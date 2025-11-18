const request = require("supertest");
const { spawn } = require("child_process");
const path = require("path");

const TEST_PORT = process.env.TEST_PORT || "4001";
const BASE_URL = `http://127.0.0.1:${TEST_PORT}`;

let serverProcess;

beforeAll(async () => {
  const indexPath = path.join(__dirname, "..", "api", "index.js");
  serverProcess = spawn("node", [indexPath], {
    env: Object.assign({}, process.env, {
      PORT: TEST_PORT,
      NODE_ENV: "test-child",
    }),
    stdio: ["ignore", "pipe", "pipe"],
  });

  // espera até o stdout indicar que o servidor subiu ou timeout em 5s
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error("Timeout: servidor não iniciou a tempo"));
    }, 5000);

    serverProcess.stdout.on("data", (data) => {
      const msg = data.toString();
      if (
        msg.includes("rodando na porta") ||
        msg.toLowerCase().includes("rodando")
      ) {
        clearTimeout(timeout);
        resolve();
      }
    });

    serverProcess.stderr.on("data", (d) => {
      // se desejar, logue lampadas de erro
      // console.error("server stderr:", d.toString());
    });

    serverProcess.on("error", (err) => {
      clearTimeout(timeout);
      reject(err);
    });

    serverProcess.on("exit", (code) => {
      clearTimeout(timeout);
      if (code !== 0) {
        reject(new Error(`Servidor finalizado com código ${code}`));
      }
    });
  });
});

afterAll(() => {
  if (serverProcess && !serverProcess.killed) {
    serverProcess.kill();
  }
});

describe("API básica", () => {
  test("GET /api retorna 200 e objeto com message e version", async () => {
    const res = await request(BASE_URL).get("/api");
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("message");
    expect(res.body).toHaveProperty("version");
  });
});
