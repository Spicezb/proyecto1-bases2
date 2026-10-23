begin;

create table roles (
    roleid serial primary key,
    name varchar(30) not null unique,
    description varchar(100),
    createdat timestamptz not null default now(),
    updatedat timestamptz not null default now(),
    isactive boolean not null default true
);

create table clinics (
    clinicid serial primary key,
    name varchar(100) not null,
    clinictimezone varchar(50) not null,
    auditpersonid int not null,
    createdat timestamptz not null default now(),
    updatedat timestamptz not null default now(),
    isactive boolean not null default true
);

create table users (
    userid serial primary key,
    providerid varchar(255) not null unique,
    clinicid int references clinics(clinicid),
    roleid int not null references roles(roleid),
    identification varchar(12) not null unique,
    name varchar(25) not null,
    lastname varchar(25) not null,
    email varchar(100) not null unique,
    phone varchar(20),
    createdat timestamptz not null default now(),
    updatedat timestamptz not null default now(),
    isactive boolean not null default true
);

-- se agrega después de crear users para resolver la dependencia circular.
alter table clinics
    add constraint fkclinicsauditperson
    foreign key (auditpersonid) references users(userid);

create table specialties (
    specialtyid serial primary key,
    name varchar(50) not null unique,
    description varchar(200),
    createdat timestamptz not null default now(),
    updatedat timestamptz not null default now(),
    isactive boolean not null default true
);

create table professionals (
    professionalid serial primary key,
    licenseid varchar(15) not null unique,
    auditpersonid int not null references users(userid),
    createdat timestamptz not null default now(),
    updatedat timestamptz not null default now(),
    isactive boolean not null default true
);

create table professionalspecialties (
    professionalspecialtyid serial primary key,
    professionalid int not null references professionals(professionalid),
    specialtyid int not null references specialties(specialtyid),
    auditpersonid int not null references users(userid),
    createdat timestamptz not null default now(),
    updatedat timestamptz not null default now(),
    isactive boolean not null default true,
    constraint uqprofessionalspecialty unique (professionalid, specialtyid)
);

create table clinicprofessionals (
    clinicprofessionalid serial primary key,
    userid int not null unique references users(userid),
    clinicid int not null references clinics(clinicid),
    professionalid int not null references professionals(professionalid),
    auditpersonid int not null references users(userid),
    createdat timestamptz not null default now(),
    updatedat timestamptz not null default now(),
    isactive boolean not null default true,
    constraint uqclinicprofessional unique (clinicid, professionalid)
);

create table patients (
    patientid serial primary key,
    identification varchar(12) not null unique,
    name varchar(25) not null,
    lastname varchar(25) not null,
    birthdate date not null check (birthdate <= current_date),
    auditpersonid int not null references users(userid),
    createdat timestamptz not null default now(),
    updatedat timestamptz not null default now(),
    isactive boolean not null default true
);

create table clinicpatients (
    clinicpatientid serial primary key,
    clinicid int not null references clinics(clinicid),
    patientid int not null references patients(patientid),
    email varchar(100),
    phone varchar(20),
    auditpersonid int not null references users(userid),
    createdat timestamptz not null default now(),
    updatedat timestamptz not null default now(),
    isactive boolean not null default true,
    constraint uqclinicpatient unique (clinicid, patientid)
);

create table services (
    serviceid serial primary key,
    name varchar(50) not null unique,
    specialtyid int not null references specialties(specialtyid),
    createdat timestamptz not null default now(),
    updatedat timestamptz not null default now(),
    isactive boolean not null default true
);

create table clinicservices (
    clinicserviceid serial primary key,
    clinicid int not null references clinics(clinicid),
    serviceid int not null references services(serviceid),
    duration int not null check (duration > 0),
    auditpersonid int not null references users(userid),
    createdat timestamptz not null default now(),
    updatedat timestamptz not null default now(),
    isactive boolean not null default true,
    constraint uqclinicservice unique (clinicid, serviceid)
);

