# Proyecto I - MediCitas

Estudiantes:

- Sebastián Aguilar Villalobos - 2025072110
- Andrés Campos Montero - 2025069367
- Xavier Céspedes Alvarado - 2025102887

## Contexto

## Aplicaciones

## Base de datos

El diseño de tablas de la base de datos puede ser observado en el archivo diseñoDB.md dentro de la carpeta BD.

### Decisiones

- Se decidió que los pacientes se guardarán en una tabla general llamada patients en donde se guardará su información general, como su nombre, fecha de nacimiento, etc; y su información más privada se guardará en la tabla clinicPatients, en donde cada clínica almacena un correo y un número de teléfono para cada uno de sus pacientes.

- Se tomó la decisión de que un profesional puede trabajar en distintas clínicas mediante el uso de distintos usuarios dentro de la aplicación.

- Respecto al nivel de isolación a utilizar, se decidió usar READ COMMITED + un EXCLUDE para garantizar que no se pueda reservar una misma cita para dos pacientes distintos. Se descartó usar SERIALIZABLE, porque aunque es un nivel de isolación más efectivo por sí solo, ya que aplica las transacciones de manera secuencial, no sería tan eficiente a gran escala si se aplicara la carga de transacciones en un sistema real.

### Stored Procedures

Se decidió manejar todos los procedimientos en la base de datos mediante stored procedures. A continuación se listan los stored procedures por área.

#### Administración de clínicas y usuarios
- crearClinica: Crear una clínica y su primer usuario administrador.
- crearUsuario: Registrar un usuario y asignarle su rol inicial.
- cambiarRolUsuario: Modificar el rol de un usuario existente.
- desactivarUsuario: Dar de baja lógicamente a un usuario.
- consultarUsuarios	Consultar los usuarios de una clínica.

#### Administración de profesionales y especialidades
- crearProfesional: Registrar un profesional y asociarlo con su usuario.
- actualizarProfesional: Actualizar los datos de un profesional.
- asignarEspecialidad: Asociar una o varias especialidades a un profesional.
- consultarProfesionales: Consultar los profesionales registrados.

#### Administración de servicios
- crearServicio: Crear un servicio y asociarlo automáticamente con la clínica en clinicServices.
- actualizarServicio: Actualizar los datos de un servicio.
- consultarServicios: Consultar los servicios disponibles.
- asignarServicioProfesional: Asociar servicios de la clínica a los profesionales habilitados para atenderlos.

#### Administración de horarios y bloqueos
- crearHorario: Registrar un horario de atención para un profesional.
- actualizarHorario: Modificar un horario existente.
- crearBloqueo: Registrar un bloqueo de agenda.
- actualizarBloqueo: Modificar o eliminar un bloqueo existente, según la operación solicitada.
- consultarHorarios: Consultar horarios y bloqueos de agenda.

#### Consulta de disponibilidad
- consultarDisponibilidad: Calcular los espacios disponibles de un profesional en una fecha determinada.
- consultarDisponibilidadServicio: Consultar los profesionales que tienen espacios disponibles para un servicio dentro de un rango de fechas.

#### Gestión de citas y agenda
- reservarCita: Reservar una cita para un paciente, profesional y servicio.
- reprogramarCita: Reprogramar una cita vigente, liberando el espacio anterior y reservando el nuevo dentro de una misma transacción.
- cambiarEstadoCita: Cambiar el estado de una cita, validando las transiciones permitidas.
- consultarAgenda: Consultar la agenda diaria de un profesional o de toda la clínica.
- consultarCitasPaciente: Consultar el historial de citas de un paciente dentro de su clínica.
- contarCitasPorEstado: Contar las citas agrupadas por estado dentro de un rango de fechas.

#### Gestión de pacientes
- crearPaciente: Registrar al paciente en patients y asociarlo con la clínica en clinicPatients.
- actualizarPaciente: Actualizar los datos generales y los datos de contacto del paciente.
- consultarPacientes: Consultar pacientes mediante filtros de búsqueda.

#### Gestión de notas clínicas
- crearNota: Crear una nota clínica asociada a una cita atendida.
- consultarNota: Consultar una nota clínica, respetando las restricciones de acceso.
- actualizarNota: Modificar una nota clínica existente.

#### Auditoría
- registrarLog: Registrar internamente las operaciones de lectura y escritura que requieren auditoría.
- consultarLogs: Consultar la bitácora con filtros por usuario, paciente y rango de fechas.

## Modulo adicional - Row Level Security

El módulo adicional escogido fue Row Level Security, este es implementado mediante el uso de una variable app.clinicid_id que ayuda a separar los registros por clínica, esta variable es local para cada transacción, por lo que después de finalizada una transacción, no condiciona el uso de las demás rutas para los demás usuarios.

Para garantizar el funcionamiento del RLS, se creó un rol llamado rol_security dentro de la base de datos, al que se le dio el ownership de todos los procedimientos y funciones almacenadas, así, al utilizar security definer, los procedimientos y funciones se ejecutan bajo sus permisos. Lo anterior es importante porque si el ownership de las funciones lo tuviera el usuario creador de la base, entonces, al tener bypassrls, se salta las políticas de seguridad.

Se aplico RLS sobre las siguientes tablas:

- clinicpatients
- clinicprofessionals
- clinicservices
- appointments
- auditlogs
- clinics
- clinicprofessionalservices
- professionalschedules
- scheduleblocks
- clinicalnotes

La mayoría de estas tablas poseen la columna clinicid, y la política se les aplica directamente, en los casos que la tabla no tiene el clinicid, se hace por relación mediante el uso de funciones para simplificar las políticas.

También existe una función que utilizan todas las políticas que se encarga de consultar la variable app.clinic_id para poder lograr la separación por clínica.

Cada vez que se utiliza una ruta, en la consulta interna a la base, que por lo general es una llamada a los procedimientos almacenados, se setea la variable, por lo que el usuario que consulta solo tiene acceso a los registros pertenecientes a su clínica.

## Pruebas