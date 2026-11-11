const pool = require('../config/database');

// RF7: Consultar espacios disponibles de un profesional en una fecha
async function consultarDisponibilidadProfesional(clinicId, auditPersonId, profesionalId, fecha) {
    const query = `
        SELECT set_config('app.clinic_id', $5, true);

        SELECT
            slotstart AS "inicio",
            slotend AS "fin"
        FROM consultardisponibilidad($1, $2, $3, $4)
        ORDER BY slotstart ASC
    `;

    const resultado = await pool.query(query, [
        clinicId,
        auditPersonId,
        profesionalId,
        fecha,
        String(clinicId)
    ]);

    return resultado.rows;
}

// RF8: Consultar disponibilidad por servicio en un rango de fechas
async function consultarDisponibilidadServicio(clinicId, auditPersonId, servicioId, fechaInicio, fechaFin) {
    const query = `
        SELECT set_config('app.clinic_id', $6, true);

        SELECT
            clinicprofessionalid AS "profesionalId",
            professionalid AS "idProfesionalGlobal",
            professionalname AS "nombreProfesional",
            startdatetime AS "inicio",
            enddatetime AS "fin"
        FROM consultardisponibilidadservicio($1, $2, $3, $4, $5)
        ORDER BY startdatetime ASC
    `;

    const resultado = await pool.query(query, [
        clinicId,
        auditPersonId,
        servicioId,
        fechaInicio,
        fechaFin,
        String(clinicId)
    ]);

    return resultado.rows;
}

module.exports = {
    consultarDisponibilidadProfesional,
    consultarDisponibilidadServicio
};
