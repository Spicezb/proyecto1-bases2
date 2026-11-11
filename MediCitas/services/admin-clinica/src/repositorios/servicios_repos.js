const pool = require('../config/database');

// Consultar todos los servicios médicos de la clínica usando la función de PostgreSQL
async function obtenerServicios(clinicId, auditPersonId) {
    const query = `
        SELECT set_config('app.clinic_id', $3, true);

        SELECT
            clinicserviceid AS id,
            serviceid AS "servicioId",
            name AS nombre,
            specialtyid AS "especialidadId",
            duration AS duracion,
            isactive AS activo
        FROM consultarservicios($1, $2)
        WHERE isactive = TRUE
        ORDER BY name ASC
    `;

    const resultado = await pool.query(query, [clinicId, auditPersonId,String(clinicId)]);
    return resultado.rows;
}

// Consultar un servicio médico por su ID
async function obtenerServicioPorId(id, clinicId, auditPersonId) {
    const query = `
        SELECT set_config('app.clinic_id', $4, true);

        SELECT
            clinicserviceid AS id,
            serviceid AS "servicioId",
            name AS nombre,
            specialtyid AS "especialidadId",
            duration AS duracion,
            isactive AS activo
        FROM consultarservicios($1, $2)
        WHERE clinicserviceid = $3
    `;

    const resultado = await pool.query(query, [clinicId, auditPersonId, id,String(clinicId)]);
    return resultado.rows[0];
}

// Registrar servicio médico mediante el Stored Procedure crearservicio
async function registrarServicio(datos, clinicId, auditPersonId) {
    const { nombre, especialidadId, duracion } = datos;

    await pool.query(
        `
        SELECT set_config('app.clinic_id', $6, true);

        CALL crearservicio($1, $2, $3, $4, $5)`,
        [clinicId, auditPersonId, nombre, especialidadId, duracion,String(clinicId)]
    );

    // Consultar el servicio recién asociado a la clínica
    const query = `
        SELECT
            clinicserviceid AS id,
            serviceid AS "servicioId",
            name AS nombre,
            specialtyid AS "especialidadId",
            duration AS duracion,
            isactive AS activo
        FROM consultarservicios($1, $2)
        WHERE name = $3
        ORDER BY clinicserviceid DESC
        LIMIT 1
    `;

    const resultado = await pool.query(query, [clinicId, auditPersonId, nombre]);
    return resultado.rows[0] || { nombre, especialidadId, duracion };
}

// Actualizar duración o estado de un servicio médico mediante actualizarservicio
async function actualizarServicio(id, datos, clinicId, auditPersonId) {
    const { duracion, activo } = datos;

    await pool.query(
        `SELECT set_config('app.clinic_id', $6, true);
        
        CALL actualizarservicio($1, $2, $3, $4, $5)`,
        [clinicId, auditPersonId, id, duracion, activo,String(clinicId)]
    );

    return await obtenerServicioPorId(id, clinicId, auditPersonId);
}

// Dar de baja lógica un servicio médico (isactive = false)
async function eliminarServicio(id, clinicId, auditPersonId) {
    const servicioActual = await obtenerServicioPorId(id, clinicId, auditPersonId);

    if (!servicioActual) {
        return null;
    }

    await pool.query(
        `
        SELECT set_config('app.clinic_id', $6, true);
        
        CALL actualizarservicio($1, $2, $3, $4, $5)`,
        [clinicId, auditPersonId, id, servicioActual.duracion, false,String(clinicId)]
    );

    return { id: Number(id), activo: false };
}

module.exports = {
    obtenerServicios,
    obtenerServicioPorId,
    registrarServicio,
    actualizarServicio,
    eliminarServicio
};
