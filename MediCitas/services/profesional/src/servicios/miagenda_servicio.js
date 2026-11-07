const miagendaRepositorio = require('../repositorios/miagenda_repos');

function esSoloFecha(fechaStr) {
    if (typeof fechaStr !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(fechaStr)) {
        return false;
    }
    const fecha = new Date(fechaStr);
    return !Number.isNaN(fecha.getTime()) && fecha.toISOString().slice(0, 10) === fechaStr;
}

async function consultarAgendaPropia(clinicId, auditPersonId, fecha) {
    if (!esSoloFecha(fecha)) {
        return { error: 'La fecha debe tener formato válido YYYY-MM-DD.', status: 400 };
    }

    const agenda = await miagendaRepositorio.consultarAgendaPropia(clinicId, auditPersonId, fecha);
    return { agenda };
}

async function consultarHorariosPropios(clinicId, auditPersonId) {
    const horarios = await miagendaRepositorio.consultarHorariosPropios(clinicId, auditPersonId);
    return { horarios };
}

async function registrarDesenlace(appointmentId, estado, clinicId, auditPersonId) {
    if (!/^[1-9]\d*$/.test(String(appointmentId))) {
        return { error: 'El ID de la cita debe ser un entero positivo.', status: 400 };
    }

    let estadoId;
    if (estado === 'atendida' || estado === 2) {
        estadoId = 2;
    } else if (estado === 'ausente' || estado === 3) {
        estadoId = 3;
    } else {
        return { error: 'El estado debe ser "atendida" (2) o "ausente" (3).', status: 400 };
    }

    const cita = await miagendaRepositorio.registrarDesenlace(Number(appointmentId), estadoId, clinicId, auditPersonId);
    return { cita };
}

async function consultarHistorialPaciente(pacienteId, clinicId, auditPersonId) {
    if (!/^[1-9]\d*$/.test(String(pacienteId))) {
        return { error: 'El ID del paciente debe ser un entero positivo.', status: 400 };
    }

    const historial = await miagendaRepositorio.consultarHistorialPaciente(Number(pacienteId), clinicId, auditPersonId);
    return { historial };
}

module.exports = {
    consultarAgendaPropia,
    consultarHorariosPropios,
    registrarDesenlace,
    consultarHistorialPaciente
};
