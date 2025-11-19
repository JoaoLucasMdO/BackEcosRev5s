import express from "express";
import { config } from "dotenv";
import fs from "fs";
import swaggerUI from "swagger-ui-express";
import cors from "cors";

config();

const app = express();
const PORT = process.env.PORT || 4000;

// Middleware CORS
app.use(cors({ origin: "*" }));
app.use(express.json());

// Rotas importadas
import RotasBeneficio from "./routes/beneficio.js";
import RotasUsuarios from "./routes/usuario.js";
import histRouter from "./routes/histRouter.js";
import uploadRouter from "./routes/upload.js";

// Conteúdo público
app.use(express.static("public"));
app.disable("x-powered-by");
app.use("/favicon.ico", express.static("public/images/logo-api.png"));

// Swagger
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const swaggerPath = path.join(__dirname, "swagger", "swagger_output.json");

app.use(
  "/api/doc",
  swaggerUI.serve,
  swaggerUI.setup(
    JSON.parse(fs.readFileSync(swaggerPath)),
    {
      customCss:
        ".swagger-ui .opblock .opblock-summary-path-description-wrapper { align-items: center; display: flex; flex-wrap: wrap; gap: 0 10px; padding: 0 10px; width: 100%; }",
      // customCssUrl removido
    }
  )
);

// Rota default
app.get("/api", (req, res) => {
  res.status(200).json({
    message: "API FATEC 100% funcional🚀",
    version: "1.0.0",
  });
});

// Rotas
app.use("/api/beneficio", RotasBeneficio);
app.use("/api/usuario", RotasUsuarios);
app.use("/api/hist", histRouter);
app.use("/api/upload", uploadRouter);

// Inicia o servidor HTTP apenas quando não estiver em ambiente de teste
if (process.env.NODE_ENV !== "test") {
  const swaggerData = JSON.parse(fs.readFileSync(swaggerPath));

  app.use(
    "/api/doc",
    swaggerUI.serve,
    swaggerUI.setup(swaggerData, {
      customCss:
        ".swagger-ui .opblock .opblock-summary-path-description-wrapper { align-items: center; display: flex; flex-wrap: wrap; gap: 0 10px; padding: 0 10px; width: 100%; }",
    })
  );

  app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
  });
}



// Exporta o app para testes com supertest
export default app;
