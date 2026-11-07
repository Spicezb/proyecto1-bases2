const bloqueosRepositorio = require('../repositorios/bloqueos_repos');
const redis = require('../config/redis');

// Validar fecha en formato ISO o timestamp parseable
function esFechaValida(fechaStr) {
    if (typeof fechaStr !== 'string' || !fechaStr.trim()) {
        return false;
    }
    const fecha = new Date(fechaStr);
    return !Number.isNaN(fecha.getTime());
}

// Validar datos para crear un bloqueo
function validarDatosCreacion(datos) {
    const { profesionalId, fechaInicio, fechaFin, motivo } = datos || {};

    if (!Number.isSafeInteger(profesionalId) || profesionalId <= 0) {
        return {
            error: 'El ID del profesional debe ser un entero positivo.',
            status: 400
        };
    }

    if (!esFechaValida(fechaInicio)) {
        return {
            error: 'La fecha y hora de inicio no tiene un formato válido.',
            status: 400
        };
    }

    if (!esFechaValida(fechaFin)) {
        return {
            error: 'La fecha y hora de finalización no tiene un formato válido.',
            status: 400
        };
    }

    const dInicio = new Date(fechaInicio);
    const dFin = new Date(fechaFin);

    if (dFin <= dInicio) {
        return {
            error: 'La fecha de finalización debe ser posterior a la fecha de inicio.',
            status: 400
        };
    }

    if (motivo !== undefined && motivo !== null && (typeof motivo !== 'string' || motivo.length > 255)) {
        return {
            error: 'El motivo del bloqueo debe ser un texto de máximo 255 caracteres.',
            status: 400
        };
    }

    return {
        datos: {
            profesionalId,
            fechaInicio,
            fechaFin,
            motivo: motivo ? motivo.trim() : null
        }
    };
}

// Validar datos para actualizar un bloqueo
function validarDatosActualizacion(datos) {
    const { fechaInicio, fechaFin, motivo } = datos || {};

    if (!esFechaValida(fechaInicio) || !esFechaValida(fechaFin)) {
        return {
            error: 'Debe proporcionar fechas de inicio y finalización válidas.',
            status: 400
        };
    }

    const dInicio = new Date(fechaInicio);
    const dFin = new Date(fechaFin);

    if (dFin <= dInicio) {
        return {
            error: 'La fecha de finalización debe ser posterior a la fecha de inicio.',
            status: 400
        };
    }

    if (motivo !== undefined && motivo !== null && (typeof motivo !== 'string' || motivo.length > 255)) {
        return {
            error: 'El motivo del bloqueo debe ser un texto de máximo 255 caracteres.',
            status: 400
        };
    }

    return {
        datos: {
            fechaInicio,
            fechaFin,
            motivo: motivo ? motivo.trim() : null
        }
    };
}

// Obtener bloqueos
async function obtenerBloqueos(clinicId, auditPersonId, profesionalId) {
    if (profesionalId !== undefined && profesionalId !== null) {
        if (!/^[1-9]\d*$/.test(String(profesionalId))) {
            return {
                error: 'El ID del profesional debe ser un entero positivo.',
                status: 400
            };
        }
    }

    const bloqueos = await bloqueosRepositorio.obtenerBloqueos(
        clinicId,
        auditPersonId,
        profesionalId ? Number(profesionalId) : null
    );

    return { bloqueos };
}

// Obtener un bloqueo por ID
async function obtenerBloqueoPorId(id, clinicId, auditPersonId) {
    if (!/^[1-9]\d*$/.test(String(id))) {
        return {
            error: 'El ID del bloqueo debe ser un entero positivo.',
            status: 400
        };
    }

    const bloqueo = await bloqueosRepositorio.obtenerBloqueoPorId(
        Number(id),
        clinicId,
        auditPersonId
    );

    return { bloqueo };
}

// Crear bloqueo
async function crearBloqueo(datos, clinicId, auditPersonId) {
    const validacion = validarDatosCreacion(datos);

    if (validacion.error) {
        return validacion;
    }

    const bloqueo = await bloqueosRepositorio.crearBloqueo(
        validacion.datos,
        clinicId,
        auditPersonId
    );

    // Invariante I8: Invalidar caché de disponibilidad del profesional
    await redis.deleteKeysByPattern(`medicitas:disp:${clinicId}:prof:${validacion.datos.profesionalId}:*`);

    return { bloqueo };
}

// Actualizar bloqueo
async function actualizarBloqueo(id, datos, clinicId, auditPersonId) {
    if (!/^[1-9]\d*$/.test(String(id))) {
        return {
            error: 'El ID del bloqueo debe ser un entero positivo.',
            status: 400
        };
    }

    const validacion = validarDatosActualizacion(datos);

    if (validacion.error) {
        return validacion;
    }

    const bloqueo = await bloqueosRepositorio.actualizarBloqueo(
        Number(id),
        validacion.datos,
        clinicId,
        auditPersonId
    );

    if (!bloqueo) {
        return {
            error: 'Bloqueo no encontrado en esta clínica.',
            status: 404
        };
    }

    // Invariante I8: Invalidar caché de disponibilidad del profesional
    if (bloqueo.profesionalId) {
        await redis.deleteKeysByPattern(`medicitas:disp:${clinicId}:prof:${bloqueo.profesionalId}:*`);
    }

    return { bloqueo };
}

// Eliminar (desactivar) bloqueo
async function eliminarBloqueo(id, clinicId, auditPersonId) {
    if (!/^[1-9]\d*$/.test(String(id))) {
        return {
            error: 'El ID del bloqueo debe ser un entero positivo.',
            status: 400
        };
    }

    const bloqueoActual = await bloqueosRepositorio.obtenerBloqueoPorId(Number(id), clinicId, auditPersonId);

    const resultado = await bloqueosRepositorio.eliminarBloqueo(
        Number(id),
        clinicId,
        auditPersonId
    );

    if (!resultado) {
        return {
            error: 'Bloqueo no encontrado en esta clínica.',
            status: 404
        };
    }

    // Invariante I8: Invalidar caché de disponibilidad del profesional
    if (bloqueoActual && bloqueoActual.profesionalId) {
        await redis.deleteKeysByPattern(`medicitas:disp:${clinicId}:prof:${bloqueoActual.profesionalId}:*`);
    }

    return { resultado };
}

module.exports = {
    obtenerBloqueos,
    obtenerBloqueoPorId,
    crearBloqueo,
    actualizarBloqueo,
    eliminarBloqueo
};
