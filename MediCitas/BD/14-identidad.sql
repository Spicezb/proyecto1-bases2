
-- Obtener el contexto de un usuario autenticado en Keycloak.
-- El argumento es el identificador vinculado con Keycloak,
-- nunca un userid escogido por el cliente.

CREATE OR REPLACE FUNCTION public.obtenercontextousuario(
    p_providerid VARCHAR
)
RETURNS TABLE (
    userid INT,
    clinicid INT,
    roleid INT,
    rolename VARCHAR
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $$
    SELECT
        u.userid,
        u.clinicid,
        u.roleid,
        r.name AS rolename
    FROM public.users u
    JOIN public.roles r
      ON r.roleid = u.roleid
    WHERE u.providerid = p_providerid
      AND u.isactive = TRUE
      AND r.isactive = TRUE
      AND (
          (r.name = 'administrador de plataforma'
           AND u.clinicid IS NULL)
          OR
          (r.name <> 'administrador de plataforma'
           AND EXISTS (
               SELECT 1
               FROM public.clinics c
               WHERE c.clinicid = u.clinicid
                 AND c.isactive = TRUE
           ))
      );
$$;

-- Evitar que cualquier usuario pueda ejecutar la función.
REVOKE ALL ON FUNCTION public.obtenercontextousuario(VARCHAR)
FROM PUBLIC;

-- Los cuatro perfiles necesitan resolver su identidad.
GRANT EXECUTE ON FUNCTION public.obtenercontextousuario(VARCHAR)
TO
    rol_admin_general,
    rol_admin_clinica,
    rol_recepcion,
    rol_profesional;

-- Impedir que usuarios no autorizados creen objetos en public
REVOKE CREATE ON SCHEMA public FROM PUBLIC;

-- Ejecutar la función con los permisos de su propietario
ALTER FUNCTION public.consultarprofesionales(INTEGER, INTEGER)
SECURITY DEFINER;

-- Fijar la búsqueda de objetos SQL
ALTER FUNCTION public.consultarprofesionales(INTEGER, INTEGER)
SET search_path = pg_catalog, public, pg_temp;
