# Nexora AI 6.1 — Inicio, Chat, Herramientas y Planes

## Qué incluye
- `index.html`: página principal.
- `chat.html`: chat con autenticación Supabase, historial y OpenRouter (se conserva el código de 6.0).
- `tools.html`: cinco formularios de escritura, estudio, programación, planificación y creatividad. Construyen un prompt y abren el chat con el texto precargado; **no lo envían automáticamente**.
- `plans.html`: comparativa Free, Plus y Pro. **Plus y Pro son propuestas, no se pueden comprar**.

## Publicar en GitHub y Vercel
1. Descomprime el ZIP. Sube **todos los archivos y la carpeta `api`** directamente a la raíz de tu repositorio. No subas la carpeta contenedora.
2. Si hay archivos antiguos con los mismos nombres, confirma que GitHub los reemplaza. Evita subir una subcarpeta `nexora-ia-main` o `nexora61`.
3. Espera el despliegue de Vercel (Root Directory = raíz del repositorio).
4. Mantén en Vercel las variables de entorno `OPENROUTER_API_KEY`, `SUPABASE_URL`, `SUPABASE_ANON_KEY` y, opcionalmente, `OPENROUTER_MODEL`. Nunca publiques claves privadas en GitHub.
5. Prueba Inicio → Herramientas → Continuar en el chat → Enviar. Prueba también Planes.
6. No vuelvas a ejecutar `setup.sql` si Supabase ya funciona.

**Importante:** No se han implementado pagos, control de membresías ni nuevas capacidades del modelo. Las herramientas utilizan el chat existente. Los servicios de IA pueden fallar o tener límites.
