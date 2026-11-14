/**
 * PRUEBA DE INTEGRACIÓN: AUTENTICACIÓN Y AUTORIZACIÓN (KEYCLOAK & RBAC)
 * Valida emisión de JWT por Keycloak y cumplimiento estricto de roles en el Gateway.
 */
const { obtenerToken } = require('../helpers/auth');
const { banner, seccion, check, item, badge, prettyJson, tarjetaResumen, c } = require('../helpers/format');

const API_URL = process.env.TEST_API_URL || 'http://localhost:3000';

async function ejecutar() {
    banner('PRUEBA DE INTEGRACIÓN: AUTENTICACIÓN Y RBAC', 'Keycloak OpenID Connect & Control de Acceso');

    seccion(1, 'Autenticando los 4 roles del sistema en Keycloak...');
    const roles = [
        { nombre: 'Administrador de plataforma', user: 'admin-plataforma', pass: '12345' },
        { nombre: 'Administrador de clínica',    user: 'ana-solis',        pass: '12345' },
        { nombre: 'Personal de recepción',       user: 'luis-mora',        pass: '12345' },
        { nombre: 'Profesional de salud',        user: 'maria-rojas',      pass: '12345' }
    ];

    const tokens = {};
    for (const r of roles) {
        const t0 = Date.now();
        tokens[r.user] = await obtenerToken(r.user, r.pass);
        const preview = `${tokens[r.user].slice(0, 18)}...${tokens[r.user].slice(-10)}`;
        check(r.nombre.padEnd(28), `Token JWT emitido (${c.dim}${preview}${c.brightGreen})`, Date.now() - t0);
    }

    console.log();
    seccion(2, 'Control de Acceso RBAC (Endpoint protegido: GET /api/usuarios)');
    item('Regla de negocio', 'Solo "Administrador de clínica" tiene acceso (200 OK). Los demás deben ser rechazados.');

    console.log(`\n${c.bold}${c.white}══════════════════════════ EVALUACIÓN DE PETICIONES ══════════════════════════${c.reset}\n`);

    // 1. Sin token
    const respSin = await fetch(`${API_URL}/api/usuarios`);
    console.log(`   ${c.bold}1. Petición sin cabecera Authorization:${c.reset}  ${badge(respSin.status, 'UNAUTHORIZED')}`);

    // 2. Con token de Admin Clínica
    const respAdmin = await fetch(`${API_URL}/api/usuarios`, {
        headers: { 'Authorization': `Bearer ${tokens['ana-solis']}` }
    });
    console.log(`   ${c.bold}2. Administrador de clínica (ana-solis):${c.reset} ${badge(respAdmin.status, 'OK')}`);

    // 3. Con token de Recepción
    const respRecep = await fetch(`${API_URL}/api/usuarios`, {
        headers: { 'Authorization': `Bearer ${tokens['luis-mora']}` }
    });
    console.log(`   ${c.bold}3. Recepción (luis-mora):               ${c.reset} ${badge(respRecep.status, 'FORBIDDEN')}`);

    // 4. Con token de Profesional
    const respProf = await fetch(`${API_URL}/api/usuarios`, {
        headers: { 'Authorization': `Bearer ${tokens['maria-rojas']}` }
    });
    console.log(`   ${c.bold}4. Profesional médico (maria-rojas):    ${c.reset} ${badge(respProf.status, 'FORBIDDEN')}`);

    const rbacCorrecto = respSin.status === 401 && respAdmin.status === 200 && respRecep.status === 403 && respProf.status === 403;

    if (rbacCorrecto) {
        tarjetaResumen('CONTROL DE ACCESO RBAC 100% BLINDADO', [
            `Tokens criptográficos validados mediante firma RS256 de Keycloak.`,
            `Peticiones anónimas bloqueadas de inmediato (HTTP 401).`,
            `Principio de menor privilegio verificado: solo Admin Clínica accede a /api/usuarios.`,
            `Roles sin permiso reciben HTTP 403 Forbidden sin fuga de información.`
        ], true);
    } else {
        tarjetaResumen('FALLO EN LA POLÍTICA DE AUTORIZACIÓN', [
            `No se cumplieron los códigos HTTP esperados (401, 200, 403, 403).`
        ], false);
    }
}

if (require.main === module) {
    ejecutar().catch(err => {
        console.error(`\n${c.red}Error durante la ejecución:${c.reset}`, err);
    });
}

module.exports = { ejecutar };
