# Diseño DB - MediCitas

A continuación se presenta el diseño de la base de datos relacional del proyecto, en el cual se utilizará PostgreSQL como motor de base de datos.

## Tablas

### roles
- roleID SERIAL PK
- name VARCHAR(30) UNIQUE NOT NULL
- description VARCHAR(100)
- createdAt TIMESTAMPTZ NOT NULL DEFAULT NOW()
- updatedAt TIMESTAMPTZ NOT NULL DEFAULT NOW()
- isActive BOOLEAN NOT NULL DEFAULT TRUE

### clinics
- clinicID SERIAL PK
- name varchar(100) NOT NULL
- clinicTimeZone varchar(50) NOT NULL
- auditPersonID INT FK (users) NOT NULL
- createdAt TIMESTAMPTZ NOT NULL DEFAULT NOW()
- updatedAt TIMESTAMPTZ NOT NULL DEFAULT NOW()
- isActive BOOLEAN NOT NULL DEFAULT TRUE

### users
- userId SERIAL PK
- providerId varchar(255) UNIQUE NOT NULL     esto hay que verificarlo
- clinicId INT FK (clinics)
- roleID INT FK (roles) NOT NULL
- identification varchar(12) UNIQUE NOT NULL
- name varchar(25) NOT NULL
- lastname varchar(25) NOT NULL
- email varchar(100) UNIQUE NOT NULL
- phone varchar(20)
- createdAt TIMESTAMPTZ NOT NULL DEFAULT NOW()
- updatedAt TIMESTAMPTZ NOT NULL DEFAULT NOW()
- isActive BOOLEAN NOT NULL DEFAULT TRUE

### specialties
- specialtyID SERIAL PK
- name varchar(50) UNIQUE NOT NULL
- description varchar(200)
- createdAt TIMESTAMPTZ NOT NULL DEFAULT NOW()
- updatedAt TIMESTAMPTZ NOT NULL DEFAULT NOW()
- isActive BOOLEAN NOT NULL DEFAULT TRUE

### professionals

RF2

- professionalId SERIAL PK
- userID INT FK (users) UNIQUE NOT NULL
- licenseId varchar(15) UNIQUE NOT NULL
- auditPersonID INT FK (users) NOT NULL
- createdAt TIMESTAMPTZ NOT NULL DEFAULT NOW()
- updatedAt TIMESTAMPTZ NOT NULL DEFAULT NOW()
- isActive BOOLEAN NOT NULL DEFAULT TRUE

### professionalSpecialties
- professionalSpecialtyId SERIAL PK
- professionalId INT FK (professionals) NOT NULL
- specialtyID INT FK (specialties) NOT NULL
- auditPersonID INT FK (users) NOT NULL
- createdAt TIMESTAMPTZ NOT NULL DEFAULT NOW()
- updatedAt TIMESTAMPTZ NOT NULL DEFAULT NOW()
- isActive BOOLEAN NOT NULL DEFAULT TRUE
- UNIQUE (professionalId, specialtyID)

### clinicProfessionals

Relación de los profesionales con las clínicas, hay que volver a pensar esto pensando en RF2

- clinicProfessionalId SERIAL PK
- clinicID INT FK (clinics) NOT NULL
- professionalId INT FK (professionals) NOT NULL
- auditPersonID INT FK (users) NOT NULL
- createdAt TIMESTAMPTZ NOT NULL DEFAULT NOW()
- updatedAt TIMESTAMPTZ NOT NULL DEFAULT NOW()
- isActive BOOLEAN NOT NULL DEFAULT TRUE
- UNIQUE (clinicID, professionalId)

### patients

La info acá es general y no sensible

- patientID SERIAL PK
- identification varchar(12) UNIQUE NOT NULL
- name varchar(25) NOT NULL
- lastname varchar(25) NOT NULL
- birthDate DATE NOT NULL
- auditPersonID INT FK (users) NOT NULL
- createdAt TIMESTAMPTZ NOT NULL DEFAULT NOW()
- updatedAt TIMESTAMPTZ NOT NULL DEFAULT NOW()
- isActive BOOLEAN NOT NULL DEFAULT TRUE

### clinicPatients

El email y el phone el paciente se lo brinda a cada clínica, esta sí es info sensible

- clinicPatientID SERIAL PK
- clinicID INT FK (clinics) NOT NULL
- patientID INt FK (patients) NOT NULL
- email varchar(100)               
- phone varchar(20) 
- auditPersonID INT FK (users) NOT NULL
- createdAt TIMESTAMPTZ NOT NULL DEFAULT NOW()
- updatedAt TIMESTAMPTZ NOT NULL DEFAULT NOW()
- isActive BOOLEAN NOT NULL DEFAULT TRUE
- UNIQUE (clinicID, patientID)

### services
- serviceId SERIAL PK
- name varchar(50) UNIQUE NOT NULL
- specialtyId INT FK (specialties) NOT NULL
- createdAt TIMESTAMPTZ NOT NULL DEFAULT NOW()
- updatedAt TIMESTAMPTZ NOT NULL DEFAULT NOW()
- isActive BOOLEAN NOT NULL DEFAULT TRUE

### clinicServices
- clinicServiceId SERIAL PK
- clinicID INT FK (clinics) NOT NULL
- serviceID INT FK (services) NOT NULL
- duration INT NOT NULL 
- auditPersonID INT FK (users) NOT NULL
- createdAt TIMESTAMPTZ NOT NULL DEFAULT NOW()
- updatedAt TIMESTAMPTZ NOT NULL DEFAULT NOW()
- isActive BOOLEAN NOT NULL DEFAULT TRUE
- UNIQUE (clinicID, serviceID)

### clinicProfessionalServices

Esto depende de la desición que tomemos sobre RF2

### professionalSchedules
- professionalScheduleID SERIAL PK
- professionalID INT FK (professionals) NOT NULL               RF2
- day INT NOT NULL
- startTime TIME NOT NULL
- endTime TIME NOT NULL
- createdAt TIMESTAMPTZ NOT NULL DEFAULT NOW()
- updatedAt TIMESTAMPTZ NOT NULL DEFAULT NOW()
- isActive BOOLEAN NOT NULL DEFAULT TRUE

### appointmentStatuses
- appointmentStatusId SERIAL PK
- name varchar(12) UNIQUE NOT NULL
- description varchar(100)
- isActive BOOLEAN NOT NULL DEFAULT TRUE

### appointment 
- appointmentId SERIAL PK
- clinicPatientId INT FK (clinicPatients) NOT NULL
- clinicId INT FK (clinics) NOT NULL
- professionalID INT FK (professionals) NOT NULL                 RF2
- clinicServiceId INT FK (clinicServices) NOT NULL
- appointmentStatusId INT FK (appointmentStatuses) NOT NULL
- date TIMESTAMPTZ NOT NULL
- createdAt TIMESTAMPTZ NOT NULL DEFAULT NOW()
- updatedAt TIMESTAMPTZ NOT NULL DEFAULT NOW()

### clinicalNotes
- clinicalNoteID SERIAL PK
- appointmentID INT FK (appointments) UNIQUE NOT NULL
- content TEXT NOT NULL
- professionalID INT FK (professionals) NOT NULL
- createdAt TIMESTAMPTZ NOT NULL DEFAULT NOW()
- updatedAt TIMESTAMPTZ NOT NULL DEFAULT NOW()
- isActive BOOLEAN NOT NULL DEFAULT TRUE

TO DOS:

logs de auditoría / bitácora
bloqueos de agenda
discutir bien lo de RF2