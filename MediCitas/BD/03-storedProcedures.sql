-- AUDITORÍA ---------------------------------------------------------------------------------

CREATE OR REPLACE PROCEDURE registrarlog(
    p_clinicid INT,
    p_auditpersonid INT,
    p_auditactionid INT,
    p_audittableid INT,
    p_auditrecordid INT,
    p_auditresultid INT,
    p_clinicpatientid INT DEFAULT NULL
)
LANGUAGE plpgsql
AS $$
BEGIN
    INSERT INTO auditlogs (
        clinicid,
        auditpersonid,
        auditactionid,
        audittableid,
        auditrecordid,
        auditresultid,
        clinicpatientid
    )
    VALUES (
        p_clinicid,
        p_auditpersonid,
        p_auditactionid,
        p_audittableid,
        p_auditrecordid,
        p_auditresultid,
        p_clinicpatientid
    );
END;
$$;

CREATE OR REPLACE FUNCTION consultarlogs(
    p_clinicid INT,
    p_auditpersonid INT,
    p_filterpersonid INT DEFAULT NULL,
    p_clinicpatientid INT DEFAULT NULL,
    p_startdate TIMESTAMPTZ DEFAULT NULL,
    p_enddate TIMESTAMPTZ DEFAULT NULL
)
RETURNS TABLE (
    auditlogid INT,
    auditpersonid INT,
    auditactionid INT,
    audittableid INT,
    auditrecordid INT,
    auditresultid INT,
    clinicpatientid INT,
    createdat TIMESTAMPTZ
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
        RAISE EXCEPTION 'Acceso denegado: solo el administrador de clínica puede consultar la auditoría.';
    END IF;

    RETURN QUERY
    SELECT
        l.auditlogid,
        l.auditpersonid,
        l.auditactionid,
        l.audittableid,
        l.auditrecordid,
        l.auditresultid,
        l.clinicpatientid,
        l.createdat
    FROM auditlogs l
    WHERE l.clinicid = p_clinicid
      AND (p_filterpersonid IS NULL OR l.auditpersonid = p_filterpersonid)
      AND (p_clinicpatientid IS NULL OR l.clinicpatientid = p_clinicpatientid)
      AND (p_startdate IS NULL OR l.createdat >= p_startdate)
      AND (p_enddate IS NULL OR l.createdat <= p_enddate)
    ORDER BY l.createdat DESC;
END;
$$;

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

-- CONSULTA DE DISPONIBILIDAD ----------------------------------------------------------------

CREATE OR REPLACE FUNCTION consultardisponibilidad(
    p_clinicid INT,
    p_auditpersonid INT,
    p_clinicprofessionalid INT,
    p_date DATE
)
RETURNS TABLE (
    slotstart TIMESTAMPTZ,
    slotend TIMESTAMPTZ
)
LANGUAGE plpgsql
AS $$
BEGIN
    -- Validar acceso del usuario
    IF NOT EXISTS (
        SELECT 1
        FROM users
        WHERE userid = p_auditpersonid
          AND clinicid = p_clinicid
          AND roleid IN (2, 3, 4)
          AND isactive
    ) THEN
        RAISE EXCEPTION 'Acceso denegado.';
    END IF;

    -- Validar que el profesional pertenezca a la clínica
    -- y que el usuario tenga permiso para consultar su agenda
    IF NOT EXISTS (
        SELECT 1
        FROM clinicprofessionals cp
        JOIN users u ON u.userid = p_auditpersonid
        WHERE cp.clinicprofessionalid = p_clinicprofessionalid
          AND cp.clinicid = p_clinicid
          AND cp.isactive
          AND (
              u.roleid IN (2, 3)
              OR cp.userid = p_auditpersonid
          )
    ) THEN
        RAISE EXCEPTION 'El profesional no pertenece a la clínica o el usuario no tiene permiso para consultar su agenda.';
    END IF;

    RETURN QUERY
    WITH schedule AS (
        -- Obtener los horarios del profesional para la fecha
        SELECT
            ps.professionalscheduleid,
            (p_date + ps.starttime) AT TIME ZONE c.clinictimezone AS starts,
            (p_date + ps.endtime) AT TIME ZONE c.clinictimezone AS ends
        FROM professionalschedules ps
        JOIN clinicprofessionals cp
            ON cp.clinicprofessionalid = ps.clinicprofessionalid
        JOIN clinics c
            ON c.clinicid = cp.clinicid
        WHERE cp.clinicprofessionalid = p_clinicprofessionalid
          AND cp.clinicid = p_clinicid
          AND ps.day = EXTRACT(ISODOW FROM p_date)::INT
          AND ps.isactive
    ),

    -- Obtener las citas reservadas que se traslapan con los horarios
    appointments_busy AS (
        SELECT
            s.professionalscheduleid,
            GREATEST(a.date, s.starts) AS busy_start,
            LEAST(a.enddatetime, s.ends) AS busy_end
        FROM schedule s
        JOIN appointments a
            ON a.clinicprofessionalid = p_clinicprofessionalid
           AND a.clinicid = p_clinicid
           AND a.appointmentstatusid = 1
           AND a.isblocked = false
           AND a.date < s.ends
           AND a.enddatetime > s.starts
    ),

    -- Obtener los bloqueos activos que se traslapan con los horarios
    blocks_busy AS (
        SELECT
            s.professionalscheduleid,
            GREATEST(b.startdatetime, s.starts) AS busy_start,
            LEAST(b.enddatetime, s.ends) AS busy_end
        FROM schedule s
        JOIN scheduleblocks b
            ON b.clinicprofessionalid = p_clinicprofessionalid
           AND b.isactive
           AND b.startdatetime < s.ends
           AND b.enddatetime > s.starts
    ),

    -- Unificar citas y bloqueos
    busy AS (
        SELECT * FROM appointments_busy
        UNION ALL
        SELECT * FROM blocks_busy
    ),

    -- Identificar el final máximo de los intervalos ocupados anteriores
    ordered_busy AS (
        SELECT
            professionalscheduleid,
            busy_start,
            busy_end,
            MAX(busy_end) OVER (
                PARTITION BY professionalscheduleid
                ORDER BY busy_start, busy_end
                ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING
            ) AS previous_end
        FROM busy
    ),

    -- Identificar grupos de intervalos ocupados que se traslapan
    grouped_busy AS (
        SELECT
            professionalscheduleid,
            busy_start,
            busy_end,
            SUM(
                CASE
                    WHEN previous_end IS NULL OR busy_start > previous_end
                    THEN 1
                    ELSE 0
                END
            ) OVER (
                PARTITION BY professionalscheduleid
                ORDER BY busy_start, busy_end
            ) AS group_id
        FROM ordered_busy
    ),

    -- Unir los intervalos ocupados
    merged_busy AS (
        SELECT
            professionalscheduleid,
            MIN(busy_start) AS busy_start,
            MAX(busy_end) AS busy_end
        FROM grouped_busy
        GROUP BY professionalscheduleid, group_id
    ),

    -- Obtener los intervalos libres anteriores y posteriores a los ocupados
    free_intervals AS (
        SELECT
            s.professionalscheduleid,
            s.starts AS free_start,
            MIN(m.busy_start) AS free_end
        FROM schedule s
        JOIN merged_busy m
            ON m.professionalscheduleid = s.professionalscheduleid
        GROUP BY s.professionalscheduleid, s.starts

        UNION ALL

        SELECT
            professionalscheduleid,
            busy_end AS free_start,
            LEAD(busy_start) OVER (
                PARTITION BY professionalscheduleid
                ORDER BY busy_start
            ) AS free_end
        FROM merged_busy

        UNION ALL

        SELECT
            s.professionalscheduleid,
            MAX(m.busy_end) AS free_start,
            s.ends AS free_end
        FROM schedule s
        JOIN merged_busy m
            ON m.professionalscheduleid = s.professionalscheduleid
        GROUP BY s.professionalscheduleid, s.ends
    ),

    -- Obtener los intervalos libres cuando no existen citas ni bloqueos
    empty_schedule AS (
        SELECT
            s.professionalscheduleid,
            s.starts AS free_start,
            s.ends AS free_end
        FROM schedule s
        WHERE NOT EXISTS (
            SELECT 1
            FROM merged_busy m
            WHERE m.professionalscheduleid = s.professionalscheduleid
        )
    ),

    all_free AS (
        SELECT * FROM free_intervals
        WHERE free_end IS NOT NULL

        UNION ALL

        SELECT * FROM empty_schedule
    )

    SELECT
        GREATEST(free_start, NOW()) AS slotstart,
        free_end AS slotend
    FROM all_free
    WHERE free_end > GREATEST(free_start, NOW())
    ORDER BY slotstart;

END;
$$;

CREATE OR REPLACE FUNCTION consultardisponibilidadservicio(
    p_clinicid INT,
    p_auditpersonid INT,
    p_clinicserviceid INT,
    p_startdate DATE,
    p_enddate DATE
)
RETURNS TABLE (
    clinicprofessionalid INT,
    professionalid INT,
    professionalname TEXT,
    startdatetime TIMESTAMPTZ,
    enddatetime TIMESTAMPTZ
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_roleid INT;
    v_duration INT;
    v_professional RECORD;
    v_date DATE;
BEGIN
    -- Validar usuario
    SELECT u.roleid
    INTO v_roleid
    FROM users u
    WHERE u.userid = p_auditpersonid
      AND u.clinicid = p_clinicid
      AND u.isactive = TRUE;

    IF v_roleid IS NULL OR v_roleid NOT IN (2, 3, 4) THEN
        RAISE EXCEPTION 'Acceso denegado.';
    END IF;

    IF p_startdate > p_enddate THEN
        RAISE EXCEPTION 'La fecha inicial no puede ser posterior a la fecha final.';
    END IF;

    -- Obtener duración del servicio
    SELECT cs.duration
    INTO v_duration
    FROM clinicservices cs
    WHERE cs.clinicserviceid = p_clinicserviceid
      AND cs.clinicid = p_clinicid
      AND cs.isactive = TRUE;

    IF v_duration IS NULL THEN
        RAISE EXCEPTION 'Servicio no disponible en esta clínica.';
    END IF;

    -- Consultar profesionales que ofrecen el servicio
    FOR v_professional IN
        SELECT
            cp.clinicprofessionalid,
            cp.professionalid,
            u.userid,
            u.name || ' ' || u.lastname AS professionalname
        FROM clinicprofessionalservices cps
        JOIN clinicprofessionals cp
          ON cp.clinicprofessionalid = cps.clinicprofessionalid
        JOIN professionals p
          ON p.professionalid = cp.professionalid
        JOIN users u
          ON u.userid = cp.userid
        WHERE cps.clinicserviceid = p_clinicserviceid
          AND cps.isactive = TRUE
          AND cp.clinicid = p_clinicid
          AND cp.isactive = TRUE
          AND p.isactive = TRUE
          AND u.isactive = TRUE
          AND (v_roleid <> 4 OR u.userid = p_auditpersonid)
    LOOP

        -- Recorrer las fechas del rango solicitado
        FOR v_date IN
            SELECT generate_series(
                p_startdate::TIMESTAMP,
                p_enddate::TIMESTAMP,
                INTERVAL '1 day'
            )::DATE
        LOOP

            -- Obtener espacios generales del profesional
            -- y comprobar si cabe el servicio solicitado
            RETURN QUERY
            SELECT
                v_professional.clinicprofessionalid,
                v_professional.professionalid,
                v_professional.professionalname,
                slots.slot_start,
                slots.slot_start + make_interval(mins => v_duration)
            FROM consultardisponibilidad(
                p_clinicid,
                p_auditpersonid,
                v_professional.clinicprofessionalid,
                v_date
            ) d
            CROSS JOIN LATERAL generate_series(
                d.startdatetime,
                d.enddatetime - make_interval(mins => v_duration),
                make_interval(mins => v_duration)
            ) AS slots(slot_start)
            WHERE slots.slot_start + make_interval(mins => v_duration)
                  <= d.enddatetime;

        END LOOP;
    END LOOP;
END;
$$;

-- GESTIÓN DE PACIENTES ----------------------------------------------------------------------

CREATE OR REPLACE PROCEDURE crearpaciente(
    p_clinicid INT,
    p_auditpersonid INT,
    p_identification VARCHAR(12),
    p_name VARCHAR(25),
    p_lastname VARCHAR(25),
    p_birthdate DATE,
    p_email VARCHAR(100),
    p_phone VARCHAR(20)
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_patientid INT;
    v_clinicpatientid INT;
BEGIN
    -- Validar que el usuario sea recepción
    IF NOT EXISTS (
        SELECT 1
        FROM users
        WHERE userid = p_auditpersonid
          AND clinicid = p_clinicid
          AND roleid = 3
          AND isactive = TRUE
    ) THEN
        RAISE EXCEPTION 'Solo recepción puede registrar pacientes.';
    END IF;

    -- Buscar si el paciente ya existe globalmente
    SELECT patientid
    INTO v_patientid
    FROM patients
    WHERE identification = p_identification;

    -- Crear el paciente si no existe
    IF v_patientid IS NULL THEN

        INSERT INTO patients (
            identification,
            name,
            lastname,
            birthdate,
            auditpersonid
        )
        VALUES (
            p_identification,
            p_name,
            p_lastname,
            p_birthdate,
            p_auditpersonid
        )
        RETURNING patientid INTO v_patientid;

        -- Registrar auditoría de creación del paciente
        CALL registrarlog(
            p_clinicid,
            p_auditpersonid,
            2,
            4,
            v_patientid,
            1,
            NULL
        );

    END IF;

    -- Buscar asociación existente con la clínica
    SELECT clinicpatientid
    INTO v_clinicpatientid
    FROM clinicpatients
    WHERE clinicid = p_clinicid
      AND patientid = v_patientid;

    IF v_clinicpatientid IS NOT NULL THEN

        -- Verificar si la asociación ya está activa
        IF EXISTS (
            SELECT 1
            FROM clinicpatients
            WHERE clinicpatientid = v_clinicpatientid
              AND isactive = TRUE
        ) THEN
            RAISE EXCEPTION 'El paciente ya se encuentra registrado en esta clínica.';
        END IF;

        -- Reactivar asociación existente
        UPDATE clinicpatients
        SET email = p_email,
            phone = p_phone,
            isactive = TRUE,
            updatedat = NOW(),
            auditpersonid = p_auditpersonid
        WHERE clinicpatientid = v_clinicpatientid;

        -- Registrar auditoría de actualización
        CALL registrarlog(
            p_clinicid,
            p_auditpersonid,
            3,
            1,
            v_clinicpatientid,
            1,
            v_clinicpatientid
        );

    ELSE

        -- Crear asociación del paciente con la clínica
        INSERT INTO clinicpatients (
            clinicid,
            patientid,
            email,
            phone,
            auditpersonid
        )
        VALUES (
            p_clinicid,
            v_patientid,
            p_email,
            p_phone,
            p_auditpersonid
        )
        RETURNING clinicpatientid INTO v_clinicpatientid;

        -- Registrar auditoría de creación de asociación
        CALL registrarlog(
            p_clinicid,
            p_auditpersonid,
            2,
            1,
            v_clinicpatientid,
            1,
            v_clinicpatientid
        );

    END IF;
END;
$$;

CREATE OR REPLACE PROCEDURE actualizarpaciente(
    p_clinicid INT,
    p_auditpersonid INT,
    p_clinicpatientid INT,
    p_name VARCHAR(25),
    p_lastname VARCHAR(25),
    p_birthdate DATE,
    p_email VARCHAR(100),
    p_phone VARCHAR(20)
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_patientid INT;
BEGIN
    -- Validar que el usuario sea recepción
    IF NOT EXISTS (
        SELECT 1
        FROM users
        WHERE userid = p_auditpersonid
          AND clinicid = p_clinicid
          AND roleid = 3
          AND isactive = TRUE
    ) THEN
        RAISE EXCEPTION 'Solo recepción puede actualizar pacientes.';
    END IF;

    -- Obtener el paciente asociado a la clínica
    SELECT cp.patientid
    INTO v_patientid
    FROM clinicpatients cp
    WHERE cp.clinicpatientid = p_clinicpatientid
      AND cp.clinicid = p_clinicid
      AND cp.isactive = TRUE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Paciente no encontrado en esta clínica.';
    END IF;

    -- Actualizar datos generales del paciente
    UPDATE patients
    SET name = p_name,
        lastname = p_lastname,
        birthdate = p_birthdate,
        updatedat = NOW(),
        auditpersonid = p_auditpersonid
    WHERE patientid = v_patientid;

    -- Registrar auditoría de datos generales
    CALL registrarlog(
        p_clinicid,
        p_auditpersonid,
        3,
        4,
        v_patientid,
        1,
        p_clinicpatientid
    );

    -- Actualizar datos específicos de la clínica
    UPDATE clinicpatients
    SET email = p_email,
        phone = p_phone,
        updatedat = NOW(),
        auditpersonid = p_auditpersonid
    WHERE clinicpatientid = p_clinicpatientid;

    -- Registrar auditoría de datos de contacto
    CALL registrarlog(
        p_clinicid,
        p_auditpersonid,
        3,
        1,
        p_clinicpatientid,
        1,
        p_clinicpatientid
    );

END;
$$;


CREATE OR REPLACE FUNCTION consultarpacientes(
    p_clinicid INT,
    p_auditpersonid INT,
    p_search VARCHAR(100) DEFAULT NULL
)
RETURNS TABLE (
    clinicpatientid INT,
    patientid INT,
    identification VARCHAR,
    name VARCHAR,
    lastname VARCHAR,
    birthdate DATE,
    email VARCHAR,
    phone VARCHAR
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_roleid INT;
    v_patient RECORD;
BEGIN
    -- Validar usuario
    SELECT roleid
    INTO v_roleid
    FROM users
    WHERE userid = p_auditpersonid
      AND clinicid = p_clinicid
      AND isactive = TRUE;

    IF v_roleid IS NULL OR v_roleid NOT IN (2, 3, 4) THEN
        RAISE EXCEPTION 'Acceso denegado.';
    END IF;

    -- Consultar pacientes de la clínica
    FOR v_patient IN
        SELECT
            cp.clinicpatientid,
            cp.patientid,
            p.identification,
            p.name,
            p.lastname,
            p.birthdate,
            cp.email,
            cp.phone
        FROM clinicpatients cp
        JOIN patients p
          ON p.patientid = cp.patientid
        WHERE cp.clinicid = p_clinicid
          AND cp.isactive = TRUE
          AND p.isactive = TRUE
          AND (
              p_search IS NULL
              OR p.identification ILIKE '%' || p_search || '%'
              OR p.name ILIKE '%' || p_search || '%'
              OR p.lastname ILIKE '%' || p_search || '%'
          )
          AND (
              v_roleid IN (2, 3)
              OR EXISTS (
                  SELECT 1
                  FROM appointments a
                  JOIN clinicprofessionals cp2
                    ON cp2.clinicprofessionalid = a.clinicprofessionalid
                  WHERE a.clinicpatientid = cp.clinicpatientid
                    AND cp2.userid = p_auditpersonid
              )
          )
    LOOP

        -- Registrar auditoría de consulta de datos de contacto
        CALL registrarlog(
            p_clinicid,
            p_auditpersonid,
            1,
            1,
            v_patient.clinicpatientid,
            1,
            v_patient.clinicpatientid
        );

        RETURN QUERY
        SELECT
            v_patient.clinicpatientid,
            v_patient.patientid,
            v_patient.identification,
            v_patient.name,
            v_patient.lastname,
            v_patient.birthdate,
            v_patient.email,
            v_patient.phone;

    END LOOP;
END;
$$;

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

-- NOTAS CLÍNICAS ----------------------------------------------------------------------------

CREATE OR REPLACE PROCEDURE crearnota(
    p_clinicid INT,
    p_auditpersonid INT,
    p_appointmentid INT,
    p_content TEXT
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_clinicprofessionalid INT;
    v_clinicpatientid INT;
    v_clinicalnoteid INT;
BEGIN
    -- Validar que la cita esté atendida
    -- y que el usuario sea el profesional asignado
    SELECT
        a.clinicprofessionalid,
        a.clinicpatientid
    INTO
        v_clinicprofessionalid,
        v_clinicpatientid
    FROM appointments a
    JOIN clinicprofessionals cp
        ON cp.clinicprofessionalid = a.clinicprofessionalid
    JOIN users u
        ON u.userid = cp.userid
    WHERE a.appointmentid = p_appointmentid
      AND a.clinicid = p_clinicid
      AND a.appointmentstatusid = 2
      AND cp.isactive
      AND u.userid = p_auditpersonid
      AND u.clinicid = p_clinicid
      AND u.roleid = 4
      AND u.isactive;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Solo el profesional asignado puede crear notas de citas atendidas.';
    END IF;

    IF p_content IS NULL OR trim(p_content) = '' THEN
        RAISE EXCEPTION 'El contenido de la nota clínica es obligatorio.';
    END IF;

    -- Registrar la nota clínica
    INSERT INTO clinicalnotes(
        appointmentid,
        content,
        clinicprofessionalid
    )
    VALUES (
        p_appointmentid,
        p_content,
        v_clinicprofessionalid
    )
    RETURNING clinicalnoteid INTO v_clinicalnoteid;

    -- Registrar auditoría
    CALL registrarlog(
        p_clinicid,
        p_auditpersonid,
        2,
        2,
        v_clinicalnoteid,
        1,
        v_clinicpatientid
    );
END;
$$;

CREATE OR REPLACE FUNCTION consultarnota(
    p_clinicid INT,
    p_auditpersonid INT,
    p_appointmentid INT
)
RETURNS TABLE (
    clinicalnoteid INT,
    appointmentid INT,
    content TEXT,
    createdat TIMESTAMPTZ,
    updatedat TIMESTAMPTZ
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_clinicalnoteid INT;
    v_clinicpatientid INT;
BEGIN
    -- Validar que el usuario sea el profesional asignado
    IF NOT EXISTS (
        SELECT 1
        FROM appointments a
        JOIN clinicprofessionals cp
            ON cp.clinicprofessionalid = a.clinicprofessionalid
        JOIN users u
            ON u.userid = cp.userid
        WHERE a.appointmentid = p_appointmentid
          AND a.clinicid = p_clinicid
          AND cp.isactive
          AND u.userid = p_auditpersonid
          AND u.clinicid = p_clinicid
          AND u.roleid = 4
          AND u.isactive
    ) THEN
        RAISE EXCEPTION 'Solo el profesional asignado puede consultar la nota clínica.';
    END IF;

    -- Obtener la nota activa
    SELECT
        cn.clinicalnoteid,
        a.clinicpatientid
    INTO
        v_clinicalnoteid,
        v_clinicpatientid
    FROM clinicalnotes cn
    JOIN appointments a
        ON a.appointmentid = cn.appointmentid
    WHERE cn.appointmentid = p_appointmentid
      AND a.clinicid = p_clinicid
      AND cn.isactive;

    -- Registrar la consulta si existe una nota
    IF FOUND THEN
        CALL registrarlog(
            p_clinicid,
            p_auditpersonid,
            1,
            2,
            v_clinicalnoteid,
            1,
            v_clinicpatientid
        );
    END IF;

    -- Devolver la nota clínica
    RETURN QUERY
    SELECT
        cn.clinicalnoteid,
        cn.appointmentid,
        cn.content,
        cn.createdat,
        cn.updatedat
    FROM clinicalnotes cn
    WHERE cn.appointmentid = p_appointmentid
      AND cn.isactive;
END;
$$;

CREATE OR REPLACE PROCEDURE actualizarnota(
    p_clinicid INT,
    p_auditpersonid INT,
    p_clinicalnoteid INT,
    p_content TEXT
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_appointmentid INT;
    v_clinicpatientid INT;
BEGIN
    -- Validar el contenido
    IF p_content IS NULL OR trim(p_content) = '' THEN
        RAISE EXCEPTION 'El contenido de la nota clínica es obligatorio.';
    END IF;

    -- Validar que el usuario sea el profesional
    -- que elaboró la nota de una cita atendida
    SELECT
        a.appointmentid,
        a.clinicpatientid
    INTO
        v_appointmentid,
        v_clinicpatientid
    FROM clinicalnotes cn
    JOIN appointments a
        ON a.appointmentid = cn.appointmentid
    JOIN clinicprofessionals cp
        ON cp.clinicprofessionalid = cn.clinicprofessionalid
    JOIN users u
        ON u.userid = cp.userid
    WHERE cn.clinicalnoteid = p_clinicalnoteid
      AND cn.isactive
      AND a.clinicid = p_clinicid
      AND a.appointmentstatusid = 2
      AND cp.isactive
      AND u.userid = p_auditpersonid
      AND u.clinicid = p_clinicid
      AND u.roleid = 4
      AND u.isactive;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Solo el profesional que elaboró la nota puede modificarla.';
    END IF;

    -- Actualizar la nota
    UPDATE clinicalnotes
    SET content = p_content,
        updatedat = now()
    WHERE clinicalnoteid = p_clinicalnoteid;

    -- Registrar auditoría
    CALL registrarlog(
        p_clinicid,
        p_auditpersonid,
        3,
        2,
        p_clinicalnoteid,
        1,
        v_clinicpatientid
    );
END;
$$;