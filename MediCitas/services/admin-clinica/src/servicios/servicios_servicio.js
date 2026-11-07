const serviciosRepositorio = require('../repositorios/servicios_repos');

// Validar datos para crear un servicio médico
function validarDatosCreacion(datos) {
    const { nombre, especialidadId, duracion } = datos || {};

    if (
        typeof nombre !== 'string' ||
        !nombre.trim() ||
        nombre.trim().length > 50
    ) {
        return {
            error: 'El nombre del servicio debe ser una cadena no vacía de máximo 50 caracteres.',
            status: 400
        };
    }

    if (!Number.isSafeInteger(especialidadId) || especialidadId <= 0) {
        return {
            error: 'La especialidad debe tener un ID entero positivo válido.',
            status: 400
        };
    }

    if (!Number.isSafeInteger(duracion) || duracion <= 0) {
        return {
            error: 'La duración debe ser un número entero positivo mayor a cero (en minutos).',
            status: 400
        };
    }

    return {
        datos: {
            nombre: nombre.trim(),
            especialidadId,
            duracion
        }
    };
}

// Validar datos para actualizar un servicio médico
function validarDatosActualizacion(datos) {
    const { duracion, activo } = datos || {};

    if (!Number.isSafeInteger(duracion) || duracion <= 0) {
        return {
            error: 'La duración debe ser un número entero positivo mayor a cero (en minutos).',
            status: 400
        };
    }

    if (activo !== undefined && typeof activo !== 'boolean') {
        return {
            error: 'El campo activo debe ser un valor booleano.',
            status: 400
        };
    }

    return {
        datos: {
            duracion,
            activo: activo !== undefined ? activo : true
        }
    };
}

// Obtener todos los servicios médicos
async function obtenerServicios(clinicId, auditPersonId) {
    const servicios = await serviciosRepositorio.obtenerServicios(clinicId, auditPersonId);
    return { servicios };
}

// Obtener un servicio médico por ID
async function obtenerServicioPorId(id, clinicId, auditPersonId) {
    if (!/^[1-9]\d*$/.test(String(id))) {
        return {
            error: 'El ID del servicio debe ser un entero positivo.',
            status: 400
        };
    }

    const servicio = await serviciosRepositorio.obtenerServicioPorId(
        Number(id),
        clinicId,
        auditPersonId
    );

    return { servicio };
}

// Registrar un servicio médico
async function registrarServicio(datos, clinicId, auditPersonId) {
    const validacion = validarDatosCreacion(datos);

    if (validacion.error) {
        return validacion;
    }

    const servicio = await serviciosRepositorio.registrarServicio(
        validacion.datos,
        clinicId,
        auditPersonId
    );

    return { servicio };
}

// Actualizar un servicio médico
async function actualizarServicio(id, datos, clinicId, auditPersonId) {
    if (!/^[1-9]\d*$/.test(String(id))) {
        return {
            error: 'El ID del servicio debe ser un entero positivo.',
            status: 400
        };
    }

    const validacion = validarDatosActualizacion(datos);

    if (validacion.error) {
        return validacion;
    }

    const servicio = await serviciosRepositorio.actualizarServicio(
        Number(id),
        validacion.datos,
        clinicId,
        auditPersonId
    );

    if (!servicio) {
        return {
            error: 'El servicio no está asociado a esta clínica.',
            status: 404
        };
    }

    return { servicio };
}

// Eliminar (baja lógica) un servicio médico
async function eliminarServicio(id, clinicId, auditPersonId) {
    if (!/^[1-9]\d*$/.test(String(id))) {
        return {
            error: 'El ID del servicio debe ser un entero positivo.',
            status: 400
        };
    }

    const resultado = await serviciosRepositorio.eliminarServicio(
        Number(id),
        clinicId,
        auditPersonId
    );

    if (!resultado) {
        return {
            error: 'El servicio no está asociado a esta clínica o ya fue eliminado.',
            status: 404
        };
    }

    return { resultado };
}

module.exports = {
    obtenerServicios,
    obtenerServicioPorId,
    registrarServicio,
    actualizarServicio,
    eliminarServicio
};
