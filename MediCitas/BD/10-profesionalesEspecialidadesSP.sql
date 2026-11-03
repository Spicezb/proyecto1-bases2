-- PROFESIONALES Y ESPECIALIDADES ------------------------------------------------------------

CREATE OR REPLACE PROCEDURE crearprofesional(
    p_clinicid INT,
    p_auditpersonid INT,
    p_userid INT,
    p_licenseid VARCHAR(15)
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_professionalid INT;
BEGIN
    -- Validar administrador de clínica
    IF NOT EXISTS (
        SELECT 1
        FROM users
        WHERE userid = p_auditpersonid
          AND clinicid = p_clinicid
          AND roleid = 2
          AND isactive = TRUE
    ) THEN
        RAISE EXCEPTION 'Solo el administrador de clínica puede registrar profesionales.';
    END IF;

    -- Validar que el usuario sea un profesional de salud
    IF NOT EXISTS (
        SELECT 1
        FROM users
        WHERE userid = p_userid
          AND clinicid = p_clinicid
          AND roleid = 4
          AND isactive = TRUE
    ) THEN
        RAISE EXCEPTION 'El usuario debe ser un profesional de salud activo de la clínica.';
    END IF;

    -- Registrar profesional
    INSERT INTO professionals (
        licenseid,
        auditpersonid
    )
    VALUES (
        p_licenseid,
        p_auditpersonid
    )
    RETURNING professionalid INTO v_professionalid;

    -- Asociar profesional con la clínica
    INSERT INTO clinicprofessionals (
        userid,
        clinicid,
        professionalid,
        auditpersonid
    )
    VALUES (
        p_userid,
        p_clinicid,
        v_professionalid,
        p_auditpersonid
    );
END;
$$;

CREATE OR REPLACE PROCEDURE actualizarprofesional(
    p_clinicid INT,
    p_auditpersonid INT,
    p_professionalid INT,
    p_licenseid VARCHAR(15),
    p_isactive BOOLEAN
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
        RAISE EXCEPTION 'Solo el administrador de clínica puede actualizar profesionales.';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM clinicprofessionals
        WHERE professionalid = p_professionalid
          AND clinicid = p_clinicid
          AND isactive = TRUE
    ) THEN
        RAISE EXCEPTION 'El profesional no está asociado activamente a esta clínica.';
    END IF;

    UPDATE professionals
    SET licenseid = p_licenseid,
        updatedat = NOW()
    WHERE professionalid = p_professionalid;

    UPDATE clinicprofessionals
    SET isactive = p_isactive,
        updatedat = NOW()
    WHERE professionalid = p_professionalid
      AND clinicid = p_clinicid;
END;
$$;

CREATE OR REPLACE PROCEDURE asignarespecialidad(
    p_clinicid INT,
    p_auditpersonid INT,
    p_professionalid INT,
    p_specialtyid INT
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
        RAISE EXCEPTION 'Solo el administrador de clínica puede asignar especialidades.';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM clinicprofessionals
        WHERE professionalid = p_professionalid
          AND clinicid = p_clinicid
          AND isactive = TRUE
    ) THEN
        RAISE EXCEPTION 'El profesional no pertenece a esta clínica.';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM specialties
        WHERE specialtyid = p_specialtyid
          AND isactive = TRUE
    ) THEN
        RAISE EXCEPTION 'La especialidad no existe o está inactiva.';
    END IF;

    INSERT INTO professionalspecialties (
        professionalid,
        specialtyid,
        auditpersonid
    )
    VALUES (
        p_professionalid,
        p_specialtyid,
        p_auditpersonid
    )
    ON CONFLICT (professionalid, specialtyid)
    DO UPDATE SET
        isactive = TRUE,
        updatedat = NOW(),
        auditpersonid = EXCLUDED.auditpersonid;
END;
$$;

CREATE OR REPLACE FUNCTION consultarprofesionales(
    p_clinicid INT,
    p_auditpersonid INT
)
RETURNS TABLE (
    clinicprofessionalid INT,
    professionalid INT,
    userid INT,
    name VARCHAR,
    lastname VARCHAR,
    licenseid VARCHAR,
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
          AND roleid IN (2, 3, 4)
          AND isactive = TRUE
    ) THEN
        RAISE EXCEPTION 'Acceso denegado.';
    END IF;

    RETURN QUERY
    SELECT
        cp.clinicprofessionalid,
        p.professionalid,
        u.userid,
        u.name,
        u.lastname,
        p.licenseid,
        cp.isactive
    FROM clinicprofessionals cp
    INNER JOIN professionals p
        ON p.professionalid = cp.professionalid
    INNER JOIN users u
        ON u.userid = cp.userid
    WHERE cp.clinicid = p_clinicid
    ORDER BY u.lastname, u.name;
END;
$$;