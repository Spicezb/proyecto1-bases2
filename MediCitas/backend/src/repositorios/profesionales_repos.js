const pool = require('../config/database');

//Obtener todos los profesionales activos de una clínica
async function obtenerProfesionales(clinicId) {
    const query = `
        SELECT
            cp.clinicprofessionalid AS id,
            p.professionalid AS "profesionalId",
            u.name AS nombre,
            u.lastname AS apellidos,
            u.email AS correo,
            p.licenseid AS licencia,
            COALESCE(
                ARRAY_AGG(DISTINCT s.name)
                    FILTER (WHERE s.specialtyid IS NOT NULL),
                ARRAY[]::varchar[]
            ) AS especialidades
        FROM clinicprofessionals cp
        INNER JOIN professionals p
            ON cp.professionalid = p.professionalid
        INNER JOIN users u
            ON cp.userid = u.userid
        LEFT JOIN professionalspecialties ps
            ON p.professionalid = ps.professionalid
            AND ps.isactive = TRUE
        LEFT JOIN specialties s
            ON ps.specialtyid = s.specialtyid
            AND s.isactive = TRUE
        WHERE cp.clinicid = $1
            AND cp.isactive = TRUE
            AND p.isactive = TRUE
            AND u.isactive = TRUE
            AND u.clinicid = cp.clinicid
        GROUP BY
            cp.clinicprofessionalid,
            p.professionalid,
            u.userid
        ORDER BY u.name, u.lastname
    `;

    const resultado = await pool.query(query, [clinicId]);
    return resultado.rows;
}

//Obtener un profesional específico de una clínica
async function obtenerProfesionalPorId(id, clinicId) {
    const query = `
        SELECT
            cp.clinicprofessionalid AS id,
            p.professionalid AS "profesionalId",
            u.name AS nombre,
            u.lastname AS apellidos,
            u.email AS correo,
            u.phone AS telefono,
            p.licenseid AS licencia,
            COALESCE(
                ARRAY_AGG(DISTINCT s.name)
                    FILTER (WHERE s.specialtyid IS NOT NULL),
                ARRAY[]::varchar[]
            ) AS especialidades
        FROM clinicprofessionals cp
        INNER JOIN professionals p
            ON cp.professionalid = p.professionalid
        INNER JOIN users u
            ON cp.userid = u.userid
        LEFT JOIN professionalspecialties ps
            ON p.professionalid = ps.professionalid
            AND ps.isactive = TRUE
        LEFT JOIN specialties s
            ON ps.specialtyid = s.specialtyid
            AND s.isactive = TRUE
        WHERE cp.clinicprofessionalid = $1
            AND cp.clinicid = $2
            AND cp.isactive = TRUE
            AND p.isactive = TRUE
            AND u.isactive = TRUE
            AND u.clinicid = cp.clinicid
        GROUP BY
            cp.clinicprofessionalid,
            p.professionalid,
            u.userid
    `;

    const resultado = await pool.query(query, [id, clinicId]);
    return resultado.rows[0];
}


