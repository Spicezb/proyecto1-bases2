const pool = require('../config/database');

// Obtener todos los profesionales de la clínica usando consultarprofesionales
async function obtenerProfesionales(clinicId, auditPersonId) {
    const query = `
        SELECT
            cp.clinicprofessionalid AS id,
            cp.professionalid AS "profesionalId",
            cp.userid AS "usuarioId",
            cp.name AS nombre,
            cp.lastname AS apellidos,
            cp.licenseid AS licencia,
            cp.isactive AS activo,
            COALESCE(
                ARRAY_AGG(DISTINCT s.name) FILTER (WHERE s.specialtyid IS NOT NULL),
                ARRAY[]::varchar[]
            ) AS especialidades
        FROM consultarprofesionales($1, $2) cp
        LEFT JOIN professionalspecialties ps
            ON cp.professionalid = ps.professionalid AND ps.isactive = TRUE
        LEFT JOIN specialties s
            ON ps.specialtyid = s.specialtyid AND s.isactive = TRUE
        WHERE cp.isactive = TRUE
        GROUP BY
            cp.clinicprofessionalid,
            cp.professionalid,
            cp.userid,
            cp.name,
            cp.lastname,
            cp.licenseid,
            cp.isactive
        ORDER BY cp.lastname, cp.name
    `;

    const resultado = await pool.query(query, [clinicId, auditPersonId]);
    return resultado.rows;
}

// Obtener un profesional específico por su ID (clinicprofessionalid)
async function obtenerProfesionalPorId(id, clinicId, auditPersonId) {
    const query = `
        SELECT
            cp.clinicprofessionalid AS id,
            cp.professionalid AS "profesionalId",
            cp.userid AS "usuarioId",
            cp.name AS nombre,
            cp.lastname AS apellidos,
            cp.licenseid AS licencia,
            cp.isactive AS activo,
            COALESCE(
                ARRAY_AGG(DISTINCT s.name) FILTER (WHERE s.specialtyid IS NOT NULL),
                ARRAY[]::varchar[]
            ) AS especialidades
        FROM consultarprofesionales($1, $2) cp
        LEFT JOIN professionalspecialties ps
            ON cp.professionalid = ps.professionalid AND ps.isactive = TRUE
        LEFT JOIN specialties s
            ON ps.specialtyid = s.specialtyid AND s.isactive = TRUE
        WHERE cp.clinicprofessionalid = $3
        GROUP BY
            cp.clinicprofessionalid,
            cp.professionalid,
            cp.userid,
            cp.name,
            cp.lastname,
            cp.licenseid,
            cp.isactive
    `;

    const resultado = await pool.query(query, [clinicId, auditPersonId, id]);
    return resultado.rows[0];
}

// Registrar un nuevo profesional usando crearprofesional y asignarespecialidad
async function registrarProfesional(datos, clinicId, auditPersonId) {
    const { usuarioId, licencia, especialidades } = datos;
    const client = await pool.connect();

    try {
        // Iniciar una única transacción
        await client.query('BEGIN');

        // Crear profesional y asociarlo con su clínica
        await client.query(
            'CALL crearprofesional($1, $2, $3, $4)',
            [clinicId, auditPersonId, usuarioId, licencia]
        );

        // Recuperar el profesional creado, se usa la misma conexión de la transacción
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

        // Registrar las especialidades
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

        // Consultar el resultado final
        const consulta = await client.query(`
            SELECT
                cp.clinicprofessionalid AS id,
                cp.professionalid AS "profesionalId",
                cp.userid AS "usuarioId",
                cp.name AS nombre,
                cp.lastname AS apellidos,
                cp.licenseid AS licencia,
                cp.isactive AS activo,
                COALESCE(
                    ARRAY_AGG(DISTINCT s.name)
                        FILTER (WHERE s.specialtyid IS NOT NULL),
                    ARRAY[]::varchar[]
                ) AS especialidades
            FROM consultarprofesionales($1, $2) cp
            LEFT JOIN professionalspecialties ps
                ON cp.professionalid = ps.professionalid
                AND ps.isactive = TRUE
            LEFT JOIN specialties s
                ON ps.specialtyid = s.specialtyid
                AND s.isactive = TRUE
            WHERE cp.clinicprofessionalid = $3
            GROUP BY
                cp.clinicprofessionalid,
                cp.professionalid,
                cp.userid,
                cp.name,
                cp.lastname,
                cp.licenseid,
                cp.isactive
        `, [clinicId, auditPersonId, clinicProfessionalId]);

        if (consulta.rows.length === 0) {
            throw new Error(
                'No se pudo consultar el profesional registrado.'
            );
        }

        // Confirmar todos los cambios juntos
        await client.query('COMMIT');

        return consulta.rows[0];

    } catch (error) {
        // Deshacer todas las operaciones si alguna falla
        await client.query('ROLLBACK');
        throw error;

    } finally {
        // Devolver la conexión al Pool
        client.release();
    }
}

// Dar de baja lógica un profesional (isactive = false)
async function eliminarProfesional(id, clinicId, auditPersonId) {
    const actual = await obtenerProfesionalPorId(id, clinicId, auditPersonId);
    if (!actual) {
        return null;
    }

    await pool.query(
        `CALL actualizarprofesional($1, $2, $3, $4, $5)`,
        [clinicId, auditPersonId, actual.profesionalId, actual.licencia, false]
    );

    return { id: Number(id), activo: false };
}

// Asignar un servicio médico al profesional usando asignarservicioprofesional
async function asociarServicio(id, servicioId, clinicId, auditPersonId) {
    await pool.query(
        `CALL asignarservicioprofesional($1, $2, $3, $4)`,
        [clinicId, auditPersonId, id, servicioId]
    );

    return {
        profesionalId: Number(id),
        servicioId: Number(servicioId)
    };
}

