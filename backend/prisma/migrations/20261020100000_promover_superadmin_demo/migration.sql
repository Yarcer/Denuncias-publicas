UPDATE "User"
SET "role" = 'SUPERADMINISTRADOR'
WHERE "email" = 'admin@denuncias.local'
  AND "role" = 'ADMINISTRADOR';