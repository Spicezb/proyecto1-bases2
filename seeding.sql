-- seeding inicial de medicitas
-- ejecutar después de medicitas_creacion.sql
-- todos los identificadores están en minúsculas y sin guiones bajos.
-- datos ficticios para desarrollo y pruebas.

begin;

-- roles
insert into roles (name, description) values
('administrador de plataforma', 'administra la plataforma y registra clínicas'),
('administrador de clínica', 'administra usuarios, profesionales y servicios'),
('recepción', 'gestiona pacientes y agenda'),
('profesional de salud', 'consulta su agenda y registra notas clínicas');

-- estados de cita
insert into appointmentstatuses (name, description) values
('reservada', 'cita confirmada pendiente de atención'),
('atendida', 'cita que recibió atención'),
('ausente', 'el paciente no asistió'),
('cancelada', 'cita cancelada'),
('reprogramada', 'cita trasladada a otro espacio');

-- catálogos de auditoría
insert into auditactions (name, description) values
('lectura', 'consulta de información'),
('inserción', 'creación de información'),
('actualización', 'modificación de información'),
('cancelación', 'cancelación de una cita');

insert into auditresults (name, description) values
('éxito', 'operación realizada correctamente'),
('denegado', 'operación denegada'),
('error', 'operación fallida');

insert into audittables (name) values
('clinicpatients'), ('clinicalnotes'), ('appointments'), ('patients');

-- usuario administrador de plataforma sin clínica.
-- se inserta primero para resolver la relación circular entre clinics y users.
insert into users
(providerid, clinicid, roleid, identification, name, lastname, email, phone)
select
    'admin-plataforma',
    null,
    r.roleid,
    '1000000001',
    'admin',
    'plataforma',
    'admin.plataforma@medicitas.test',
    '88880001'
from roles r
where r.name = 'administrador de plataforma';

-- clínicas creadas por el administrador de plataforma.
insert into clinics (name, clinictimezone, auditpersonid)
select v.name, 'america/costa_rica', u.userid
from (values
    ('clínica central'),
    ('clínica del este'),
    ('clínica del oeste')
) as v(name)
cross join users u
where u.providerid = 'admin-plataforma';

-- usuarios de prueba: administrador, recepción y dos profesionales por clínica.
insert into users
(providerid, clinicid, roleid, identification, name, lastname, email, phone)
select v.providerid, c.clinicid, r.roleid, v.identification,
       v.name, v.lastname, v.email, v.phone
from (values
 ('ana-solis','1000000002','ana','solís','ana.admin@central.test','88881001','clínica central','administrador de clínica'),
 ('luis-mora','1000000003','luis','mora','luis.recepcion@central.test','88881002','clínica central','recepción'),
 ('maria-rojas','1000000004','maría','rojas','maria.rojas@central.test','88881003','clínica central','profesional de salud'),
 ('carlos-vega','1000000005','carlos','vega','carlos.vega@central.test','88881004','clínica central','profesional de salud'),
 ('elena-arias','2000000001','elena','arias','elena.admin@este.test','88882001','clínica del este','administrador de clínica'),
 ('pedro-castro','2000000002','pedro','castro','pedro.recepcion@este.test','88882002','clínica del este','recepción'),
 ('laura-jimenez','2000000003','laura','jiménez','laura.jimenez@este.test','88882003','clínica del este','profesional de salud'),
 ('diego-salas','2000000004','diego','salas','diego.salas@este.test','88882004','clínica del este','profesional de salud'),
 ('sofia-leon','3000000001','sofía','león','sofia.admin@oeste.test','88883001','clínica del oeste','administrador de clínica'),
 ('marco-ruiz','3000000002','marco','ruiz','marco.recepcion@oeste.test','88883002','clínica del oeste','recepción'),
 ('valeria-chacon','3000000003','valeria','chacón','valeria.chacon@oeste.test','88883003','clínica del oeste','profesional de salud'),
 ('andres-perez','3000000004','andrés','pérez','andres.perez@oeste.test','88883004','clínica del oeste','profesional de salud')
) as v(providerid, identification, name, lastname, email, phone, clinicname, rolename)
join clinics c on c.name = v.clinicname
join roles r on r.name = v.rolename;

