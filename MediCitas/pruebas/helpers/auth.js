const KEYCLOAK_URL = process.env.TEST_KEYCLOAK_URL;
const REALM = "medicitas";
const CLIENT_ID = "medicitas-api";

async function obtenerToken(username, password) {
    const url = `${KEYCLOAK_URL}/realms/${REALM}/protocol/openid-connect/token`;

    const body = new URLSearchParams({
        grant_type: "password",
        client_id: CLIENT_ID,
        username,
        password
    });

    const response = await fetch(url, {
        method: "POST",
        headers: {
            "Content-Type": "application/x-www-form-urlencoded"
        },
        body
    });

    const resultado = await response.json();

    if (!response.ok) {
        throw new Error(`Error obteniendo token: ${JSON.stringify(resultado)}`);
    }

    return resultado.access_token;
}

module.exports = { obtenerToken };