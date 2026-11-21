# Nexora AI 6.0 — Inicio + Chat

**Página principal:** `index.html` (Home). **Chat funcional:** `chat.html`. Las tarjetas de herramientas llevan al chat con una sugerencia precargada, que el usuario decide enviar.

## Instalación

1. Subir **el contenido de esta carpeta** a la raíz del repositorio de GitHub, incluyendo `api/`. No subir la carpeta contenedora.
2. Vercel debe utilizar la raíz del repositorio como Root Directory (`.`), con framework Other si se requiere.
3. Mantener en Vercel las variables `OPENROUTER_API_KEY`, `SUPABASE_URL` y `SUPABASE_ANON_KEY` (y opcional `OPENROUTER_MODEL`). No poner claves secretas en archivos públicos.
4. Esperar despliegue Ready y probar `index.html` → Chat → enviar un mensaje.
5. No hace falta volver a ejecutar `setup.sql` si las tablas y políticas ya funcionan.

La página de planes solo informa sobre funciones futuras; **no procesa pagos ni activa membresías**. Las tarjetas de herramientas son atajos al chat, no servicios independientes.

## Seguridad

Conservar las políticas RLS de Supabase y verificar límites de uso antes de abrir el producto al público. Nunca subir secretos al repositorio.
