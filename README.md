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

- Registrarse e iniciar sesión.
- Entrar como visitante mediante una sesión temporal.
- Crear denuncias.
- Consultar sus propias denuncias.

### Ente público

- Iniciar sesión con la cuenta demo.
- Ver la bandeja de denuncias activas.
- Filtrar por estado.
- Tomar una denuncia.
- Marcarla como `EN_REVISION`, `RESUELTO` o `RECHAZADO`.

### Administrador

- Ver la bandeja completa.
- Gestionar denuncias y estados.
- Consultar los cambios registrados en el historial.

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

## Estado del proyecto

La migración inicial está en `backend/prisma/migrations`. Los endpoints de autenticación, denuncias y gestión de estados están implementados. Evidencias, comentarios avanzados y administración completa de categorías/usuarios quedan como trabajo posterior.
