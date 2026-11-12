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
DECLARE
    v_clinicprofessionalid INT;
BEGIN
    -- Verificar que el usuario sea administrador de la clínica
    IF NOT EXISTS (
        SELECT 1
        FROM users u
        WHERE u.userid = p_auditpersonid
          AND u.clinicid = p_clinicid
          AND u.roleid = 2
          AND u.isactive = TRUE
    ) THEN
        RAISE EXCEPTION
            'Solo el administrador de clínica puede actualizar profesionales.';
    END IF;

    -- Verificar que el profesional esté asociado a la clínica y bloquear su asociación durante la operación
    SELECT cp.clinicprofessionalid
    INTO v_clinicprofessionalid
    FROM clinicprofessionals cp
    WHERE cp.professionalid = p_professionalid
      AND cp.clinicid = p_clinicid
      AND cp.isactive = TRUE
    FOR UPDATE;

    IF v_clinicprofessionalid IS NULL THEN
        RAISE EXCEPTION
            'El profesional no está asociado activamente a esta clínica.';
    END IF;

    -- Si se solicita una baja, comprobar citas futuras reservadas
    IF p_isactive = FALSE THEN
        IF EXISTS (
            SELECT 1
            FROM appointments a
            JOIN appointmentstatuses aps
                ON aps.appointmentstatusid = a.appointmentstatusid
            WHERE a.clinicprofessionalid = v_clinicprofessionalid
              AND a.clinicid = p_clinicid
              AND a.date > NOW()
              AND aps.name = 'reservada'
        ) THEN
            RAISE EXCEPTION
                'No se puede desactivar un profesional con citas futuras reservadas.';
        END IF;
    END IF;

    -- Actualizar la licencia del profesional
    UPDATE professionals
    SET licenseid = p_licenseid,
        updatedat = NOW()
    WHERE professionalid = p_professionalid;

    -- Actualizar su estado únicamente en esta clínica
    UPDATE clinicprofessionals
    SET isactive = p_isactive,
        updatedat = NOW()
    WHERE clinicprofessionalid = v_clinicprofessionalid;

END;
$$;

DROP FUNCTION IF EXISTS consultarprofesionales(INT, INT);

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
    isactive BOOLEAN,
    especialidades VARCHAR[]
)
LANGUAGE plpgsql
AS $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM users u
        WHERE u.userid = p_auditpersonid
          AND u.clinicid = p_clinicid
          AND u.roleid IN (2, 3, 4)
          AND u.isactive = TRUE
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
        cp.isactive,
        COALESCE(
            ARRAY_AGG(DISTINCT s.name)
                FILTER (WHERE s.specialtyid IS NOT NULL),
            ARRAY[]::varchar[]
        )::VARCHAR[]
    FROM clinicprofessionals cp
    INNER JOIN professionals p
        ON p.professionalid = cp.professionalid
    INNER JOIN users u
        ON u.userid = cp.userid
    LEFT JOIN professionalspecialties ps
        ON p.professionalid = ps.professionalid
        AND ps.isactive = TRUE
    LEFT JOIN specialties s
        ON ps.specialtyid = s.specialtyid
        AND s.isactive = TRUE
    WHERE cp.clinicid = p_clinicid
    GROUP BY
        cp.clinicprofessionalid,
        p.professionalid,
        u.userid,
        u.name,
        u.lastname,
        p.licenseid,
        cp.isactive
    ORDER BY u.lastname, u.name;
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
    -- Solo un administrador activo de la clínica.
    IF NOT EXISTS (
        SELECT 1
        FROM users u
        WHERE u.userid = p_auditpersonid
          AND u.clinicid = p_clinicid
          AND u.roleid = 2
          AND u.isactive = TRUE
    ) THEN
        RAISE EXCEPTION
            'Solo el administrador de clínica puede asignar especialidades.';
    END IF;

    -- El profesional debe pertenecer a esa clínica.
    IF NOT EXISTS (
        SELECT 1
        FROM clinicprofessionals cp
        JOIN professionals p
            ON p.professionalid = cp.professionalid
        WHERE cp.professionalid = p_professionalid
          AND cp.clinicid = p_clinicid
          AND cp.isactive = TRUE
          AND p.isactive = TRUE
    ) THEN
        RAISE EXCEPTION
            'El profesional no pertenece activamente a la clínica.';
    END IF;

    -- La especialidad debe existir y estar activa.
    IF NOT EXISTS (
        SELECT 1
        FROM specialties
        WHERE specialtyid = p_specialtyid
          AND isactive = TRUE
    ) THEN
        RAISE EXCEPTION
            'La especialidad no existe o está inactiva.';
    END IF;

    -- Crear la asociación o reactivarla si ya existía.
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

