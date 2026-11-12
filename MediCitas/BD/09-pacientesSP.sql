-- GESTIÓN DE PACIENTES ----------------------------------------------------------------------

CREATE OR REPLACE PROCEDURE crearpaciente(
    IN p_clinicid INT,
    IN p_auditpersonid INT,
    IN p_identification VARCHAR(12),
    IN p_name VARCHAR(25),
    IN p_lastname VARCHAR(25),
    IN p_birthdate DATE,
    IN p_email VARCHAR(100),
    IN p_phone VARCHAR(20),
    OUT p_clinicpatientid INT
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_patientid INT;
    v_clinicpatientid INT;
    v_patientactive BOOLEAN;
BEGIN
    -- Validar que el usuario sea recepción o administrador de clínica
    IF NOT EXISTS (
        SELECT 1
        FROM users
        WHERE userid = p_auditpersonid
          AND clinicid = p_clinicid
          AND roleid IN (2, 3)
          AND isactive = TRUE
    ) THEN
        RAISE EXCEPTION 'Solo recepción o el administrador de clínica puede registrar pacientes.';
    END IF;

    -- Buscar si el paciente ya existe globalmente
    SELECT patientid, isactive
    INTO v_patientid, v_patientactive
    FROM patients
    WHERE identification = p_identification;

    -- Si existe, verificar que esté activo
    IF FOUND THEN

        IF v_patientactive = FALSE THEN
            RAISE EXCEPTION 'La identificación ya existe en un paciente inactivo.';
        END IF;

    ELSE

        -- Crear el paciente si no existe
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

    IF FOUND THEN

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

    -- Devolver el identificador de la asociación
    p_clinicpatientid := v_clinicpatientid;

END;
$$;

CREATE OR REPLACE PROCEDURE actualizarpaciente(
    IN p_clinicid INT,
    IN p_auditpersonid INT,
    IN p_clinicpatientid INT,
    IN p_identification VARCHAR(12),
    IN p_name VARCHAR(25),
    IN p_lastname VARCHAR(25),
    IN p_birthdate DATE,
    IN p_email VARCHAR(100),
    IN p_phone VARCHAR(20)
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_patientid INT;
BEGIN
    -- Validar que el usuario sea recepción o administrador de clínica
    IF NOT EXISTS (
        SELECT 1
        FROM users
        WHERE userid = p_auditpersonid
          AND clinicid = p_clinicid
          AND roleid IN (2, 3)
          AND isactive = TRUE
    ) THEN
        RAISE EXCEPTION 'Solo recepción o el administrador de clínica puede actualizar pacientes.';
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
    SET identification = p_identification,
        name = p_name,
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
    p_clinicpatientid INT DEFAULT NULL
)
RETURNS TABLE (
    clinicpatientid INT,
    identification VARCHAR,
    name VARCHAR,
    lastname VARCHAR,
    birthdate VARCHAR,
    email VARCHAR,
    phone VARCHAR
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_clinicpatientid INT;
BEGIN
    -- Validar usuario
    IF NOT EXISTS (
        SELECT 1
        FROM users
        WHERE userid = p_auditpersonid
          AND clinicid = p_clinicid
          AND isactive = TRUE
          AND roleid IN (2, 3, 4)
    ) THEN
        RAISE EXCEPTION 'Acceso denegado.';
    END IF;

    -- Registrar auditoría por cada paciente consultado
    FOR v_clinicpatientid IN
        SELECT cp.clinicpatientid
        FROM clinicpatients cp
        JOIN patients p
            ON p.patientid = cp.patientid
        WHERE cp.clinicid = p_clinicid
          AND cp.isactive = TRUE
          AND p.isactive = TRUE
          AND (
              p_clinicpatientid IS NULL
              OR cp.clinicpatientid = p_clinicpatientid
          )
          AND (
              EXISTS (
                  SELECT 1
                  FROM users u
                  WHERE u.userid = p_auditpersonid
                    AND u.isactive = TRUE
                    AND u.roleid IN (2, 3)
              )
              OR EXISTS (
                  SELECT 1
                  FROM appointments a
                  JOIN clinicprofessionals cp2
                      ON cp2.clinicprofessionalid = a.clinicprofessionalid
                  JOIN users u
                      ON u.userid = cp2.userid
                  WHERE a.clinicpatientid = cp.clinicpatientid
                    AND u.userid = p_auditpersonid
                    AND u.isactive = TRUE
              )
          )
    LOOP
        CALL registrarlog(
            p_clinicid,
            p_auditpersonid,
            1,
            1,
            v_clinicpatientid,
            1,
            v_clinicpatientid
        );
    END LOOP;

    -- Consultar pacientes
    RETURN QUERY
    SELECT
        cp.clinicpatientid,
        p.identification,
        p.name,
        p.lastname,
        TO_CHAR(p.birthdate, 'YYYY-MM-DD')::VARCHAR AS birthdate,
        cp.email,
        cp.phone
    FROM clinicpatients cp
    JOIN patients p
        ON p.patientid = cp.patientid
    WHERE cp.clinicid = p_clinicid
      AND cp.isactive = TRUE
      AND p.isactive = TRUE
      AND (
          p_clinicpatientid IS NULL
          OR cp.clinicpatientid = p_clinicpatientid
      )
      AND (
          EXISTS (
              SELECT 1
              FROM users u
              WHERE u.userid = p_auditpersonid
                AND u.isactive = TRUE
                AND u.roleid IN (2, 3)
          )
          OR EXISTS (
              SELECT 1
              FROM appointments a
              JOIN clinicprofessionals cp2
                  ON cp2.clinicprofessionalid = a.clinicprofessionalid
              JOIN users u
                  ON u.userid = cp2.userid
              WHERE a.clinicpatientid = cp.clinicpatientid
                AND u.userid = p_auditpersonid
                AND u.isactive = TRUE
          )
      );

END;
$$;