create table clinicprofessionalservices (
    clinicprofessionalserviceid serial primary key,
    clinicprofessionalid int not null references clinicprofessionals(clinicprofessionalid),
    clinicserviceid int not null references clinicservices(clinicserviceid),
    auditpersonid int not null references users(userid),
    createdat timestamptz not null default now(),
    updatedat timestamptz not null default now(),
    isactive boolean not null default true,
    constraint uqclinicprofessionalservice
        unique (clinicserviceid, clinicprofessionalid)
);

create table professionalschedules (
    professionalscheduleid serial primary key,
    clinicprofessionalid int not null references clinicprofessionals(clinicprofessionalid),
    day int not null check (day between 1 and 7),
    starttime time not null,
    endtime time not null,
    createdat timestamptz not null default now(),
    updatedat timestamptz not null default now(),
    isactive boolean not null default true,
    constraint ckprofessionalscheduletimes check (endtime > starttime)
);

create table appointmentstatuses (
    appointmentstatusid serial primary key,
    name varchar(12) not null unique,
    description varchar(100),
    isactive boolean not null default true
);

create table appointments (
    appointmentid serial primary key,
    clinicpatientid int not null references clinicpatients(clinicpatientid),
    clinicid int not null references clinics(clinicid),
    clinicprofessionalid int not null references clinicprofessionals(clinicprofessionalid),
    clinicserviceid int not null references clinicservices(clinicserviceid),
    appointmentstatusid int not null references appointmentstatuses(appointmentstatusid),
    date timestamptz not null,
    cancellationreason varchar(250),
    auditpersonid int not null references users(userid),
    createdat timestamptz not null default now(),
    updatedat timestamptz not null default now(),
    isblocked boolean not null default false
);

create table clinicalnotes (
    clinicalnoteid serial primary key,
    appointmentid int not null unique references appointments(appointmentid),
    content text not null,
    clinicprofessionalid int not null references clinicprofessionals(clinicprofessionalid),
    createdat timestamptz not null default now(),
    updatedat timestamptz not null default now(),
    isactive boolean not null default true
);

create table scheduleblocks (
    scheduleblockid serial primary key,
    clinicprofessionalid int not null references clinicprofessionals(clinicprofessionalid),
    startdatetime timestamptz not null,
    enddatetime timestamptz not null,
    reason varchar(200),
    auditpersonid int not null references users(userid),
    createdat timestamptz not null default now(),
    updatedat timestamptz not null default now(),
    isactive boolean not null default true,
    constraint ckscheduleblocktimes check (enddatetime > startdatetime)
);

create table auditactions (
    auditactionid serial primary key,
    name varchar(30) not null unique,
    description varchar(100),
    isactive boolean not null default true
);

create table auditresults (
    auditresultid serial primary key,
    name varchar(30) not null unique,
    description varchar(100),
    isactive boolean not null default true
);

create table audittables (
    audittableid serial primary key,
    name varchar(30) not null unique,
    isactive boolean not null default true
);

create table auditlogs (
    auditlogid serial primary key,
    clinicid int not null references clinics(clinicid),
    auditpersonid int not null references users(userid),
    auditactionid int not null references auditactions(auditactionid),
    audittableid int not null references audittables(audittableid),
    auditrecordid int not null,
    auditresultid int not null references auditresults(auditresultid),
    clinicpatientid int references clinicpatients(clinicpatientid),
    createdat timestamptz not null default now()
);

create index idxappointmentsprofessionaldate
    on appointments (clinicprofessionalid, date);

create index idxappointmentsclinicdate
    on appointments (clinicid, date);

create index idxappointmentspatientdate
    on appointments (clinicpatientid, date);

create index idxappointmentsclinicdatestatus
    on appointments (clinicid, date, appointmentstatusid);

create index idxprofessionalschedulesprofessionalday
    on professionalschedules (clinicprofessionalid, day);

create index idxscheduleblocksprofessionalstart
    on scheduleblocks (clinicprofessionalid, startdatetime);

create index idxclinicprofessionalservicesprofessionalservice
    on clinicprofessionalservices (clinicprofessionalid, clinicserviceid);

create index idxauditlogspersoncreated
    on auditlogs (auditpersonid, createdat);

create index idxauditlogspatientcreated
    on auditlogs (clinicpatientid, createdat);

create index idxauditlogscreated
    on auditlogs (createdat);

commit;