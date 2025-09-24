import express from "express";
import {
  insertHistPontos,
  insertHistTransacoes,
  findHistPontosByUsuario,
  findHistTransacoesByUsuario,
  findAllHistPontos,
  findAllHistTransacoes
} from "../utils/histRouterDb.js";

const router = express.Router();

function getBrazilDateTime() {
  const date = new Date().toLocaleString("sv-SE", {
    timeZone: "America/Sao_Paulo",
  }).replace(" ", "T");
  return date;
}

// POST /hist/pontos
router.post("/pontos", async (req, res) => {
  try {
    const { id, idUsuario, pontos } = req.body;
    if (!id || !idUsuario || !pontos) {
      return res.status(400).json({ error: "Campos obrigatórios ausentes." });
    }
    const brazilDate = getBrazilDateTime();
    await insertHistPontos({ id, pontos, idUsuario, data: brazilDate });
    res.status(200).json({ message: "Histórico de pontos registrado com sucesso." });
  } catch (error) {
    res.status(500).json({ error: "Erro ao registrar histórico de pontos.", details: error.message });
  }
});

// POST /hist/transacoes
router.post("/transacoes", async (req, res) => {
  try {
    const { idUsuario, idBeneficio, descricao, pontos } = req.body;
    if (!idUsuario || !idBeneficio || !descricao || !pontos) {
      return res.status(400).json({ error: "Campos obrigatórios ausentes." });
    }
    const brazilDate = getBrazilDateTime();
    await insertHistTransacoes({ descricao, pontos, idBeneficio, idUsuario, data: brazilDate });
    res.status(200).json({ message: "Histórico de transação registrado com sucesso." });
  } catch (error) {
    res.status(500).json({ error: "Erro ao registrar transação.", details: error.message });
  }
});

// GET /hist/:idUsuario
router.get("/:idUsuario", async (req, res) => {
  try {
    const { idUsuario } = req.params;
    const { start, end } = req.query;
    const startDateTime = start ? `${start} 00:00:00` : "1970-01-01 00:00:00";
    const endDateTime = end ? `${end} 23:59:59` : "2999-12-31 23:59:59";

    const pointsHistory = await findHistPontosByUsuario(idUsuario, startDateTime, endDateTime);
    const transactionsHistory = await findHistTransacoesByUsuario(idUsuario, startDateTime, endDateTime);

    function formatDateToBrazil(date) {
      return new Date(date).toLocaleString("pt-BR");
    }

    const history = [
      ...pointsHistory.map(item => ({
        ...item,
        data: formatDateToBrazil(item.data),
      })),
      ...transactionsHistory.map(item => ({
        ...item,
        data: formatDateToBrazil(item.data),
      }))
    ].sort((a, b) => new Date(b.data) - new Date(a.data));

    res.status(200).json(history);
  } catch (error) {
    res.status(500).json({ error: "Erro ao buscar histórico.", details: error.message });
  }
});

// GET /hist
router.get("/", async (req, res) => {
  try {
    const { start, end } = req.query;
    const startDateTime = start ? `${start} 00:00:00` : "1970-01-01 00:00:00";
    const endDateTime = end ? `${end} 23:59:59` : "2999-12-31 23:59:59";

    const pointsHistory = await findAllHistPontos(startDateTime, endDateTime);
    const transactionsHistory = await findAllHistTransacoes(startDateTime, endDateTime);

    function formatDateToBrazil(date) {
      return new Date(date).toLocaleString("pt-BR");
    }

    const history = [
      ...pointsHistory.map(item => ({
        ...item,
        data: formatDateToBrazil(item.data),
      })),
      ...transactionsHistory.map(item => ({
        ...item,
        data: formatDateToBrazil(item.data),
      }))
    ].sort((a, b) => new Date(b.data) - new Date(a.data));

    // Agrupa por idUsuario
    const result = history.reduce((acc, item) => {
      if (!acc[item.idUsuario]) acc[item.idUsuario] = [];
      acc[item.idUsuario].push(item);
      return acc;
    }, {});

    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({ error: "Erro ao buscar histórico.", details: error.message });
  }
});

export default router;