-- Actualización atómica de licencia y especialidades, acotada por clínica.
CREATE OR REPLACE PROCEDURE public.actualizarprofesionalespecialidades(
    p_clinicid INT,
    p_auditpersonid INT,
    p_clinicprofessionalid INT,
    p_licenseid VARCHAR(15),
    p_specialties INT[]
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_professionalid INT;
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM public.users u
        WHERE u.userid = p_auditpersonid AND u.clinicid = p_clinicid
          AND u.roleid = 2 AND u.isactive = TRUE
    ) THEN
        RAISE EXCEPTION 'Solo un administrador activo de la clínica puede actualizar profesionales.';
    END IF;

    SELECT cp.professionalid INTO v_professionalid
    FROM public.clinicprofessionals cp
    JOIN public.professionals p ON p.professionalid = cp.professionalid
    WHERE cp.clinicprofessionalid = p_clinicprofessionalid
      AND cp.clinicid = p_clinicid AND cp.isactive AND p.isactive
    FOR UPDATE OF cp, p;
    IF v_professionalid IS NULL THEN
        RAISE EXCEPTION 'Profesional no encontrado en esta clínica.';
    END IF;

    IF EXISTS (
        SELECT 1 FROM public.clinicprofessionals
        WHERE professionalid = v_professionalid
          AND clinicid <> p_clinicid AND isactive = TRUE
    ) THEN
        RAISE EXCEPTION 'No se pueden modificar datos globales de un profesional compartido.';
    END IF;

    IF p_specialties IS NOT NULL THEN
        IF EXISTS (SELECT 1 FROM unnest(p_specialties) x WHERE x IS NULL)
           OR (SELECT count(*) FROM unnest(p_specialties)) <>
              (SELECT count(DISTINCT x) FROM unnest(p_specialties) x)
           OR EXISTS (
             SELECT 1 FROM unnest(p_specialties) x
             WHERE NOT EXISTS (
                 SELECT 1 FROM public.specialties s
                 WHERE s.specialtyid = x AND s.isactive = TRUE
             )
           ) THEN
            RAISE EXCEPTION 'Una o más especialidades son inválidas o están duplicadas.';
        END IF;

        IF EXISTS (
            SELECT 1 FROM public.clinicprofessionalservices cps
            JOIN public.clinicservices cs ON cs.clinicserviceid = cps.clinicserviceid
            JOIN public.services s ON s.serviceid = cs.serviceid
            WHERE cps.clinicprofessionalid = p_clinicprofessionalid
              AND cps.isactive AND cs.isactive AND s.isactive
              AND NOT (s.specialtyid = ANY(p_specialties))
        ) THEN
            RAISE EXCEPTION 'No se pueden retirar especialidades de servicios habilitados.';
        END IF;
    END IF;

    UPDATE public.professionals
    SET licenseid = COALESCE(p_licenseid, licenseid), updatedat = NOW()
    WHERE professionalid = v_professionalid;

    IF p_specialties IS NOT NULL THEN
        UPDATE public.professionalspecialties
        SET isactive = FALSE, updatedat = NOW(), auditpersonid = p_auditpersonid
        WHERE professionalid = v_professionalid AND isactive = TRUE
          AND NOT (specialtyid = ANY(p_specialties));

        INSERT INTO public.professionalspecialties
            (professionalid, specialtyid, auditpersonid)
        SELECT v_professionalid, x, p_auditpersonid
        FROM unnest(p_specialties) AS x
        ON CONFLICT (professionalid, specialtyid)
        DO UPDATE SET isactive = TRUE, updatedat = NOW(),
                      auditpersonid = EXCLUDED.auditpersonid;
    END IF;
END;
$$;
