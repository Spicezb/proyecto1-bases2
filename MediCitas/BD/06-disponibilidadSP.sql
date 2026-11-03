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
                d.slotstart,
                d.slotend - make_interval(mins => v_duration),
                make_interval(mins => v_duration)
            ) AS slots(slot_start)
            WHERE slots.slot_start + make_interval(mins => v_duration)
                  <= d.slotend;

        END LOOP;
    END LOOP;
END;
$$;