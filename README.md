# Nexora AI 5.2 — Gemini + Supabase

Actualización del proyecto 5.1. Incluye interfaz existente, autenticación con Supabase, IA Gemini en función Vercel y conversaciones privadas en Postgres protegidas con RLS.

## 1. Subir a GitHub
Sube **los archivos que están dentro de esta carpeta** a la raíz del repositorio. Conserva `api/`, `supabase/`, `index.html`, `auth.js`, `app.js`, `styles.css` y `vercel.json`. No subas credenciales ni un archivo `.env`.

## 2. Preparar Supabase
En Supabase > SQL Editor, pega y ejecuta TODO `supabase/setup.sql`. Esto crea tablas `conversations`, `messages`, `ai_usage`, políticas RLS y la función de cuotas. Si no se ejecuta el SQL, el historial y el chat NO funcionarán.
En Authentication > URL Configuration configura tu dominio de Production y redirects autorizados. Mantén Email Provider y Confirm email habilitados.

## 3. Variables de entorno en Vercel (Production)
- `SUPABASE_URL`: `https://TU-PROYECTO.supabase.co` (sin `/rest/v1/`)
- `SUPABASE_ANON_KEY`: clave **publishable** (`sb_publishable_...`) de ESE proyecto. Ya estaba configurada en 5.1.
- `GEMINI_API_KEY`: clave privada de Gemini autorizada, solo en Vercel, **nunca en GitHub ni navegador**.
- `GEMINI_MODEL`: opcional, por defecto `gemini-2.5-flash`. Comprueba en AI Studio qué modelos y cuotas están disponibles en tu cuenta.

Luego Redeploy de Production. No pongas `sb_secret_` ni `service_role` en el frontend. `/api/public-config` expone solamente datos públicos de Supabase.

## 4. Probar
1. Abre la app y entra a tu cuenta ya verificada.
2. Envía un mensaje. La respuesta de Gemini puede tardar unos segundos.
3. Recarga la página: el historial debería persistir.
4. Prueba otra cuenta para comprobar que no ve el historial de la primera.
5. Si falla, revisa Vercel > Logs, las tablas y políticas de Supabase, el modelo y la cuota de Gemini.

## Notas importantes
- El nivel gratuito de Gemini **no es ilimitado** y depende del modelo, región y cuenta. Revisa las condiciones de privacidad y uso de datos del proveedor antes de enviar información personal.
- El backend valida la sesión con Supabase Auth, consulta conversaciones bajo RLS y nunca expone GEMINI_API_KEY.
- Cuotas por cuenta: máximo **30 respuestas al día y 5 por minuto** (controladas atómicamente en Supabase). Los límites de Gemini son independientes y pueden ser más restrictivos. No sustituye protecciones antiabuso a escala de producción.
- El frontend utiliza el cliente Supabase importado desde esm.sh; necesita conexión a Internet.
- El chat envía a Gemini hasta los últimos 20 mensajes de la conversación. Las conversaciones se guardan en Supabase. Al borrar historial se eliminan sus mensajes por cascada.
- El esquema permite a los usuarios insertar mensajes con rol `assistant` en sus propias conversaciones; no se debe tratar el historial como un registro de auditoría fiable.
- Si el servidor Gemini falla tras guardar el mensaje del usuario, este queda en historial; puedes enviar un nuevo mensaje para continuar.
- El historial local de la versión 5.1 **no se migra automáticamente**.
- Usa una cuenta y credenciales con acceso autorizado al proveedor. No compartas contraseñas ni claves.
