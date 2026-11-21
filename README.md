# Nexora AI 5.0
Aplicación web estática en español, sin dependencias externas.

## Contenido
- index.html: interfaz
- styles.css: diseño responsive
- app.js: chat de demostración e historial local
- vercel.json: configuración de despliegue

## Uso
Abre index.html en el navegador para probarla. Para publicarla en Vercel, importa una carpeta o repositorio con estos archivos en la raíz y selecciona Framework Preset: Other. No requiere variables de entorno ni comando de compilación.

## Importante
Este proyecto es una reconstrucción nueva, no una copia recuperada de una versión anterior. El chatbot es una demostración basada en respuestas locales, no está conectado a un modelo de IA. Los chats se guardan únicamente en localStorage de este navegador; no hay registro de cuentas ni sincronización entre dispositivos. Para habilitar respuestas de IA reales, integra una función de servidor que mantenga las claves API fuera del navegador.
