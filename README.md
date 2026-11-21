# Nexora AI 5.1 — Supabase Auth

Proyecto estático para Vercel con función `/api/public-config` y autenticación real de Supabase.

## Despliegue
1. Sube **el contenido de esta carpeta** a la raíz de tu repositorio GitHub (no la carpeta contenedora).
2. En Vercel → Settings → Environment Variables configura `SUPABASE_URL` (URL HTTPS del proyecto) y `SUPABASE_ANON_KEY` (publishable key `sb_publishable_...`). No uses `sb_secret_`.
3. Redeploy de Production y abre `/api/public-config` para verificar que responde JSON con URL y publishable key (ambos datos son públicos).
4. En Supabase → Authentication → URL Configuration añade la URL pública y `https://tu-dominio.vercel.app/**` a redirects. En Email activa Confirm email.
5. Prueba crear cuenta, confirmar email, iniciar y cerrar sesión.

## Alcance y seguridad
- **El registro e inicio de sesión sí usan Supabase Auth.**
- El chatbot sigue en **modo demostración**; no hay IA generativa conectada.
- El historial se guarda **solo en el navegador**, separado por ID de usuario; no se sincroniza entre dispositivos y no es almacenamiento privado robusto para datos sensibles. Para conversaciones en la nube se necesitarán tablas y políticas RLS por usuario.
- La publishable key puede estar en el navegador; las tablas deben tener RLS y políticas correctas. Nunca publiques `sb_secret_` ni `service_role`.
- Si la confirmación de email falla, revisa los ajustes de URL y los límites de envío de emails de Supabase.
- El inicio de sesión requiere conexión a Internet y acceso a esm.sh.
