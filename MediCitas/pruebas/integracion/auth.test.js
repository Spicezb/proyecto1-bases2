const { obtenerToken } = require("../helpers/auth");

const usuarios = [
    {
        nombre: "Administrador de plataforma",
        username: process.env.TEST_ADMIN_USERNAME,
        password: process.env.TEST_ADMIN_PASSWORD
    },
    {
        nombre: "Administrador de clínica",
        username: process.env.TEST_ADMIN_CLINICA_USERNAME,
        password: process.env.TEST_ADMIN_CLINICA_PASSWORD
    },
    {
        nombre: "Recepción",
        username: process.env.TEST_RECEPCION_USERNAME,
        password: process.env.TEST_RECEPCION_PASSWORD
    },
    {
        nombre: "Profesional de salud",
        username: process.env.TEST_PROFESIONAL_USERNAME,
        password: process.env.TEST_PROFESIONAL_PASSWORD
    }
];

describe("Autenticación con Keycloak", () => {
    test.each(usuarios)(
        "Debe obtener un token para $nombre",
        async ({ username, password }) => {
            expect(username).toBeTruthy();
            expect(password).toBeTruthy();

            const token = await obtenerToken(username, password);

            expect(token).toBeDefined();
            expect(typeof token).toBe("string");
        }
    );
});

const request = require("supertest");

const API_URL = process.env.TEST_API_URL;

describe("Autorización en API Gateway", () => {
    test("Debe rechazar solicitudes sin token", async () => {
        const response = await request(API_URL)
            .get("/api/usuarios");

        expect(response.status).toBe(401);
    });

    test("Debe permitir consultar usuarios al administrador de clínica", async () => {
        const token = await obtenerToken(
            process.env.TEST_ADMIN_CLINICA_USERNAME,
            process.env.TEST_ADMIN_CLINICA_PASSWORD
        );

        const response = await request(API_URL)
            .get("/api/usuarios")
            .set("Authorization", `Bearer ${token}`);

        expect(response.status).toBe(200);
    });

    test.each([
        ["Recepción", "TEST_RECEPCION_USERNAME", "TEST_RECEPCION_PASSWORD"],
        ["Profesional de salud", "TEST_PROFESIONAL_USERNAME", "TEST_PROFESIONAL_PASSWORD"],
        ["Administrador de plataforma", "TEST_ADMIN_USERNAME", "TEST_ADMIN_PASSWORD"]
    ])("Debe denegar el acceso a %s", async (_, usernameVar, passwordVar) => {
        const token = await obtenerToken(
            process.env[usernameVar],
            process.env[passwordVar]
        );

        const response = await request(API_URL)
            .get("/api/usuarios")
            .set("Authorization", `Bearer ${token}`);

        expect(response.status).toBe(403);
    });
});