-- especialidades
insert into specialties (name, description) values
('medicina general', 'atención médica general'),
('pediatría', 'atención médica infantil'),
('dermatología', 'atención de condiciones de piel');

-- profesionales (cada profesional se asocia con su usuario de keycloak).
insert into professionals (licenseid, auditpersonid)
select v.licenseid, u.userid
from (values
 ('med-cr-001','maria-rojas'),
 ('med-cr-002','carlos-vega'),
 ('med-cr-003','laura-jimenez'),
 ('med-cr-004','diego-salas'),
 ('med-cr-005','valeria-chacon'),
 ('med-cr-006','andres-perez')
) as v(licenseid, providerid)
join users u on u.providerid = v.providerid;

insert into professionalspecialties (professionalid, specialtyid, auditpersonid)
select p.professionalid, s.specialtyid, u.userid
from (values
 ('med-cr-001','medicina general','ana-solis'),
 ('med-cr-002','pediatría','ana-solis'),
 ('med-cr-003','medicina general','elena-arias'),
 ('med-cr-004','dermatología','elena-arias'),
 ('med-cr-005','pediatría','sofia-leon'),
 ('med-cr-006','dermatología','sofia-leon')
) as v(licenseid, specialtyname, auditorproviderid)
join professionals p on p.licenseid = v.licenseid
join specialties s on s.name = v.specialtyname
join users u on u.providerid = v.auditorproviderid;

insert into clinicprofessionals
(userid, clinicid, professionalid, auditpersonid)
select u.userid, c.clinicid, p.professionalid, adminuser.userid
from (values
 ('maria-rojas','clínica central','med-cr-001','ana-solis'),
 ('carlos-vega','clínica central','med-cr-002','ana-solis'),
 ('laura-jimenez','clínica del este','med-cr-003','elena-arias'),
 ('diego-salas','clínica del este','med-cr-004','elena-arias'),
 ('valeria-chacon','clínica del oeste','med-cr-005','sofia-leon'),
 ('andres-perez','clínica del oeste','med-cr-006','sofia-leon')
) as v(providerid, clinicname, licenseid, adminproviderid)
join users u on u.providerid = v.providerid
join clinics c on c.name = v.clinicname
join professionals p on p.licenseid = v.licenseid
join users adminuser on adminuser.providerid = v.adminproviderid;

-- servicios globales y servicios ofrecidos por cada clínica.
insert into services (name, specialtyid)
select v.name, s.specialtyid
from (values
 ('consulta general','medicina general'),
 ('consulta pediátrica','pediatría'),
 ('consulta dermatológica','dermatología')
) as v(name, specialtyname)
join specialties s on s.name = v.specialtyname;

insert into clinicservices (clinicid, serviceid, duration, auditpersonid)
select c.clinicid, s.serviceid, v.duration, adminuser.userid
from (values
 ('clínica central','consulta general',30,'ana-solis'),
 ('clínica central','consulta pediátrica',40,'ana-solis'),
 ('clínica del este','consulta general',30,'elena-arias'),
 ('clínica del este','consulta dermatológica',45,'elena-arias'),
 ('clínica del oeste','consulta pediátrica',40,'sofia-leon'),
 ('clínica del oeste','consulta dermatológica',45,'sofia-leon')
) as v(clinicname, servicename, duration, adminproviderid)
join clinics c on c.name = v.clinicname
join services s on s.name = v.servicename
join users adminuser on adminuser.providerid = v.adminproviderid;

