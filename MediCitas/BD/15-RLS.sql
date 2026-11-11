--rls

-- funciones

--general
CREATE OR REPLACE FUNCTION obtener_clinic_id()
RETURNS INTEGER
LANGUAGE SQL
STABLE
AS $$
    SELECT NULLIF(
        current_setting('app.clinic_id', true),
        ''
    )::INTEGER;
$$;

-- de relacion

CREATE OR REPLACE FUNCTION public.rls_clinicprofessionalservice(
    p_clinicprofessionalid INTEGER,
    p_clinicserviceid INTEGER
)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.clinicprofessionals cp
        JOIN public.clinicservices cs
            ON cs.clinicserviceid = p_clinicserviceid
        WHERE cp.clinicprofessionalid = p_clinicprofessionalid
          AND cp.clinicid = public.obtener_clinic_id()
          AND cs.clinicid = public.obtener_clinic_id()
    );
$$;

CREATE OR REPLACE FUNCTION public.rls_professionalschedule(
    p_clinicprofessionalid INTEGER
)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.clinicprofessionals cp
        WHERE cp.clinicprofessionalid = p_clinicprofessionalid
          AND cp.clinicid = public.obtener_clinic_id()
    );
$$;

CREATE OR REPLACE FUNCTION public.rls_scheduleblock(
    p_clinicprofessionalid INTEGER
)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.clinicprofessionals cp
        WHERE cp.clinicprofessionalid = p_clinicprofessionalid
          AND cp.clinicid = public.obtener_clinic_id()
    );
$$;

CREATE OR REPLACE FUNCTION public.rls_clinicalnote(
    p_appointmentid INTEGER,
    p_clinicprofessionalid INTEGER
)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.appointments a
        WHERE a.appointmentid = p_appointmentid
          AND a.clinicid = public.obtener_clinic_id()
          AND a.clinicprofessionalid = p_clinicprofessionalid
    );
$$;

-- policy

-- por columna
ALTER TABLE clinicpatients ENABLE ROW LEVEL SECURITY;
ALTER TABLE clinicpatients FORCE ROW LEVEL SECURITY;

CREATE POLICY clinicpatients_isolation
ON clinicpatients
FOR ALL
USING (clinicid = obtener_clinic_id())
WITH CHECK (clinicid = obtener_clinic_id());

ALTER TABLE clinicprofessionals ENABLE ROW LEVEL SECURITY;
ALTER TABLE clinicprofessionals FORCE ROW LEVEL SECURITY;

CREATE POLICY clinicprofessionals_isolation
ON clinicprofessionals
FOR ALL
USING (clinicid = obtener_clinic_id())
WITH CHECK (clinicid = obtener_clinic_id());


ALTER TABLE clinicservices ENABLE ROW LEVEL SECURITY;
ALTER TABLE clinicservices FORCE ROW LEVEL SECURITY;

CREATE POLICY clinicservices_isolation
ON clinicservices
FOR ALL
USING (clinicid = obtener_clinic_id())
WITH CHECK (clinicid = obtener_clinic_id());


ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments FORCE ROW LEVEL SECURITY;

CREATE POLICY appointments_isolation
ON appointments
FOR ALL
USING (clinicid = obtener_clinic_id())
WITH CHECK (clinicid = obtener_clinic_id());


ALTER TABLE auditlogs ENABLE ROW LEVEL SECURITY;
ALTER TABLE auditlogs FORCE ROW LEVEL SECURITY;

CREATE POLICY auditlogs_isolation
ON auditlogs
FOR ALL
USING (clinicid = obtener_clinic_id())
WITH CHECK (clinicid = obtener_clinic_id());

-- por relación

ALTER TABLE public.clinicprofessionalservices
ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.clinicprofessionalservices
FORCE ROW LEVEL SECURITY;

CREATE POLICY clinicprofessionalservices_isolation
ON public.clinicprofessionalservices
FOR ALL
USING (
    public.rls_clinicprofessionalservice(
        clinicprofessionalid,
        clinicserviceid
    )
)
WITH CHECK (
    public.rls_clinicprofessionalservice(
        clinicprofessionalid,
        clinicserviceid
    )
);

ALTER TABLE public.professionalschedules
ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.professionalschedules
FORCE ROW LEVEL SECURITY;

CREATE POLICY professionalschedules_isolation
ON public.professionalschedules
FOR ALL
USING (
    public.rls_professionalschedule(clinicprofessionalid)
)
WITH CHECK (
    public.rls_professionalschedule(clinicprofessionalid)
);

