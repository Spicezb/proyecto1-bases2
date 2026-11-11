const pool = require('../config/database');

// Consultar todos los servicios médicos de la clínica usando la función de PostgreSQL
async function obtenerServicios(clinicId, auditPersonId) {
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        await client.query( "select set_config('app.clinic_id', $1, true)", [String(clinicId)]);

        const resultado = await client.query( `
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
        `,[clinicId, auditPersonId]);

        await client.query('COMMIT');

        return resultado.rows;

    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
}

// Consultar un servicio médico por su ID
async function obtenerServicioPorId(id, clinicId, auditPersonId) {
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        await client.query( "select set_config('app.clinic_id', $1, true)", [String(clinicId)]);

        const resultado = await client.query(`
        SELECT
            clinicserviceid AS id,
            serviceid AS "servicioId",
            name AS nombre,
            specialtyid AS "especialidadId",
            duration AS duracion,
            isactive AS activo
        FROM consultarservicios($1, $2)
        WHERE clinicserviceid = $3
        `,[clinicId, auditPersonId, id]);

        await client.query('COMMIT');

        return resultado.rows[0];

    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
}

// Registrar servicio médico mediante el Stored Procedure crearservicio
async function registrarServicio(datos, clinicId, auditPersonId) {
    const { nombre, especialidadId, duracion } = datos;

    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        await client.query( "select set_config('app.clinic_id', $1, true)", [String(clinicId)]);

        await client.query(
        `
        CALL crearservicio($1, $2, $3, $4, $5)`,
        [clinicId, auditPersonId, nombre, especialidadId, duracion]
        );

        // Consultar el servicio recién asociado a la clínica
        const resultado = await client.query(`
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
        `,[clinicId, auditPersonId, nombre]);

        await client.query('COMMIT');

        return resultado.rows[0] || { nombre, especialidadId, duracion };

    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
}

// Actualizar duración o estado de un servicio médico mediante actualizarservicio
async function actualizarServicio(id, datos, clinicId, auditPersonId) {
    const { duracion, activo } = datos;

    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        await client.query( "select set_config('app.clinic_id', $1, true)", [String(clinicId)]);

        await client.query(
        `
        CALL actualizarservicio($1, $2, $3, $4, $5)`,
        [clinicId, auditPersonId, id, duracion, activo]
        );

        await client.query('COMMIT');

        return await obtenerServicioPorId(id, clinicId, auditPersonId);

    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
}

// Dar de baja lógica un servicio médico (isactive = false)
async function eliminarServicio(id, clinicId, auditPersonId) {
    const servicioActual = await obtenerServicioPorId(id, clinicId, auditPersonId);

    if (!servicioActual) {
        return null;
    }

    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        await client.query( "select set_config('app.clinic_id', $1, true)", [String(clinicId)]);

        await client.query(
        `
        CALL actualizarservicio($1, $2, $3, $4, $5)`,
        [clinicId, auditPersonId, id, servicioActual.duracion, false]
        );

        await client.query('COMMIT');

        return { id: Number(id), activo: false };

    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
}

module.exports = {
    obtenerServicios,
    obtenerServicioPorId,
    registrarServicio,
    actualizarServicio,
    eliminarServicio
};
