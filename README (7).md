# Nexora AI 5.2 — OpenRouter + Supabase

Proyecto revisado y corregido a partir del ZIP original. Mantiene interfaz, registro e inicio de sesión, historial privado y renderizado seguro de respuestas Markdown.

## Subir a GitHub

Sube el **contenido de esta carpeta** a la raíz del repositorio, conservando la carpeta `api/`. En GitHub, reemplaza los archivos existentes y elimina `index (1).html` si todavía aparece. El archivo que sirve Vercel es `index.html`. No subas claves privadas.

## Variables de Vercel → Settings → Environment Variables

Configura estas variables para **Production**:

- `SUPABASE_URL`: `https://TU-PROYECTO.supabase.co`
- `SUPABASE_ANON_KEY`: clave pública `sb_publishable_...` o `eyJ...`
- `OPENROUTER_API_KEY`: clave secreta de OpenRouter. No poner en HTML, JavaScript del navegador ni GitHub.
- `OPENROUTER_MODEL` (opcional): por defecto `openrouter/free`. Puedes elegir un identificador válido habilitado para tu cuenta.

**Importante:** La clave OpenRouter debe estar habilitada y con un límite de gasto compatible con el uso previsto. Una clave con límite de crédito total 0 puede rechazar solicitudes. Los modelos gratuitos pueden tener límites o no estar disponibles temporalmente.

Después de guardar variables, realiza **Redeploy** de Production.

## Base de datos

Si ya ejecutaste `setup.sql` y el historial funciona, no hace falta volver a crear las tablas. Si es una instalación nueva, ejecuta `setup.sql` en Supabase → SQL Editor. Configura las URL de redirección en Supabase Auth.

## Pruebas

1. Abre el dominio de Production, actualiza con Ctrl+F5 y entra con tu cuenta.
2. Envía `Hola Nexora, preséntate en una frase`.
3. Comprueba que llega la respuesta y que sigue ahí tras recargar.
4. Comprueba que otra cuenta no ve las conversaciones anteriores.
5. Si falla, abre Vercel → Logs → `/api/chat` y revisa el código HTTP y el mensaje.

## Cambios de esta corrección

- Reparada la llave duplicada en `api/chat.js` que causaba `SyntaxError: Unexpected token '}'`.
- Aumentado a 45 segundos el timeout de OpenRouter.
- Mensaje específico si el modelo de OpenRouter no existe (404).
- Frontend tolera respuestas no JSON del servidor y muestra un error entendible.
- Eliminada la página HTML duplicada que no se utiliza.
- Actualizadas las etiquetas visibles para indicar OpenRouter en lugar de Gemini.

## Seguridad y limitaciones

La clave privada solo se usa en `api/chat.js` en Vercel. Las consultas de historial usan el token de la sesión Supabase y las políticas RLS. `setup.sql` aplica cuotas de 30 solicitudes por día y 5 por minuto por usuario. El proveedor puede imponer límites adicionales. Este ZIP pasa verificaciones locales de sintaxis y estructura, pero para confirmar el servicio completo hay que desplegarlo con las credenciales reales.
