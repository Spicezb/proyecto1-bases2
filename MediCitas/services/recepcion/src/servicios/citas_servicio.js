const citasRepositorio = require('../repositorios/citas_repos');
const redis = require('../config/redis');
const { construirClaveDisponibilidad } = require('./disponibilidad_servicio');

function esFechaValida(fechaStr) {
    if (typeof fechaStr !== 'string' || !fechaStr.trim()) {
        return false;
    }
    const fecha = new Date(fechaStr);
    return !Number.isNaN(fecha.getTime());
}

function esSoloFecha(fechaStr) {
    if (typeof fechaStr !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(fechaStr)) {
        return false;
    }
    const fecha = new Date(fechaStr);
    return !Number.isNaN(fecha.getTime()) && fecha.toISOString().slice(0, 10) === fechaStr;
}

// Extraer YYYY-MM-DD de un string ISO o fecha
function extraerFecha(fechaHoraStr) {
    try {
        const d = new Date(fechaHoraStr);
        return d.toISOString().slice(0, 10);
    } catch {
        return String(fechaHoraStr).slice(0, 10);
    }
}

// RF9: Validar y reservar cita
async function reservarCita(datos, clinicId, auditPersonId) {
    const { pacienteId, profesionalId, servicioId, fechaHora } = datos || {};

    if (!Number.isSafeInteger(pacienteId) || pacienteId <= 0) {
        return {
            error: 'El ID del paciente debe ser un entero positivo.',
            status: 400
        };
    }

    if (!Number.isSafeInteger(profesionalId) || profesionalId <= 0) {
        return {
            error: 'El ID del profesional debe ser un entero positivo.',
            status: 400
        };
    }

    if (!Number.isSafeInteger(servicioId) || servicioId <= 0) {
        return {
            error: 'El ID del servicio debe ser un entero positivo.',
            status: 400
        };
    }

    if (!esFechaValida(fechaHora)) {
        return {
            error: 'La fecha y hora de la cita debe tener un formato válido (ISO-8601).',
            status: 400
        };
    }

    const cita = await citasRepositorio.reservarCita(
        {
            pacienteId,
            profesionalId,
            servicioId,
            fechaHora
        },
        clinicId,
        auditPersonId
    );

    // Invariante I8: Invalidar explícitamente la caché de disponibilidad en Redis
    const fecha = extraerFecha(fechaHora);
    const cacheKey = construirClaveDisponibilidad(clinicId, profesionalId, fecha);
    await redis.deleteCache(cacheKey);

    return { cita };
}

// RF10: Validar y reprogramar cita
async function reprogramarCita(id, datos, clinicId, auditPersonId) {
    if (!/^[1-9]\d*$/.test(String(id))) {
        return {
            error: 'El ID de la cita debe ser un entero positivo.',
            status: 400
        };
    }

    const { nuevoProfesionalId, nuevoServicioId, nuevaFechaHora } = datos || {};

    if (!Number.isSafeInteger(nuevoProfesionalId) || nuevoProfesionalId <= 0) {
        return {
            error: 'El ID del nuevo profesional debe ser un entero positivo.',
            status: 400
        };
    }

    if (!Number.isSafeInteger(nuevoServicioId) || nuevoServicioId <= 0) {
        return {
            error: 'El ID del nuevo servicio debe ser un entero positivo.',
            status: 400
        };
    }

    if (!esFechaValida(nuevaFechaHora)) {
        return {
            error: 'La nueva fecha y hora debe tener un formato válido (ISO-8601).',
            status: 400
        };
    }

    const cita = await citasRepositorio.reprogramarCita(
        Number(id),
        {
            nuevoProfesionalId,
            nuevoServicioId,
            nuevaFechaHora
        },
        clinicId,
        auditPersonId
    );

    // Invariante I8: Invalidar caché para nuevo horario y horario previo
    const nuevaFecha = extraerFecha(nuevaFechaHora);
    await redis.deleteCache(construirClaveDisponibilidad(clinicId, nuevoProfesionalId, nuevaFecha));
    if (cita.profesionalOriginalId && cita.fechaOriginal) {
        await redis.deleteCache(construirClaveDisponibilidad(clinicId, cita.profesionalOriginalId, cita.fechaOriginal));
    }

    return { cita };
}