ALTER TABLE public.scheduleblocks
ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.scheduleblocks
FORCE ROW LEVEL SECURITY;

CREATE POLICY scheduleblocks_isolation
ON public.scheduleblocks
FOR ALL
USING (
    public.rls_scheduleblock(clinicprofessionalid)
)
WITH CHECK (
    public.rls_scheduleblock(clinicprofessionalid)
);

ALTER TABLE public.clinicalnotes
ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.clinicalnotes
FORCE ROW LEVEL SECURITY;

CREATE POLICY clinicalnotes_isolation
ON public.clinicalnotes
FOR ALL
USING (
    public.rls_clinicalnote(
        appointmentid,
        clinicprofessionalid
    )
)
WITH CHECK (
    public.rls_clinicalnote(
        appointmentid,
        clinicprofessionalid
    )
);

-- permisos a los roles sobre las funciones de rls

GRANT EXECUTE ON FUNCTION public.obtener_clinic_id()
TO rol_admin_general, rol_admin_clinica, rol_recepcion, rol_profesional;

GRANT EXECUTE ON FUNCTION public.rls_clinicprofessionalservice(INTEGER, INTEGER)
TO rol_admin_general, rol_admin_clinica, rol_recepcion, rol_profesional;

GRANT EXECUTE ON FUNCTION public.rls_professionalschedule(INTEGER)
TO rol_admin_general, rol_admin_clinica, rol_recepcion, rol_profesional;

GRANT EXECUTE ON FUNCTION public.rls_scheduleblock(INTEGER)
TO rol_admin_general, rol_admin_clinica, rol_recepcion, rol_profesional;

GRANT EXECUTE ON FUNCTION public.rls_clinicalnote(INTEGER, INTEGER)
TO rol_admin_general, rol_admin_clinica, rol_recepcion, rol_profesional;

-- rol

CREATE ROLE rol_security
WITH
    NOLOGIN
    NOSUPERUSER
    NOBYPASSRLS
    NOCREATEDB
    NOCREATEROLE;

GRANT USAGE ON SCHEMA public TO rol_security;

GRANT SELECT, INSERT, UPDATE, DELETE
ON ALL TABLES IN SCHEMA public
TO rol_security;

GRANT USAGE, SELECT, UPDATE
ON ALL SEQUENCES IN SCHEMA public
TO rol_security;

BEGIN;

GRANT CREATE ON SCHEMA public TO rol_security;

DO $$
DECLARE
    rutina RECORD;
    firma TEXT;
BEGIN

    FOR rutina IN
        SELECT
            p.oid,
            p.proname,
            p.prokind,
            n.nspname,
            pg_get_function_identity_arguments(p.oid) AS argumentos
        FROM pg_proc p
        JOIN pg_namespace n
            ON n.oid = p.pronamespace
        WHERE n.nspname = 'public'
          AND p.prokind IN ('f', 'p')

          -- Excluir funciones pertenecientes a extensiones.
          AND NOT EXISTS (
              SELECT 1
              FROM pg_depend d
              WHERE d.classid = 'pg_proc'::regclass
                AND d.objid = p.oid
                AND d.deptype = 'e'
          )
    LOOP

        firma := format(
            '%I.%I(%s)',
            rutina.nspname,
            rutina.proname,
            rutina.argumentos
        );

        IF rutina.prokind = 'f' THEN

            EXECUTE format(
                'ALTER FUNCTION %s OWNER TO rol_security',
                firma
            );

            EXECUTE format(
                'ALTER FUNCTION %s SECURITY DEFINER',
                firma
            );

            EXECUTE format(
                'ALTER FUNCTION %s SET search_path = pg_catalog, public',
                firma
            );

        ELSIF rutina.prokind = 'p' THEN

            EXECUTE format(
                'ALTER PROCEDURE %s OWNER TO rol_security',
                firma
            );

            EXECUTE format(
                'ALTER PROCEDURE %s SECURITY DEFINER',
                firma
            );

            EXECUTE format(
                'ALTER PROCEDURE %s SET search_path = pg_catalog, public',
                firma
            );

        END IF;

        RAISE NOTICE 'Rutina configurada: %', firma;

    END LOOP;

END;
$$;

-- Retirar el permiso temporal de creación.
REVOKE CREATE ON SCHEMA public FROM rol_security;

COMMIT;
