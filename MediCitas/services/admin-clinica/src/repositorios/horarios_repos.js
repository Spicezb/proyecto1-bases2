const pool = require('../config/database');

// Consultar los horarios semanales (opcionalmente filtrados por profesional)
async function obtenerHorarios(clinicId, auditPersonId, profesionalId = null) {
    const query = `

        SELECT set_config('app.clinic_id', $4, true);

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
    `;

    const resultado = await pool.query(query, [
        clinicId,
        auditPersonId,
        profesionalId || null,
        String(clinicId)
    ]);

    return resultado.rows;
}

// Consultar un horario específico por su ID
async function obtenerHorarioPorId(id, clinicId, auditPersonId) {
    const query = `

        SELECT set_config('app.clinic_id', $4, true);

        SELECT DISTINCT
            professionalscheduleid AS id,
            clinicprofessionalid AS "profesionalId",
            day AS dia,
            starttime AS "horaInicio",
            endtime AS "horaFin",
            scheduleactive AS activo
        FROM consultarhorarios($1, $2, NULL)
        WHERE professionalscheduleid = $3
    `;

    const resultado = await pool.query(query, [clinicId, auditPersonId, id,String(clinicId)]);

    return resultado.rows[0];
}

// Registrar un nuevo horario semanal para un profesional
async function crearHorario(datos, clinicId, auditPersonId) {
    const { profesionalId, dia, horaInicio, horaFin } = datos;

    await pool.query(
        `
        SELECT set_config('app.clinic_id', $7, true);
        
        CALL crearhorario($1, $2, $3, $4, $5, $6)`,
        [
            clinicId,
            auditPersonId,
            profesionalId,
            dia,
            horaInicio,
            horaFin,
            String(clinicId)
        ]
    );

    return {
        profesionalId,
        dia,
        horaInicio,
        horaFin
    };
}

// Actualizar un horario semanal existente
async function actualizarHorario(id, datos, clinicId, auditPersonId) {
    const { dia, horaInicio, horaFin, activo } = datos;

    await pool.query(
        `
        SELECT set_config('app.clinic_id', $8, true);
        
        CALL actualizarhorario($1, $2, $3, $4, $5, $6, $7)`,
        [
            clinicId,
            auditPersonId,
            id,
            dia,
            horaInicio,
            horaFin,
            activo,
            String(clinicId)
        ]
    );

    return await obtenerHorarioPorId(id, clinicId, auditPersonId);
}

// Dar de baja lógica un horario semanal (isactive = false)
async function eliminarHorario(id, clinicId, auditPersonId) {
    const horarioActual = await obtenerHorarioPorId(id, clinicId, auditPersonId);

    if (!horarioActual) {
        return null;
    }

    await pool.query(
        `
        SELECT set_config('app.clinic_id', $8, true);
        
        CALL actualizarhorario($1, $2, $3, $4, $5, $6, $7)`,
        [
            clinicId,
            auditPersonId,
            id,
            horarioActual.dia,
            horarioActual.horaInicio,
            horarioActual.horaFin,
            false,
            String(clinicId)
        ]
    );

    return { id: Number(id), activo: false };
}

module.exports = {
    obtenerHorarios,
    obtenerHorarioPorId,
    crearHorario,
    actualizarHorario,
    eliminarHorario
};