async function registrarProfesional(datos, clinicId) {
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        const { usuarioId, licencia, especialidades } = datos;

        // Buscar un administrador activo para auditoría local
        const auditor = await client.query(`
            SELECT u.userid
            FROM users u
            INNER JOIN roles r ON u.roleid = r.roleid
            WHERE u.clinicid = $1
              AND u.isactive = TRUE
              AND r.name = 'administrador de clínica'
            LIMIT 1
        `, [clinicId]);

        if (auditor.rows.length === 0) {
            const error = new Error(
                'No existe un administrador activo para la clínica.'
            );
            error.status = 409;
            throw error;
        }

        const auditPersonId = auditor.rows[0].userid;

        // Verificar que el usuario pertenezca a esta clínica
        const usuario = await client.query(`
            SELECT u.userid
            FROM users u
            INNER JOIN roles r ON u.roleid = r.roleid
            WHERE u.userid = $1
              AND u.clinicid = $2
              AND u.isactive = TRUE
              AND r.name = 'profesional de salud'
        `, [usuarioId, clinicId]);

        if (usuario.rows.length === 0) {
            const error = new Error(
                'El usuario no existe o no es un profesional activo de esta clínica.'
            );
            error.status = 404;
            throw error;
        }

        // No permitir registrar nuevamente al mismo usuario
        const asociado = await client.query(`
            SELECT clinicprofessionalid
            FROM clinicprofessionals
            WHERE userid = $1
        `, [usuarioId]);

        if (asociado.rows.length > 0) {
            const error = new Error(
                'Este usuario ya tiene un registro profesional.'
            );
            error.status = 409;
            throw error;
        }

        // Verificar que las especialidades estén activas
        const especialidadesValidas = await client.query(`
            SELECT specialtyid
            FROM specialties
            WHERE specialtyid = ANY($1::int[])
              AND isactive = TRUE
        `, [especialidades]);

        if (especialidadesValidas.rows.length !== especialidades.length) {
            const error = new Error(
                'Una o más especialidades no existen o están inactivas.'
            );
            error.status = 400;
            throw error;
        }

        // Crear el registro profesional
        const profesional = await client.query(`
            INSERT INTO professionals (licenseid, auditpersonid)
            VALUES ($1, $2)
            RETURNING professionalid
        `, [licencia, auditPersonId]);

        const profesionalId = profesional.rows[0].professionalid;

        // Asociar profesional con la clínica y su usuario
        const asociacion = await client.query(`
            INSERT INTO clinicprofessionals
                (userid, clinicid, professionalid, auditpersonid)
            VALUES ($1, $2, $3, $4)
            RETURNING clinicprofessionalid
        `, [usuarioId, clinicId, profesionalId, auditPersonId]);

        // Registrar sus especialidades
        for (const especialidadId of especialidades) {
            await client.query(`
                INSERT INTO professionalspecialties
                    (professionalid, specialtyid, auditpersonid)
                VALUES ($1, $2, $3)
            `, [profesionalId, especialidadId, auditPersonId]);
        }

        await client.query('COMMIT');

        return {
            id: asociacion.rows[0].clinicprofessionalid,
            profesionalId,
            usuarioId,
            licencia,
            especialidades
        };

    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
}


async function obtenerServiciosProfesional(id, clinicId) {
    const resultado = await pool.query(`
        SELECT
            cps.clinicprofessionalserviceid AS id,
            cs.clinicserviceid AS "servicioId",
            s.name AS nombre,
            sp.name AS especialidad,
            cs.duration AS duracion
        FROM clinicprofessionalservices cps
        INNER JOIN clinicprofessionals cp
            ON cps.clinicprofessionalid = cp.clinicprofessionalid
        INNER JOIN professionals p
            ON cp.professionalid = p.professionalid
        INNER JOIN users u
            ON cp.userid = u.userid
        INNER JOIN clinicservices cs
            ON cps.clinicserviceid = cs.clinicserviceid
        INNER JOIN services s
            ON cs.serviceid = s.serviceid
        INNER JOIN specialties sp
            ON s.specialtyid = sp.specialtyid
        WHERE cp.clinicprofessionalid = $1
            AND cp.clinicid = $2
            AND cs.clinicid = $2
            AND u.clinicid = $2
            AND cps.isactive = TRUE
            AND cp.isactive = TRUE
            AND p.isactive = TRUE
            AND u.isactive = TRUE
            AND cs.isactive = TRUE
            AND s.isactive = TRUE
            AND sp.isactive = TRUE
        ORDER BY s.name
    `, [id, clinicId]);

    return resultado.rows;
}


