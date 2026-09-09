# REX Scanner

Inspector público de personajes de REX MU. Consulta estado online, progreso, ubicación, estadísticas, ranking, guild, equipo, inventario y skills sin guardar credenciales del juego.

## Despliegue recomendado

El proyecto está preparado para Cloudflare Pages:

- Directorio de salida: `public`
- Functions: detectadas automáticamente desde `functions/`
- Comando de build: dejar vacío
- Variables de entorno: ninguna

La función `functions/api/character.js` consulta la API oficial desde el servidor de Cloudflare, evitando la restricción CORS del navegador. Solo acepta nombres de personaje válidos y solicitudes GET.

## Privacidad

La interfaz no muestra seriales de objetos, contraseñas, tokens ni datos privados de cuenta. Todas las fuentes consultadas son endpoints públicos de REX MU.

## Desarrollo local

```bash
npm run check
npm run dev
```