insert into clinicprofessionalservices
(clinicprofessionalid, clinicserviceid, auditpersonid)
select cp.clinicprofessionalid, cs.clinicserviceid, adminuser.userid
from (values
 ('maria-rojas','clínica central','consulta general','ana-solis'),
 ('carlos-vega','clínica central','consulta pediátrica','ana-solis'),
 ('laura-jimenez','clínica del este','consulta general','elena-arias'),
 ('diego-salas','clínica del este','consulta dermatológica','elena-arias'),
 ('valeria-chacon','clínica del oeste','consulta pediátrica','sofia-leon'),
 ('andres-perez','clínica del oeste','consulta dermatológica','sofia-leon')
) as v(providerid, clinicname, servicename, adminproviderid)
join users u on u.providerid = v.providerid
join clinics c on c.name = v.clinicname
join clinicprofessionals cp on cp.userid = u.userid and cp.clinicid = c.clinicid
join clinicservices cs on cs.clinicid = c.clinicid
join services s on s.serviceid = cs.serviceid and s.name = v.servicename
join users adminuser on adminuser.providerid = v.adminproviderid;

-- horarios semanales: dos bloques por día para cada profesional.
insert into professionalschedules
(clinicprofessionalid, day, starttime, endtime)
select cp.clinicprofessionalid, d.day, t.starttime, t.endtime
from clinicprofessionals cp
cross join (values (1),(2),(3),(4),(5)) as d(day)
cross join (values (time '08:00', time '12:00'),
                   (time '13:00', time '17:00')) as t(starttime, endtime);

-- bloqueos de agenda de ejemplo, en fechas futuras.
insert into scheduleblocks
(clinicprofessionalid, startdatetime, enddatetime, reason, auditpersonid)
select cp.clinicprofessionalid,
       date_trunc('day', now() + interval '10 days') + interval '09 hours',
       date_trunc('day', now() + interval '10 days') + interval '11 hours',
       'capacitación interna',
       u.userid
from clinicprofessionals cp
join users u on u.userid = cp.userid
where u.providerid in ('maria-rojas','laura-jimenez','valeria-chacon');

-- insercion de datos de las tablas con mayor volumen
DO $$
DECLARE
    i INT;
    v_clinic_name VARCHAR(100);
    v_reception_provider VARCHAR(255);
    v_clinic_id INT;
    v_user_id INT;
    v_patient_id INT;
    v_clinic_patient_id INT;
    v_appointment_id INT;
    v_status_id_atendida INT;
    v_status_id_reservada INT;
    v_status_id_ausente INT;
    v_status_id_cancelada INT;
    v_prof_user_id INT;
    v_clinic_prof_id INT;
    v_clinic_service_id INT;
    v_action_id INT;
    v_table_id INT;
    v_result_id INT;
