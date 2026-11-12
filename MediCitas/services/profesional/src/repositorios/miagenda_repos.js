const pool = require('../config/database');

// RF20: Consultar propia agenda del día
async function consultarAgendaPropia(clinicId, auditPersonId, fecha) {
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
                appointmentid AS "citaId",
                appointmentdate AS "fechaHoraInicio",
                enddatetime AS "fechaHoraFin",
                clinicpatientid AS "pacienteId",
                patientname AS "pacienteNombre",
                servicename AS "servicioNombre",
                statusid AS "estadoId"
            FROM consultaragenda($1, $2, $3, NULL)
            ORDER BY appointmentdate ASC
        `;

        const resultado = await client.query(query, [
            clinicId,
            auditPersonId,
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

// RF5: Consultar propios horarios semanales
async function consultarHorariosPropios(clinicId, auditPersonId) {
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        // Establecer el contexto de la clínica para RLS
        await client.query(
            "SELECT set_config('app.clinic_id', $1, true)",
            [String(clinicId)]
        );

        const query = `
            SELECT DISTINCT
                professionalscheduleid AS id,
                day AS dia,
                starttime AS "horaInicio",
                endtime AS "horaFin",
                scheduleactive AS activo
            FROM consultarhorarios($1, $2, NULL)
            WHERE professionalscheduleid IS NOT NULL
            ORDER BY dia, "horaInicio"
        `;

        const resultado = await client.query(query, [
            clinicId,
            auditPersonId
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

// RF12 y RF13: Registrar desenlace de cita
// Estado 2 = atendida
// Estado 3 = ausente
async function registrarDesenlace(
    appointmentId,
    nuevoEstadoId,
    clinicId,
    auditPersonId
) {
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        // Establecer el contexto de la clínica para RLS
        await client.query(
            "SELECT set_config('app.clinic_id', $1, true)",
            [String(clinicId)]
        );

        await client.query(
            'CALL cambiarestadocita($1, $2, $3, $4, NULL)',
            [
                clinicId,
                auditPersonId,
                appointmentId,
                nuevoEstadoId
            ]
        );

        await client.query('COMMIT');

        return {
            citaId: Number(appointmentId),
            estadoId: nuevoEstadoId,
            estado: Number(nuevoEstadoId) === 2
                ? 'atendida'
                : 'ausente'
        };

    } catch (error) {
        await client.query('ROLLBACK');
        throw error;

    } finally {
        client.release();
    }
}

// RF16: Consultar historial de citas de un paciente atendido
async function consultarHistorialPaciente(
    pacienteId,
    clinicId,
    auditPersonId
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
                appointmentid AS "citaId",
                appointmentdate AS "fechaHoraInicio",
                enddatetime AS "fechaHoraFin",
                statusid AS "estadoId",
                servicename AS "servicioNombre",
                professionalname AS "profesionalNombre",
                cancellationreason AS "motivoCancelacion"
            FROM consultarcitaspaciente($1, $2, $3)
            ORDER BY appointmentdate DESC
        `;

        const resultado = await client.query(query, [
            clinicId,
            auditPersonId,
            pacienteId
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
    consultarAgendaPropia,
    consultarHorariosPropios,
    registrarDesenlace,
    consultarHistorialPaciente
};
