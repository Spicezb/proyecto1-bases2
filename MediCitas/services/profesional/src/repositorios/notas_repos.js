const pool = require('../config/database');

// RF15: Redactar nota clínica para una cita atendida
async function crearNota(appointmentId, contenido, clinicId, auditPersonId) {
    await pool.query(
        `CALL crearnota($1, $2, $3, $4)`,
        [clinicId, auditPersonId, appointmentId, contenido]
    );

    return await consultarNota(appointmentId, clinicId, auditPersonId);
}

// RF15: Consultar nota clínica de una cita
async function consultarNota(appointmentId, clinicId, auditPersonId) {
    const query = `
        SELECT
            clinicalnoteid AS id,
            appointmentid AS "citaId",
            content AS contenido,
            createdat AS "fechaCreacion",
            updatedat AS "fechaActualizacion"
        FROM consultarnota($1, $2, $3)
    `;

    const resultado = await pool.query(query, [clinicId, auditPersonId, appointmentId]);
    return resultado.rows[0];
}

module.exports = {
    crearNota,
    consultarNota
};
