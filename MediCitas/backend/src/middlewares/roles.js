// Middleware para autorizar operaciones según los roles permitidos
function autorizarRoles(rolesPermitidos) {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({
                status: 'error',
                message: 'No autenticado.'
            });
        }

        const rolUsuario = req.user.roleName;

        // Comprobar si el rol del usuario está dentro de los roles autorizados
        if (!rolesPermitidos.includes(rolUsuario)) {
            return res.status(403).json({
                status: 'error',
                message: 'Acceso denegado. No posee los permisos requeridos para esta operación.'
            });
        }

        next();
    };
}

module.exports = { autorizarRoles };
