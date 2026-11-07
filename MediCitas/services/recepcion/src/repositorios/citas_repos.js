const pool = require('../config/database');

// Helper para obtener profesional y fecha de una cita para invalidación de caché
async function obtenerDetalleCita(id, clinicId) {
    const res = await pool.query(
        `SELECT
            a.clinicprofessionalid AS "profesionalId",
            (a.date AT TIME ZONE c.clinictimezone)::date::text AS "fecha"
         FROM appointments a
         JOIN clinics c ON c.clinicid = a.clinicid
         WHERE a.appointmentid = $1 AND a.clinicid = $2`,
        [id, clinicId]
    );
    return res.rows[0] || null;
}

// RF9: Reservar una cita
async function reservarCita(datos, clinicId, auditPersonId) {
    const { pacienteId, profesionalId, servicioId, fechaHora } = datos;

    await pool.query(
        `CALL reservarcita($1, $2, $3, $4, $5, $6)`,
        [
            clinicId,
            auditPersonId,
            pacienteId,
            profesionalId,
            servicioId,
            fechaHora
        ]
    );

    return {
        pacienteId,
        profesionalId,
        servicioId,
        fechaHora,
        estado: 'reservada'
    };
}

// RF10: Reprogramar una cita vigente
async function reprogramarCita(id, datos, clinicId, auditPersonId) {
    const { nuevoProfesionalId, nuevoServicioId, nuevaFechaHora } = datos;

    const detalleOriginal = await obtenerDetalleCita(id, clinicId);

    await pool.query(
        `CALL reprogramarcita($1, $2, $3, $4, $5, $6)`,
        [
            clinicId,
            auditPersonId,
            id,
            nuevoProfesionalId,
            nuevoServicioId,
            nuevaFechaHora
        ]
    );

    return {
        citaOriginalId: Number(id),
        nuevoProfesionalId,
        nuevoServicioId,
        nuevaFechaHora,
        profesionalOriginalId: detalleOriginal ? detalleOriginal.profesionalId : null,
        fechaOriginal: detalleOriginal ? detalleOriginal.fecha : null,
        estado: 'reprogramada'
    };
}

// RF11: Cancelar una cita
async function cancelarCita(id, motivo, clinicId, auditPersonId) {
    const detalleOriginal = await obtenerDetalleCita(id, clinicId);

    await pool.query(
        `CALL cambiarestadocita($1, $2, $3, 4, $4)`,
        [clinicId, auditPersonId, id, motivo]
    );

    return {
        citaId: Number(id),
        estado: 'cancelada',
        motivo,
        profesionalId: detalleOriginal ? detalleOriginal.profesionalId : null,
        fecha: detalleOriginal ? detalleOriginal.fecha : null
    };
}

// RF12 & RF13: Registrar desenlace de cita (atendida = 2, ausente = 3)
async function registrarDesenlace(id, nuevoEstadoId, clinicId, auditPersonId) {
    await pool.query(
        `CALL cambiarestadocita($1, $2, $3, $4, NULL)`,
        [clinicId, auditPersonId, id, nuevoEstadoId]
    );

    return {
        citaId: Number(id),
        estadoId: nuevoEstadoId,
        estado: nuevoEstadoId === 2 ? 'atendida' : 'ausente'
    };
}

// RF20: Consultar la agenda del día (de un profesional o de toda la clínica)
async function consultarAgenda(clinicId, auditPersonId, fecha, profesionalId = null) {
    const query = `
        SELECT
            appointmentid AS "citaId",
            appointmentdate AS "fechaHoraInicio",
            enddatetime AS "fechaHoraFin",
            clinicpatientid AS "pacienteId",
            patientname AS "pacienteNombre",
            professionalname AS "profesionalNombre",
            servicename AS "servicioNombre",
            statusid AS "estadoId"
        FROM consultaragenda($1, $2, $3, $4)
        ORDER BY appointmentdate ASC
    `;

    const resultado = await pool.query(query, [
        clinicId,
        auditPersonId,
        fecha,
        profesionalId || null
    ]);

    return resultado.rows;
}

// RF16: Consultar el historial de citas de un paciente
async function consultarCitasPaciente(clinicId, auditPersonId, pacienteId) {
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

    const resultado = await pool.query(query, [
        clinicId,
        auditPersonId,
        pacienteId
    ]);

    return resultado.rows;
}

// RF21: Contar citas por estado en un rango de fechas
async function contarCitasPorEstado(clinicId, auditPersonId, fechaInicio, fechaFin) {
    const query = `
        SELECT
            appointmentstatusid AS "estadoId",
            total::int AS total
        FROM contarcitasporestado($1, $2, $3, $4)
        ORDER BY appointmentstatusid ASC
    `;

    const resultado = await pool.query(query, [
        clinicId,
        auditPersonId,
        fechaInicio,
        fechaFin
    ]);

    return resultado.rows;
}

module.exports = {
    reservarCita,
    reprogramarCita,
    cancelarCita,
    registrarDesenlace,
    consultarAgenda,
    consultarCitasPaciente,
    contarCitasPorEstado
};
