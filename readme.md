# Proyecto I - MediCitas

Estudiantes:

- Sebastián Aguilar Villalobos - 2025072110
- Andrés Campos Montero - 2025069367
- Xavier Céspedes Alvarado - 2025102887

## Contexto

## Aplicación

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