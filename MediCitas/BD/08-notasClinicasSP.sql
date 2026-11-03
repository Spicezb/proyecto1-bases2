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