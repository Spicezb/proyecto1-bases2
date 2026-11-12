const pool = require('../config/database');

// Helper: ejecutar operaciones con contexto de clínica
async function ejecutarConClinica(clinicId, operacion) {
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        // Establecer contexto de clínica para RLS
        await client.query(
            "SELECT set_config('app.clinic_id', $1, true)",
            [String(clinicId)]
        );

        const resultado = await operacion(client);

        await client.query('COMMIT');

        return resultado;

    } catch (error) {
        try {
            await client.query('ROLLBACK');
        } catch (rollbackError) {
            console.error(
                'Error al revertir la transacción:',
                rollbackError
            );
        }

        throw error;

    } finally {
        client.release();
    }
}

// Helper: consultar un paciente dentro de la misma conexión
async function consultarPacienteEnTransaccion(
    client,
    id,
    clinicId,
    auditPersonId
) {
    const resultado = await client.query(
        'SELECT * FROM consultarpacientes($1, $2, $3)',
        [clinicId, auditPersonId, id]
    );

    return resultado.rows[0] || null;
}

// Obtener los pacientes de una clínica
async function obtenerPacientes(clinicId, auditPersonId) {
    return ejecutarConClinica(clinicId, async (client) => {
        const resultado = await client.query(
            'SELECT * FROM consultarpacientes($1, $2)',
            [clinicId, auditPersonId]
        );

        return resultado.rows;
    });
}

// Obtener un paciente específico de una clínica
async function obtenerPacientePorId(id, clinicId, auditPersonId) {
    return ejecutarConClinica(clinicId, async (client) => {
        return consultarPacienteEnTransaccion(
            client,
            id,
            clinicId,
            auditPersonId
        );
    });
}

// Registrar paciente en PostgreSQL
async function registrarPaciente(datos, clinicId, auditPersonId) {
    const {
        identificacion,
        nombre,
        apellido,
        fechaNacimiento,
        correo,
        telefono
    } = datos;

    return ejecutarConClinica(clinicId, async (client) => {
        // El último parámetro es el ID de salida del SP
        const resultado = await client.query(
            `CALL crearpaciente(
                $1, $2, $3, $4, $5, $6, $7, $8, NULL
            )`,
            [
                clinicId,
                auditPersonId,
                identificacion,
                nombre,
                apellido,
                fechaNacimiento,
                correo || null,
                telefono || null
            ]
        );

        const pacienteId = resultado.rows[0]?.p_clinicpatientid;

        if (pacienteId == null) {
            throw new Error(
                'El procedimiento no devolvió el ID del paciente registrado.'
            );
        }

        return {
            id: pacienteId,
            identificacion,
            nombre,
            apellido,
            fechaNacimiento,
            correo: correo || null,
            telefono: telefono || null
        };
    });
}

// Actualizar un paciente en PostgreSQL
async function actualizarPaciente(id, datos, clinicId, auditPersonId) {
    const {
        identificacion,
        nombre,
        apellido,
        fechaNacimiento,
        correo,
        telefono
    } = datos;

    return ejecutarConClinica(clinicId, async (client) => {
        // Actualizar mediante el procedimiento almacenado
        await client.query(
            `CALL actualizarpaciente(
                $1, $2, $3, $4, $5, $6, $7, $8, $9
            )`,
            [
                clinicId,
                auditPersonId,
                id,
                identificacion,
                nombre,
                apellido,
                fechaNacimiento,
                correo || null,
                telefono || null
            ]
        );

        // Recuperar el paciente actualizado usando
        // la misma conexión y el mismo contexto RLS
        const pacienteActualizado =
            await consultarPacienteEnTransaccion(
                client,
                id,
                clinicId,
                auditPersonId
            );

        if (!pacienteActualizado) {
            throw new Error(
                'No se pudo recuperar el paciente actualizado.'
            );
        }

        return pacienteActualizado;
    });
}

module.exports = {
    obtenerPacientes,
    obtenerPacientePorId,
    registrarPaciente,
    actualizarPaciente
};
