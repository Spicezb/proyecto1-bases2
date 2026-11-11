
const pool = require('../config/database');

// RF2: Crear usuario de clínica
async function crearUsuario(datos, clinicId, auditPersonId) {
    const {
        providerId,
        roleId,
        identificacion,
        nombre,
        apellido,
        email,
        telefono
    } = datos;

    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        await client.query( "select set_config('app.clinic_id', $1, true)", [String(clinicId)]);

        await client.query(
            'CALL crearusuario($1, $2, $3, $4, $5, $6, $7, $8, $9)',
            [
                clinicId,
                auditPersonId,
                providerId,
                roleId,
                identificacion,
                nombre,
                apellido,
                email,
                telefono || null
            ]
        );

        const resultado = await client.query(`
            SELECT
                userid,
                providerid,
                roleid,
                identification,
                name,
                lastname,
                email,
                phone,
                isactive
            FROM consultarusuarios($1, $2)
            WHERE providerid = $3
            ORDER BY userid DESC
            LIMIT 1
        `, [clinicId, auditPersonId, providerId]);

        if (resultado.rows.length === 0) {
            throw new Error(
                'No se pudo recuperar el usuario registrado.'
            );
        }

        await client.query('COMMIT');

        return resultado.rows[0];

    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
}

// RF2: Cambiar rol de usuario
async function cambiarRolUsuario(userId, newRoleId, clinicId, auditPersonId) {
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        await client.query( "select set_config('app.clinic_id', $1, true)", [String(clinicId)]);

        await client.query(
            'CALL cambiarrolusuario($1, $2, $3, $4)',
            [clinicId, auditPersonId, userId, newRoleId]
        );

        const resultado = await client.query(`
            SELECT
                userid,
                providerid,
                roleid,
                identification,
                name,
                lastname,
                email,
                phone,
                isactive
            FROM consultarusuarios($1, $2)
            WHERE userid = $3
            LIMIT 1
        `, [clinicId, auditPersonId, userId]);

        if (resultado.rows.length === 0) {
            throw new Error(
                'No se pudo recuperar el usuario actualizado.'
            );
        }

        await client.query('COMMIT');

        return resultado.rows[0];

    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
}

// RF2: Desactivar usuario
async function desactivarUsuario(userId, clinicId, auditPersonId) {
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        await client.query( "select set_config('app.clinic_id', $1, true)", [String(clinicId)]);

        await client.query(
        `
        CALL desactivarusuario($1, $2, $3)`,
        [clinicId, auditPersonId, userId]
        );

        await client.query('COMMIT');

        return {
            userId: Number(userId),
            activo: false
        };

    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
}

// RF2: Consultar usuarios de la clínica
async function obtenerUsuarios(clinicId, auditPersonId) {
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        await client.query( "select set_config('app.clinic_id', $1, true)", [String(clinicId)]);

        const resultado = await client.query(`
        SELECT
            userid AS id,
            providerid,
            roleid AS "rolId",
            identification AS identificacion,
            name AS nombre,
            lastname AS apellido,
            email,
            phone AS telefono,
            isactive AS activo
        FROM consultarusuarios($1, $2)
        ORDER BY apellido, nombre
        `,[
        clinicId,
        auditPersonId
        ]);

        await client.query('COMMIT');

        return resultado.rows;

    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
}

module.exports = {
    crearUsuario,
    cambiarRolUsuario,
    desactivarUsuario,
    obtenerUsuarios
};
