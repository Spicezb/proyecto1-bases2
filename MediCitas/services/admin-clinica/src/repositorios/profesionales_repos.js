const pool = require('../config/database');

// Obtener profesionales de la clínica
async function obtenerProfesionales(clinicId, auditPersonId) {
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        await client.query("select set_config('app.clinic_id', $1, true)", [String(clinicId)]);

        const resultado = await client.query(`
            SELECT
                clinicprofessionalid AS id,
                professionalid AS "profesionalId",
                userid AS "usuarioId",
                name AS nombre,
                lastname AS apellidos,
                licenseid AS licencia,
                isactive AS activo,
                especialidades
            FROM consultarprofesionales($1, $2)
            WHERE isactive = TRUE
        `, [clinicId, auditPersonId]);

        await client.query('COMMIT');

        return resultado.rows;

    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
}

// Obtener profesional por clinicprofessionalid
async function obtenerProfesionalPorId(id, clinicId, auditPersonId) {
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        await client.query("select set_config('app.clinic_id', $1, true)", [String(clinicId)]);

        const resultado = await client.query(`
            SELECT
                clinicprofessionalid AS id,
                professionalid AS "profesionalId",
                userid AS "usuarioId",
                name AS nombre,
                lastname AS apellidos,
                licenseid AS licencia,
                isactive AS activo,
                especialidades
            FROM consultarprofesionales($1, $2)
            WHERE clinicprofessionalid = $3
        `, [clinicId, auditPersonId, id]);

        await client.query('COMMIT');

        return resultado.rows[0];

    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
}

// Registrar profesional y asignar especialidades
async function registrarProfesional(datos, clinicId, auditPersonId) {
    const { usuarioId, licencia, especialidades } = datos;
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        await client.query("select set_config('app.clinic_id', $1, true)", [String(clinicId)]);

        await client.query(
            `CALL crearprofesional($1, $2, $3, $4)`,
            [clinicId, auditPersonId, usuarioId, licencia]
        );

        const resultado = await client.query(`
            SELECT
                clinicprofessionalid AS id,
                professionalid AS "profesionalId"
            FROM consultarprofesionales($1, $2)
            WHERE userid = $3
            ORDER BY clinicprofessionalid DESC
            LIMIT 1
        `, [clinicId, auditPersonId, usuarioId]);

        if (resultado.rows.length === 0) {
            throw new Error(
                'No se pudo recuperar el profesional registrado.'
            );
        }

        const profesionalId = resultado.rows[0].profesionalId;
        const clinicProfessionalId = resultado.rows[0].id;

        for (const specialtyId of especialidades) {
            await client.query(
                'CALL asignarespecialidad($1, $2, $3, $4)',
                [
                    clinicId,
                    auditPersonId,
                    profesionalId,
                    specialtyId
                ]
            );
        }

        const consulta = await client.query(`
            SELECT
                clinicprofessionalid AS id,
                professionalid AS "profesionalId",
                userid AS "usuarioId",
                name AS nombre,
                lastname AS apellidos,
                licenseid AS licencia,
                isactive AS activo,
                especialidades
            FROM consultarprofesionales($1, $2)
            WHERE clinicprofessionalid = $3
        `, [clinicId, auditPersonId, clinicProfessionalId]);

        if (consulta.rows.length === 0) {
            throw new Error(
                'No se pudo consultar el profesional registrado.'
            );
        }

        await client.query('COMMIT');

        return consulta.rows[0];

    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
}

// Desactivar profesional
async function eliminarProfesional(id, clinicId, auditPersonId) {
    const actual = await obtenerProfesionalPorId(
        id,
        clinicId,
        auditPersonId
    );

    if (!actual) {
        return null;
    }

    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        await client.query("select set_config('app.clinic_id', $1, true)", [String(clinicId)]);

        await client.query(
            `CALL actualizarprofesional($1, $2, $3, $4, $5)`,
            [
                clinicId,
                auditPersonId,
                actual.profesionalId,
                actual.licencia,
                false
            ]
        );

        await client.query('COMMIT');

        return {
            id: Number(id),
            activo: false
        };

    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
}

// Asociar un servicio al profesional
async function asociarServicio(id, servicioId, clinicId, auditPersonId) {
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        await client.query("select set_config('app.clinic_id', $1, true)", [String(clinicId)]);

        await client.query(
            `CALL asignarservicioprofesional($1, $2, $3, $4)`,
            [
                clinicId,
                auditPersonId,
                id,
                servicioId
            ]
        );

        await client.query('COMMIT');

        return {
            profesionalId: Number(id),
            servicioId: Number(servicioId)
        };

    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
}

// Consultar servicios habilitados del profesional mediante función almacenada
async function obtenerServiciosProfesional(id, clinicId, auditPersonId) {
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        await client.query("select set_config('app.clinic_id', $1, true)", [String(clinicId)]);

        const resultado = await client.query(`
            SELECT
                clinicprofessionalserviceid AS id,
                clinicserviceid AS "servicioId",
                servicename AS nombre,
                specialtyname AS especialidad,
                duration AS duracion
            FROM consultarserviciosprofesional($1, $2, $3)
        `, [clinicId, auditPersonId, id]);

        await client.query('COMMIT');

        return resultado.rows;

    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
}

// Actualizar licencia y especialidades
async function actualizarProfesional(id, datos, clinicId, auditPersonId) {
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        await client.query("select set_config('app.clinic_id', $1, true)", [String(clinicId)]);

        const previo = await client.query(`
            SELECT
                clinicprofessionalid AS id,
                professionalid AS "profesionalId",
                licenseid AS licencia
            FROM consultarprofesionales($1, $2)
            WHERE clinicprofessionalid = $3
              AND isactive = TRUE
        `, [clinicId, auditPersonId, id]);

        if (previo.rows.length === 0) {
            await client.query('ROLLBACK');
            return null;
        }

        const licencia = datos.licencia ?? previo.rows[0].licencia;

        // null: conservar especialidades.
        // []: retirar las especialidades permitidas.
        const especialidades = datos.especialidades === undefined
            ? null
            : datos.especialidades;

        await client.query(`
            CALL actualizarprofesionalespecialidades(
                $1, $2, $3, $4, $5::integer[]
            )
        `, [
            clinicId,
            auditPersonId,
            id,
            licencia,
            especialidades
        ]);

        const resultado = await client.query(`
            SELECT
                clinicprofessionalid AS id,
                professionalid AS "profesionalId",
                licenseid AS licencia,
                isactive AS activo,
                especialidades
            FROM consultarprofesionales($1, $2)
            WHERE clinicprofessionalid = $3
        `, [clinicId, auditPersonId, id]);

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
    obtenerProfesionales,
    obtenerProfesionalPorId,
    registrarProfesional,
    eliminarProfesional,
    asociarServicio,
    obtenerServiciosProfesional,
    actualizarProfesional
};
