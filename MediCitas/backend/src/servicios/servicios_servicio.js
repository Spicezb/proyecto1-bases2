const serviciosRepositorio = require('../repositorios/servicios_repos');

//Obtener todos los servicios médicos
async function obtenerServicios(clinicId) {
    return await serviciosRepositorio.obtenerServicios(clinicId);
}

//Obtener un servicio médico por ID
async function obtenerServicioPorId(id, clinicId) {
    return await serviciosRepositorio.obtenerServicioPorId(id, clinicId);
}

//Registrar servicio médico
async function registrarServicio(datos, clinicId) {
    const { nombre, especialidadId, duracion } = datos || {};

    if (
        typeof nombre !== 'string' ||
        !nombre.trim() ||
        nombre.trim().length > 50
    ) {
        return {
            error: 'El nombre del servicio es inválido.',
            status: 400
        };
    }

    if (
        !Number.isSafeInteger(especialidadId) ||
        especialidadId <= 0
    ) {
        return {
            error: 'La especialidad debe tener un ID válido.',
            status: 400
        };
    }

    if (
        !Number.isSafeInteger(duracion) ||
        duracion <= 0
    ) {
        return {
            error: 'La duración debe ser un entero positivo.',
            status: 400
        };
    }

    const servicio = await serviciosRepositorio.registrarServicio({
        nombre: nombre.trim(),
        especialidadId,
        duracion
    }, clinicId);

    return { servicio };
}

//Actualizar duración de un servicio
async function actualizarServicio(id, datos, clinicId) {
    if (
        !/^[1-9]\d*$/.test(String(id)) ||
        !Number.isSafeInteger(Number(id))
    ) {
        return {
            error: 'El ID debe ser un entero positivo.',
            status: 400
        };
    }
    const { duracion } = datos || {};
    if (
        !Number.isSafeInteger(duracion) ||
        duracion <= 0
    ) {
        return {
            error: 'La duración debe ser un entero positivo.',
            status: 400
        };
    }
    const servicio = await serviciosRepositorio.actualizarServicio(
        id,
        { duracion },
        clinicId
    );
    if (!servicio) {
        return {
            error: 'Servicio médico no encontrado.',
            status: 404
        };
    }
    return { servicio };
}

//Dar de baja un servicio médico
async function eliminarServicio(id, clinicId) {
    if (
        !/^[1-9]\d*$/.test(String(id)) ||
        !Number.isSafeInteger(Number(id))
    ) {
        return {
            error: 'El ID debe ser un entero positivo.',
            status: 400
        };
    }
    const resultado = await serviciosRepositorio.eliminarServicio(
        id,
        clinicId
    );
    if (resultado.estado === 'no_encontrado') {
        return {
            error: 'Servicio médico no encontrado.',
            status: 404
        };
    }
    if (resultado.estado === 'con_citas') {
        return {
            error: 'No se puede desactivar un servicio con citas registradas.',
            status: 409
        };
    }
    return { eliminado: true };
}

module.exports = {
    obtenerServicios,
    obtenerServicioPorId,
    registrarServicio,
    actualizarServicio,
    eliminarServicio
};