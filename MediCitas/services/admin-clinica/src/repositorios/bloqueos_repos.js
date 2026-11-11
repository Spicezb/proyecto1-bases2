const pool = require('../config/database');

// Consultar bloqueos de agenda de la clínica (opcionalmente filtrados por profesional)
async function obtenerBloqueos(clinicId, auditPersonId, profesionalId = null) {
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        await client.query( "select set_config('app.clinic_id', $1, true)", [String(clinicId)]);

        const resultado = await client.query( `
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
        `,[clinicId, profesionalId || null]);

        await client.query('COMMIT');

        return resultado.rows;

    }catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
}

// Consultar un bloqueo específico por su ID
async function obtenerBloqueoPorId(id, clinicId, auditPersonId) {
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        await client.query( "select set_config('app.clinic_id', $1, true)", [String(clinicId)]);

        const resultado = await client.query(`
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
        `,[clinicId, id]);
    
        await client.query('COMMIT');

        return resultado.rows[0];

    }catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
}

// Registrar un bloqueo de agenda usando el SP crearbloqueo
async function crearBloqueo(datos, clinicId, auditPersonId) {
    const { profesionalId, fechaInicio, fechaFin, motivo } = datos;
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        await client.query( "select set_config('app.clinic_id', $1, true)", [String(clinicId)]);

        await client.query(
        `
        CALL crearbloqueo($1, $2, $3, $4, $5, $6)`,
        [clinicId, auditPersonId, profesionalId, fechaInicio, fechaFin, motivo]
        );

        await client.query('COMMIT');

        return {
            profesionalId,
            fechaInicio,
            fechaFin,
            motivo
        };
    }catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
}

// Actualizar fechas o motivo de un bloqueo usando actualizarbloqueo (operación 1)
async function actualizarBloqueo(id, datos, clinicId, auditPersonId) {
    const { fechaInicio, fechaFin, motivo } = datos;
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        await client.query( "select set_config('app.clinic_id', $1, true)", [String(clinicId)]);

        await client.query(
        `
        CALL actualizarbloqueo($1, $2, $3, 1, $4, $5, $6)`,
        [clinicId, auditPersonId, id, fechaInicio, fechaFin, motivo]
        );

        await client.query('COMMIT');

        return await obtenerBloqueoPorId(id, clinicId, auditPersonId);

    }catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
}

// Desactivar un bloqueo de agenda usando actualizarbloqueo (operación 2)
async function eliminarBloqueo(id, clinicId, auditPersonId) {
    const bloqueoActual = await obtenerBloqueoPorId(id, clinicId, auditPersonId);
    if (!bloqueoActual) {
        return null;
    }

    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        await client.query( "select set_config('app.clinic_id', $1, true)", [String(clinicId)]);

        await client.query(
        `
        CALL actualizarbloqueo($1, $2, $3, 2, NULL, NULL, NULL)`,
        [clinicId, auditPersonId, id]
        );

        await client.query('COMMIT');

        return { id: Number(id), activo: false };

    }catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
}

module.exports = {
    obtenerBloqueos,
    obtenerBloqueoPorId,
    crearBloqueo,
    actualizarBloqueo,
    eliminarBloqueo
};
