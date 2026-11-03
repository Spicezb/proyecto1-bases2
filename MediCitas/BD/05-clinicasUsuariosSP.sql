-- CLÍNICAS Y USUARIOS -----------------------------------------------------------------------

CREATE OR REPLACE PROCEDURE crearclinica(
    p_platformuserid INT,
    p_name VARCHAR(100),
    p_timezone VARCHAR(50),
    p_adminproviderid VARCHAR(255),
    p_adminidentification VARCHAR(12),
    p_adminname VARCHAR(25),
    p_adminlastname VARCHAR(25),
    p_adminemail VARCHAR(100),
    p_adminphone VARCHAR(20)
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_clinicid INT;
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM users
        WHERE userid = p_platformuserid
          AND roleid = 1
          AND clinicid IS NULL
          AND isactive = TRUE
    ) THEN
        RAISE EXCEPTION 'Solo el administrador de plataforma puede crear clínicas.';
    END IF;

    INSERT INTO clinics (
        name,
        clinictimezone,
        auditpersonid
    )
    VALUES (
        p_name,
        p_timezone,
        p_platformuserid
    )
    RETURNING clinicid INTO v_clinicid;

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
        p_adminproviderid,
        v_clinicid,
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

CREATE OR REPLACE FUNCTION consultarusuarios(
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
    FROM users u
    WHERE u.clinicid = p_clinicid
    ORDER BY u.lastname, u.name;
END;
$$;