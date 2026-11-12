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

    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        // Crear la clínica y su administrador mediante el SP.
        // El parámetro OUT devuelve el clinicid generado.
        const resultado = await client.query(
            `CALL public.crearclinica(
                $1, $2, $3, $4, $5,
                $6, $7, $8, $9, NULL
            )`,
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

        const clinicId = resultado.rows[0]?.p_clinicid;

        if (clinicId == null) {
            throw new Error(
                'El procedimiento no devolvió el ID de la clínica creada.'
            );
        }

        await client.query('COMMIT');

        return {
            id: clinicId,
            nombre,
            zonaHoraria: zonaHoraria || 'America/Costa_Rica',
            activo: true
        };

    } catch (error) {
        await client.query('ROLLBACK');
        throw error;

    } finally {
        client.release();
    }
}

// Consultar clínicas de la plataforma
async function obtenerClinicas(platformUserId) {
    const client = await pool.connect();

    try {
        const resultado = await client.query(`
            SELECT
                clinicid AS id,
                name AS nombre,
                clinictimezone AS "zonaHoraria",
                isactive AS activo,
                createdat AS "fechaCreacion"
            FROM public.consultarclinicas($1)
        `, [platformUserId]);

        return resultado.rows;

    } finally {
        client.release();
    }
}

module.exports = {
    crearClinica,
    obtenerClinicas
};
