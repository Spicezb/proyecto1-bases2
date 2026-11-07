const pool = require('../config/database');

// RF19: Consultar bitácora de auditoría
async function consultarLogs(clinicId, auditPersonId, filtros = {}) {
    const { personaId, pacienteId, fechaInicio, fechaFin } = filtros;

    const query = `
        SELECT
            auditlogid AS id,
            auditpersonid AS "usuarioId",
            auditactionid AS "accionId",
            audittableid AS "tablaId",
            auditrecordid AS "registroId",
            auditresultid AS "resultadoId",
            clinicpatientid AS "pacienteId",
            createdat AS "fechaHora"
        FROM consultarlogs($1, $2, $3, $4, $5, $6)
    `;

    const resultado = await pool.query(query, [
        clinicId,
        auditPersonId,
        personaId || null,
        pacienteId || null,
        fechaInicio || null,
        fechaFin || null
    ]);

    return resultado.rows;
}

module.exports = {
    consultarLogs
};
