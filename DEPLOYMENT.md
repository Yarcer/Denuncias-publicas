# Publicación gratuita y seguridad

La publicación propuesta usa:

- **Cloudflare Pages** para el frontend, con una dirección `*.pages.dev` y HTTPS, o **Workers** si Pages no está disponible en el panel, con una dirección `*.workers.dev`.
- **Render** para la API, con una dirección `*.onrender.com` y plan gratuito.
- **Neon** para PostgreSQL y **Cloudflare R2** para evidencias privadas.

Los planes gratuitos tienen límites y pueden cambiar. El servicio gratuito de Render puede suspenderse cuando no se usa; la primera solicitud después de una pausa puede demorar. No es un SLA para un servicio público crítico.

La dirección será un subdominio gratuito `*.pages.dev` o `*.workers.dev`, según la plataforma, si el nombre está disponible. No es un dominio `.com` propio ni queda reservado hasta que crees el proyecto en Cloudflare.

## 1. Subir el repositorio

Sube el proyecto a un repositorio privado de GitHub. No subas archivos `.env`, contraseñas, claves ni evidencias. El archivo `pnpm-lock.yaml` debe quedar incluido para que las plataformas puedan instalar las mismas dependencias.

## 2. Crear la base de datos

1. Crea un proyecto PostgreSQL en Neon.
2. Copia la cadena de conexión con SSL (`sslmode=require`) y guárdala como secreto; no la publiques.
3. Conserva esa cadena para la variable `DATABASE_URL` de Render.

## 3. Preparar evidencias privadas

1. Crea un bucket privado en Cloudflare R2; no habilites acceso público ni dominios públicos para el bucket.
2. Genera credenciales limitadas a ese bucket y anótalas en un gestor de contraseñas.
3. Guarda el endpoint, nombre del bucket, `Access Key ID` y `Secret Access Key`; Render los pedirá como variables secretas.
4. La API mantiene la autorización de cada denuncia antes de leer una imagen. No compartas enlaces públicos de R2.

## 4. Desplegar la API

1. Elige primero el nombre de tu sitio; luego usarás su URL pública completa como origen CORS en Render.
2. En Render, crea un **Blueprint** desde el repositorio y acepta la configuración de `render.yaml`.
3. Completa los campos `DATABASE_URL`, `CORS_ORIGIN`, `R2_ENDPOINT`, `R2_BUCKET`, `R2_ACCESS_KEY_ID` y `R2_SECRET_ACCESS_KEY`.
4. Despliega la API. Render genera el secreto JWT automáticamente.
5. Comprueba `https://<tu-api>.onrender.com/api/health`.

`CORS_ORIGIN` debe ser el origen HTTPS exacto de la web publicada (`*.pages.dev` o `*.workers.dev`), sin ruta final. Las migraciones y categorías iniciales se preparan al iniciar la API. En producción el seed no crea usuarios demo; mantén una sola instancia mientras uses este comando de arranque.

## 5. Desplegar el frontend

### Cloudflare Pages

En Cloudflare Pages, crea el proyecto con el nombre elegido, conecta el repositorio y configura:

- **Build command:** `pnpm install --frozen-lockfile --prod=false && pnpm --filter frontend build`
- **Build output directory:** `frontend/dist`
- **Variable de entorno de producción:** `VITE_API_URL=https://<tu-api>.onrender.com/api`

Tras el primer despliegue, configura `CORS_ORIGIN` en Render con el origen real de Pages (`https://<nombre>.pages.dev`) o Workers (`https://<nombre>.<subdominio>.workers.dev`) y vuelve a desplegar la API. Pages aplica automáticamente el fallback SPA; en Workers el fallback está definido por Wrangler.

### Cloudflare Workers

Si el panel solo permite crear Workers, despliega el frontend estático como Worker con la configuración incluida en `frontend/wrangler.jsonc`:

- Conecta `Yarcer/Denuncias-publicas` desde **Workers & Pages → Create application → Worker → Connect to Git**.
- **Root directory:** `frontend`
- **Build command:** `pnpm install --frozen-lockfile --prod=false && pnpm build`
- **Deploy command:** `pnpm exec wrangler deploy`
- Agrega `VITE_API_URL=https://<tu-api>.onrender.com/api` en las variables de build del entorno **Production**.

El Worker `denuncias-publicas` sirve el frontend compilado en `frontend/dist` y configura fallback SPA para las rutas de React. Si ya creaste un Worker con otro nombre, cambia `name` en `frontend/wrangler.jsonc` para que coincida.

Los builds de producción fallan deliberadamente si falta `VITE_API_URL` o si no es una URL HTTPS terminada en `/api`.

## Seguridad antes de recibir denuncias reales

- No uses las cuentas ni contraseñas de demostración en producción. Crea cuentas administrativas nuevas con contraseñas únicas.
- Para habilitar gestión, registra primero tu propia cuenta y cambia solo esa cuenta a `ADMINISTRADOR` desde la consola SQL privada de Neon: `UPDATE "User" SET role = 'ADMINISTRADOR' WHERE email = 'tu-correo@example.com' AND role = 'CIUDADANO';`. Confirma que la consulta afectó exactamente una fila y luego inicia sesión en el portal de gestión.
- Guarda credenciales solo en los paneles de los proveedores; nunca en el repositorio, código frontend o mensajes.
- Activa MFA en las cuentas de GitHub, Cloudflare, Render y Neon; limita quién administra el proyecto.
- Configura una política de privacidad, retención y eliminación de denuncias/evidencias, y confirma que el proveedor y la ubicación de datos cumplen los requisitos legales aplicables.
- Verifica copias de seguridad y recuperación de la base de datos antes de operar.
- El plan gratuito no garantiza disponibilidad ni soporte. No lo uses para emergencias o información cuya pérdida o exposición pueda poner a alguien en riesgo.

En producción la API rechaza secretos JWT débiles, orígenes CORS que no sean HTTPS, conexiones PostgreSQL sin SSL y almacenamiento de evidencias distinto de R2. En desarrollo local se conserva el almacenamiento en disco.
