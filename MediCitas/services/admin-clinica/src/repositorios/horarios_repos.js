const pool = require('../config/database');

// Consultar los horarios semanales (opcionalmente filtrados por profesional)
async function obtenerHorarios(clinicId, auditPersonId, profesionalId = null) {
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        await client.query( "select set_config('app.clinic_id', $1, true)", [String(clinicId)]);

        const resultado = await client.query( `
        SELECT DISTINCT
            professionalscheduleid AS id,
            clinicprofessionalid AS "profesionalId",
            day AS dia,
            starttime AS "horaInicio",
            endtime AS "horaFin",
            scheduleactive AS activo
        FROM consultarhorarios($1, $2, $3)
        WHERE professionalscheduleid IS NOT NULL
        ORDER BY "profesionalId", dia, "horaInicio"
        `,[
        clinicId,
        auditPersonId,
        profesionalId || null
        ]);

        await client.query('COMMIT');

        return resultado.rows;

    }catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
}

// Consultar un horario específico por su ID
async function obtenerHorarioPorId(id, clinicId, auditPersonId) {
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        await client.query( "select set_config('app.clinic_id', $1, true)", [String(clinicId)]);

        const resultado = await client.query(`
        SELECT DISTINCT
            professionalscheduleid AS id,
            clinicprofessionalid AS "profesionalId",
            day AS dia,
            starttime AS "horaInicio",
            endtime AS "horaFin",
            scheduleactive AS activo
        FROM consultarhorarios($1, $2, NULL)
        WHERE professionalscheduleid = $3
        `,[clinicId, auditPersonId, id]);

        await client.query('COMMIT');

        return resultado.rows[0];

    }catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
}

// Registrar un nuevo horario semanal para un profesional
async function crearHorario(datos, clinicId, auditPersonId) {
    const { profesionalId, dia, horaInicio, horaFin } = datos;
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        await client.query( "select set_config('app.clinic_id', $1, true)", [String(clinicId)]);

        await client.query(
        `
        CALL crearhorario($1, $2, $3, $4, $5, $6)`,
        [
            clinicId,
            auditPersonId,
            profesionalId,
            dia,
            horaInicio,
            horaFin
        ]
        );

        await client.query('COMMIT');

        return {
        profesionalId,
        dia,
        horaInicio,
        horaFin
        };

    }catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
}

// Actualizar un horario semanal existente
async function actualizarHorario(id, datos, clinicId, auditPersonId) {
    const { dia, horaInicio, horaFin, activo } = datos;
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        await client.query( "select set_config('app.clinic_id', $1, true)", [String(clinicId)]);

        await client.query(
        `
        CALL actualizarhorario($1, $2, $3, $4, $5, $6, $7)`,
        [
            clinicId,
            auditPersonId,
            id,
            dia,
            horaInicio,
            horaFin,
            activo
        ]
        );

        await client.query('COMMIT');

        return await obtenerHorarioPorId(id, clinicId, auditPersonId);

    }catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
}

// Dar de baja lógica un horario semanal (isactive = false)
async function eliminarHorario(id, clinicId, auditPersonId) {
    const horarioActual = await obtenerHorarioPorId(id, clinicId, auditPersonId);
    if (!horarioActual) {
        return null;
    }
    
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        await client.query( "select set_config('app.clinic_id', $1, true)", [String(clinicId)]);

        await client.query(
        `        
        CALL actualizarhorario($1, $2, $3, $4, $5, $6, $7)`,
        [
            clinicId,
            auditPersonId,
            id,
            horarioActual.dia,
            horarioActual.horaInicio,
            horarioActual.horaFin,
            false
        ]
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
    obtenerHorarios,
    obtenerHorarioPorId,
    crearHorario,
    actualizarHorario,
    eliminarHorario
};