BEGIN
    SELECT appointmentStatusId INTO v_status_id_atendida FROM appointmentstatuses WHERE name = 'atendida';
    SELECT appointmentStatusId INTO v_status_id_reservada FROM appointmentstatuses WHERE name = 'reservada';
    SELECT appointmentStatusId INTO v_status_id_ausente FROM appointmentstatuses WHERE name = 'ausente';
    SELECT appointmentStatusId INTO v_status_id_cancelada FROM appointmentstatuses WHERE name = 'cancelada';
    
    SELECT auditActionID INTO v_action_id FROM auditactions WHERE name = 'inserción';
    SELECT auditTableId INTO v_table_id FROM audittables WHERE name = 'clinicpatients';
    SELECT auditResultID INTO v_result_id FROM auditresults WHERE name = 'éxito';

    FOR i IN 1..60 LOOP
        IF i > 56 THEN
            IF i % 2 = 0 THEN
                v_clinic_name := 'clínica central';
                v_reception_provider := 'luis-mora';
            ELSE
                v_clinic_name := 'clínica del este';
                v_reception_provider := 'pedro-castro';
            END IF;
        ELSE
            IF i % 3 = 0 THEN
                v_clinic_name := 'clínica central';
                v_reception_provider := 'luis-mora';
            ELSIF i % 3 = 1 THEN
                v_clinic_name := 'clínica del este';
                v_reception_provider := 'pedro-castro';
            ELSE
                v_clinic_name := 'clínica del oeste';
                v_reception_provider := 'marco-ruiz';
            END IF;
        END IF;

        SELECT clinicid INTO v_clinic_id FROM clinics WHERE name = v_clinic_name;
        SELECT userid INTO v_user_id FROM users WHERE providerid = v_reception_provider;

        -- pacientes ficticios y sus contactos por clinica
        INSERT INTO patients (identification, name, lastname, birthdate, auditpersonid)
        VALUES ('p-' || i, 'paciente' || i, 'apellido' || i, '1990-01-01'::date + (i || ' days')::interval, v_user_id)
        RETURNING patientID INTO v_patient_id;

        INSERT INTO clinicpatients (clinicid, patientid, email, phone, auditpersonid)
        VALUES (v_clinic_id, v_patient_id, 'paciente' || i || '@gmail.com', '8888' || LPAD(i::text, 4, '0'), v_user_id)
        RETURNING clinicPatientID INTO v_clinic_patient_id;
        
        IF v_clinic_name = 'clínica central' THEN
            IF i % 2 = 0 THEN v_reception_provider := 'maria-rojas'; ELSE v_reception_provider := 'carlos-vega'; END IF;
        ELSIF v_clinic_name = 'clínica del este' THEN
            IF i % 2 = 0 THEN v_reception_provider := 'laura-jimenez'; ELSE v_reception_provider := 'diego-salas'; END IF;
        ELSE
            IF i % 2 = 0 THEN v_reception_provider := 'valeria-chacon'; ELSE v_reception_provider := 'andres-perez'; END IF;
        END IF;

        SELECT userid INTO v_prof_user_id FROM users WHERE providerid = v_reception_provider;
        SELECT clinicprofessionalid INTO v_clinic_prof_id FROM clinicprofessionals WHERE userid = v_prof_user_id AND clinicid = v_clinic_id;
        SELECT clinicserviceid INTO v_clinic_service_id FROM clinicprofessionalservices WHERE clinicprofessionalid = v_clinic_prof_id LIMIT 1;

        -- citas en el pasado y en el futuro con distintos estados
        IF i <= 20 THEN
            INSERT INTO appointments (clinicpatientid, clinicid, clinicprofessionalid, clinicserviceid, appointmentstatusid, date, auditpersonid)
            VALUES (v_clinic_patient_id, v_clinic_id, v_clinic_prof_id, v_clinic_service_id, v_status_id_atendida, NOW() - INTERVAL '7 days', v_user_id)
            RETURNING appointmentId INTO v_appointment_id;

        -- notas de ejemplo para citas que ya fueron atendidas
            INSERT INTO clinicalnotes (appointmentid, content, clinicprofessionalid)
            VALUES (v_appointment_id, 'Atención del paciente' || i || ' procesada con éxito en el sistema.', v_clinic_prof_id);

        ELSIF i > 20 AND i <= 45 THEN
            INSERT INTO appointments (clinicpatientid, clinicid, clinicprofessionalid, clinicserviceid, appointmentstatusid, date, auditpersonid)
            VALUES (v_clinic_patient_id, v_clinic_id, v_clinic_prof_id, v_clinic_service_id, v_status_id_reservada, NOW() + INTERVAL '5 days', v_user_id);
        
        ELSIF i > 45 AND i <= 55 THEN
            INSERT INTO appointments (clinicpatientid, clinicid, clinicprofessionalid, clinicserviceid, appointmentstatusid, date, cancellationreason, auditpersonid)
            VALUES (
                v_clinic_patient_id, v_clinic_id, v_clinic_prof_id, v_clinic_service_id, 
                CASE WHEN i % 2 = 0 THEN v_status_id_ausente ELSE v_status_id_cancelada END, 
                NOW() - INTERVAL '2 days', 
                CASE WHEN i % 2 != 0 THEN 'Cancelación sistemática automatizada' ELSE NULL END, 
                v_user_id
            );
        END IF;

        -- registros de auditoría ilustrativos
        IF i <= 30 THEN
            INSERT INTO auditlogs (clinicid, auditpersonid, auditactionid, audittableid, auditrecordid, auditresultid, clinicpatientid)
            VALUES (v_clinic_id, v_user_id, v_action_id, v_table_id, v_clinic_patient_id, v_result_id, v_clinic_patient_id);
        END IF;

    END LOOP;
END $$;

COMMIT;
