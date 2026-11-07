const auditoriaRepositorio = require('../repositorios/auditoria_repos');

async function consultarLogs(clinicId, auditPersonId, queryFiltros) {
    const { personaId, pacienteId, fechaInicio, fechaFin } = queryFiltros || {};

    const filtros = {
        personaId: personaId ? Number(personaId) : null,
        pacienteId: pacienteId ? Number(pacienteId) : null,
        fechaInicio: fechaInicio || null,
        fechaFin: fechaFin || null
    };

    const logs = await auditoriaRepositorio.consultarLogs(clinicId, auditPersonId, filtros);
    return { logs };
}

module.exports = {
    consultarLogs
};
