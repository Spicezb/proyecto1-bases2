const pool = require('../config/database');

// RF2: Crear usuario de clínica
async function crearUsuario(datos, clinicId, auditPersonId) {
    const { providerId, roleId, identificacion, nombre, apellido, email, telefono } = datos;

    await pool.query(
        `CALL crearusuario($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
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

    const query = `
        SELECT userid, providerid, roleid, identification, name, lastname, email, phone, isactive
        FROM users
        WHERE clinicid = $1 AND providerid = $2
        ORDER BY userid DESC
        LIMIT 1
    `;
    const resultado = await pool.query(query, [clinicId, providerId]);
    return resultado.rows[0];
}

// RF2: Cambiar rol de usuario
async function cambiarRolUsuario(userId, newRoleId, clinicId, auditPersonId) {
    await pool.query(
        `CALL cambiarrolusuario($1, $2, $3, $4)`,
        [clinicId, auditPersonId, userId, newRoleId]
    );

    const query = `
        SELECT userid, providerid, roleid, identification, name, lastname, email, phone, isactive
        FROM users
        WHERE clinicid = $1 AND userid = $2
    `;
    const resultado = await pool.query(query, [clinicId, userId]);
    return resultado.rows[0];
}

// RF2: Desactivar usuario (baja lógica)
async function desactivarUsuario(userId, clinicId, auditPersonId) {
    await pool.query(
        `CALL desactivarusuario($1, $2, $3)`,
        [clinicId, auditPersonId, userId]
    );

    return { userId: Number(userId), activo: false };
}

// RF2: Consultar usuarios de la clínica
async function obtenerUsuarios(clinicId, auditPersonId) {
    const query = `
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
    `;

    const resultado = await pool.query(query, [clinicId, auditPersonId]);
    return resultado.rows;
}

module.exports = {
    crearUsuario,
    cambiarRolUsuario,
    desactivarUsuario,
    obtenerUsuarios
};
