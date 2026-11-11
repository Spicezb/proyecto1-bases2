const pool = require('../config/database');

// RF19: Consultar bitácora de auditoría
async function consultarLogs(clinicId, auditPersonId, filtros = {}) {
    const { personaId, pacienteId, fechaInicio, fechaFin } = filtros;

    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        await client.query( "select set_config('app.clinic_id', $1, true)", [String(clinicId)]);

        const resultado  = await client.query(`

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
        `,[
            clinicId,
            auditPersonId,
            personaId || null,
            pacienteId || null,
            fechaInicio || null,
            fechaFin || null
        ]);

        await client.query('COMMIT');

        return resultado.rows;

    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
}

module.exports = {
    consultarLogs
};
