const jwt = require('jsonwebtoken');
const jwksClient = require('jwks-rsa');
const pool = require('../config/database');

const KEYCLOAK_URL = process.env.KEYCLOAK_URL || 'http://localhost:8080';
const KEYCLOAK_REALM = process.env.KEYCLOAK_REALM || 'medicitas';

const client = jwksClient({
    jwksUri: `${KEYCLOAK_URL}/realms/${KEYCLOAK_REALM}/protocol/openid-connect/certs`,
    cache: true,
    cacheMaxEntries: 5,
    cacheMaxAge: 600000, // 10 minutos
    rateLimit: true,
    jwksRequestsPerMinute: 10
});

function getKey(header, callback) {
    client.getSigningKey(header.kid, function (err, key) {
        if (err) {
            return callback(err);
        }
        const signingKey = key.getPublicKey();
        callback(null, signingKey);
    });
}

// Middleware para autenticar tokens JWT emitidos por Keycloak (Jason Web Token)
function autenticarToken(req, res, next) {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({
            status: 'error',
            message: 'Token de autenticación no proporcionado o formato inválido.'
        });
    }

    const token = authHeader.split(' ')[1];

    jwt.verify(token, getKey, { algorithms: ['RS256'] }, async (err, decoded) => {
        if (err) {
            return res.status(401).json({
                status: 'error',
                message: 'Token inválido, alterado o expirado.'
            });
        }

        // Obtener el identificador del proveedor (preferred_username o sub)
        const providerId = decoded.preferred_username || decoded.sub;

        try {
            // Opción A: Derivar la clínica y los roles directamente de la BD según el providerid
            const query = `
                SELECT
                    u.userid,
                    u.clinicid,
                    u.roleid,
                    r.name AS rolename
                FROM users u
                INNER JOIN roles r ON u.roleid = r.roleid
                WHERE u.providerid = $1
                  AND u.isactive = TRUE
            `;

            const resultado = await pool.query(query, [providerId]);

            if (resultado.rows.length === 0) {
                return res.status(401).json({
                    status: 'error',
                    message: 'Usuario no registrado o inactivo en la plataforma.'
                });
            }

            const dbUser = resultado.rows[0];

            req.user = {
                userId: dbUser.userid,
                clinicId: dbUser.clinicid,
                roleId: dbUser.roleid,
                roleName: dbUser.rolename,
                providerId: providerId,
                realmRoles: decoded.realm_access?.roles || []
            };

            next();
        } catch (dbError) {
            console.error('Error al vincular identidad con base de datos:', dbError);
            return res.status(500).json({
                status: 'error',
                message: 'Error interno al validar la identidad.'
            });
        }
    });
}

module.exports = { autenticarToken };