// RF11: Validar y cancelar cita
async function cancelarCita(id, motivo, clinicId, auditPersonId) {
    if (!/^[1-9]\d*$/.test(String(id))) {
        return {
            error: 'El ID de la cita debe ser un entero positivo.',
            status: 400
        };
    }

    if (motivo !== undefined && motivo !== null && (typeof motivo !== 'string' || motivo.length > 250)) {
        return {
            error: 'El motivo de cancelación debe ser un texto de máximo 250 caracteres.',
            status: 400
        };
    }

    const cita = await citasRepositorio.cancelarCita(
        Number(id),
        motivo ? motivo.trim() : 'Cancelada por recepción',
        clinicId,
        auditPersonId
    );

    // Invariante I8: Invalidar caché al cancelar la cita para liberar el cupo en Redis
    if (cita.profesionalId && cita.fecha) {
        await redis.deleteCache(construirClaveDisponibilidad(clinicId, cita.profesionalId, cita.fecha));
    }

    return { cita };
}

// RF12: Validar y registrar desenlace
async function registrarDesenlace(id, estado, clinicId, auditPersonId) {
    if (!/^[1-9]\d*$/.test(String(id))) {
        return {
            error: 'El ID de la cita debe ser un entero positivo.',
            status: 400
        };
    }

    let estadoId;
    if (estado === 'atendida' || estado === 2) {
        estadoId = 2;
    } else if (estado === 'ausente' || estado === 3) {
        estadoId = 3;
    } else {
        return {
            error: 'El estado del desenlace debe ser "atendida" (2) o "ausente" (3).',
            status: 400
        };
    }

    const cita = await citasRepositorio.registrarDesenlace(
        Number(id),
        estadoId,
        clinicId,
        auditPersonId
    );

    return { cita };
}

// RF20: Consultar agenda
async function consultarAgenda(clinicId, auditPersonId, fecha, profesionalId) {
    if (!esSoloFecha(fecha)) {
        return {
            error: 'La fecha debe tener formato válido YYYY-MM-DD.',
            status: 400
        };
    }

    if (profesionalId !== undefined && profesionalId !== null) {
        if (!/^[1-9]\d*$/.test(String(profesionalId))) {
            return {
                error: 'El ID del profesional debe ser un entero positivo.',
                status: 400
            };
        }
    }

    const agenda = await citasRepositorio.consultarAgenda(
        clinicId,
        auditPersonId,
        fecha,
        profesionalId ? Number(profesionalId) : null
    );

    return { agenda };
}

// RF16: Historial de citas de un paciente
async function consultarCitasPaciente(clinicId, auditPersonId, pacienteId) {
    if (!/^[1-9]\d*$/.test(String(pacienteId))) {
        return {
            error: 'El ID del paciente debe ser un entero positivo.',
            status: 400
        };
    }

    const citas = await citasRepositorio.consultarCitasPaciente(
        clinicId,
        auditPersonId,
        Number(pacienteId)
    );

    return { citas };
}

// RF21: Contar citas por estado
async function contarCitasPorEstado(clinicId, auditPersonId, fechaInicio, fechaFin) {
    if (!esSoloFecha(fechaInicio) || !esSoloFecha(fechaFin)) {
        return {
            error: 'Las fechas deben tener formato válido YYYY-MM-DD.',
            status: 400
        };
    }

    if (fechaInicio > fechaFin) {
        return {
            error: 'La fecha de inicio no puede ser posterior a la fecha final.',
            status: 400
        };
    }

    const resumen = await citasRepositorio.contarCitasPorEstado(
        clinicId,
        auditPersonId,
        fechaInicio,
        fechaFin
    );

    return { resumen };
}

module.exports = {
    reservarCita,
    reprogramarCita,
    cancelarCita,
    registrarDesenlace,
    consultarAgenda,
    consultarCitasPaciente,
    contarCitasPorEstado
};
