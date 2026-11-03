const pool = require('../config/database');

// Obtener todos los profesionales de la clínica usando consultarprofesionales
async function obtenerProfesionales(clinicId, auditPersonId) {
    const query = `
        SELECT
            cp.clinicprofessionalid AS id,
            cp.professionalid AS "profesionalId",
            cp.userid AS "usuarioId",
            cp.name AS nombre,
            cp.lastname AS apellidos,
            cp.licenseid AS licencia,
            cp.isactive AS activo,
            COALESCE(
                ARRAY_AGG(DISTINCT s.name) FILTER (WHERE s.specialtyid IS NOT NULL),
                ARRAY[]::varchar[]
            ) AS especialidades
        FROM consultarprofesionales($1, $2) cp
        LEFT JOIN professionalspecialties ps
            ON cp.professionalid = ps.professionalid AND ps.isactive = TRUE
        LEFT JOIN specialties s
            ON ps.specialtyid = s.specialtyid AND s.isactive = TRUE
        WHERE cp.isactive = TRUE
        GROUP BY
            cp.clinicprofessionalid,
            cp.professionalid,
            cp.userid,
            cp.name,
            cp.lastname,
            cp.licenseid,
            cp.isactive
        ORDER BY cp.lastname, cp.name
    `;

    const resultado = await pool.query(query, [clinicId, auditPersonId]);
    return resultado.rows;
}

// Obtener un profesional específico por su ID (clinicprofessionalid)
async function obtenerProfesionalPorId(id, clinicId, auditPersonId) {
    const query = `
        SELECT
            cp.clinicprofessionalid AS id,
            cp.professionalid AS "profesionalId",
            cp.userid AS "usuarioId",
            cp.name AS nombre,
            cp.lastname AS apellidos,
            cp.licenseid AS licencia,
            cp.isactive AS activo,
            COALESCE(
                ARRAY_AGG(DISTINCT s.name) FILTER (WHERE s.specialtyid IS NOT NULL),
                ARRAY[]::varchar[]
            ) AS especialidades
        FROM consultarprofesionales($1, $2) cp
        LEFT JOIN professionalspecialties ps
            ON cp.professionalid = ps.professionalid AND ps.isactive = TRUE
        LEFT JOIN specialties s
            ON ps.specialtyid = s.specialtyid AND s.isactive = TRUE
        WHERE cp.clinicprofessionalid = $3
        GROUP BY
            cp.clinicprofessionalid,
            cp.professionalid,
            cp.userid,
            cp.name,
            cp.lastname,
            cp.licenseid,
            cp.isactive
    `;

    const resultado = await pool.query(query, [clinicId, auditPersonId, id]);
    return resultado.rows[0];
}

// Registrar un nuevo profesional usando crearprofesional y asignarespecialidad
async function registrarProfesional(datos, clinicId, auditPersonId) {
    const { usuarioId, licencia, especialidades } = datos;

    // 1. Invocar el SP crearprofesional
    await pool.query(
        `CALL crearprofesional($1, $2, $3, $4)`,
        [clinicId, auditPersonId, usuarioId, licencia]
    );

    // Obtener el registro recién creado
    const query = `
        SELECT clinicprofessionalid AS id, professionalid AS "profesionalId"
        FROM consultarprofesionales($1, $2)
        WHERE userid = $3
        LIMIT 1
    `;
    const creado = await pool.query(query, [clinicId, auditPersonId, usuarioId]);
    const profesionalId = creado.rows[0]?.profesionalId;
    const clinicProfessionalId = creado.rows[0]?.id;

    // 2. Asignar especialidades si se proporcionaron
    if (profesionalId && Array.isArray(especialidades)) {
        for (const specialtyId of especialidades) {
            await pool.query(
                `CALL asignarespecialidad($1, $2, $3, $4)`,
                [clinicId, auditPersonId, profesionalId, specialtyId]
            );
        }
    }

    return await obtenerProfesionalPorId(clinicProfessionalId, clinicId, auditPersonId);
}

// Actualizar datos del profesional usando actualizarprofesional
async function actualizarProfesional(id, datos, clinicId, auditPersonId) {
    const { licencia, activo, especialidades } = datos;

    const actual = await obtenerProfesionalPorId(id, clinicId, auditPersonId);
    if (!actual) {
        return null;
    }

    await pool.query(
        `CALL actualizarprofesional($1, $2, $3, $4, $5)`,
        [
            clinicId,
            auditPersonId,
            actual.profesionalId,
            licencia || actual.licencia,
            activo !== undefined ? activo : true
        ]
    );

    // Si se envían nuevas especialidades para asignar
    if (Array.isArray(especialidades)) {
        for (const specialtyId of especialidades) {
            await pool.query(
                `CALL asignarespecialidad($1, $2, $3, $4)`,
                [clinicId, auditPersonId, actual.profesionalId, specialtyId]
            );
        }
    }

    return await obtenerProfesionalPorId(id, clinicId, auditPersonId);
}

// Dar de baja lógica un profesional (isactive = false)
async function eliminarProfesional(id, clinicId, auditPersonId) {
    const actual = await obtenerProfesionalPorId(id, clinicId, auditPersonId);
    if (!actual) {
        return null;
    }

    await pool.query(
        `CALL actualizarprofesional($1, $2, $3, $4, $5)`,
        [clinicId, auditPersonId, actual.profesionalId, actual.licencia, false]
    );

    return { id: Number(id), activo: false };
}

// Asignar un servicio médico al profesional usando asignarservicioprofesional
async function asociarServicio(id, servicioId, clinicId, auditPersonId) {
    await pool.query(
        `CALL asignarservicioprofesional($1, $2, $3, $4)`,
        [clinicId, auditPersonId, id, servicioId]
    );

    return {
        profesionalId: Number(id),
        servicioId: Number(servicioId)
    };
}

// Consultar los servicios médicos habilitados para un profesional
async function obtenerServiciosProfesional(id, clinicId) {
    const query = `
        SELECT
            cps.clinicprofessionalserviceid AS id,
            cs.clinicserviceid AS "servicioId",
            s.name AS nombre,
            sp.name AS especialidad,
            cs.duration AS duracion
        FROM clinicprofessionalservices cps
        JOIN clinicservices cs
            ON cs.clinicserviceid = cps.clinicserviceid
        JOIN services s
            ON s.serviceid = cs.serviceid
        JOIN specialties sp
            ON sp.specialtyid = s.specialtyid
        WHERE cps.clinicprofessionalid = $1
          AND cs.clinicid = $2
          AND cps.isactive = TRUE
          AND cs.isactive = TRUE
        ORDER BY s.name ASC
    `;

    const resultado = await pool.query(query, [id, clinicId]);
    return resultado.rows;
}

module.exports = {
    obtenerProfesionales,
    obtenerProfesionalPorId,
    registrarProfesional,
    actualizarProfesional,
    eliminarProfesional,
    asociarServicio,
    obtenerServiciosProfesional
};
