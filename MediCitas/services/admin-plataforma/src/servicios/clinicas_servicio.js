const clinicasRepositorio = require('../repositorios/clinicas_repos');

function validarDatosClinica(datos) {
    const {
        nombre,
        zonaHoraria,
        adminProviderId,
        adminIdentificacion,
        adminNombre,
        adminApellido,
        adminEmail,
        adminTelefono
    } = datos || {};

    if (typeof nombre !== 'string' || !nombre.trim() || nombre.trim().length > 100) {
        return {
            error: 'El nombre de la clínica es obligatorio y debe tener máximo 100 caracteres.',
            status: 400
        };
    }

    if (typeof adminProviderId !== 'string' || !adminProviderId.trim()) {
        return {
            error: 'El identificador de Keycloak del administrador (adminProviderId) es obligatorio.',
            status: 400
        };
    }

    if (typeof adminIdentificacion !== 'string' || !adminIdentificacion.trim() || adminIdentificacion.trim().length > 12) {
        return {
            error: 'La identificación del administrador es obligatoria y debe tener máximo 12 caracteres.',
            status: 400
        };
    }

    if (typeof adminNombre !== 'string' || !adminNombre.trim() || adminNombre.trim().length > 25) {
        return {
            error: 'El nombre del administrador es obligatorio y debe tener máximo 25 caracteres.',
            status: 400
        };
    }

    if (typeof adminApellido !== 'string' || !adminApellido.trim() || adminApellido.trim().length > 25) {
        return {
            error: 'El apellido del administrador es obligatorio y debe tener máximo 25 caracteres.',
            status: 400
        };
    }

    if (typeof adminEmail !== 'string' || !adminEmail.trim() || adminEmail.trim().length > 100) {
        return {
            error: 'El correo electrónico del administrador es obligatorio y debe tener formato válido.',
            status: 400
        };
    }

    return {
        datos: {
            nombre: nombre.trim(),
            zonaHoraria: (zonaHoraria && typeof zonaHoraria === 'string') ? zonaHoraria.trim() : 'America/Costa_Rica',
            adminProviderId: adminProviderId.trim(),
            adminIdentificacion: adminIdentificacion.trim(),
            adminNombre: adminNombre.trim(),
            adminApellido: adminApellido.trim(),
            adminEmail: adminEmail.trim(),
            adminTelefono: adminTelefono ? String(adminTelefono).trim() : null
        }
    };
}

async function crearClinica(datos, platformUserId) {
    const validacion = validarDatosClinica(datos);
    if (validacion.error) {
        return validacion;
    }

    const clinica = await clinicasRepositorio.crearClinica(validacion.datos, platformUserId);
    return { clinica };
}

async function obtenerClinicas() {
    const clinicas = await clinicasRepositorio.obtenerClinicas();
    return { clinicas };
}

module.exports = {
    crearClinica,
    obtenerClinicas
};
