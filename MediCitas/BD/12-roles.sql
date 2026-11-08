CREATE ROLE rol_admin_general NOLOGIN;

CREATE ROLE rol_admin_clinica NOLOGIN;

CREATE ROLE rol_recepcion NOLOGIN;

CREATE ROLE rol_profesional NOLOGIN;

-- Quitar los privilegios generales de PUBLIC sobre el esquema.
REVOKE ALL ON SCHEMA public FROM PUBLIC;

-- Permitir que los roles de aplicación utilicen el esquema.
GRANT USAGE ON SCHEMA public TO
    rol_admin_general,
    rol_admin_clinica,
    rol_recepcion,
    rol_profesional;

-- Revocar acceso directo a las tablas.
REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public
FROM
    PUBLIC,
    rol_admin_general,
    rol_admin_clinica,
    rol_recepcion,
    rol_profesional;

-- Revocar acceso directo a las secuencias.
REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public
FROM
    PUBLIC,
    rol_admin_general,
    rol_admin_clinica,
    rol_recepcion,
    rol_profesional;

DO $$
DECLARE
    r RECORD;
BEGIN

    FOR r IN
        SELECT
            p.proname,
            pg_get_function_identity_arguments(p.oid) AS argumentos,
            asignacion.rol
        FROM pg_proc p
        JOIN pg_namespace n
            ON n.oid = p.pronamespace
        JOIN (
            VALUES

                -- admin general
                ('crearclinica', 'rol_admin_general'),

                -- admin de la clínica
                ('crearusuario', 'rol_admin_clinica'),
                ('cambiarrolusuario', 'rol_admin_clinica'),
                ('desactivarusuario', 'rol_admin_clinica'),
                ('consultarusuarios', 'rol_admin_clinica'),

                ('crearprofesional', 'rol_admin_clinica'),
                ('actualizarprofesional', 'rol_admin_clinica'),
                ('consultarprofesionales', 'rol_admin_clinica'),
                ('asignarservicioprofesional', 'rol_admin_clinica'),

                ('crearservicio', 'rol_admin_clinica'),
                ('actualizarservicio', 'rol_admin_clinica'),
                ('consultarservicios', 'rol_admin_clinica'),

                ('crearhorario', 'rol_admin_clinica'),
                ('actualizarhorario', 'rol_admin_clinica'),
                ('crearbloqueo', 'rol_admin_clinica'),
                ('actualizarbloqueo', 'rol_admin_clinica'),
                ('consultarhorarios', 'rol_admin_clinica'),

                ('crearpaciente', 'rol_admin_clinica'),
                ('actualizarpaciente', 'rol_admin_clinica'),
                ('consultarpacientes', 'rol_admin_clinica'),

                ('reservarcita', 'rol_admin_clinica'),
                ('reprogramarcita', 'rol_admin_clinica'),
                ('cambiarestadocita', 'rol_admin_clinica'),

                ('consultaragenda', 'rol_admin_clinica'),
                ('consultarcitaspaciente', 'rol_admin_clinica'),

                ('consultarlogs', 'rol_admin_clinica'),
                ('contarcitasporestado', 'rol_admin_clinica'),

                -- recepción
                ('consultardisponibilidad', 'rol_recepcion'),
                ('consultardisponibilidadservicio', 'rol_recepcion'),

                ('crearpaciente', 'rol_recepcion'),
                ('actualizarpaciente', 'rol_recepcion'),
                ('consultarpacientes', 'rol_recepcion'),

                ('reservarcita', 'rol_recepcion'),
                ('reprogramarcita', 'rol_recepcion'),
                ('cambiarestadocita', 'rol_recepcion'),

                ('consultaragenda', 'rol_recepcion'),
                ('consultarcitaspaciente', 'rol_recepcion'),

                -- profesional
                ('consultardisponibilidad', 'rol_profesional'),
                ('consultardisponibilidadservicio', 'rol_profesional'),

                ('crearhorario', 'rol_profesional'),
                ('actualizarhorario', 'rol_profesional'),
                ('crearbloqueo', 'rol_profesional'),
                ('actualizarbloqueo', 'rol_profesional'),
                ('consultarhorarios', 'rol_profesional'),

                ('consultarpacientes', 'rol_profesional'),

                ('reservarcita', 'rol_profesional'),
                ('cambiarestadocita', 'rol_profesional'),

                ('consultaragenda', 'rol_profesional'),
                ('consultarcitaspaciente', 'rol_profesional'),

                ('crearnota', 'rol_profesional'),
                ('actualizarnota', 'rol_profesional'),
                ('consultarnota', 'rol_profesional')

        ) AS asignacion(nombre, rol)
            ON asignacion.nombre = p.proname

        WHERE n.nspname = 'public'
          AND p.prokind IN ('f', 'p')

    LOOP

        -- Retirar ejecución pública
        EXECUTE format(
            'REVOKE EXECUTE ON ROUTINE public.%I(%s) FROM PUBLIC',
            r.proname,
            r.argumentos
        );

        -- Conceder ejecución al rol correspondiente
        EXECUTE format(
            'GRANT EXECUTE ON ROUTINE public.%I(%s) TO %I',
            r.proname,
            r.argumentos,
            r.rol
        );

    END LOOP;

    FOR r IN
        SELECT
            p.proname,
            pg_get_function_identity_arguments(p.oid) AS argumentos
        FROM pg_proc p
        JOIN pg_namespace n
            ON n.oid = p.pronamespace
        WHERE n.nspname = 'public'
          AND p.proname = 'registrarlog'
          AND p.prokind IN ('f', 'p')

    LOOP

        EXECUTE format(
            'REVOKE EXECUTE ON ROUTINE public.%I(%s)
             FROM PUBLIC, rol_admin_general,
                  rol_admin_clinica, rol_recepcion,
                  rol_profesional',
            r.proname,
            r.argumentos
        );

    END LOOP;

END
$$;