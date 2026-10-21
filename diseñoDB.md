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
- name VARCHAR(100) NOT NULL
- clinicTimeZone VARCHAR(50) NOT NULL
- auditPersonID INT FK (users) NOT NULL
- createdAt TIMESTAMPTZ NOT NULL DEFAULT NOW()
- updatedAt TIMESTAMPTZ NOT NULL DEFAULT NOW()
- isActive BOOLEAN NOT NULL DEFAULT TRUE

### users
- userId SERIAL PK
- providerId VARCHAR(255) UNIQUE NOT NULL     esto hay que verificarlo
- clinicId INT FK (clinics)
- roleID INT FK (roles) NOT NULL
- identification VARCHAR(12) UNIQUE NOT NULL
- name VARCHAR(25) NOT NULL
- lastname VARCHAR(25) NOT NULL
- email VARCHAR(100) UNIQUE NOT NULL
- phone VARCHAR(20)
- createdAt TIMESTAMPTZ NOT NULL DEFAULT NOW()
- updatedAt TIMESTAMPTZ NOT NULL DEFAULT NOW()
- isActive BOOLEAN NOT NULL DEFAULT TRUE

### specialties
- specialtyID SERIAL PK
- name VARCHAR(50) UNIQUE NOT NULL
- description VARCHAR(200)
- createdAt TIMESTAMPTZ NOT NULL DEFAULT NOW()
- updatedAt TIMESTAMPTZ NOT NULL DEFAULT NOW()
- isActive BOOLEAN NOT NULL DEFAULT TRUE

### professionals
- professionalId SERIAL PK
- licenseId VARCHAR(15) UNIQUE NOT NULL
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
- clinicProfessionalId SERIAL PK
- userId INT FK (users) UNIQUE NOT NULL
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
- identification VARCHAR(12) UNIQUE NOT NULL
- name VARCHAR(25) NOT NULL
- lastname VARCHAR(25) NOT NULL
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
- email VARCHAR(100)               
- phone VARCHAR(20) 
- auditPersonID INT FK (users) NOT NULL
- createdAt TIMESTAMPTZ NOT NULL DEFAULT NOW()
- updatedAt TIMESTAMPTZ NOT NULL DEFAULT NOW()
- isActive BOOLEAN NOT NULL DEFAULT TRUE
- UNIQUE (clinicID, patientID)

### services
- serviceId SERIAL PK
- name VARCHAR(50) UNIQUE NOT NULL
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
- clinicProfessionalServiceId SERIAL PK
- clinicProfessionalId INT FK (clinicProfessionals) NOT NULL
- clinicServiceId INT FK (clinicServices) NOT NULL
- auditPersonID INT FK (users) NOT NULL
- createdAt TIMESTAMPTZ NOT NULL DEFAULT NOW()
- updatedAt TIMESTAMPTZ NOT NULL DEFAULT NOW()
- isActive BOOLEAN NOT NULL DEFAULT TRUE
- UNIQUE (clinicServiceId, clinicProfessionalId)

### professionalSchedules
- professionalScheduleID SERIAL PK
- clinicProfessionalId INT FK (clinicProfessionals) NOT NULL
- day INT NOT NULL
- startTime TIME NOT NULL
- endTime TIME NOT NULL
- createdAt TIMESTAMPTZ NOT NULL DEFAULT NOW()
- updatedAt TIMESTAMPTZ NOT NULL DEFAULT NOW()
- isActive BOOLEAN NOT NULL DEFAULT TRUE

### appointmentStatuses
- appointmentStatusId SERIAL PK
- name VARCHAR(12) UNIQUE NOT NULL
- description VARCHAR(100)
- isActive BOOLEAN NOT NULL DEFAULT TRUE

### appointment 
- appointmentId SERIAL PK
- clinicPatientId INT FK (clinicPatients) NOT NULL
- clinicId INT FK (clinics) NOT NULL
- clinicProfessionalId INT FK (clinicProfessionals) NOT NULL
- clinicServiceId INT FK (clinicServices) NOT NULL
- appointmentStatusId INT FK (appointmentStatuses) NOT NULL
- date TIMESTAMPTZ NOT NULL
- auditPersonID INT FK (users) NOT NULL
- createdAt TIMESTAMPTZ NOT NULL DEFAULT NOW()
- updatedAt TIMESTAMPTZ NOT NULL DEFAULT NOW()
- isBlocked BOOLEAN NOT NULL DEFAULT FALSE

### clinicalNotes
- clinicalNoteID SERIAL PK
- appointmentID INT FK (appointments) UNIQUE NOT NULL
- content TEXT NOT NULL
- clinicProfessionalId INT FK (clinicProfessionals) NOT NULL
- createdAt TIMESTAMPTZ NOT NULL DEFAULT NOW()
- updatedAt TIMESTAMPTZ NOT NULL DEFAULT NOW()
- isActive BOOLEAN NOT NULL DEFAULT TRUE

### scheduleBlocks
- scheduleBlockId SERIAL PK
- clinicProfessionalId INT FK (clinicProfessionals) NOT NULL
- startDateTime TIMESTAMPTZ NOT NULL
- endDateTime TIMESTAMPTZ NOT NULL
- reason VARCHAR(200)
- auditPersonID INT FK (users) NOT NULL
- createdAt TIMESTAMPTZ NOT NULL DEFAULT NOW()
- updatedAt TIMESTAMPTZ NOT NULL DEFAULT NOW()
- isActive BOOLEAN NOT NULL DEFAULT TRUE

### auditActions
- auditActionID SERIAL PK
- name VARCHAR(30) UNIQUE NOT NULL
- description VARCHAR(100)
- isActive BOOLEAN NOT NULL DEFAULT TRUE

### auditResults
- auditResultID SERIAL PK
- name VARCHAR(30) UNIQUE NOT NULL
- description VARCHAR(100)
- isActive BOOLEAN NOT NULL DEFAULT TRUE

### auditTables
- auditTableId SERIAL PK
- name VARCHAR(30) UNIQUE NOT NULL
- isActive BOOLEAN NOT NULL DEFAULT TRUE

### auditLogs
- auditLogID SERIAL PK
- clinicId INT FK (clinics) NOT NULL
- auditPersonID INT FK (users) NOT NULL
- auditActionID INT FK (auditActions) NOT NULL
- auditTableID INT FK (auditTables) NOT NULL
- auditRecordID INT NOT NULL
- auditResultID INT FK (auditResults) NOT NULL
- clinicPatientID INT FK (clinicPatients) 
- createdAt TIMESTAMPTZ NOT NULL DEFAULT NOW()