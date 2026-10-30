const pool = require('../config/database');

//Obtener servicios médicos de una clínica
async function obtenerServicios(clinicId) {
    const query = `
        SELECT
            cs.clinicserviceid AS id,
            s.name AS nombre,
            sp.name AS especialidad,
            cs.duration AS duracion
        FROM clinicservices cs
        INNER JOIN services s
            ON cs.serviceid = s.serviceid
        INNER JOIN specialties sp
            ON s.specialtyid = sp.specialtyid
        WHERE cs.clinicid = $1
            AND cs.isactive = TRUE
            AND s.isactive = TRUE
            AND sp.isactive = TRUE
        ORDER BY s.name ASC
    `;

    const resultado = await pool.query(query, [clinicId]);

    return resultado.rows;
}

//Obtener un servicio médico por ID
async function obtenerServicioPorId(id, clinicId) {
    const query = `
        SELECT
            cs.clinicserviceid AS id,
            s.name AS nombre,
            sp.name AS especialidad,
            cs.duration AS duracion
        FROM clinicservices cs
        INNER JOIN services s
            ON cs.serviceid = s.serviceid
        INNER JOIN specialties sp
            ON s.specialtyid = sp.specialtyid
        WHERE cs.clinicserviceid = $1
            AND cs.clinicid = $2
            AND cs.isactive = TRUE
            AND s.isactive = TRUE
            AND sp.isactive = TRUE
    `;

    const resultado = await pool.query(query, [id, clinicId]);

    return resultado.rows[0];
}

//Registrar servicio médico en una clínica
async function registrarServicio(datos, clinicId) {
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        const { nombre, especialidadId, duracion } = datos;

        //Verificar que la especialidad exista
        const especialidad = await client.query(`
            SELECT specialtyid
            FROM specialties
            WHERE specialtyid = $1 AND isactive = TRUE
        `, [especialidadId]);

        if (especialidad.rows.length === 0) {
            const error = new Error('La especialidad no existe.');
            error.status = 404;
            throw error;
        }

        //Buscar si el servicio ya existe globalmente
        const existente = await client.query(`
            SELECT serviceid, specialtyid
            FROM services
            WHERE name = $1
        `, [nombre]);

        let serviceId;

        if (existente.rows.length > 0) {
            //No reutilizar servicios inactivos o de otra especialidad
            const servicioActual = await client.query(`
                SELECT serviceid
                FROM services
                WHERE serviceid = $1
                    AND specialtyid = $2
                    AND isactive = TRUE
            `, [existente.rows[0].serviceid, especialidadId]);

            if (servicioActual.rows.length === 0) {
                const error = new Error(
                    'El servicio ya existe con otra especialidad o está inactivo.'
                );
                error.status = 409;
                throw error;
            }

            serviceId = existente.rows[0].serviceid;

        } else {
            //Crear servicio en el catálogo global
            const nuevo = await client.query(`
                INSERT INTO services (name, specialtyid)
                VALUES ($1, $2)
                RETURNING serviceid
            `, [nombre, especialidadId]);

            serviceId = nuevo.rows[0].serviceid;
        }

        //Obtener usuario provisional de la clínica
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

        //Asociar el servicio con la clínica
        const resultado = await client.query(`
            INSERT INTO clinicservices
                (clinicid, serviceid, duration, auditpersonid)
            VALUES ($1, $2, $3, $4)
            ON CONFLICT (clinicid, serviceid) DO NOTHING
            RETURNING clinicserviceid
        `, [clinicId, serviceId, duracion, auditPersonId]);

        if (resultado.rows.length === 0) {
            const error = new Error(
                'El servicio ya está registrado en esta clínica.'
            );
            error.status = 409;
            throw error;
        }

        await client.query('COMMIT');

        return {
            id: resultado.rows[0].clinicserviceid,
            nombre,
            especialidadId,
            duracion
        };

    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
}

//Actualizar la duración de un servicio de una clínica
async function actualizarServicio(id, datos, clinicId) {
    const { duracion } = datos;

    const query = `
        UPDATE clinicservices
        SET duration = $1,
            updatedat = NOW()
        WHERE clinicserviceid = $2
            AND clinicid = $3
            AND isactive = TRUE
        RETURNING clinicserviceid AS id, duration AS duracion
    `;

    const resultado = await pool.query(query, [
        duracion,
        id,
        clinicId
    ]);

    return resultado.rows[0];
}

//Dar de baja lógica un servicio de una clínica
async function eliminarServicio(id, clinicId) {
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        //Bloquear el servicio mientras se revisan sus dependencias
        const servicio = await client.query(`
            SELECT clinicserviceid
            FROM clinicservices
            WHERE clinicserviceid = $1
                AND clinicid = $2
                AND isactive = TRUE
            FOR UPDATE
        `, [id, clinicId]);

        if (servicio.rows.length === 0) {
            await client.query('ROLLBACK');
            return { estado: 'no_encontrado' };
        }

        //Comprobar si existen citas futuras reservadas
        const citas = await client.query(`
            SELECT 1
            FROM appointments a
            INNER JOIN appointmentstatuses s
                ON a.appointmentstatusid = s.appointmentstatusid
            WHERE a.clinicserviceid = $1
                AND a.clinicid = $2
                AND a.date > NOW()
                AND s.name = 'reservada'
            LIMIT 1
        `, [id, clinicId]);

        if (citas.rows.length > 0) {
            await client.query('ROLLBACK');
            return { estado: 'con_citas' };
        }

        await client.query(`
            UPDATE clinicservices
            SET isactive = FALSE,
                updatedat = NOW()
            WHERE clinicserviceid = $1
                AND clinicid = $2
        `, [id, clinicId]);

        await client.query('COMMIT');

        return { estado: 'eliminado' };

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
