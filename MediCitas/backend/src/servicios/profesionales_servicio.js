const profesionalesRepositorio = require('../repositorios/profesionales_repos');

// Validar datos para crear un profesional
function validarDatosCreacion(datos) {
    const { usuarioId, licencia, especialidades } = datos || {};

    if (!Number.isSafeInteger(usuarioId) || usuarioId <= 0) {
        return {
            error: 'El ID de usuario debe ser un número entero positivo.',
            status: 400
        };
    }

    if (
        typeof licencia !== 'string' ||
        !licencia.trim() ||
        licencia.trim().length > 15
    ) {
        return {
            error: 'La licencia profesional es obligatoria y debe tener máximo 15 caracteres.',
            status: 400
        };
    }

    if (especialidades !== undefined) {
        if (!Array.isArray(especialidades) || especialidades.some(id => !Number.isSafeInteger(id) || id <= 0)) {
            return {
                error: 'Las especialidades deben ser un arreglo de IDs enteros positivos.',
                status: 400
            };
        }
    }

    return {
        datos: {
            usuarioId,
            licencia: licencia.trim(),
            especialidades: especialidades || []
        }
    };
}

// Validar datos para actualizar un profesional
function validarDatosActualizacion(datos) {
    const { licencia, activo, especialidades } = datos || {};

    if (licencia !== undefined) {
        if (typeof licencia !== 'string' || !licencia.trim() || licencia.trim().length > 15) {
            return {
                error: 'La licencia profesional debe tener máximo 15 caracteres.',
                status: 400
            };
        }
    }

    if (activo !== undefined && typeof activo !== 'boolean') {
        return {
            error: 'El campo activo debe ser un valor booleano.',
            status: 400
        };
    }

    if (especialidades !== undefined) {
        if (!Array.isArray(especialidades) || especialidades.some(id => !Number.isSafeInteger(id) || id <= 0)) {
            return {
                error: 'Las especialidades deben ser un arreglo de IDs enteros positivos.',
                status: 400
            };
        }
    }

    return {
        datos: {
            licencia: licencia ? licencia.trim() : undefined,
            activo: activo !== undefined ? activo : true,
            especialidades
        }
    };
}

// Obtener todos los profesionales de la clínica
async function obtenerProfesionales(clinicId, auditPersonId) {
    const profesionales = await profesionalesRepositorio.obtenerProfesionales(clinicId, auditPersonId);
    return { profesionales };
}

// Obtener un profesional por ID
async function obtenerProfesionalPorId(id, clinicId, auditPersonId) {
    if (!/^[1-9]\d*$/.test(String(id))) {
        return {
            error: 'El ID del profesional debe ser un entero positivo.',
            status: 400
        };
    }

    const profesional = await profesionalesRepositorio.obtenerProfesionalPorId(
        Number(id),
        clinicId,
        auditPersonId
    );

    return { profesional };
}

// Registrar profesional
async function registrarProfesional(datos, clinicId, auditPersonId) {
    const validacion = validarDatosCreacion(datos);

    if (validacion.error) {
        return validacion;
    }

    const profesional = await profesionalesRepositorio.registrarProfesional(
        validacion.datos,
        clinicId,
        auditPersonId
    );

    return { profesional };
}

// Actualizar profesional
async function actualizarProfesional(id, datos, clinicId, auditPersonId) {
    if (!/^[1-9]\d*$/.test(String(id))) {
        return {
            error: 'El ID del profesional debe ser un entero positivo.',
            status: 400
        };
    }

    const validacion = validarDatosActualizacion(datos);

    if (validacion.error) {
        return validacion;
    }

    const profesional = await profesionalesRepositorio.actualizarProfesional(
        Number(id),
        validacion.datos,
        clinicId,
        auditPersonId
    );

    if (!profesional) {
        return {
            error: 'Profesional no encontrado en esta clínica.',
            status: 404
        };
    }

    return { profesional };
}

// Eliminar (baja lógica) profesional
async function eliminarProfesional(id, clinicId, auditPersonId) {
    if (!/^[1-9]\d*$/.test(String(id))) {
        return {
            error: 'El ID del profesional debe ser un entero positivo.',
            status: 400
        };
    }

    const resultado = await profesionalesRepositorio.eliminarProfesional(
        Number(id),
        clinicId,
        auditPersonId
    );

    if (!resultado) {
        return {
            error: 'Profesional no encontrado en esta clínica.',
            status: 404
        };
    }

    return { resultado };
}

// Asociar servicio a un profesional
async function asociarServicio(id, servicioId, clinicId, auditPersonId) {
    if (!/^[1-9]\d*$/.test(String(id)) || !/^[1-9]\d*$/.test(String(servicioId))) {
        return {
            error: 'Tanto el ID del profesional como el ID del servicio deben ser enteros positivos.',
            status: 400
        };
    }

    const resultado = await profesionalesRepositorio.asociarServicio(
        Number(id),
        Number(servicioId),
        clinicId,
        auditPersonId
    );

    return { resultado };
}

// Obtener servicios de un profesional
async function obtenerServiciosProfesional(id, clinicId) {
    if (!/^[1-9]\d*$/.test(String(id))) {
        return {
            error: 'El ID del profesional debe ser un entero positivo.',
            status: 400
        };
    }

    const servicios = await profesionalesRepositorio.obtenerServiciosProfesional(
        Number(id),
        clinicId
    );

    return { servicios };
}

module.exports = {
    obtenerProfesionales,
    obtenerProfesionalPorId,
    registrarProfesional,
    actualizarProfesional,
    eliminarProfesional,
    asociarServicio,
    obtenerServiciosProfesional
};
