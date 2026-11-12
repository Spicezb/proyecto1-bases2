-- CLÍNICAS Y USUARIOS -----------------------------------------------------------------------
DROP PROCEDURE IF EXISTS public.crearclinica(
    INT,
    VARCHAR,
    VARCHAR,
    VARCHAR,
    VARCHAR,
    VARCHAR,
    VARCHAR,
    VARCHAR,
    VARCHAR
);

CREATE PROCEDURE public.crearclinica(
    IN p_platformuserid INT,
    IN p_name VARCHAR(100),
    IN p_timezone VARCHAR(50),
    IN p_adminproviderid VARCHAR(255),
    IN p_adminidentification VARCHAR(12),
    IN p_adminname VARCHAR(25),
    IN p_adminlastname VARCHAR(25),
    IN p_adminemail VARCHAR(100),
    IN p_adminphone VARCHAR(20),
    OUT p_clinicid INT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
BEGIN
    -- Validar al administrador de plataforma
    IF NOT EXISTS (
        SELECT 1
        FROM public.users
        WHERE userid = p_platformuserid
          AND roleid = 1
          AND clinicid IS NULL
          AND isactive = TRUE
    ) THEN
        RAISE EXCEPTION
            'Solo el administrador de plataforma puede crear clínicas.';
    END IF;

    -- Crear clínica y obtener su ID
    INSERT INTO public.clinics (
        name,
        clinictimezone,
        auditpersonid
    )
    VALUES (
        p_name,
        p_timezone,
        p_platformuserid
    )
    RETURNING clinicid INTO p_clinicid;

    -- Registrar administrador de la nueva clínica
    INSERT INTO public.users (
        providerid,
        clinicid,
        roleid,
        identification,
        name,
        lastname,
        email,
        phone
    )
    VALUES (
        p_adminproviderid,
        p_clinicid,
        2,
        p_adminidentification,
        p_adminname,
        p_adminlastname,
        p_adminemail,
        p_adminphone
    );
END;
$$;

CREATE OR REPLACE PROCEDURE crearusuario(
    p_clinicid INT,
    p_auditpersonid INT,
    p_providerid VARCHAR(255),
    p_roleid INT,
    p_identification VARCHAR(12),
    p_name VARCHAR(25),
    p_lastname VARCHAR(25),
    p_email VARCHAR(100),
    p_phone VARCHAR(20) DEFAULT NULL
)
LANGUAGE plpgsql
AS $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM users
        WHERE userid = p_auditpersonid
          AND clinicid = p_clinicid
          AND roleid = 2
          AND isactive = TRUE
    ) THEN
        RAISE EXCEPTION 'Solo el administrador de clínica puede crear usuarios.';
    END IF;

    IF p_roleid NOT IN (2, 3, 4) THEN
        RAISE EXCEPTION 'Rol no válido para un usuario de clínica.';
    END IF;

    INSERT INTO users (
        providerid,
        clinicid,
        roleid,
        identification,
        name,
        lastname,
        email,
        phone
    )
    VALUES (
        p_providerid,
        p_clinicid,
        p_roleid,
        p_identification,
        p_name,
        p_lastname,
        p_email,
        p_phone
    );
END;
$$;

CREATE OR REPLACE PROCEDURE cambiarrolusuario(
    p_clinicid INT,
    p_auditpersonid INT,
    p_userid INT,
    p_roleid INT
)
LANGUAGE plpgsql
AS $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM users
        WHERE userid = p_auditpersonid
          AND clinicid = p_clinicid
          AND roleid = 2
          AND isactive = TRUE
    ) THEN
        RAISE EXCEPTION 'Solo el administrador de clínica puede cambiar roles.';
    END IF;

    IF p_roleid NOT IN (2, 3, 4) THEN
        RAISE EXCEPTION 'Rol no válido.';
    END IF;

    UPDATE users
    SET roleid = p_roleid,
        updatedat = NOW()
    WHERE userid = p_userid
      AND clinicid = p_clinicid
      AND isactive = TRUE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Usuario inexistente o inactivo.';
    END IF;
