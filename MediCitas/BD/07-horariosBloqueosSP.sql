-- ADMINISTRACIÓN DE HORARIOS Y BLOQUEOS -----------------------------------------------------

CREATE OR REPLACE PROCEDURE crearhorario(
    p_clinicid INT,
    p_auditpersonid INT,
    p_clinicprofessionalid INT,
    p_day INT,
    p_starttime TIME,
    p_endtime TIME
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
        RAISE EXCEPTION 'Solo el administrador de clínica puede crear horarios.';
    END IF;

    -- Validar profesional
    IF NOT EXISTS (
        SELECT 1
        FROM clinicprofessionals
        WHERE clinicprofessionalid = p_clinicprofessionalid
          AND clinicid = p_clinicid
          AND isactive = TRUE
    ) THEN
        RAISE EXCEPTION 'El profesional no pertenece a esta clínica o está inactivo.';
    END IF;

    IF p_day NOT BETWEEN 1 AND 7 THEN
        RAISE EXCEPTION 'El día debe estar entre 1 y 7.';
    END IF;

    IF p_endtime <= p_starttime THEN
        RAISE EXCEPTION 'La hora de finalización debe ser posterior a la hora de inicio.';
    END IF;

    INSERT INTO professionalschedules (
        clinicprofessionalid,
        day,
        starttime,
        endtime
    )
    VALUES (
        p_clinicprofessionalid,
        p_day,
        p_starttime,
        p_endtime
    );
END;
$$;

CREATE OR REPLACE PROCEDURE actualizarhorario(
    p_clinicid INT,
    p_auditpersonid INT,
    p_professionalscheduleid INT,
    p_day INT,
    p_starttime TIME,
    p_endtime TIME,
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
        RAISE EXCEPTION 'Solo el administrador de clínica puede actualizar horarios.';
    END IF;

    IF p_day NOT BETWEEN 1 AND 7 THEN
        RAISE EXCEPTION 'El día debe estar entre 1 y 7.';
    END IF;

    IF p_endtime <= p_starttime THEN
        RAISE EXCEPTION 'La hora de finalización debe ser posterior a la hora de inicio.';
    END IF;

    UPDATE professionalschedules ps
    SET day = p_day,
        starttime = p_starttime,
        endtime = p_endtime,
        isactive = p_isactive,
        updatedat = NOW()
    WHERE ps.professionalscheduleid = p_professionalscheduleid
      AND EXISTS (
          SELECT 1
          FROM clinicprofessionals cp
          WHERE cp.clinicprofessionalid = ps.clinicprofessionalid
            AND cp.clinicid = p_clinicid
            AND cp.isactive = TRUE
      );

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Horario no encontrado en esta clínica.';
    END IF;
END;
$$;

CREATE OR REPLACE PROCEDURE crearbloqueo(
    p_clinicid INT,
    p_auditpersonid INT,
    p_clinicprofessionalid INT,
    p_startdatetime TIMESTAMPTZ,
    p_enddatetime TIMESTAMPTZ,
    p_reason VARCHAR(255)
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
        RAISE EXCEPTION 'Solo el administrador de clínica puede crear bloqueos.';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM clinicprofessionals
        WHERE clinicprofessionalid = p_clinicprofessionalid
          AND clinicid = p_clinicid
          AND isactive = TRUE
    ) THEN
        RAISE EXCEPTION 'El profesional no pertenece a esta clínica o está inactivo.';
    END IF;

    IF p_enddatetime <= p_startdatetime THEN
        RAISE EXCEPTION 'La fecha de finalización debe ser posterior a la fecha de inicio.';
    END IF;

    INSERT INTO scheduleblocks (
        clinicprofessionalid,
        startdatetime,
        enddatetime,
        reason,
        auditpersonid
    )
    VALUES (
        p_clinicprofessionalid,
        p_startdatetime,
        p_enddatetime,
        p_reason,
        p_auditpersonid
    );
END;
$$;

CREATE OR REPLACE PROCEDURE actualizarbloqueo(
    p_clinicid INT,
    p_auditpersonid INT,
    p_scheduleblockid INT,
    p_operation INT,
    p_startdatetime TIMESTAMPTZ DEFAULT NULL,
    p_enddatetime TIMESTAMPTZ DEFAULT NULL,
    p_reason VARCHAR(255) DEFAULT NULL
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
        RAISE EXCEPTION 'Solo el administrador de clínica puede modificar bloqueos.';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM scheduleblocks sb
        JOIN clinicprofessionals cp
          ON cp.clinicprofessionalid = sb.clinicprofessionalid
        WHERE sb.scheduleblockid = p_scheduleblockid
          AND cp.clinicid = p_clinicid
    ) THEN
        RAISE EXCEPTION 'Bloqueo no encontrado en esta clínica.';
    END IF;

    -- Operación 1: actualizar
    IF p_operation = 1 THEN

        IF p_startdatetime IS NULL OR p_enddatetime IS NULL THEN
            RAISE EXCEPTION 'Debe proporcionar ambas fechas para actualizar el bloqueo.';
        END IF;

        IF p_enddatetime <= p_startdatetime THEN
            RAISE EXCEPTION 'La fecha de finalización debe ser posterior a la fecha de inicio.';
        END IF;

        UPDATE scheduleblocks
        SET startdatetime = p_startdatetime,
            enddatetime = p_enddatetime,
            reason = p_reason,
            updatedat = NOW(),
            auditpersonid = p_auditpersonid
        WHERE scheduleblockid = p_scheduleblockid;

    -- Operación 2: desactivar
    ELSIF p_operation = 2 THEN

        UPDATE scheduleblocks
        SET isactive = FALSE,
            updatedat = NOW(),
            auditpersonid = p_auditpersonid
        WHERE scheduleblockid = p_scheduleblockid;

    ELSE
        RAISE EXCEPTION 'Operación no válida. Utilice 1 para actualizar o 2 para desactivar.';
    END IF;
END;
$$;

CREATE OR REPLACE FUNCTION consultarhorarios(
    p_clinicid INT,
    p_auditpersonid INT,
    p_clinicprofessionalid INT DEFAULT NULL
)
RETURNS TABLE (
    professionalscheduleid INT,
    clinicprofessionalid INT,
    day INT,
    starttime TIME,
    endtime TIME,
    scheduleactive BOOLEAN,
    scheduleblockid INT,
    blockstart TIMESTAMPTZ,
    blockend TIMESTAMPTZ,
    blockreason VARCHAR,
    blockactive BOOLEAN
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_roleid INT;
BEGIN
    SELECT roleid
    INTO v_roleid
    FROM users
    WHERE userid = p_auditpersonid
      AND clinicid = p_clinicid
      AND isactive = TRUE;

    IF v_roleid IS NULL OR v_roleid NOT IN (2, 3, 4) THEN
        RAISE EXCEPTION 'Acceso denegado.';
    END IF;

    -- El profesional solo puede consultar sus propios horarios
    IF v_roleid = 4 THEN

        RETURN QUERY
        SELECT
            ps.professionalscheduleid,
            ps.clinicprofessionalid,
            ps.day,
            ps.starttime,
            ps.endtime,
            ps.isactive,
            sb.scheduleblockid,
            sb.startdatetime,
            sb.enddatetime,
            sb.reason,
            sb.isactive
        FROM professionalschedules ps
        JOIN clinicprofessionals cp
          ON cp.clinicprofessionalid = ps.clinicprofessionalid
        LEFT JOIN scheduleblocks sb
          ON sb.clinicprofessionalid = ps.clinicprofessionalid
        WHERE cp.clinicid = p_clinicid
          AND cp.userid = p_auditpersonid
          AND (p_clinicprofessionalid IS NULL
               OR cp.clinicprofessionalid = p_clinicprofessionalid);

    ELSE

        RETURN QUERY
        SELECT
            ps.professionalscheduleid,
            ps.clinicprofessionalid,
            ps.day,
            ps.starttime,
            ps.endtime,
            ps.isactive,
            sb.scheduleblockid,
            sb.startdatetime,
            sb.enddatetime,
            sb.reason,
            sb.isactive
        FROM professionalschedules ps
        JOIN clinicprofessionals cp
          ON cp.clinicprofessionalid = ps.clinicprofessionalid
        LEFT JOIN scheduleblocks sb
          ON sb.clinicprofessionalid = ps.clinicprofessionalid
        WHERE cp.clinicid = p_clinicid
          AND (p_clinicprofessionalid IS NULL
               OR cp.clinicprofessionalid = p_clinicprofessionalid);

    END IF;
END;
$$;