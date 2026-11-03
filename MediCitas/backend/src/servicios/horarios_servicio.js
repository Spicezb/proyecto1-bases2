const horariosRepositorio = require('../repositorios/horarios_repos');

// Expresión regular para validar formato TIME (HH:MM o HH:MM:SS)
const TIME_REGEX = /^([01]\d|2[0-3]):([0-5]\d)(:([0-5]\d))?$/;

// Validar y comparar que horaFin sea mayor a horaInicio
function esHoraPosterior(horaInicio, horaFin) {
    return horaFin > horaInicio;
}

// Validar los datos de entrada para la creación de un horario
function validarDatosCreacion(datos) {
    const { profesionalId, dia, horaInicio, horaFin } = datos || {};

    if (!Number.isSafeInteger(profesionalId) || profesionalId <= 0) {
        return {
            error: 'El ID del profesional debe ser un entero positivo.',
            status: 400
        };
    }

    if (!Number.isSafeInteger(dia) || dia < 1 || dia > 7) {
        return {
            error: 'El día debe ser un número entero entre 1 y 7.',
            status: 400
        };
    }

    if (typeof horaInicio !== 'string' || !TIME_REGEX.test(horaInicio.trim())) {
        return {
            error: 'La hora de inicio debe tener formato válido HH:MM o HH:MM:SS.',
            status: 400
        };
    }

    if (typeof horaFin !== 'string' || !TIME_REGEX.test(horaFin.trim())) {
        return {
            error: 'La hora de finalización debe tener formato válido HH:MM o HH:MM:SS.',
            status: 400
        };
    }

    const inicioLimpio = horaInicio.trim();
    const finLimpia = horaFin.trim();

    if (!esHoraPosterior(inicioLimpio, finLimpia)) {
        return {
            error: 'La hora de finalización debe ser posterior a la hora de inicio.',
            status: 400
        };
    }

    return {
        datos: {
            profesionalId,
            dia,
            horaInicio: inicioLimpio,
            horaFin: finLimpia
        }
    };
}

// Validar los datos de entrada para la actualización de un horario
function validarDatosActualizacion(datos) {
    const { dia, horaInicio, horaFin, activo } = datos || {};

    if (!Number.isSafeInteger(dia) || dia < 1 || dia > 7) {
        return {
            error: 'El día debe ser un número entero entre 1 y 7.',
            status: 400
        };
    }

    if (typeof horaInicio !== 'string' || !TIME_REGEX.test(horaInicio.trim())) {
        return {
            error: 'La hora de inicio debe tener formato válido HH:MM o HH:MM:SS.',
            status: 400
        };
    }

    if (typeof horaFin !== 'string' || !TIME_REGEX.test(horaFin.trim())) {
        return {
            error: 'La hora de finalización debe tener formato válido HH:MM o HH:MM:SS.',
            status: 400
        };
    }

    const inicioLimpio = horaInicio.trim();
    const finLimpia = horaFin.trim();

    if (!esHoraPosterior(inicioLimpio, finLimpia)) {
        return {
            error: 'La hora de finalización debe ser posterior a la hora de inicio.',
            status: 400
        };
    }

    if (activo !== undefined && typeof activo !== 'boolean') {
        return {
            error: 'El campo activo debe ser un valor booleano.',
            status: 400
        };
    }

    return {
        datos: {
            dia,
            horaInicio: inicioLimpio,
            horaFin: finLimpia,
            activo: activo !== undefined ? activo : true
        }
    };
}

// Obtener horarios semanales (opcionalmente filtrados por profesional)
async function obtenerHorarios(clinicId, auditPersonId, profesionalId) {
    if (profesionalId !== undefined && profesionalId !== null) {
        if (!/^[1-9]\d*$/.test(String(profesionalId))) {
            return {
                error: 'El ID del profesional debe ser un entero positivo.',
                status: 400
            };
        }
    }

    const horarios = await horariosRepositorio.obtenerHorarios(
        clinicId,
        auditPersonId,
        profesionalId ? Number(profesionalId) : null
    );

    return { horarios };
}

// Obtener un horario por su ID
async function obtenerHorarioPorId(id, clinicId, auditPersonId) {
    if (!/^[1-9]\d*$/.test(String(id))) {
        return {
            error: 'El ID del horario debe ser un entero positivo.',
            status: 400
        };
    }

    const horario = await horariosRepositorio.obtenerHorarioPorId(
        Number(id),
        clinicId,
        auditPersonId
    );

    return { horario };
}

// Registrar un nuevo horario semanal
async function crearHorario(datos, clinicId, auditPersonId) {
    const validacion = validarDatosCreacion(datos);

    if (validacion.error) {
        return validacion;
    }

    const horario = await horariosRepositorio.crearHorario(
        validacion.datos,
        clinicId,
        auditPersonId
    );

    return { horario };
}

// Actualizar un horario semanal
async function actualizarHorario(id, datos, clinicId, auditPersonId) {
    if (!/^[1-9]\d*$/.test(String(id))) {
        return {
            error: 'El ID del horario debe ser un entero positivo.',
            status: 400
        };
    }

    const validacion = validarDatosActualizacion(datos);

    if (validacion.error) {
        return validacion;
    }

    const horario = await horariosRepositorio.actualizarHorario(
        Number(id),
        validacion.datos,
        clinicId,
        auditPersonId
    );

    if (!horario) {
        return {
            error: 'Horario no encontrado en esta clínica.',
            status: 404
        };
    }

    return { horario };
}

// Eliminar (desactivar lógicamente) un horario semanal
async function eliminarHorario(id, clinicId, auditPersonId) {
    if (!/^[1-9]\d*$/.test(String(id))) {
        return {
            error: 'El ID del horario debe ser un entero positivo.',
            status: 400
        };
    }

    const resultado = await horariosRepositorio.eliminarHorario(
        Number(id),
        clinicId,
        auditPersonId
    );

    if (!resultado) {
        return {
            error: 'Horario no encontrado en esta clínica.',
            status: 404
        };
    }

    return { resultado };
}

module.exports = {
    obtenerHorarios,
    obtenerHorarioPorId,
    crearHorario,
    actualizarHorario,
    eliminarHorario
};
