const pool = require('../config/database');

// Consultar bloqueos de agenda de la clínica (opcionalmente filtrados por profesional)
async function obtenerBloqueos(clinicId, auditPersonId, profesionalId = null) {
    const query = `
        SELECT
            sb.scheduleblockid AS id,
            sb.clinicprofessionalid AS "profesionalId",
            u.name || ' ' || u.lastname AS "profesionalNombre",
            sb.startdatetime AS "fechaInicio",
            sb.enddatetime AS "fechaFin",
            sb.reason AS motivo,
            sb.isactive AS activo
        FROM scheduleblocks sb
        JOIN clinicprofessionals cp
            ON cp.clinicprofessionalid = sb.clinicprofessionalid
        JOIN users u
            ON u.userid = cp.userid
        WHERE cp.clinicid = $1
          AND ($2::int IS NULL OR sb.clinicprofessionalid = $2)
          AND sb.isactive = TRUE
        ORDER BY sb.startdatetime ASC
    `;

    const resultado = await pool.query(query, [clinicId, profesionalId || null]);
    return resultado.rows;
}

// Consultar un bloqueo específico por su ID
async function obtenerBloqueoPorId(id, clinicId, auditPersonId) {
    const query = `
        SELECT
            sb.scheduleblockid AS id,
            sb.clinicprofessionalid AS "profesionalId",
            u.name || ' ' || u.lastname AS "profesionalNombre",
            sb.startdatetime AS "fechaInicio",
            sb.enddatetime AS "fechaFin",
            sb.reason AS motivo,
            sb.isactive AS activo
        FROM scheduleblocks sb
        JOIN clinicprofessionals cp
            ON cp.clinicprofessionalid = sb.clinicprofessionalid
        JOIN users u
            ON u.userid = cp.userid
        WHERE cp.clinicid = $1
          AND sb.scheduleblockid = $2
    `;

    const resultado = await pool.query(query, [clinicId, id]);
    return resultado.rows[0];
}

// Registrar un bloqueo de agenda usando el SP crearbloqueo
async function crearBloqueo(datos, clinicId, auditPersonId) {
    const { profesionalId, fechaInicio, fechaFin, motivo } = datos;

    await pool.query(
        `CALL crearbloqueo($1, $2, $3, $4, $5, $6)`,
        [clinicId, auditPersonId, profesionalId, fechaInicio, fechaFin, motivo]
    );

    return {
        profesionalId,
        fechaInicio,
        fechaFin,
        motivo
    };
}

// Actualizar fechas o motivo de un bloqueo usando actualizarbloqueo (operación 1)
async function actualizarBloqueo(id, datos, clinicId, auditPersonId) {
    const { fechaInicio, fechaFin, motivo } = datos;

    await pool.query(
        `CALL actualizarbloqueo($1, $2, $3, 1, $4, $5, $6)`,
        [clinicId, auditPersonId, id, fechaInicio, fechaFin, motivo]
    );

    return await obtenerBloqueoPorId(id, clinicId, auditPersonId);
}

// Desactivar un bloqueo de agenda usando actualizarbloqueo (operación 2)
async function eliminarBloqueo(id, clinicId, auditPersonId) {
    const bloqueoActual = await obtenerBloqueoPorId(id, clinicId, auditPersonId);
    if (!bloqueoActual) {
        return null;
    }

    await pool.query(
        `CALL actualizarbloqueo($1, $2, $3, 2, NULL, NULL, NULL)`,
        [clinicId, auditPersonId, id]
    );

    return { id: Number(id), activo: false };
}

module.exports = {
    obtenerBloqueos,
    obtenerBloqueoPorId,
    crearBloqueo,
    actualizarBloqueo,
    eliminarBloqueo
};
