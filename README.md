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

Abre Docker Desktop y espera a que el motor esté listo. Si ya existe el contenedor,
inícialo:

```powershell
docker start denuncias-postgres
```

En una instalación nueva, créalo:

```powershell
docker run --name denuncias-postgres `
  -e POSTGRES_USER=postgres `
  -e POSTGRES_PASSWORD=postgres `
  -e POSTGRES_DB=reportes_db `
  -p 5432:5432 `
  -d postgres:16
```

También puedes usar Docker Compose; ese método publica PostgreSQL en el puerto
5433, por lo que `DATABASE_URL` debe apuntar a `localhost:5433`:

```powershell
docker compose up -d
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
pnpm --dir backend exec prisma migrate deploy
pnpm --dir backend db:seed
```

El seed crea estas cuentas:

| Rol | Correo | Contraseña |
|---|---|---|
| Superadministrador | `admin@denuncias.local` | `Admin123!` |
| Administrador de ente | `ente@denuncias.local` | `Ente123!` |
| Funcionario | `funcionario@denuncias.local` | `Funcionario123!` |

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
- Crear denuncias, recibir prioridad automática y derivación al organismo correspondiente.
- Recibir el identificador de seguimiento en pantalla y confirmación por email cuando la cuenta tenga correo y SMTP esté configurado.
- Consultar sus propias denuncias.
- Llamar a emergencias, bomberos o asistencia médica desde los accesos directos.

### Ente público

- Iniciar sesión desde `/gestion/login` con una cuenta institucional.
- Ver la bandeja de denuncias activas.
- Filtrar por estado.
- Tomar una denuncia o asignarla a un funcionario activo del mismo ente.
- Marcarla como `EN_REVISION`, `RESUELTO` o `RECHAZADO`.

### Administrador

- Iniciar sesión desde `/gestion/login`.
- Consultar estadísticas generales por fechas, estado, tipo, prioridad y evolución mensual.
- Gestionar denuncias y estados.
- Consultar los cambios registrados en el historial.

Las estadísticas generales están restringidas al superadministrador. Las denuncias se derivan a Municipalidad Demo (URBANO), bombero demo (BOMBEROS) o policia demo (POLICIAL) si existe una cuenta institucional activa para ese organismo; en caso contrario quedan sin asignar y disponibles para gestión institucional. El seed configura Municipalidad Demo; bombero demo y policia demo deben configurarse desde la administración de funcionarios. La prioridad se calcula según términos de riesgo del título y descripción; las denuncias anónimas reciben prioridad baja. Las operaciones de gestión de categorías y usuarios están restringidas a administradores. La asignación interna requiere cuentas activas del mismo organismo; el seed incluye un funcionario demo para probar ese flujo. La botonera telefónica usa los números uruguayos 911, 104 y 105.

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
