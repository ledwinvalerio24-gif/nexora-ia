
'use strict';

const SUPABASE_URL = (process.env.SUPABASE_URL || '').replace(/\/+$/, '');
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY || '';
const OPENROUTER_KEY = process.env.OPENROUTER_API_KEY || '';

function send(res, status, body) {
  return res.status(status).json(body);
}

async function supabase(path, token, options = {}) {
  const response = await fetch(SUPABASE_URL + path, {
    ...options,
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${token}`,
      ...options.headers
    }
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const error = new Error(
      data?.message || data?.msg || data?.error ||
      'Error de Supabase'
    );
    error.status = response.status;
    throw error;
  }

  return data;
}

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'POST') {
    return send(res, 405, { error: 'Método no permitido.' });
  }

  if (!SUPABASE_URL || !SUPABASE_KEY || !OPENROUTER_KEY) {
    return send(res, 503, {
      error: 'Falta configurar OpenRouter o Supabase en Vercel.'
    });
  }

  const token = /^Bearer (.+)$/i.exec(
    req.headers.authorization || ''
  )?.[1];

  if (!token || token.length > 4096) {
    return send(res, 401, {
      error: 'Inicia sesión para conversar.'
    });
  }

  const body = typeof req.body === 'string'
    ? (() => {
        try { return JSON.parse(req.body); }
        catch { return {}; }
      })()
    : req.body || {};

  const conversationId = body.conversationId;

  const uuidPattern =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  if (
    typeof conversationId !== 'string' ||
    !uuidPattern.test(conversationId)
  ) {
    return send(res, 400, {
      error: 'Conversación inválida.'
    });
  }

  try {
    // Verificar identidad del usuario.
    const user = await supabase('/auth/v1/user', token);

    if (!user?.id) {
      return send(res, 401, {
        error: 'Sesión inválida.'
      });
    }

    // Comprobar que la conversación pertenece al usuario.
    const conversations = await supabase(
      '/rest/v1/conversations?id=eq.' +
      encodeURIComponent(conversationId) +
      '&select=id,user_id',
      token
    );

    if (
      !conversations?.length ||
      conversations[0].user_id !== user.id
    ) {
      return send(res, 404, {
        error: 'Conversación no encontrada.'
      });
    }

    // Recuperar los últimos mensajes.
    const history = await supabase(
      '/rest/v1/messages?conversation_id=eq.' +
      encodeURIComponent(conversationId) +
      '&select=role,content,created_at' +
      '&order=created_at.desc&limit=20',
      token
    );

    const messages = history.reverse().filter(
      m =>
        ['user', 'assistant'].includes(m.role) &&
        typeof m.content === 'string'
    );

    if (
      !messages.length ||
      messages[messages.length - 1].role !== 'user'
    ) {
      return send(res, 400, {
        error: 'Primero escribe un mensaje.'
      });
    }

    if (messages[messages.length - 1].content.length > 4000) {
      return send(res, 413, {
        error: 'El mensaje es demasiado largo.'
      });
    }

    // Mantener el límite de uso existente.
    await supabase('/rest/v1/rpc/consume_ai_quota', token, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: '{}'
    });

    // Usar el selector de modelos gratuitos de OpenRouter.
    const model = process.env.OPENROUTER_MODEL || 'openrouter/free';

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);

    let response;
    let data;

    try {
      response = await fetch(
        'https://openrouter.ai/api/v1/chat/completions',
        {
          method: 'POST',
          signal: controller.signal,
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${OPENROUTER_KEY}`
          },
          body: JSON.stringify({
            model,
            messages: [
              {
                role: 'system',
                content:
                  'Eres Nexora, un asistente inteligente, ' +
                  'creativo, claro y amigable. ' +
                  'Responde en el idioma del usuario.'
              },
              ...messages.map(m => ({
                role: m.role,
                content: m.content.slice(0, 4000)
              }))
            ],
            max_tokens: 700,
            temperature: 0.7
          })
        }
      );

      data = await response.json().catch(() => ({}));
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok) {
      console.error('OpenRouter status:', response.status);
      console.error(
        'OpenRouter error:',
        String(data?.error?.message || 'Sin detalles').slice(0, 500)
      );

      if (response.status === 401 || response.status === 403) {
        return send(res, 502, {
          error: 'Revisa la configuración de OpenRouter.'
        });
      }

      if (response.status === 402) {
        return send(res, 503, {
          error: 'El modelo requiere créditos. Revisa el modelo gratuito.'
        });
      }

      if (response.status === 429) {
        return send(res, 429, {
          error: 'Límite de OpenRouter alcanzado. Inténtalo más tarde.'
        });
      }

      return send(res, 502, {
        error: 'OpenRouter no pudo responder. Revisa los registros.'
      });
    }

    const reply = data?.choices?.[0]?.message?.content;

    if (typeof reply !== 'string' || !reply.trim()) {
      return send(res, 502, {
        error: 'El modelo no devolvió una respuesta de texto.'
      });
    }

    // Guardar respuesta en el historial privado.
    await supabase('/rest/v1/messages', token, {
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

    return send(res, 200, {
      reply: reply.slice(0, 12000)
    });

  } catch (error) {
    if (error.name === 'AbortError') {
      return send(res, 504, {
        error: 'La IA tardó demasiado. Inténtalo de nuevo.'
      });
    }

    if (error.status === 401) {
      return send(res, 401, {
        error: 'Tu sesión expiró. Inicia sesión de nuevo.'
      });
    }

    if (
      error.status === 429 ||
      /Usage limit reached/i.test(error.message)
    ) {
      return send(res, 429, {
        error: 'Límite de mensajes alcanzado.'
      });
    }

    console.error(
      'Nexora server error:',
      error.status || error.message
    );

    return send(res, 500, {
      error: 'No se pudo completar la solicitud.'
    });
  }
};
