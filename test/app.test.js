import request from "supertest";
import app from "../api/index.js";

describe("API básica", () => {
  test("GET /api retorna 200 e objeto com message e version", async () => {
    const res = await request(app).get("/api");

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("message");
    expect(res.body).toHaveProperty("version");
  });
});
