-- ADMINISTRACIÓN DE SERVICIOS ---------------------------------------------------------------

CREATE OR REPLACE PROCEDURE crearservicio(
    p_clinicid INT,
    p_auditpersonid INT,
    p_name VARCHAR(50),
    p_specialtyid INT,
    p_duration INT
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_serviceid INT;
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
        RAISE EXCEPTION 'Solo el administrador de clínica puede crear servicios.';
    END IF;

    IF p_duration <= 0 THEN
        RAISE EXCEPTION 'La duración del servicio debe ser mayor que cero.';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM specialties
        WHERE specialtyid = p_specialtyid
          AND isactive = TRUE
    ) THEN
        RAISE EXCEPTION 'La especialidad no existe o está inactiva.';
    END IF;

    -- Buscar si el servicio ya existe en el catálogo global
    SELECT serviceid
    INTO v_serviceid
    FROM services
    WHERE name = p_name;

    IF v_serviceid IS NOT NULL THEN

        IF NOT EXISTS (
            SELECT 1
            FROM services
            WHERE serviceid = v_serviceid
              AND specialtyid = p_specialtyid
        ) THEN
            RAISE EXCEPTION 'Ya existe un servicio con ese nombre asociado a otra especialidad.';
        END IF;

    ELSE

        INSERT INTO services (
            name,
            specialtyid
        )
        VALUES (
            p_name,
            p_specialtyid
        )
        RETURNING serviceid INTO v_serviceid;

    END IF;

    -- Asociar el servicio con la clínica
    INSERT INTO clinicservices (
        clinicid,
        serviceid,
        duration,
        auditpersonid
    )
    VALUES (
        p_clinicid,
        v_serviceid,
        p_duration,
        p_auditpersonid
    );

END;
$$;

CREATE OR REPLACE PROCEDURE actualizarservicio(
    p_clinicid INT,
    p_auditpersonid INT,
    p_clinicserviceid INT,
    p_duration INT,
    p_isactive BOOLEAN
)
LANGUAGE plpgsql
AS $$
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
        RAISE EXCEPTION 'Solo el administrador de clínica puede actualizar servicios.';
    END IF;

    IF p_duration <= 0 THEN
        RAISE EXCEPTION 'La duración del servicio debe ser mayor que cero.';
    END IF;

    -- Actualizar únicamente la asociación con la clínica
    UPDATE clinicservices
    SET duration = p_duration,
        isactive = p_isactive,
        updatedat = NOW(),
        auditpersonid = p_auditpersonid
    WHERE clinicserviceid = p_clinicserviceid
      AND clinicid = p_clinicid;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'El servicio no está asociado a esta clínica.';
    END IF;
END;
$$;

CREATE OR REPLACE FUNCTION consultarservicios(
    p_clinicid INT,
    p_auditpersonid INT
)
RETURNS TABLE (
    clinicserviceid INT,
    serviceid INT,
    name VARCHAR,
    specialtyid INT,
    duration INT,
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
        cs.clinicserviceid,
        s.serviceid,
        s.name,
        s.specialtyid,
        cs.duration,
        cs.isactive
    FROM clinicservices cs
    INNER JOIN services s
        ON s.serviceid = cs.serviceid
    WHERE cs.clinicid = p_clinicid
    ORDER BY s.name;
END;
$$;

CREATE OR REPLACE PROCEDURE asignarservicioprofesional(
    p_clinicid INT,
    p_auditpersonid INT,
    p_clinicprofessionalid INT,
    p_clinicserviceid INT
)
LANGUAGE plpgsql
AS $$
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
        RAISE EXCEPTION 'Solo el administrador de clínica puede asignar servicios a profesionales.';
    END IF;

    -- Validar que el profesional pertenezca a la clínica
    IF NOT EXISTS (
        SELECT 1
        FROM clinicprofessionals
        WHERE clinicprofessionalid = p_clinicprofessionalid
          AND clinicid = p_clinicid
          AND isactive = TRUE
    ) THEN
        RAISE EXCEPTION 'El profesional no pertenece a esta clínica o está inactivo.';
    END IF;

    -- Validar que el servicio esté disponible en la clínica
    IF NOT EXISTS (
        SELECT 1
        FROM clinicservices
        WHERE clinicserviceid = p_clinicserviceid
          AND clinicid = p_clinicid
          AND isactive = TRUE
    ) THEN
        RAISE EXCEPTION 'El servicio no está disponible en esta clínica.';
    END IF;

    
    -- Verificar que el profesional tenga la especialidad
    -- requerida por el servicio.
    IF NOT EXISTS (
        SELECT 1
        FROM clinicprofessionals cp
        INNER JOIN professionals p
            ON p.professionalid = cp.professionalid
        INNER JOIN professionalspecialties ps
            ON ps.professionalid = p.professionalid
        INNER JOIN clinicservices cs
            ON cs.clinicserviceid = p_clinicserviceid
        INNER JOIN services s
            ON s.serviceid = cs.serviceid
        INNER JOIN specialties esp
            ON esp.specialtyid = s.specialtyid
        WHERE cp.clinicprofessionalid = p_clinicprofessionalid
          AND cp.clinicid = p_clinicid
          AND p.isactive = TRUE
          AND ps.specialtyid = s.specialtyid
          AND ps.isactive = TRUE
          AND cs.clinicid = p_clinicid
          AND s.isactive = TRUE
          AND esp.isactive = TRUE
    ) THEN
        RAISE EXCEPTION
            'El profesional no posee la especialidad requerida para este servicio.';
    END IF;

    INSERT INTO clinicprofessionalservices (
        clinicprofessionalid,
        clinicserviceid,
        auditpersonid
    )
    VALUES (
        p_clinicprofessionalid,
        p_clinicserviceid,
        p_auditpersonid
    )
    ON CONFLICT (clinicserviceid, clinicprofessionalid)
    DO UPDATE SET
        isactive = TRUE,
        updatedat = NOW(),
        auditpersonid = EXCLUDED.auditpersonid;

END;
$$;