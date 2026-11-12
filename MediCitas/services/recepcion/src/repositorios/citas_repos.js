const pool = require('../config/database');

// Helper: establecer el contexto de clínica dentro de una transacción
async function establecerContextoClinica(client, clinicId) {
    await client.query(
        "SELECT set_config('app.clinic_id', $1, true)",
        [String(clinicId)]
    );
}

// Helper: ejecutar una operación con transacción y contexto RLS
async function ejecutarConClinica(clinicId, operacion) {
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        await establecerContextoClinica(client, clinicId);

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

// Helper: obtener profesional y fecha de una cita
// para invalidar la caché de Redis
// Recibe el client para utilizar la misma conexión
// y conservar el contexto RLS de la transacción
async function obtenerDetalleCita(client, id, clinicId, auditPersonId) {
    const resultado = await client.query(`
        SELECT
            profesionalid AS "profesionalId",
            fecha
        FROM public.obtenerdetallecita($1, $2, $3)
    `, [id, clinicId, auditPersonId]);

    return resultado.rows[0] || null;
}


// RF9: Reservar una cita
async function reservarCita(datos, clinicId, auditPersonId) {
    const {
        pacienteId,
        profesionalId,
        servicioId,
        fechaHora
    } = datos;

    return ejecutarConClinica(clinicId, async (client) => {
        await client.query(
            'CALL reservarcita($1, $2, $3, $4, $5, $6)',
            [
                clinicId,
                auditPersonId,
                pacienteId,
                profesionalId,
                servicioId,
                fechaHora
            ]
        );

        return {
            pacienteId,
            profesionalId,
            servicioId,
            fechaHora,
            estado: 'reservada'
        };
    });
}

// RF10: Reprogramar una cita vigente
async function reprogramarCita(id, datos, clinicId, auditPersonId) {
    const {
        nuevoProfesionalId,
        nuevoServicioId,
        nuevaFechaHora
    } = datos;

    return ejecutarConClinica(clinicId, async (client) => {
        // Obtener los datos originales antes de reprogramar
        const detalleOriginal = await obtenerDetalleCita(
            client,
            id,
            clinicId,
            auditPersonId
        );

        // Reprogramar mediante el procedimiento almacenado
        await client.query(
            'CALL reprogramarcita($1, $2, $3, $4, $5, $6)',
            [
                clinicId,
                auditPersonId,
                id,
                nuevoProfesionalId,
                nuevoServicioId,
                nuevaFechaHora
            ]
        );

        return {
            citaOriginalId: Number(id),
            nuevoProfesionalId,
            nuevoServicioId,
            nuevaFechaHora,
            profesionalOriginalId: detalleOriginal
                ? detalleOriginal.profesionalId
                : null,
            fechaOriginal: detalleOriginal
                ? detalleOriginal.fecha
                : null,
            estado: 'reprogramada'
        };
    });
}

// RF11: Cancelar una cita
async function cancelarCita(id, motivo, clinicId, auditPersonId) {
    return ejecutarConClinica(clinicId, async (client) => {
        // Guardar los datos originales para invalidar Redis
        const detalleOriginal = await obtenerDetalleCita(
            client,
            id,
            clinicId,
            auditPersonId
        );

        await client.query(
            'CALL cambiarestadocita($1, $2, $3, 4, $4)',
            [
                clinicId,
                auditPersonId,
                id,
                motivo
            ]
        );

        return {
            citaId: Number(id),
            estado: 'cancelada',
            motivo,
            profesionalId: detalleOriginal
                ? detalleOriginal.profesionalId
                : null,
            fecha: detalleOriginal
                ? detalleOriginal.fecha
                : null
        };
    });
}

// RF12 y RF13: Registrar desenlace de cita
// Estado 2 = atendida
// Estado 3 = ausente
async function registrarDesenlace(
    id,
    nuevoEstadoId,
    clinicId,
    auditPersonId
) {
    return ejecutarConClinica(clinicId, async (client) => {
        await client.query(
            'CALL cambiarestadocita($1, $2, $3, $4, NULL)',
            [
                clinicId,
                auditPersonId,
                id,
                nuevoEstadoId
            ]
        );

        return {
            citaId: Number(id),
            estadoId: nuevoEstadoId,
            estado: Number(nuevoEstadoId) === 2
                ? 'atendida'
                : 'ausente'
        };
    });
}

// RF20: Consultar agenda del día
// Puede ser de un profesional o de toda la clínica
async function consultarAgenda(
    clinicId,
    auditPersonId,
    fecha,
    profesionalId = null
) {
    return ejecutarConClinica(clinicId, async (client) => {
        const resultado = await client.query(`
            SELECT
                appointmentid AS "citaId",
                appointmentdate AS "fechaHoraInicio",
                enddatetime AS "fechaHoraFin",
                clinicpatientid AS "pacienteId",
                patientname AS "pacienteNombre",
                professionalname AS "profesionalNombre",
                servicename AS "servicioNombre",
                statusid AS "estadoId"
            FROM consultaragenda($1, $2, $3, $4)
            ORDER BY appointmentdate ASC
        `, [
            clinicId,
            auditPersonId,
            fecha,
            profesionalId || null
        ]);

        return resultado.rows;
    });
}

// RF16: Consultar historial de citas de un paciente
async function consultarCitasPaciente(
    clinicId,
    auditPersonId,
    pacienteId
) {
    return ejecutarConClinica(clinicId, async (client) => {
        const resultado = await client.query(`
            SELECT
                appointmentid AS "citaId",
                appointmentdate AS "fechaHoraInicio",
                enddatetime AS "fechaHoraFin",
                statusid AS "estadoId",
                servicename AS "servicioNombre",
                professionalname AS "profesionalNombre",
                cancellationreason AS "motivoCancelacion"
            FROM consultarcitaspaciente($1, $2, $3)
            ORDER BY appointmentdate DESC
        `, [
            clinicId,
            auditPersonId,
            pacienteId
        ]);

        return resultado.rows;
    });
}

// RF21: Contar citas por estado en un rango de fechas
async function contarCitasPorEstado(
    clinicId,
    auditPersonId,
    fechaInicio,
    fechaFin
) {
    return ejecutarConClinica(clinicId, async (client) => {
        const resultado = await client.query(`
            SELECT
                appointmentstatusid AS "estadoId",
                total::int AS total
            FROM contarcitasporestado($1, $2, $3, $4)
            ORDER BY appointmentstatusid ASC
        `, [
            clinicId,
            auditPersonId,
            fechaInicio,
            fechaFin
        ]);

        return resultado.rows;
    });
}

module.exports = {
    reservarCita,
    reprogramarCita,
    cancelarCita,
    registrarDesenlace,
    consultarAgenda,
    consultarCitasPaciente,
    contarCitasPorEstado
};
