# Denuncias Públicas

Plataforma para registrar denuncias ciudadanas y permitir que entes públicos y administradores las gestionen.

## Requisitos

- Node.js
- pnpm 10+
- Docker Desktop

## Instalación

Desde la raíz del proyecto:

```powershell
pnpm install
```

El backend necesita un archivo `backend/.env`. Usa esta configuración para desarrollo local:

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/reportes_db?schema=public"
PORT=3000
NODE_ENV=development
JWT_SECRET=dev_secret_change_me_in_production
JWT_EXPIRES_IN=1h
CORS_ORIGIN=http://localhost:5173
```

Para enviar confirmaciones por correo, configura también los datos de tu proveedor SMTP en `backend/.env`:

```env
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=usuario-smtp
SMTP_PASSWORD=contraseña-smtp
SMTP_FROM="Denuncias Públicas <no-reply@example.com>"
```

`SMTP_HOST`, `SMTP_PORT` y `SMTP_FROM` son obligatorios en conjunto; `SMTP_USER` y `SMTP_PASSWORD` también deben configurarse juntos. El puerto 465 usa TLS implícito. Sin SMTP configurado, la denuncia se registra normalmente y la pantalla informa que no se pudo enviar el correo. Las sesiones anónimas no reciben correo.

## Iniciar PostgreSQL

Abre Docker Desktop y espera a que el motor esté listo. Después crea el contenedor:

```powershell
docker run --name denuncias-postgres `
  -e POSTGRES_USER=postgres `
  -e POSTGRES_PASSWORD=postgres `
  -e POSTGRES_DB=reportes_db `
  -p 5432:5432 `
  -d postgres:16
```

Si el contenedor ya existe, solo inícialo:

```powershell
docker start denuncias-postgres
```

Para comprobarlo:

```powershell
docker ps --filter "name=denuncias-postgres"
```

Para detener PostgreSQL:

```powershell
docker stop denuncias-postgres
```

## Base de datos y usuarios demo

Ejecuta estos comandos desde la raíz `Denuncias-publicas`:

```powershell
pnpm --dir backend exec prisma migrate dev --name initial_schema
pnpm --dir backend db:seed
```

El seed crea estas cuentas:

| Rol | Correo | Contraseña |
|---|---|---|
| Administrador | `admin@denuncias.local` | `Admin123!` |
| Ente público | `ente@denuncias.local` | `Ente123!` |
| Funcionario del ente | `funcionario@denuncias.local` | `Funcionario123!` |

No uses estas contraseñas en producción.

## Ejecutar el proyecto

Desde la raíz:

```powershell
pnpm dev
```

URLs locales:

- Frontend: http://localhost:5173/
- API: http://localhost:3000/api
- Health check: http://localhost:3000/api/health

También se pueden iniciar por separado:

```powershell
pnpm --dir backend start:dev
pnpm --dir frontend dev
```

## Funciones disponibles

### Ciudadano o visitante

- Registrarse e iniciar sesión desde `/login`.
- Entrar como visitante mediante una sesión temporal.
- Crear denuncias.
- Recibir un identificador de seguimiento y consultar sus propias denuncias.
- Llamar a emergencias, bomberos o asistencia médica desde los accesos directos.

### Ente público

- Iniciar sesión desde `/gestion/login` con una cuenta institucional.
- Ver la bandeja de denuncias activas.
- Filtrar por estado.
- Tomar una denuncia o asignarla a un funcionario activo del mismo ente.
- Marcarla como `EN_REVISION`, `RESUELTO` o `RECHAZADO`.

### Administrador

- Iniciar sesión desde `/gestion/login`.
- Ver la bandeja completa.
- Consultar los indicadores generales de denuncias: totales recibidos, pendientes y resueltos; distribución por categoría, organismo y estado; y evolución mensual de los últimos 12 meses.
- Gestionar denuncias y estados.
- Consultar los cambios registrados en el historial.

Las operaciones de gestión de categorías y usuarios están restringidas a administradores. En la bandeja de administración, la sección **Asignación automática** permite definir el organismo responsable de cada categoría. Al crear una denuncia, el backend comprueba que el tipo coincida con la categoría y la asigna al funcionario activo más antiguo cuyo nombre de organismo coincida; si no hay regla o funcionario activo, queda pendiente.

La prioridad también se calcula en el backend a partir de `Category.defaultPriority`, cuyo valor inicial es `MEDIA` para todas las categorías. Un administrador puede cambiarla con `PATCH /api/categorias/:id` enviando, por ejemplo, `{"defaultPriority":"ALTA"}`; los valores aceptados son `BAJA`, `MEDIA`, `ALTA` y `URGENTE`. La API no acepta prioridad en el registro ni en la edición de denuncias por ciudadanos. No se aplican reglas de urgencia basadas en situaciones hasta que esos criterios sean aprobados.

Para aplicar las nuevas columnas, ejecuta `npx prisma migrate deploy` desde `backend`. El seed de desarrollo configura las categorías demo para `Municipalidad Demo`; en producción no asigna un organismo automáticamente. La botonera telefónica usa los números uruguayos 911, 104 y 105.

## Solución de problemas

### La API responde que PostgreSQL no está disponible

Comprueba que Docker Desktop esté abierto y ejecuta:

```powershell
docker start denuncias-postgres
```

Después comprueba el health check:

```powershell
Invoke-WebRequest -UseBasicParsing http://localhost:3000/api/health
```

### La base de datos no existe o las tablas faltan

Ejecuta nuevamente:

```powershell
pnpm --dir backend exec prisma migrate dev --name initial_schema
pnpm --dir backend db:seed
```

### El backend usa otra base de datos

Asegúrate de que `backend/.env` use `reportes_db` y reinicia el backend. La variable `DATABASE_URL` debe coincidir con la base creada en Docker.

## Compilación

```powershell
pnpm build
```

## Publicar la página

La guía para publicarla con planes gratuitos, dominio `pages.dev` y medidas de seguridad está en [DEPLOYMENT.md](./DEPLOYMENT.md). Antes de usar datos reales, configura la base de datos y el bucket privado de evidencias indicados allí.

## Estado del proyecto

La migración inicial está en `backend/prisma/migrations`. Los endpoints de autenticación, denuncias y gestión de estados están implementados. Evidencias, comentarios avanzados y administración completa de categorías/usuarios quedan como trabajo posterior.
