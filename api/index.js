import express from "express";
import { config } from "dotenv";
import fs from "fs";
import https from "https"; // <-- Adicione esta linha
import swaggerUI from "swagger-ui-express";
import cors from "cors";

config();

const app = express();
const { PORT } = process.env || 443;

// Middleware CORS
app.use(cors({ origin: '*' }));
app.use(express.json());

// Import das rotas da aplicação
import RotasBeneficio from "./routes/beneficio.js";
import RotasUsuarios from "./routes/usuario.js";
import histRouter from "./routes/histRouter.js";

// Conteúdo público
app.use(express.static("public"));
app.disable("x-powered-by");
app.use("/favicon.ico", express.static("public/images/logo-api.png"));

// Swagger
const CSS_URL =
  "https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/4.1.0/swagger-ui.min.css";
app.use(
  "/api/doc",
  swaggerUI.serve,
  swaggerUI.setup(
    JSON.parse(fs.readFileSync("./api/swagger/swagger_output.json")),
    {
      customCss:
        ".swagger-ui .opblock .opblock-summary-path-description-wrapper { align-items: center; display: flex; flex-wrap: wrap; gap: 0 10px; padding: 0 10px; width: 100%; }",
      customCssUrl: CSS_URL,
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

// Rotas da API
app.use("/api/beneficio", RotasBeneficio);
app.use("/api/usuario", RotasUsuarios);
app.use("/api/hist", histRouter);

// HTTPS options
const httpsOptions = {
  key: fs.readFileSync("./server.key"),
  cert: fs.readFileSync("./server.cert"),
};

// Inicia o servidor HTTPS
https.createServer(httpsOptions, app).listen(PORT, '0.0.0.0', function () {
  console.log(`💻Servidor HTTPS rodando na porta ${PORT}`);
});
