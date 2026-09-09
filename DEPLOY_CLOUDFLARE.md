# Publicar REX Scanner en Cloudflare Pages

El proyecto ya incluye la página y la función que consulta la API de REX MU. No hace falta crear un Worker separado ni configurar variables secretas.

## 1. Crear el repositorio en GitHub

1. En GitHub, pulsa **New repository**.
2. Nombre: `REX-Scanner`.
3. Selecciona **Public**.
4. No marques README, `.gitignore` ni License, porque el proyecto ya los incluye.
5. Pulsa **Create repository**.

Después de crearlo, vuelve al chat. Codex puede cargar todos los archivos al repositorio conectado.

## 2. Conectar el repositorio en Cloudflare

1. Entra al panel de Cloudflare.
2. Abre **Workers & Pages**.
3. Pulsa **Create application**.
4. Selecciona **Pages** y luego **Connect to Git**.
5. Conecta GitHub si Cloudflare todavía no tiene autorización.
6. Selecciona el repositorio `jgomez94x/REX-Scanner`.
7. Usa esta configuración:

| Campo | Valor |
|---|---|
| Production branch | `main` |
| Framework preset | `None` |
| Build command | dejar vacío |
| Build output directory | `public` |
| Root directory | dejar vacío |

8. No agregues variables de entorno.
9. Pulsa **Save and Deploy**.

Cloudflare detectará automáticamente la carpeta `functions/` y creará la ruta `/api/character`. Cada cambio futuro en `main` se publicará solo.

## 3. Comprobar el funcionamiento

Cuando Cloudflare termine, abrirá una dirección similar a:

```text
https://rex-scanner.pages.dev
```

Busca `DONT` o `1uffy`. La ficha debe mostrar estado online, progreso, mapa, coordenadas, rankings, guild, equipo, inventario y skills.

## Si Cloudflare muestra otro formulario

Las etiquetas del panel pueden cambiar ligeramente. Lo importante es mantener:

- repositorio `jgomez94x/REX-Scanner`;
- rama `main`;
- sin comando de build;
- salida `public`;
- sin variables de entorno.

No pegues contraseñas, tokens de REX MU ni API Tokens de Cloudflare: este proyecto no los necesita.
