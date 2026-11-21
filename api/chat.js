const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Método no permitido"
    });
  }

  try {
    if (!SUPABASE_URL || !SUPABASE_KEY || !GEMINI_API_KEY) {
      return res.status(500).json({
        error: "Faltan variables de entorno"
      });
    }

    const token = (req.headers.authorization || "")
      .match(/^Bearer (.+)$/i)?.[1];

    if (!token) {
      return res.status(401).json({
        error: "Debes iniciar sesión"
      });
    }

    const authResponse = await fetch(
      `${SUPABASE_URL.replace(/\/$/, "")}/auth/v1/user`,
      {
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${token}`
        }
      }
    );

    if (!authResponse.ok) {
      return res.status(401).json({
        error: "Sesión inválida o expirada"
      });
    }

    const user = await authResponse.json();

    if (!user.id) {
      return res.status(401).json({
        error: "Usuario no válido"
      });
    }

    const body = typeof req.body === "string"
      ? JSON.parse(req.body)
      : req.body || {};

    const message = body.message;

    if (typeof message !== "string" || !message.trim()) {
      return res.status(400).json({
        error: "Escribe un mensaje"
      });
    }

    if (message.length > 12000) {
      return res.status(413).json({
        error: "Mensaje demasiado largo"
      });
    }

    const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";

    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": GEMINI_API_KEY
        },
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [{ text: message.trim() }]
            }
          ],
          generationConfig: {
            maxOutputTokens: 1024
          }
        })
      }
    );

    if (!geminiResponse.ok) {
      console.error("Gemini HTTP status:", geminiResponse.status);

      return res.status(502).json({
        error: "No se pudo obtener respuesta de Gemini"
      });
    }

    const data = await geminiResponse.json();

    const reply = data.candidates?.[0]?.content?.parts
      ?.filter(part => typeof part.text === "string")
      .map(part => part.text)
      .join("") || "";

    if (!reply) {
      return res.status(502).json({
        error: "Gemini no devolvió texto"
      });
    }

    return res.status(200).json({
      reply,
      response: reply
    });

  } catch (error) {
    console.error("Nexora API error:", error.message);

    return res.status(500).json({
      error: "Error interno de Nexora"
    });
  }
}
