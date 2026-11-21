
'use strict';

const base = () =>
  String(process.env.SUPABASE_URL || '').replace(/\/+$/, '');

const publicKey = () => process.env.SUPABASE_ANON_KEY || '';

const json = (res, status, body) =>
  res.status(status).json(body);

async function sb(path, token, options = {}) {
  const response = await fetch(base() + path, {
    ...options,
    headers: {
      apikey: publicKey(),
      Authorization: 'Bearer ' + token,
      ...options.headers
    }
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw Object.assign(
      new Error(data?.message || data?.msg || 'Error de Supabase'),
      { status: response.status }
    );
  }

  return data;
}

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'POST') {
    return json(res, 405, { error: 'Método no permitido' });
  }

  if (!process.env.GEMINI_API_KEY || !base() || !publicKey()) {
    return json(res, 503, {
      error: 'Faltan variables de entorno en Vercel.'
    });
  }

  const token = /^Bearer (.+)$/i.exec(
    req.headers.authorization || ''
  )?.[1];

  if (!token || token.length > 4096) {
    return json(res, 401, { error: 'Inicia sesión.' });
  }

  const conversationId = req.body?.conversationId;

  if (
    typeof conversationId !== 'string' ||
    !/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(conversationId)
  ) {
    return json(res, 400, { error: 'Conversación inválida.' });
  }

  try {
    const user = await sb('/auth/v1/user', token);

    if (!user?.id) {
      return json(res, 401, { error: 'Sesión no válida.' });
    }

    const rows = await sb(
      '/rest/v1/conversations?id=eq.' +
      encodeURIComponent(conversationId) +
      '&select=id,user_id',
      token
    );

    if (!rows?.length || rows[0].user_id !== user.id) {
      return json(res, 404, {
        error: 'Conversación no encontrada.'
      });
    }

    const history = await sb(
      '/rest/v1/messages?conversation_id=eq.' +
      encodeURIComponent(conversationId) +
      '&select=role,content,created_at&order=created_at.desc&limit=20',
      token
    );

    const ordered = history.reverse().filter(
      x =>
        ['user', 'assistant'].includes(x.role) &&
        typeof x.content === 'string'
    );

    if (!ordered.length || ordered.at(-1).role !== 'user') {
      return json(res, 400, {
        error: 'Escribe un mensaje antes de pedir una respuesta.'
      });
    }

    if (ordered.at(-1).content.length > 4000) {
      return json(res, 400, {
        error: 'Mensaje demasiado largo.'
      });
    }

    await sb('/rest/v1/rpc/consume_ai_quota', token, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}'
    });

    const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

    if (!/^gemini-[a-z0-9.-]+$/.test(model)) {
      return json(res, 503, {
        error: 'Modelo Gemini inválido.'
      });
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 24000);

    let response;
    let answer;

    try {
      response = await fetch(
        'https://generativelanguage.googleapis.com/v1beta/models/' +
        model + ':generateContent',
        {
          method: 'POST',
          signal: controller.signal,
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': process.env.GEMINI_API_KEY
          },
          body: JSON.stringify({
            systemInstruction: {
              parts: [{
                text: 'Eres Nexora, un asistente útil, claro y amigable. Responde en el idioma del usuario.'
              }]
            },
            contents: ordered.map(x => ({
              role: x.role === 'assistant' ? 'model' : 'user',
              parts: [{ text: x.content.slice(0, 4000) }]
            })),
            generationConfig: {
              maxOutputTokens: 900,
              temperature: 0.7
            }
          })
        }
      );

      answer = await response.json().catch(() => ({}));
    } finally {
      clearTimeout(timer);
    }

    if (!response.ok) {
      console.error('Gemini status:', response.status);

      return json(res, response.status === 429 ? 429 : 502, {
        error: response.status === 429
          ? 'Gemini alcanzó su límite de solicitudes.'
          : 'Gemini no pudo responder. Revisa la clave y el modelo.'
      });
    }

    const reply = (
      answer.candidates?.[0]?.content?.parts || []
    ).map(p => p.text || '').join('').trim();

    if (!reply) {
      return json(res, 502, {
        error: 'Gemini no devolvió texto.'
      });
    }

    await sb('/rest/v1/messages', token, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Prefer: 'return=minimal'
      },
      body: JSON.stringify({
        conversation_id: conversationId,
        user_id: user.id,
        role: 'assistant',
        content: reply.slice(0, 12000)
      })
    });

    return json(res, 200, {
      reply: reply.slice(0, 12000)
    });

  } catch (error) {
    if (error.name === 'AbortError') {
      return json(res, 504, {
        error: 'La IA tardó demasiado.'
      });
    }

    if (error.status === 401) {
      return json(res, 401, {
        error: 'Tu sesión expiró.'
      });
    }

    if (
      error.status === 429 ||
      /Usage limit reached/i.test(error.message)
    ) {
      return json(res, 429, {
        error: 'Límite de mensajes alcanzado.'
      });
    }

    console.error('Chat server error:', error.status || error.message);

    return json(res, 500, {
      error: 'No se pudo completar la solicitud.'
    });
  }
};
