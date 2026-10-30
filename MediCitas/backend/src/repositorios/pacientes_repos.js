const pool = require('../config/database');

//Obtener los pacientes de una clinica
async function obtenerPacientes(clinicId) {
    const query = `
        SELECT
            cp.clinicpatientid AS id,
            p.identification AS identificacion,
            p.name AS nombre,
            p.lastname AS apellido,
            p.birthdate AS fecha_nacimiento,
            cp.email AS correo,
            cp.phone AS telefono
        FROM clinicpatients cp
        INNER JOIN patients p
            ON cp.patientid = p.patientid
        WHERE cp.clinicid = $1
            AND cp.isactive = TRUE
            AND p.isactive = TRUE
        ORDER BY p.name ASC
    `;

    const resultado = await pool.query(query, [clinicId]);

    return resultado.rows;
}

//Obtener un paciente especifico de una clinica
async function obtenerPacientePorId(id, clinicId) {
    const query = `
        SELECT
            cp.clinicpatientid AS id,
            p.identification AS identificacion,
            p.name AS nombre,
            p.lastname AS apellido,
            p.birthdate AS fecha_nacimiento,
            cp.email AS correo,
            cp.phone AS telefono
        FROM clinicpatients cp
        INNER JOIN patients p
            ON cp.patientid = p.patientid
        WHERE cp.clinicpatientid = $1
            AND cp.clinicid = $2
            AND cp.isactive = TRUE
            AND p.isactive = TRUE
    `;

    const resultado = await pool.query(query, [id, clinicId]);

    return resultado.rows[0];
}

//Registrar paciente en PostgreSQL
async function registrarPaciente(datos, clinicId) {
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        const {
            identificacion,
            nombre,
            apellido,
            fechaNacimiento,
            correo,
            telefono
        } = datos;

        //Usuario provisional para pruebas locales.
        //Debe reemplazarse por el usuario autenticado.
        const usuario = await client.query(`
            SELECT userid
            FROM users
            WHERE clinicid = $1 AND isactive = TRUE
            ORDER BY userid
            LIMIT 1
        `, [clinicId]);

        if (usuario.rows.length === 0) {
            throw new Error('No existe un usuario de prueba para la clínica.');
        }

        const auditPersonId = usuario.rows[0].userid;

        //Crear paciente si no existe su identificación.
        const insercion = await client.query(`
            INSERT INTO patients
                (identification, name, lastname, birthdate, auditpersonid)
            VALUES ($1, $2, $3, $4, $5)
            ON CONFLICT (identification) DO NOTHING
            RETURNING patientid
        `, [
            identificacion,
            nombre,
            apellido,
            fechaNacimiento,
            auditPersonId
        ]);

        let patientId;

        if (insercion.rows.length > 0) {
            patientId = insercion.rows[0].patientid;
        } else {
            const existente = await client.query(`
                SELECT patientid
                FROM patients
                WHERE identification = $1 AND isactive = TRUE
            `, [identificacion]);

            if (existente.rows.length === 0) {
                const error = new Error('La identificación ya existe en un paciente inactivo.');
                error.status = 409;
                throw error;
            }

            patientId = existente.rows[0].patientid;
        }

        //Asociar al paciente con la clínica
        const resultado = await client.query(`
            INSERT INTO clinicpatients
                (clinicid, patientid, email, phone, auditpersonid)
            VALUES ($1, $2, $3, $4, $5)
            ON CONFLICT (clinicid, patientid) DO NOTHING
            RETURNING clinicpatientid
        `, [
            clinicId,
            patientId,
            correo || null,
            telefono || null,
            auditPersonId
        ]);

        if (resultado.rows.length === 0) {
            const error = new Error('El paciente ya está registrado en esta clínica.');
            error.status = 409;
            throw error;
        }

        await client.query('COMMIT');

        return {
            id: resultado.rows[0].clinicpatientid,
            identificacion,
            nombre,
            apellido,
            fechaNacimiento,
            correo: correo || null,
            telefono: telefono || null
        };

    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
}

//Actualizar un paciente en PostgreSQL
async function actualizarPaciente(id, datos, clinicId) {
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        //Buscar paciente y bloquearlo durante la actualización
        const existente = await client.query(`
            SELECT
                cp.clinicpatientid,
                p.patientid
            FROM clinicpatients cp
            INNER JOIN patients p
                ON cp.patientid = p.patientid
            WHERE cp.clinicpatientid = $1
                AND cp.clinicid = $2
                AND cp.isactive = TRUE
                AND p.isactive = TRUE
            FOR UPDATE OF cp, p
        `, [id, clinicId]);

        if (existente.rows.length === 0) {
            const error = new Error('Paciente no encontrado.');
            error.status = 404;
            throw error;
        }

        const patientId = existente.rows[0].patientid;

        //Comprobar si el registro global pertenece a otras clínicas
        const asociaciones = await client.query(`
            SELECT COUNT(*)::int AS total
            FROM clinicpatients
            WHERE patientid = $1
                AND isactive = TRUE
        `, [patientId]);

        if (asociaciones.rows[0].total > 1) {
            const error = new Error(
                'El paciente está asociado con otras clínicas. No se pueden modificar sus datos globales.'
            );
            error.status = 409;
            throw error;
        }

        const {
            identificacion,
            nombre,
            apellido,
            fechaNacimiento,
            correo,
            telefono
        } = datos;

        //Usuario provisional de la clínica para pruebas
        const usuario = await client.query(`
            SELECT userid
            FROM users
            WHERE clinicid = $1
                AND isactive = TRUE
            ORDER BY userid
            LIMIT 1
        `, [clinicId]);

        if (usuario.rows.length === 0) {
            throw new Error('No existe un usuario de prueba para esta clínica.');
        }

        const auditPersonId = usuario.rows[0].userid;
        //Actualizar los datos generales
        await client.query(`
            UPDATE patients
            SET identification = $1,
                name = $2,
                lastname = $3,
                birthdate = $4,
                auditpersonid = $5,
                updatedat = NOW()
            WHERE patientid = $6
        `, [
            identificacion,
            nombre,
            apellido,
            fechaNacimiento,
            auditPersonId,
            patientId
        ]);

        //Actualizar los datos de contacto de la clínica
        const resultado = await client.query(`
            UPDATE clinicpatients
            SET email = $1,
                phone = $2,
                auditpersonid = $3,
                updatedat = NOW()
            WHERE clinicpatientid = $4
                AND clinicid = $5
            RETURNING clinicpatientid
        `, [
            correo ?? null,
            telefono ?? null,
            auditPersonId,
            id,
            clinicId
        ]);

        await client.query('COMMIT');
        return {
            id: resultado.rows[0].clinicpatientid,
            identificacion,
            nombre,
            apellido,
            fechaNacimiento,
            correo: correo ?? null,
            telefono: telefono ?? null
        };
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
}

module.exports = {
    obtenerPacientes,
    obtenerPacientePorId,
    registrarPaciente,
    actualizarPaciente
};