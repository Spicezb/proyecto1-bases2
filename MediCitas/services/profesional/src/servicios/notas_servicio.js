const notasRepositorio = require('../repositorios/notas_repos');

async function crearNota(appointmentId, contenido, clinicId, auditPersonId) {
    if (!/^[1-9]\d*$/.test(String(appointmentId))) {
        return { error: 'El ID de la cita debe ser un entero positivo.', status: 400 };
    }

    if (typeof contenido !== 'string' || !contenido.trim()) {
        return { error: 'El contenido de la nota clínica es obligatorio.', status: 400 };
    }

    const nota = await notasRepositorio.crearNota(Number(appointmentId), contenido.trim(), clinicId, auditPersonId);
    return { nota };
}

async function consultarNota(appointmentId, clinicId, auditPersonId) {
    if (!/^[1-9]\d*$/.test(String(appointmentId))) {
        return { error: 'El ID de la cita debe ser un entero positivo.', status: 400 };
    }

    const nota = await notasRepositorio.consultarNota(Number(appointmentId), clinicId, auditPersonId);
    return { nota };
}

async function actualizarNota(notaId, contenido, clinicId, auditPersonId) {
    if (!/^[1-9]\d*$/.test(String(notaId))) {
        return { error: 'El ID de la nota clínica debe ser un entero positivo.', status: 400 };
    }

    if (typeof contenido !== 'string' || !contenido.trim()) {
        return { error: 'El contenido de la nota clínica es obligatorio.', status: 400 };
    }

    const nota = await notasRepositorio.actualizarNota(Number(notaId), contenido.trim(), clinicId, auditPersonId);
    return { nota };
}

module.exports = {
    crearNota,
    consultarNota,
    actualizarNota
};
