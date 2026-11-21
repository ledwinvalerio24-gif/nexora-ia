NEXORA AI 6.3 - Supabase

1. Antes de cambiar archivos, guarda una copia de tu panel.js actual.
2. En Supabase > SQL Editor, ejecuta setup-business.sql una sola vez.
3. En GitHub, reemplaza SOLO panel.js en la raiz del repositorio por el panel.js de este ZIP.
4. Espera a que Vercel publique la actualizacion.
5. Inicia sesion en chat.html, vuelve a panel.html y prueba crear un cliente y una cita.
6. Recarga el panel: los datos deberian permanecer en Supabase.

ATENCION:
- Los registros del prototipo 6.2 siguen en localStorage bajo nexora62-demo-v1. No se importan automaticamente ni se eliminan.
- El panel requiere la misma cuenta de Supabase que el chat.
- El esquema de esta version admite UN negocio por cuenta. En futuras versiones se pueden agregar equipos y multiples negocios.
- Los recursos distinguen mayusculas/minusculas (Principal y principal son diferentes). Usa nombres consistentes.
- No ingreses datos reales de clientes hasta verificar el acceso, la privacidad y los permisos de tu despliegue.
- Si tu base ya contiene tablas con estos nombres, revisa el SQL antes de ejecutarlo.
