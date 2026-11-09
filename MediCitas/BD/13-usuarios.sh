#!/usr/bin/env bash
set -euo pipefail

# Validar variables de entorno
: "${POSTGRES_USER:?Variable POSTGRES_USER no definida}"
: "${POSTGRES_DB:?Variable POSTGRES_DB no definida}"

: "${ADMIN_GENERAL_USER:?Variable ADMIN_GENERAL_USER no definida}"
: "${ADMIN_CLINICA_USER:?Variable ADMIN_CLINICA_USER no definida}"
: "${RECEPCION_USER:?Variable RECEPCION_USER no definida}"
: "${PROFESIONAL_USER:?Variable PROFESIONAL_USER no definida}"

: "${ADMIN_GENERAL_PASSWORD:?Variable ADMIN_GENERAL_PASSWORD no definida}"
: "${ADMIN_CLINICA_PASSWORD:?Variable ADMIN_CLINICA_PASSWORD no definida}"
: "${RECEPCION_PASSWORD:?Variable RECEPCION_PASSWORD no definida}"
: "${PROFESIONAL_PASSWORD:?Variable PROFESIONAL_PASSWORD no definida}"

# Crear usuarios y asignar roles
psql \
  --username "$POSTGRES_USER" \
  --dbname "$POSTGRES_DB" \
  --set=ON_ERROR_STOP=1 \
  --set="ADMIN_GENERAL_USER=$ADMIN_GENERAL_USER" \
  --set="ADMIN_CLINICA_USER=$ADMIN_CLINICA_USER" \
  --set="RECEPCION_USER=$RECEPCION_USER" \
  --set="PROFESIONAL_USER=$PROFESIONAL_USER" \
  --set="ADMIN_GENERAL_PASSWORD=$ADMIN_GENERAL_PASSWORD" \
  --set="ADMIN_CLINICA_PASSWORD=$ADMIN_CLINICA_PASSWORD" \
  --set="RECEPCION_PASSWORD=$RECEPCION_PASSWORD" \
  --set="PROFESIONAL_PASSWORD=$PROFESIONAL_PASSWORD" <<'SQL'

SELECT format(
    'CREATE ROLE %I LOGIN PASSWORD %L',
    :'ADMIN_GENERAL_USER',
    :'ADMIN_GENERAL_PASSWORD'
)
WHERE NOT EXISTS (
    SELECT 1 FROM pg_roles
    WHERE rolname = :'ADMIN_GENERAL_USER'
)
\gexec

SELECT format(
    'CREATE ROLE %I LOGIN PASSWORD %L',
    :'ADMIN_CLINICA_USER',
    :'ADMIN_CLINICA_PASSWORD'
)
WHERE NOT EXISTS (
    SELECT 1 FROM pg_roles
    WHERE rolname = :'ADMIN_CLINICA_USER'
)
\gexec

SELECT format(
    'CREATE ROLE %I LOGIN PASSWORD %L',
    :'RECEPCION_USER',
    :'RECEPCION_PASSWORD'
)
WHERE NOT EXISTS (
    SELECT 1 FROM pg_roles
    WHERE rolname = :'RECEPCION_USER'
)
\gexec

SELECT format(
    'CREATE ROLE %I LOGIN PASSWORD %L',
    :'PROFESIONAL_USER',
    :'PROFESIONAL_PASSWORD'
)
WHERE NOT EXISTS (
    SELECT 1 FROM pg_roles
    WHERE rolname = :'PROFESIONAL_USER'
)
\gexec

-- Asignar los roles de permisos
GRANT rol_admin_general TO :"ADMIN_GENERAL_USER";
GRANT rol_admin_clinica TO :"ADMIN_CLINICA_USER";
GRANT rol_recepcion TO :"RECEPCION_USER";
GRANT rol_profesional TO :"PROFESIONAL_USER";

SQL

echo "Usuarios de conexión de MediCitas creados correctamente."
