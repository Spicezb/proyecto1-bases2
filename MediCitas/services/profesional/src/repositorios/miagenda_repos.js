const pool = require('../config/database');

// RF20: Consultar propia agenda del día
async function consultarAgendaPropia(clinicId, auditPersonId, fecha) {
    const query = `
        SELECT set_config('app.clinic_id', $4, true);

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

    const resultado = await pool.query(query, [clinicId, auditPersonId, fecha,String(clinicId)]);
    return resultado.rows;
}

// RF5: Consultar propios horarios semanales
async function consultarHorariosPropios(clinicId, auditPersonId) {
    const query = `
        SELECT set_config('app.clinic_id', $3, true);

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

    const resultado = await pool.query(query, [clinicId, auditPersonId,String(clinicId)]);
    return resultado.rows;
}

// RF12 & RF13: Registrar desenlace de cita (atendida = 2, ausente = 3)
async function registrarDesenlace(appointmentId, nuevoEstadoId, clinicId, auditPersonId) {
    await pool.query(
        `
        SELECT set_config('app.clinic_id', $5, true);

        CALL cambiarestadocita($1, $2, $3, $4, NULL)`,
        [clinicId, auditPersonId, appointmentId, nuevoEstadoId,String(clinicId)]
    );

    return {
        citaId: Number(appointmentId),
        estadoId: nuevoEstadoId,
        estado: nuevoEstadoId === 2 ? 'atendida' : 'ausente'
    };
}

// RF16: Consultar historial de citas de un paciente atendido
async function consultarHistorialPaciente(pacienteId, clinicId, auditPersonId) {
    const query = `
        SELECT set_config('app.clinic_id', $4, true);

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

    const resultado = await pool.query(query, [clinicId, auditPersonId, pacienteId, String(clinicId)]);
    return resultado.rows;
}

module.exports = {
    consultarAgendaPropia,
    consultarHorariosPropios,
    registrarDesenlace,
    consultarHistorialPaciente
};
