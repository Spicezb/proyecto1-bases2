const pool = require('../config/database');

// RF15: Redactar nota clínica para una cita atendida
async function crearNota(appointmentId, contenido, clinicId, auditPersonId) {
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        // Establecer el contexto de la clínica para RLS
        await client.query(
            "SELECT set_config('app.clinic_id', $1, true)",
            [String(clinicId)]
        );

        // Crear la nota clínica mediante el procedimiento almacenado
        await client.query(
            'CALL crearnota($1, $2, $3, $4)',
            [
                clinicId,
                auditPersonId,
                appointmentId,
                contenido
            ]
        );

        // Recuperar la nota creada usando la misma conexión
        const resultado = await client.query(`
            SELECT
                clinicalnoteid AS id,
                appointmentid AS "citaId",
                content AS contenido,
                createdat AS "fechaCreacion",
                updatedat AS "fechaActualizacion"
            FROM consultarnota($1, $2, $3)
        `, [
            clinicId,
            auditPersonId,
            appointmentId
        ]);

        if (resultado.rows.length === 0) {
            throw new Error(
                'No se pudo recuperar la nota clínica registrada.'
            );
        }

        await client.query('COMMIT');

        return resultado.rows[0];

    } catch (error) {
        await client.query('ROLLBACK');
        throw error;

    } finally {
        client.release();
    }
}

// RF15: Consultar nota clínica de una cita
async function consultarNota(appointmentId, clinicId, auditPersonId) {
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        // Establecer el contexto de la clínica para RLS
        await client.query(
            "SELECT set_config('app.clinic_id', $1, true)",
            [String(clinicId)]
        );

        const resultado = await client.query(`
            SELECT
                clinicalnoteid AS id,
                appointmentid AS "citaId",
                content AS contenido,
                createdat AS "fechaCreacion",
                updatedat AS "fechaActualizacion"
            FROM consultarnota($1, $2, $3)
        `, [
            clinicId,
            auditPersonId,
            appointmentId
        ]);

        await client.query('COMMIT');

        return resultado.rows[0];

    } catch (error) {
        await client.query('ROLLBACK');
        throw error;

    } finally {
        client.release();
    }
}

module.exports = {
    crearNota,
    consultarNota
};
