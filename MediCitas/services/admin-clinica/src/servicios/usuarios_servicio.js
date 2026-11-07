const usuariosRepositorio = require('../repositorios/usuarios_repos');

function validarDatosUsuario(datos) {
    const { providerId, roleId, identificacion, nombre, apellido, email, telefono } = datos || {};

    if (typeof providerId !== 'string' || !providerId.trim()) {
        return { error: 'El providerId (Keycloak username) es obligatorio.', status: 400 };
    }

    if (![2, 3, 4].includes(Number(roleId))) {
        return { error: 'El roleId debe ser 2 (Admin de clínica), 3 (Recepción) o 4 (Profesional).', status: 400 };
    }

    if (typeof identificacion !== 'string' || !identificacion.trim() || identificacion.trim().length > 12) {
        return { error: 'La identificación es obligatoria y debe tener máximo 12 caracteres.', status: 400 };
    }

    if (typeof nombre !== 'string' || !nombre.trim() || nombre.trim().length > 25) {
        return { error: 'El nombre es obligatorio y debe tener máximo 25 caracteres.', status: 400 };
    }

    if (typeof apellido !== 'string' || !apellido.trim() || apellido.trim().length > 25) {
        return { error: 'El apellido es obligatorio y debe tener máximo 25 caracteres.', status: 400 };
    }

    if (typeof email !== 'string' || !email.trim() || email.trim().length > 100) {
        return { error: 'El email es obligatorio y debe tener formato válido.', status: 400 };
    }

    return {
        datos: {
            providerId: providerId.trim(),
            roleId: Number(roleId),
            identificacion: identificacion.trim(),
            nombre: nombre.trim(),
            apellido: apellido.trim(),
            email: email.trim(),
            telefono: telefono ? String(telefono).trim() : null
        }
    };
}

async function crearUsuario(datos, clinicId, auditPersonId) {
    const validacion = validarDatosUsuario(datos);
    if (validacion.error) {
        return validacion;
    }

    const usuario = await usuariosRepositorio.crearUsuario(validacion.datos, clinicId, auditPersonId);
    return { usuario };
}

async function cambiarRolUsuario(userId, newRoleId, clinicId, auditPersonId) {
    if (!/^[1-9]\d*$/.test(String(userId))) {
        return { error: 'El ID de usuario debe ser un entero positivo.', status: 400 };
    }

    if (![2, 3, 4].includes(Number(newRoleId))) {
        return { error: 'El nuevo roleId debe ser 2, 3 o 4.', status: 400 };
    }

    const usuario = await usuariosRepositorio.cambiarRolUsuario(Number(userId), Number(newRoleId), clinicId, auditPersonId);
    return { usuario };
}

async function desactivarUsuario(userId, clinicId, auditPersonId) {
    if (!/^[1-9]\d*$/.test(String(userId))) {
        return { error: 'El ID de usuario debe ser un entero positivo.', status: 400 };
    }

    const resultado = await usuariosRepositorio.desactivarUsuario(Number(userId), clinicId, auditPersonId);
    return { resultado };
}

async function obtenerUsuarios(clinicId, auditPersonId) {
    const usuarios = await usuariosRepositorio.obtenerUsuarios(clinicId, auditPersonId);
    return { usuarios };
}

module.exports = {
    crearUsuario,
    cambiarRolUsuario,
    desactivarUsuario,
    obtenerUsuarios
};