async function asociarServicio(id, servicioId, clinicId) {
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        // Verificar profesional y servicio activos,
        // pertenencia a la clínica y especialidad.
        const validacion = await client.query(`
            SELECT
                cp.clinicprofessionalid,
                cs.clinicserviceid
            FROM clinicprofessionals cp
            INNER JOIN professionals p
                ON cp.professionalid = p.professionalid
            INNER JOIN users u
                ON cp.userid = u.userid
            CROSS JOIN clinicservices cs
            INNER JOIN services s
                ON cs.serviceid = s.serviceid
            INNER JOIN specialties sp
                ON s.specialtyid = sp.specialtyid
            WHERE cp.clinicprofessionalid = $1
                AND cs.clinicserviceid = $2
                AND cp.clinicid = $3
                AND cs.clinicid = $3
                AND u.clinicid = $3
                AND cp.isactive = TRUE
                AND p.isactive = TRUE
                AND u.isactive = TRUE
                AND cs.isactive = TRUE
                AND s.isactive = TRUE
                AND sp.isactive = TRUE
                AND EXISTS (
                    SELECT 1
                    FROM professionalspecialties ps
                    WHERE ps.professionalid = p.professionalid
                        AND ps.specialtyid = s.specialtyid
                        AND ps.isactive = TRUE
                )
            FOR UPDATE OF cp, cs
        `, [id, servicioId, clinicId]);

        if (validacion.rows.length === 0) {
            const error = new Error(
                'El profesional o servicio no está habilitado, ' +
                'no pertenece a la clínica o no coincide la especialidad.'
            );
            error.status = 400;
            throw error;
        }

        // Usuario provisional de auditoría
        const auditor = await client.query(`
            SELECT u.userid
            FROM users u
            INNER JOIN roles r ON u.roleid = r.roleid
            WHERE u.clinicid = $1
                AND u.isactive = TRUE
                AND r.name = 'administrador de clínica'
            ORDER BY u.userid
            LIMIT 1
        `, [clinicId]);

        if (auditor.rows.length === 0) {
            const error = new Error(
                'No existe un administrador activo para la clínica.'
            );
            error.status = 409;
            throw error;
        }

        const resultado = await client.query(`
            INSERT INTO clinicprofessionalservices (
                clinicprofessionalid,
                clinicserviceid,
                auditpersonid
            )
            VALUES ($1, $2, $3)
            ON CONFLICT (clinicserviceid, clinicprofessionalid)
            DO NOTHING
            RETURNING clinicprofessionalserviceid
        `, [id, servicioId, auditor.rows[0].userid]);

        if (resultado.rows.length === 0) {
            const error = new Error(
                'El servicio ya tiene una asociación con este profesional.'
            );
            error.status = 409;
            throw error;
        }

        await client.query('COMMIT');

        return {
            id: resultado.rows[0].clinicprofessionalserviceid,
            profesionalId: id,
            servicioId
        };

    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
}


async function desasociarServicio(id, servicioId, clinicId) {
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        const asociacion = await client.query(`
            SELECT cps.clinicprofessionalserviceid
            FROM clinicprofessionalservices cps
            INNER JOIN clinicprofessionals cp
                ON cps.clinicprofessionalid = cp.clinicprofessionalid
            INNER JOIN clinicservices cs
                ON cps.clinicserviceid = cs.clinicserviceid
            WHERE cp.clinicprofessionalid = $1
                AND cs.clinicserviceid = $2
                AND cp.clinicid = $3
                AND cs.clinicid = $3
                AND cps.isactive = TRUE
            FOR UPDATE OF cps
        `, [id, servicioId, clinicId]);

        if (asociacion.rows.length === 0) {
            await client.query('ROLLBACK');
            return { estado: 'no_encontrado' };
        }

        // No retirar una habilitación con citas futuras reservadas
        const citas = await client.query(`
            SELECT 1
            FROM appointments a
            INNER JOIN appointmentstatuses aps
                ON a.appointmentstatusid = aps.appointmentstatusid
            WHERE a.clinicprofessionalid = $1
                AND a.clinicserviceid = $2
                AND a.clinicid = $3
                AND a.date > NOW()
                AND aps.name = 'reservada'
            LIMIT 1
        `, [id, servicioId, clinicId]);

        if (citas.rows.length > 0) {
            await client.query('ROLLBACK');
            return { estado: 'con_citas' };
        }

        await client.query(`
            UPDATE clinicprofessionalservices
            SET isactive = FALSE,
                updatedat = NOW()
            WHERE clinicprofessionalserviceid = $1
        `, [asociacion.rows[0].clinicprofessionalserviceid]);

        await client.query('COMMIT');

        return { estado: 'desasociado' };

    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
}