END;
$$;

CREATE OR REPLACE PROCEDURE desactivarusuario(
    p_clinicid INT,
    p_auditpersonid INT,
    p_userid INT
)
LANGUAGE plpgsql
AS $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM users
        WHERE userid = p_auditpersonid
          AND clinicid = p_clinicid
          AND roleid = 2
          AND isactive = TRUE
    ) THEN
        RAISE EXCEPTION 'Solo el administrador de clínica puede desactivar usuarios.';
    END IF;

    UPDATE users
    SET isactive = FALSE,
        updatedat = NOW()
    WHERE userid = p_userid
      AND clinicid = p_clinicid
      AND roleid <> 2
      AND isactive = TRUE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Usuario inexistente, inactivo o no desactivable.';
    END IF;
END;
$$;


CREATE OR REPLACE FUNCTION public.consultarusuarios(
    p_clinicid INT,
    p_auditpersonid INT
)
RETURNS TABLE (
    userid INT,
    providerid VARCHAR,
    roleid INT,
    identification VARCHAR,
    name VARCHAR,
    lastname VARCHAR,
    email VARCHAR,
    phone VARCHAR,
    isactive BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM public.users u
        WHERE u.userid = p_auditpersonid
          AND u.clinicid = p_clinicid
          AND u.roleid = 2
          AND u.isactive = TRUE
    ) THEN
        RAISE EXCEPTION 'Acceso denegado.';
    END IF;

    RETURN QUERY
    SELECT
        u.userid,
        u.providerid,
        u.roleid,
        u.identification,
        u.name,
        u.lastname,
        u.email,
        u.phone,
        u.isactive
    FROM public.users u
    WHERE u.clinicid = p_clinicid
    ORDER BY u.lastname, u.name;
END;
$$;

-- Consultar clínicas de la plataforma
CREATE OR REPLACE FUNCTION public.consultarclinicas(
    p_platformuserid INT
)
RETURNS TABLE (
    clinicid INT,
    name VARCHAR,
    clinictimezone VARCHAR,
    isactive BOOLEAN,
    createdat TIMESTAMP
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
BEGIN
    -- Verificar que sea administrador de plataforma
    IF NOT EXISTS (
        SELECT 1
        FROM public.users u
        WHERE u.userid = p_platformuserid
          AND u.roleid = 1
          AND u.clinicid IS NULL
          AND u.isactive = TRUE
    ) THEN
        RAISE EXCEPTION
            'Solo el administrador de plataforma puede consultar clínicas.';
    END IF;

    RETURN QUERY
    SELECT
        c.clinicid,
        c.name::VARCHAR,
        c.clinictimezone::VARCHAR,
        c.isactive,
        c.createdat::TIMESTAMP
    FROM public.clinics c
    ORDER BY c.clinicid;
END;
$$;


-- Consultar los datos necesarios para invalidar Redis
-- al reprogramar o cancelar una cita
CREATE OR REPLACE FUNCTION public.obtenerdetallecita(
    p_appointmentid INT,
    p_clinicid INT,
    p_auditpersonid INT
)
RETURNS TABLE (
    profesionalid INT,
    fecha TEXT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
BEGIN
    -- Validar que el usuario sea recepcionista activo
    -- y pertenezca a la clínica correspondiente.
    IF NOT EXISTS (
        SELECT 1
        FROM public.users u
        WHERE u.userid = p_auditpersonid
          AND u.clinicid = p_clinicid
          AND u.roleid = 3
          AND u.isactive = TRUE
    ) THEN
        RAISE EXCEPTION 'Acceso denegado.';
    END IF;

    RETURN QUERY
    SELECT
        a.clinicprofessionalid,
        (a.date AT TIME ZONE c.clinictimezone)::DATE::TEXT
    FROM public.appointments a
    JOIN public.clinics c
        ON c.clinicid = a.clinicid
    WHERE a.appointmentid = p_appointmentid
      AND a.clinicid = p_clinicid;
END;
$$;