// Consultar los servicios médicos habilitados para un profesional
async function obtenerServiciosProfesional(id, clinicId) {
    const query = `
        SELECT
            cps.clinicprofessionalserviceid AS id,
            cs.clinicserviceid AS "servicioId",
            s.name AS nombre,
            sp.name AS especialidad,
            cs.duration AS duracion
        FROM clinicprofessionalservices cps
        JOIN clinicservices cs
            ON cs.clinicserviceid = cps.clinicserviceid
        JOIN services s
            ON s.serviceid = cs.serviceid
        JOIN specialties sp
            ON sp.specialtyid = s.specialtyid
        WHERE cps.clinicprofessionalid = $1
          AND cs.clinicid = $2
          AND cps.isactive = TRUE
          AND cs.isactive = TRUE
        ORDER BY s.name ASC
    `;

    const resultado = await pool.query(query, [id, clinicId]);
    return resultado.rows;
}


async function actualizarProfesional(id, datos, clinicId, auditPersonId) {
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        // Buscar el profesional en esta clínica y bloquear el registro.
        const actual = await client.query(`
            SELECT
                cp.clinicprofessionalid,
                cp.professionalid,
                p.licenseid
            FROM clinicprofessionals cp
            JOIN professionals p
                ON p.professionalid = cp.professionalid
            WHERE cp.clinicprofessionalid = $1
              AND cp.clinicid = $2
              AND cp.isactive = TRUE
              AND p.isactive = TRUE
            FOR UPDATE OF cp, p
        `, [id, clinicId]);

        if (actual.rows.length === 0) {
            await client.query('ROLLBACK');
            return null;
        }

        const professionalId = actual.rows[0].professionalid;
        const licencia = datos.licencia ??
            actual.rows[0].licenseid;

        // Evitar modificar datos globales de un profesional compartido.
        const compartido = await client.query(`
            SELECT 1
            FROM clinicprofessionals
            WHERE professionalid = $1
              AND clinicid <> $2
              AND isactive = TRUE
            LIMIT 1
        `, [professionalId, clinicId]);

        if (compartido.rows.length > 0) {
            const error = new Error(
                'El profesional pertenece a otra clínica y tiene datos compartidos.'
            );
            error.status = 409;
            throw error;
        }

        // Si se enviaron especialidades, validar la lista completa.
        if (datos.especialidades !== undefined) {
            const especialidades = datos.especialidades;

            const validas = await client.query(`
                SELECT specialtyid
                FROM specialties
                WHERE specialtyid = ANY($1::int[])
                  AND isactive = TRUE
            `, [especialidades]);

            if (validas.rows.length !== especialidades.length) {
                const error = new Error(
                    'Una o más especialidades no existen o están inactivas.'
                );
                error.status = 400;
                throw error;
            }

            // No retirar especialidades requeridas por servicios habilitados.
            const incompatibles = await client.query(`
                SELECT 1
                FROM clinicprofessionalservices cps
                JOIN clinicservices cs
                    ON cs.clinicserviceid = cps.clinicserviceid
                JOIN services s
                    ON s.serviceid = cs.serviceid
                WHERE cps.clinicprofessionalid = $1
                  AND cps.isactive = TRUE
                  AND cs.isactive = TRUE
                  AND s.isactive = TRUE
                  AND NOT (s.specialtyid = ANY($2::int[]))
                LIMIT 1
            `, [id, especialidades]);

            if (incompatibles.rows.length > 0) {
                const error = new Error(
                    'No se pueden retirar especialidades de servicios habilitados.'
                );
                error.status = 409;
                throw error;
            }
        }

        // Actualizar la licencia mediante el SP.
        // El PUT mantiene activo al profesional.
        await client.query(`
            CALL actualizarprofesional($1, $2, $3, $4, $5)
        `, [clinicId, auditPersonId, professionalId, licencia, true]);

        if (datos.especialidades !== undefined) {
            // Desactivar las especialidades retiradas.
            await client.query(`
                UPDATE professionalspecialties
                SET isactive = FALSE,
                    updatedat = NOW(),
                    auditpersonid = $3
                WHERE professionalid = $1
                  AND NOT (specialtyid = ANY($2::int[]))
                  AND isactive = TRUE
            `, [
                professionalId,
                datos.especialidades,
                auditPersonId
            ]);

            // Agregar o reactivar las especialidades seleccionadas.
            for (const specialtyId of datos.especialidades) {
                await client.query(`
                    CALL asignarespecialidad($1, $2, $3, $4)
                `, [
                    clinicId,
                    auditPersonId,
                    professionalId,
                    specialtyId
                ]);
            }
        }

        // Obtener el resultado actualizado.
        const resultado = await client.query(`
            SELECT
                cp.clinicprofessionalid AS id,
                p.professionalid AS "profesionalId",
                p.licenseid AS licencia,
                cp.isactive AS activo,
                COALESCE(
                    ARRAY_AGG(DISTINCT s.name)
                        FILTER (WHERE s.specialtyid IS NOT NULL),
                    ARRAY[]::varchar[]
                ) AS especialidades
            FROM clinicprofessionals cp
            JOIN professionals p
                ON p.professionalid = cp.professionalid
            LEFT JOIN professionalspecialties ps
                ON ps.professionalid = p.professionalid
                AND ps.isactive = TRUE
            LEFT JOIN specialties s
                ON s.specialtyid = ps.specialtyid
                AND s.isactive = TRUE
            WHERE cp.clinicprofessionalid = $1
              AND cp.clinicid = $2
            GROUP BY
                cp.clinicprofessionalid,
                p.professionalid
        `, [id, clinicId]);

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
