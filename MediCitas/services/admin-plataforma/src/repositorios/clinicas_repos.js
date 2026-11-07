const pool = require('../config/database');

// RF1: Crear una clínica junto con su usuario administrador
async function crearClinica(datos, platformUserId) {
    const {
        nombre,
        zonaHoraria,
        adminProviderId,
        adminIdentificacion,
        adminNombre,
        adminApellido,
        adminEmail,
        adminTelefono
    } = datos;

    await pool.query(
        `CALL crearclinica($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
            platformUserId,
            nombre,
            zonaHoraria || 'America/Costa_Rica',
            adminProviderId,
            adminIdentificacion,
            adminNombre,
            adminApellido,
            adminEmail,
            adminTelefono || null
        ]
    );

    const query = `
        SELECT clinicid, name, clinictimezone, isactive, createdat
        FROM clinics
        WHERE name = $1
        ORDER BY clinicid DESC
        LIMIT 1
    `;
    const resultado = await pool.query(query, [nombre]);
    return resultado.rows[0];
}

// Consultar clínicas de la plataforma
async function obtenerClinicas() {
    const query = `
        SELECT
            c.clinicid AS id,
            c.name AS nombre,
            c.clinictimezone AS "zonaHoraria",
            c.isactive AS activo,
            c.createdat AS "fechaCreacion"
        FROM clinics c
        ORDER BY c.clinicid ASC
    `;

    const resultado = await pool.query(query);
    return resultado.rows;
}

module.exports = {
    crearClinica,
    obtenerClinicas
};
