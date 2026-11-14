DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'Role'
      AND t.typnamespace = current_schema()::regnamespace
      AND e.enumlabel = 'ENTE_PUBLICO'
  ) THEN
    IF EXISTS (
      SELECT 1
      FROM pg_enum e
      JOIN pg_type t ON t.oid = e.enumtypid
      WHERE t.typname = 'Role'
        AND t.typnamespace = current_schema()::regnamespace
        AND e.enumlabel = 'FUNCIONARIO'
    ) THEN
      RAISE EXCEPTION 'Role enum contains both ENTE_PUBLICO and FUNCIONARIO';
    END IF;
    ALTER TYPE "Role" RENAME VALUE 'ENTE_PUBLICO' TO 'FUNCIONARIO';
  ELSIF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'Role'
      AND t.typnamespace = current_schema()::regnamespace
      AND e.enumlabel = 'FUNCIONARIO'
  ) THEN
    RAISE EXCEPTION 'Role enum contains neither ENTE_PUBLICO nor FUNCIONARIO';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'Role'
      AND t.typnamespace = current_schema()::regnamespace
      AND e.enumlabel = 'ADMINISTRADOR'
  ) THEN
    IF EXISTS (
      SELECT 1
      FROM pg_enum e
      JOIN pg_type t ON t.oid = e.enumtypid
      WHERE t.typname = 'Role'
        AND t.typnamespace = current_schema()::regnamespace
        AND e.enumlabel = 'SUPERADMINISTRADOR'
    ) THEN
      RAISE EXCEPTION 'Role enum contains both ADMINISTRADOR and SUPERADMINISTRADOR';
    END IF;
    ALTER TYPE "Role" RENAME VALUE 'ADMINISTRADOR' TO 'SUPERADMINISTRADOR';
  ELSIF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'Role'
      AND t.typnamespace = current_schema()::regnamespace
      AND e.enumlabel = 'SUPERADMINISTRADOR'
  ) THEN
    RAISE EXCEPTION 'Role enum contains neither ADMINISTRADOR nor SUPERADMINISTRADOR';
  END IF;
END $$;