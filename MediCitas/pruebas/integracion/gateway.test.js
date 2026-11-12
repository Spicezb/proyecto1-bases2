const request = require("supertest");

const API_URL = "http://localhost:3000";

describe("API Gateway", () => {

    test("Debe responder correctamente al healthcheck", async () => {

        const response = await request(API_URL)
            .get("/health");

        expect(response.status).toBe(200);

        expect(response.body).toEqual({
            status: "ok",
            gateway: "healthy"
        });

    });

});