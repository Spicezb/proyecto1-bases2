const pool = require('../config/database');

// RF19: Consultar bitácora de auditoría
async function consultarLogs(clinicId, auditPersonId, filtros = {}) {
    const { personaId, pacienteId, fechaInicio, fechaFin } = filtros;

    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        await client.query("select set_config('app.clinic_id', $1, true)", [String(clinicId)]);

        const resultado = await client.query(`
            SELECT
                auditlogid AS id,
                auditpersonid AS "usuarioId",
                useridentification AS "usuarioIdentificacion",
                username AS "usuarioNombre",
                userlastname AS "usuarioApellido",
                TRIM(CONCAT(username, ' ', userlastname)) AS "usuarioNombreCompleto",
                auditactionid AS "accionId",
                actionname AS "accion",
                audittableid AS "tablaId",
                tablename AS "tabla",
                auditrecordid AS "registroId",
                auditresultid AS "resultadoId",
                resultname AS "resultado",
                clinicpatientid AS "pacienteId",
                createdat AS "fechaHora"
            FROM consultarlogs($1, $2, $3, $4, $5, $6)
        `, [
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