async function actualizarProfesional(id, datos, clinicId) {
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        const { licencia, especialidades } = datos;

        // Bloquear la asociación y obtener el ID global.
        const actual = await client.query(`
            SELECT cp.professionalid
            FROM clinicprofessionals cp
            JOIN professionals p
                ON p.professionalid = cp.professionalid
            JOIN users u
                ON u.userid = cp.userid
            WHERE cp.clinicprofessionalid = $1
              AND cp.clinicid = $2
              AND cp.isactive = TRUE
              AND p.isactive = TRUE
              AND u.isactive = TRUE
            FOR UPDATE OF cp, p
        `, [id, clinicId]);

        if (actual.rows.length === 0) {
            await client.query('ROLLBACK');
            return { estado: 'no_encontrado' };
        }

        const professionalId = actual.rows[0].professionalid;

        // Impedir cambios globales si trabaja en otras clínicas.
        const compartido = await client.query(`
            SELECT 1
            FROM clinicprofessionals
            WHERE professionalid = $1
              AND clinicid <> $2
              AND isactive = TRUE
            LIMIT 1
        `, [professionalId, clinicId]);

        if (compartido.rows.length > 0) {
            await client.query('ROLLBACK');
            return { estado: 'compartido' };
        }

        // Verificar que todas las especialidades estén activas.
        const validas = await client.query(`
            SELECT specialtyid
            FROM specialties
            WHERE specialtyid = ANY($1::int[])
              AND isactive = TRUE
        `, [especialidades]);

        if (validas.rows.length !== especialidades.length) {
            await client.query('ROLLBACK');
            return { estado: 'especialidad_invalida' };
        }

        // Impedir retirar especialidades necesarias para
        // servicios actualmente habilitados.
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
            await client.query('ROLLBACK');
            return { estado: 'servicios_incompatibles' };
        }

        // Actualizar licencia global.
        await client.query(`
            UPDATE professionals
            SET licenseid = $1,
                updatedat = NOW()
            WHERE professionalid = $2
        `, [licencia, professionalId]);

        // Desactivar especialidades que ya no se seleccionaron.
        await client.query(`
            UPDATE professionalspecialties
            SET isactive = FALSE,
                updatedat = NOW()
            WHERE professionalid = $1
              AND NOT (specialtyid = ANY($2::int[]))
              AND isactive = TRUE
        `, [professionalId, especialidades]);

        // Obtener un auditor provisional de la clínica.
        const auditor = await client.query(`
            SELECT u.userid
            FROM users u
            JOIN roles r ON r.roleid = u.roleid
            WHERE u.clinicid = $1
              AND u.isactive = TRUE
              AND r.name = 'administrador de clínica'
            ORDER BY u.userid
            LIMIT 1
        `, [clinicId]);

        if (auditor.rows.length === 0) {
            const error = new Error(
                'No existe un administrador activo para la clínica.'
            );
            error.status = 409;
            throw error;
        }

        // Insertar especialidades nuevas o reactivar existentes.
        for (const specialtyId of especialidades) {
            await client.query(`
                INSERT INTO professionalspecialties (
                    professionalid,
                    specialtyid,
                    auditpersonid
                )
                VALUES ($1, $2, $3)
                ON CONFLICT (professionalid, specialtyid)
                DO UPDATE SET
                    isactive = TRUE,
                    updatedat = NOW(),
                    auditpersonid = EXCLUDED.auditpersonid
            `, [
                professionalId,
                specialtyId,
                auditor.rows[0].userid
            ]);
        }

        await client.query('COMMIT');

        return {
            estado: 'actualizado',
            profesional: {
                id: Number(id),
                profesionalId: professionalId,
                licencia,
                especialidades
            }
        };

    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
}

async function eliminarProfesional(id, clinicId) {
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        // Bloquear la asociación del profesional.
        const profesional = await client.query(`
            SELECT clinicprofessionalid
            FROM clinicprofessionals
            WHERE clinicprofessionalid = $1
              AND clinicid = $2
              AND isactive = TRUE
            FOR UPDATE
        `, [id, clinicId]);

        if (profesional.rows.length === 0) {
            await client.query('ROLLBACK');
            return { estado: 'no_encontrado' };
        }

        // Comprobar citas futuras reservadas.
        const citas = await client.query(`
            SELECT 1
            FROM appointments a
            JOIN appointmentstatuses aps
                ON aps.appointmentstatusid = a.appointmentstatusid
            WHERE a.clinicprofessionalid = $1
              AND a.clinicid = $2
              AND a.date > NOW()
              AND aps.name = 'reservada'
            LIMIT 1
        `, [id, clinicId]);

        if (citas.rows.length > 0) {
            await client.query('ROLLBACK');
            return { estado: 'con_citas' };
        }

        // Baja lógica del profesional en esta clínica.
        await client.query(`
            UPDATE clinicprofessionals
            SET isactive = FALSE,
                updatedat = NOW()
            WHERE clinicprofessionalid = $1
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
    obtenerProfesionales,
    obtenerProfesionalPorId,
    registrarProfesional,
    obtenerServiciosProfesional,
    asociarServicio,
    desasociarServicio,
    actualizarProfesional,
    eliminarProfesional
};