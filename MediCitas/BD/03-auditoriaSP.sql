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

DROP FUNCTION IF EXISTS public.consultarlogs(INT, INT, INT, INT, TIMESTAMPTZ, TIMESTAMPTZ);

CREATE OR REPLACE FUNCTION public.consultarlogs(
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
    useridentification VARCHAR(12),
    username VARCHAR(25),
    userlastname VARCHAR(25),
    auditactionid INT,
    actionname VARCHAR(30),
    audittableid INT,
    tablename VARCHAR(30),
    auditrecordid INT,
    auditresultid INT,
    resultname VARCHAR(30),
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
        u.identification AS useridentification,
        u.name AS username,
        u.lastname AS userlastname,
        l.auditactionid,
        a.name AS actionname,
        l.audittableid,
        t.name AS tablename,
        l.auditrecordid,
        l.auditresultid,
        r.name AS resultname,
        l.clinicpatientid,
        l.createdat
    FROM auditlogs l
    LEFT JOIN users u ON u.userid = l.auditpersonid
    LEFT JOIN auditactions a ON a.auditactionid = l.auditactionid
    LEFT JOIN audittables t ON t.audittableid = l.audittableid
    LEFT JOIN auditresults r ON r.auditresultid = l.auditresultid
    WHERE l.clinicid = p_clinicid
      AND (p_filterpersonid IS NULL OR l.auditpersonid = p_filterpersonid)
      AND (p_clinicpatientid IS NULL OR l.clinicpatientid = p_clinicpatientid)
      AND (p_startdate IS NULL OR l.createdat >= p_startdate)
      AND (p_enddate IS NULL OR l.createdat <= p_enddate)
    ORDER BY l.createdat DESC;
END;
$$;