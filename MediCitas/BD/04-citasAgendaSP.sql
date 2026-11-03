-- CITAS Y AGENDA ----------------------------------------------------------------------------

CREATE OR REPLACE PROCEDURE reservarcita(
    p_clinicid INT,
    p_auditpersonid INT,
    p_clinicpatientid INT,
    p_clinicprofessionalid INT,
    p_clinicserviceid INT,
    p_date TIMESTAMPTZ
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_duration INT;
    v_enddatetime TIMESTAMPTZ;
    v_appointmentid INT;
    v_localdate DATE;
BEGIN
    -- Validar que el usuario sea de recepción
    IF NOT EXISTS (
        SELECT 1
        FROM users
        WHERE userid = p_auditpersonid
          AND clinicid = p_clinicid
          AND roleid = 3
          AND isactive
    ) THEN
        RAISE EXCEPTION 'Solo recepción puede reservar citas.';
    END IF;

    -- Validar que el paciente pertenezca a la clínica
    IF NOT EXISTS (
        SELECT 1
        FROM clinicpatients
        WHERE clinicpatientid = p_clinicpatientid
          AND clinicid = p_clinicid
          AND isactive
    ) THEN
        RAISE EXCEPTION 'Paciente no pertenece a la clínica.';
    END IF;

    -- Obtener la duración del servicio
    SELECT cs.duration
    INTO v_duration
    FROM clinicservices cs
    WHERE cs.clinicserviceid = p_clinicserviceid
      AND cs.clinicid = p_clinicid
      AND cs.isactive;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Servicio no disponible en la clínica.';
    END IF;

    -- Validar que el profesional tenga asignado el servicio
    IF NOT EXISTS (
        SELECT 1
        FROM clinicprofessionalservices cps
        JOIN clinicprofessionals cp
            ON cp.clinicprofessionalid = cps.clinicprofessionalid
        WHERE cps.clinicprofessionalid = p_clinicprofessionalid
          AND cps.clinicserviceid = p_clinicserviceid
          AND cps.isactive
          AND cp.clinicid = p_clinicid
          AND cp.isactive
    ) THEN
        RAISE EXCEPTION 'Servicio no disponible para el profesional.';
    END IF;

    -- Calcular la hora de finalización
    v_enddatetime := p_date + make_interval(mins => v_duration);

    -- Obtener la fecha local de la clínica
    SELECT (p_date AT TIME ZONE clinictimezone)::date
    INTO v_localdate
    FROM clinics
    WHERE clinicid = p_clinicid;

    -- Validar que el intervalo libre sea suficiente
    IF NOT EXISTS (
        SELECT 1
        FROM consultardisponibilidad(
            p_clinicid,
            p_auditpersonid,
            p_clinicprofessionalid,
            v_localdate
        ) d
        WHERE d.slotstart <= p_date
          AND d.slotend >= v_enddatetime
    ) THEN
        RAISE EXCEPTION 'El espacio solicitado no está disponible.';
    END IF;

    -- Registrar la cita
    -- Las restricciones EXCLUDE controlan los traslapes
    INSERT INTO appointments(
        clinicpatientid,
        clinicid,
        clinicprofessionalid,
        clinicserviceid,
        appointmentstatusid,
        date,
        enddatetime,
        auditpersonid
    )
    VALUES (
        p_clinicpatientid,
        p_clinicid,
        p_clinicprofessionalid,
        p_clinicserviceid,
        1,
        p_date,
        v_enddatetime,
        p_auditpersonid
    )
    RETURNING appointmentid INTO v_appointmentid;

    CALL registrarlog(
        p_clinicid,
        p_auditpersonid,
        2,
        3,
        v_appointmentid,
        1,
        p_clinicpatientid
    );
END;
$$;

CREATE OR REPLACE PROCEDURE reprogramarcita(
    p_clinicid INT,
    p_auditpersonid INT,
    p_appointmentid INT,
    p_newprofessionalid INT,
    p_newserviceid INT,
    p_newdate TIMESTAMPTZ
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_patientid INT;
    v_duration INT;
    v_enddatetime TIMESTAMPTZ;
    v_newappointmentid INT;
    v_localdate DATE;
BEGIN
    -- Validar que el usuario sea de recepción
    IF NOT EXISTS (
        SELECT 1
        FROM users
        WHERE userid = p_auditpersonid
          AND clinicid = p_clinicid
          AND roleid = 3
          AND isactive
    ) THEN
        RAISE EXCEPTION 'Solo recepción puede reprogramar citas.';
    END IF;

    -- Obtener el paciente de la cita original
    SELECT clinicpatientid
    INTO v_patientid
    FROM appointments
    WHERE appointmentid = p_appointmentid
      AND clinicid = p_clinicid
      AND appointmentstatusid = 1
      AND isblocked = false
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Cita vigente no encontrada.';
    END IF;

    -- Obtener la duración del nuevo servicio
    SELECT duration
    INTO v_duration
    FROM clinicservices
    WHERE clinicserviceid = p_newserviceid
      AND clinicid = p_clinicid
      AND isactive;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Servicio no disponible en la clínica.';
    END IF;

    -- Validar que el nuevo profesional tenga asignado el servicio
    IF NOT EXISTS (
        SELECT 1
        FROM clinicprofessionalservices cps
        JOIN clinicprofessionals cp
            ON cp.clinicprofessionalid = cps.clinicprofessionalid
        WHERE cps.clinicprofessionalid = p_newprofessionalid
          AND cps.clinicserviceid = p_newserviceid
          AND cps.isactive
          AND cp.clinicid = p_clinicid
          AND cp.isactive
    ) THEN
        RAISE EXCEPTION 'Servicio no disponible para el profesional.';
    END IF;

    -- Calcular la hora de finalización
    v_enddatetime := p_newdate + make_interval(mins => v_duration);

    -- Marcar la cita original como reprogramada
    UPDATE appointments
    SET appointmentstatusid = 5,
        updatedat = now(),
        auditpersonid = p_auditpersonid
    WHERE appointmentid = p_appointmentid;

    -- Obtener la fecha local de la clínica
    SELECT (p_newdate AT TIME ZONE clinictimezone)::date
    INTO v_localdate
    FROM clinics
    WHERE clinicid = p_clinicid;

    -- Validar que el nuevo intervalo esté disponible
    IF NOT EXISTS (
        SELECT 1
        FROM consultardisponibilidad(
            p_clinicid,
            p_auditpersonid,
            p_newprofessionalid,
            v_localdate
        ) d
        WHERE d.slotstart <= p_newdate
          AND d.slotend >= v_enddatetime
    ) THEN
        RAISE EXCEPTION 'El nuevo espacio no está disponible.';
    END IF;

    -- Crear la nueva cita
    INSERT INTO appointments(
        clinicpatientid,
        clinicid,
        clinicprofessionalid,
        clinicserviceid,
        appointmentstatusid,
        date,
        enddatetime,
        auditpersonid
    )
    VALUES (
        v_patientid,
        p_clinicid,
        p_newprofessionalid,
        p_newserviceid,
        1,
        p_newdate,
        v_enddatetime,
        p_auditpersonid
    )
    RETURNING appointmentid INTO v_newappointmentid;

    CALL registrarlog(
        p_clinicid,
        p_auditpersonid,
        3,
        3,
        p_appointmentid,
        1,
        v_patientid
    );
END;
$$;

CREATE OR REPLACE PROCEDURE cambiarestadocita(
    p_clinicid INT,
    p_auditpersonid INT,
    p_appointmentid INT,
    p_newstatusid INT,
    p_cancellationreason VARCHAR(250) DEFAULT NULL
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_status INT;
    v_date TIMESTAMPTZ;
    v_clinicpatientid INT;
BEGIN
    -- Obtener y bloquear la cita
    SELECT appointmentstatusid, date, clinicpatientid
    INTO v_status, v_date, v_clinicpatientid
    FROM appointments
    WHERE appointmentid = p_appointmentid
      AND clinicid = p_clinicid
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Cita no encontrada.';
    END IF;

    -- Validar transición de estado
    IF v_status <> 1 OR p_newstatusid NOT IN (2, 3, 4) THEN
        RAISE EXCEPTION 'Transición de estado inválida.';
    END IF;

    -- Validar que la cita ya haya comenzado
    IF p_newstatusid IN (2, 3) AND now() < v_date THEN
        RAISE EXCEPTION 'El desenlace solo se registra después de la hora de inicio.';
    END IF;

    -- Validar permisos para cancelar
    IF p_newstatusid = 4 AND NOT EXISTS (
        SELECT 1
        FROM users
        WHERE userid = p_auditpersonid
          AND clinicid = p_clinicid
          AND roleid = 3
          AND isactive
    ) THEN
        RAISE EXCEPTION 'Solo recepción puede cancelar citas.';
    END IF;

    -- Validar que el profesional asignado registre el desenlace
    IF p_newstatusid IN (2, 3) AND NOT EXISTS (
        SELECT 1
        FROM clinicprofessionals cp
        JOIN users u ON u.userid = cp.userid
        JOIN appointments a
            ON a.clinicprofessionalid = cp.clinicprofessionalid
        WHERE u.userid = p_auditpersonid
          AND cp.clinicid = p_clinicid
          AND a.appointmentid = p_appointmentid
          AND u.roleid = 4
          AND u.isactive
    ) THEN
        RAISE EXCEPTION 'Solo el profesional asignado puede registrar el desenlace.';
    END IF;

    UPDATE appointments
    SET appointmentstatusid = p_newstatusid,
        cancellationreason = CASE
            WHEN p_newstatusid = 4 THEN p_cancellationreason
            ELSE cancellationreason
        END,
        auditpersonid = p_auditpersonid,
        updatedat = now()
    WHERE appointmentid = p_appointmentid;

    CALL registrarlog(
        p_clinicid,
        p_auditpersonid,
        CASE WHEN p_newstatusid = 4 THEN 4 ELSE 3 END,
        3,
        p_appointmentid,
        1,
        v_clinicpatientid
    );
END;
$$;

CREATE OR REPLACE FUNCTION consultaragenda(
    p_clinicid INT,
    p_auditpersonid INT,
    p_date DATE,
    p_clinicprofessionalid INT DEFAULT NULL
)
RETURNS TABLE (
    appointmentid INT,
    appointmentdate TIMESTAMPTZ,
    enddatetime TIMESTAMPTZ,
    clinicpatientid INT,
    patientname TEXT,
    professionalname TEXT,
    servicename VARCHAR,
    statusid INT
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_roleid INT;
    v_timezone VARCHAR(50);
BEGIN
    SELECT roleid
    INTO v_roleid
    FROM users
    WHERE userid = p_auditpersonid
      AND clinicid = p_clinicid
      AND isactive;

    IF NOT FOUND OR v_roleid NOT IN (2, 3, 4) THEN
        RAISE EXCEPTION 'Acceso denegado.';
    END IF;

    SELECT clinictimezone
    INTO v_timezone
    FROM clinics
    WHERE clinicid = p_clinicid;

    RETURN QUERY
    SELECT
        a.appointmentid,
        a.date,
        a.enddatetime,
        a.clinicpatientid,
        p.name || ' ' || p.lastname,
        u.name || ' ' || u.lastname,
        s.name,
        a.appointmentstatusid
    FROM appointments a
    JOIN clinicpatients cp
        ON cp.clinicpatientid = a.clinicpatientid
    JOIN patients p
        ON p.patientid = cp.patientid
    JOIN clinicprofessionals cprof
        ON cprof.clinicprofessionalid = a.clinicprofessionalid
    JOIN users u
        ON u.userid = cprof.userid
    JOIN clinicservices cs
        ON cs.clinicserviceid = a.clinicserviceid
    JOIN services s
        ON s.serviceid = cs.serviceid
    WHERE a.clinicid = p_clinicid
      AND (a.date AT TIME ZONE v_timezone)::date = p_date
      AND (
          p_clinicprofessionalid IS NULL
          OR a.clinicprofessionalid = p_clinicprofessionalid
      )
      AND (
          v_roleid IN (2, 3)
          OR cprof.userid = p_auditpersonid
      )
    ORDER BY a.date;
END;
$$;

CREATE OR REPLACE FUNCTION consultarcitaspaciente(
    p_clinicid INT,
    p_auditpersonid INT,
    p_clinicpatientid INT
)
RETURNS TABLE (
    appointmentid INT,
    appointmentdate TIMESTAMPTZ,
    enddatetime TIMESTAMPTZ,
    statusid INT,
    servicename VARCHAR,
    professionalname TEXT,
    cancellationreason VARCHAR
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
      AND isactive;

    IF NOT FOUND OR v_roleid NOT IN (2, 3, 4) THEN
        RAISE EXCEPTION 'Acceso denegado.';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM clinicpatients
        WHERE clinicpatientid = p_clinicpatientid
          AND clinicid = p_clinicid
    ) THEN
        RAISE EXCEPTION 'Paciente no pertenece a la clínica.';
    END IF;

    -- El profesional solo puede consultar pacientes con citas propias
    IF v_roleid = 4 AND NOT EXISTS (
        SELECT 1
        FROM appointments a
        JOIN clinicprofessionals cp
            ON cp.clinicprofessionalid = a.clinicprofessionalid
        WHERE a.clinicid = p_clinicid
          AND a.clinicpatientid = p_clinicpatientid
          AND cp.userid = p_auditpersonid
    ) THEN
        RAISE EXCEPTION 'No tiene permiso para consultar las citas de este paciente.';
    END IF;

    RETURN QUERY
    SELECT
        a.appointmentid,
        a.date,
        a.enddatetime,
        a.appointmentstatusid,
        s.name,
        u.name || ' ' || u.lastname,
        a.cancellationreason
    FROM appointments a
    JOIN clinicservices cs
        ON cs.clinicserviceid = a.clinicserviceid
    JOIN services s
        ON s.serviceid = cs.serviceid
    JOIN clinicprofessionals cp
        ON cp.clinicprofessionalid = a.clinicprofessionalid
    JOIN users u
        ON u.userid = cp.userid
    WHERE a.clinicid = p_clinicid
      AND a.clinicpatientid = p_clinicpatientid
    ORDER BY a.date DESC;
END;
$$;

CREATE OR REPLACE FUNCTION contarcitasporestado(
    p_clinicid INT,
    p_auditpersonid INT,
    p_startdate DATE,
    p_enddate DATE
)
RETURNS TABLE (
    appointmentstatusid INT,
    total BIGINT
)
LANGUAGE plpgsql
AS $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM users
        WHERE userid = p_auditpersonid
          AND clinicid = p_clinicid
          AND roleid IN (2, 3)
          AND isactive
    ) THEN
        RAISE EXCEPTION 'Acceso denegado.';
    END IF;

    IF p_enddate < p_startdate THEN
        RAISE EXCEPTION 'Rango de fechas inválido.';
    END IF;

    RETURN QUERY
    SELECT
        a.appointmentstatusid,
        COUNT(*)
    FROM appointments a
    JOIN clinics c
        ON c.clinicid = a.clinicid
    WHERE a.clinicid = p_clinicid
      AND (a.date AT TIME ZONE c.clinictimezone)::date
          BETWEEN p_startdate AND p_enddate
    GROUP BY a.appointmentstatusid
    ORDER BY a.appointmentstatusid;
END;
$$;