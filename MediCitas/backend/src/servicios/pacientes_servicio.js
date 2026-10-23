// Datos provisionales mientras se conecta PostgreSQL
const pacientes = [
    { id: 1, nombre: 'Ana', apellido: 'Rodríguez' },
    { id: 2, nombre: 'Carlos', apellido: 'Mora' }
];

// Obtener todos los pacientes
function obtenerPacientes() {
    return pacientes;
}

// Buscar un paciente por ID
function obtenerPacientePorId(id) {
    return pacientes.find(paciente => paciente.id === Number(id));
}

// Registrar un nuevo paciente
function registrarPaciente(datos) {
    const { nombre, apellido } = datos;

    if (typeof nombre !== 'string' || !nombre.trim() ||
        typeof apellido !== 'string' || !apellido.trim()) {
        return {
            error: 'El nombre y el apellido son obligatorios.'
        };
    }
    const nuevoPaciente = {
        id: pacientes.length + 1,
        nombre: nombre.trim(),
        apellido: apellido.trim()
    };
    pacientes.push(nuevoPaciente);
    return { paciente: nuevoPaciente };
}

// Actualizar un paciente existente
function actualizarPaciente(id, datos) {
    const paciente = pacientes.find(p => p.id === Number(id));

    if (!paciente) {
        return {
            error: 'Paciente no encontrado.',
            status: 404
        };
    }

    const { nombre, apellido } = datos;

    if (typeof nombre !== 'string' || !nombre.trim() ||
        typeof apellido !== 'string' || !apellido.trim()) {
        return {
            error: 'El nombre y el apellido son obligatorios.',
            status: 400
        };
    }

    paciente.nombre = nombre.trim();
    paciente.apellido = apellido.trim();

    return { paciente };
}

module.exports = {
    obtenerPacientes,
    obtenerPacientePorId,
    registrarPaciente,
    actualizarPaciente
};
