const profesionalesRepositorio = require('../repositorios/profesionales_repos');

//Obtener profesionales de la clínica
async function obtenerProfesionales(clinicId) {
    return await profesionalesRepositorio.obtenerProfesionales(clinicId);
}

//Obtener profesional por ID
async function obtenerProfesionalPorId(id, clinicId) {
    return await profesionalesRepositorio.obtenerProfesionalPorId(
        id,
        clinicId
    );
}


async function registrarProfesional(datos, clinicId) {
    const { usuarioId, licencia, especialidades } = datos || {};

    if (!Number.isSafeInteger(usuarioId) || usuarioId <= 0) {
        return {
            error: 'El ID del usuario debe ser un entero positivo.',
            status: 400
        };
    }

    if (
        typeof licencia !== 'string' ||
        !licencia.trim() ||
        licencia.trim().length > 15
    ) {
        return {
            error: 'La licencia es inválida. Máximo 15 caracteres.',
            status: 400
        };
    }

    if (
        !Array.isArray(especialidades) ||
        especialidades.length === 0 ||
        especialidades.some(
            id => !Number.isSafeInteger(id) || id <= 0
        ) ||
        new Set(especialidades).size !== especialidades.length
    ) {
        return {
            error: 'Debe indicar especialidades válidas y sin duplicados.',
            status: 400
        };
    }

    const profesional = await profesionalesRepositorio.registrarProfesional(
        {
            usuarioId,
            licencia: licencia.trim(),
            especialidades
        },
        clinicId
    );

    return { profesional };
}


function validarId(id) {
    return /^[1-9]\d*$/.test(String(id)) &&
        Number.isSafeInteger(Number(id));
}

async function obtenerServiciosProfesional(id, clinicId) {
    if (!validarId(id)) {
        return {
            error: 'El ID del profesional es inválido.',
            status: 400
        };
    }

    const profesional =
        await profesionalesRepositorio.obtenerProfesionalPorId(
            Number(id),
            clinicId
        );

    if (!profesional) {
        return {
            error: 'Profesional no encontrado.',
            status: 404
        };
    }

    const servicios =
        await profesionalesRepositorio.obtenerServiciosProfesional(
            Number(id),
            clinicId
        );

    return { servicios };
}

async function asociarServicio(id, datos, clinicId) {
    if (!validarId(id) || !validarId(datos?.servicioId)) {
        return {
            error: 'Los identificadores deben ser enteros positivos.',
            status: 400
        };
    }

    const asociacion =
        await profesionalesRepositorio.asociarServicio(
            Number(id),
            Number(datos.servicioId),
            clinicId
        );

    return { asociacion };
}

async function desasociarServicio(id, servicioId, clinicId) {
    if (!validarId(id) || !validarId(servicioId)) {
        return {
            error: 'Los identificadores deben ser enteros positivos.',
            status: 400
        };
    }

    const resultado =
        await profesionalesRepositorio.desasociarServicio(
            Number(id),
            Number(servicioId),
            clinicId
        );

    if (resultado.estado === 'no_encontrado') {
        return {
            error: 'Asociación no encontrada.',
            status: 404
        };
    }

    if (resultado.estado === 'con_citas') {
        return {
            error: 'El profesional tiene citas futuras reservadas para este servicio.',
            status: 409
        };
    }

    return { desasociado: true };
}

async function actualizarProfesional(id, datos, clinicId) {
    if (!validarId(id)) {
        return {
            error: 'El ID del profesional es inválido.',
            status: 400
        };
    }

    const { licencia, especialidades } = datos || {};

    if (
        typeof licencia !== 'string' ||
        !licencia.trim() ||
        licencia.trim().length > 15
    ) {
        return {
            error: 'La licencia debe tener entre 1 y 15 caracteres.',
            status: 400
        };
    }

    if (
        !Array.isArray(especialidades) ||
        especialidades.length === 0 ||
        especialidades.some(id => !Number.isSafeInteger(id) || id <= 0) ||
        new Set(especialidades).size !== especialidades.length
    ) {
        return {
            error: 'Debe indicar especialidades válidas y sin duplicados.',
            status: 400
        };
    }

    const resultado =
        await profesionalesRepositorio.actualizarProfesional(
            Number(id),
            {
                licencia: licencia.trim(),
                especialidades
            },
            clinicId
        );

    if (resultado.estado === 'no_encontrado') {
        return {
            error: 'Profesional no encontrado.',
            status: 404
        };
    }

    if (resultado.estado === 'compartido') {
        return {
            error: 'El profesional está asociado con otra clínica. No se pueden modificar sus datos globales desde esta operación.',
            status: 409
        };
    }

    if (resultado.estado === 'especialidad_invalida') {
        return {
            error: 'Una o más especialidades no existen o están inactivas.',
            status: 400
        };
    }

    if (resultado.estado === 'servicios_incompatibles') {
        return {
            error: 'No se pueden retirar especialidades utilizadas por servicios habilitados.',
            status: 409
        };
    }

    return { profesional: resultado.profesional };
}

async function eliminarProfesional(id, clinicId) {
    if (!validarId(id)) {
        return {
            error: 'El ID del profesional es inválido.',
            status: 400
        };
    }

    const resultado = await profesionalesRepositorio.eliminarProfesional(
        Number(id),
        clinicId
    );

    if (resultado.estado === 'no_encontrado') {
        return {
            error: 'Profesional no encontrado.',
            status: 404
        };
    }

    if (resultado.estado === 'con_citas') {
        return {
            error: 'No se puede desactivar un profesional con citas futuras reservadas.',
            status: 409
        };
    }

    return { eliminado: true };
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