const pacientesRepositorio = require('../repositorios/pacientes_repos');

// Validar los datos de un paciente (POST y PUT)
function validarDatosPaciente(datos) {
    const {
        identificacion,
        nombre,
        apellido,
        fechaNacimiento,
        correo,
        telefono
    } = datos || {};

    // Validar campos obligatorios
    if (
        typeof identificacion !== 'string' ||
        !identificacion.trim() ||
        identificacion.trim().length > 12 ||
        typeof nombre !== 'string' ||
        !nombre.trim() ||
        nombre.trim().length > 25 ||
        typeof apellido !== 'string' ||
        !apellido.trim() ||
        apellido.trim().length > 25 ||
        typeof fechaNacimiento !== 'string'
    ) {
        return {
            error: 'Los datos obligatorios son inválidos.',
            status: 400
        };
    }

    // Validar fecha de nacimiento
    const fecha = new Date(fechaNacimiento);

    if (
        !/^\d{4}-\d{2}-\d{2}$/.test(fechaNacimiento) ||
        Number.isNaN(fecha.getTime()) ||
        fecha.toISOString().slice(0, 10) !== fechaNacimiento ||
        fecha > new Date()
    ) {
        return {
            error: 'La fecha de nacimiento no es válida.',
            status: 400
        };
    }

    // Validar campos opcionales
    if (
        (correo != null &&
            (typeof correo !== 'string' || correo.length > 100)) ||
        (telefono != null &&
            (typeof telefono !== 'string' || telefono.length > 20))
    ) {
        return {
            error: 'Correo o teléfono inválido.',
            status: 400
        };
    }

    // Devolver datos limpios y validados
    return {
        datos: {
            identificacion: identificacion.trim(),
            nombre: nombre.trim(),
            apellido: apellido.trim(),
            fechaNacimiento,
            correo: correo ?? null,
            telefono: telefono ?? null
        }
    };
}

// Obtener pacientes desde PostgreSQL
async function obtenerPacientes(clinicId) {
    return await pacientesRepositorio.obtenerPacientes(clinicId);
}

// Buscar un paciente por ID desde PostgreSQL
async function obtenerPacientePorId(id, clinicId) {
    return await pacientesRepositorio.obtenerPacientePorId(id, clinicId);
}

// Registrar paciente
async function registrarPaciente(datos, clinicId) {
    const validacion = validarDatosPaciente(datos);

    if (validacion.error) {
        return validacion;
    }

    const paciente = await pacientesRepositorio.registrarPaciente(
        validacion.datos,
        clinicId
    );

    return { paciente };
}

// Actualizar paciente
async function actualizarPaciente(id, datos, clinicId) {
    if (
        !/^[1-9]\d*$/.test(String(id)) ||
        !Number.isSafeInteger(Number(id))
    ) {
        return {
            error: 'El ID del paciente debe ser un entero positivo.',
            status: 400
        };
    }

    const validacion = validarDatosPaciente(datos);

    if (validacion.error) {
        return validacion;
    }

    const paciente = await pacientesRepositorio.actualizarPaciente(
        id,
        validacion.datos,
        clinicId
    );

    return { paciente };
}

module.exports = {
    obtenerPacientes,
    obtenerPacientePorId,
    registrarPaciente,
    actualizarPaciente
};
