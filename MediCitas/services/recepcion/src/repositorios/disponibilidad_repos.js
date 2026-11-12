const pool = require('../config/database');

// RF7: Consultar espacios disponibles de un profesional en una fecha
async function consultarDisponibilidadProfesional(
    clinicId,
    auditPersonId,
    profesionalId,
    fecha
) {
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        // Establecer el contexto de la clínica para RLS
        await client.query(
            "SELECT set_config('app.clinic_id', $1, true)",
            [String(clinicId)]
        );

        const query = `
            SELECT
                slotstart AS "inicio",
                slotend AS "fin"
            FROM consultardisponibilidad($1, $2, $3, $4)
            ORDER BY slotstart ASC
        `;

        const resultado = await client.query(query, [
            clinicId,
            auditPersonId,
            profesionalId,
            fecha
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

// RF8: Consultar disponibilidad por servicio en un rango de fechas
async function consultarDisponibilidadServicio(
    clinicId,
    auditPersonId,
    servicioId,
    fechaInicio,
    fechaFin
) {
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        // Establecer el contexto de la clínica para RLS
        await client.query(
            "SELECT set_config('app.clinic_id', $1, true)",
            [String(clinicId)]
        );

        const query = `
            SELECT
                clinicprofessionalid AS "profesionalId",
                professionalid AS "idProfesionalGlobal",
                professionalname AS "nombreProfesional",
                startdatetime AS "inicio",
                enddatetime AS "fin"
            FROM consultardisponibilidadservicio($1, $2, $3, $4, $5)
            ORDER BY startdatetime ASC
        `;

        const resultado = await client.query(query, [
            clinicId,
            auditPersonId,
            servicioId,
            fechaInicio,
            fechaFin
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
    consultarDisponibilidadProfesional,
    consultarDisponibilidadServicio
};
