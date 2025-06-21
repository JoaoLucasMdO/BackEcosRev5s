import express from "express";
import { connectToDatabase } from "../utils/mongodb.js";
import { check, validationResult } from "express-validator";
import auth from "../middleware/auth.js";
import { isAfter } from "date-fns";
import logger from "../config/logger.js"; // Adicione o logger

const router = express.Router();
const { db, ObjectId } = await connectToDatabase();
const nomeCollection = "beneficio";

const validaBeneficio = [
  check("nome")
    .not()
    .isEmpty()
    .trim()
    .withMessage("É obrigatório informar o nome do benefício")
    .isLength({ min: 5 })
    .withMessage("O nome é muito curto. Mínimo de 5")
    .isLength({ max: 200 })
    .withMessage("O nome é muito longo. Máximo de 200")
    .not()
    .matches(/^\d+$/)
    .withMessage("O nome não pode conter apenas números"),
  check("endereco")
    .notEmpty()
    .withMessage("O endereço é obrigatório")
    .isLength({ min: 5 })
    .withMessage("O endereço é muito curto. Mínimo de 5")
    .isLength({ max: 500 })
    .withMessage("O endereço é muito longo. Máximo de 500")
    .not()
    .matches(/^\s+$/)
    .withMessage("O endereço não pode conter apenas espaços em branco"),
  check("pontos")
    .isNumeric()
    .withMessage("Os pontos devem ser um número")
    .isInt({ min: 0 })
    .withMessage("Os pontos não podem ser negativos"),
  check("data")
    .matches(/^\d{4}-\d{2}-\d{2}$/)
    .withMessage("O formato de data é inválido. Informe yyyy-mm-dd")
    .custom((value, { req }) => {
      if (!isAfter(new Date(value), new Date())) {
        throw new Error("A data deve ser maior do que o dia de hoje");
      }
      return true;
    }),
  check("quantidade")
    .isNumeric()
    .withMessage("A quantidade deve ser um número")
    .isInt({ min: 0 })
    .withMessage("A quantidade não pode ser negativa"),
];

const validaQuantidade = [
  check("quantidade")
    .isInt({ min: 0 })
    .withMessage("A quantidade não pode ser negativa"),
];

// GET todos os benefícios
router.get("/", auth, async (req, res) => {
  const { limit, skip, order } = req.query;
  try {
    const docs = [];
    await db
      .collection(nomeCollection)
      .find()
      .limit(parseInt(limit) || 10)
      .skip(parseInt(skip) || 0)
      .sort({ order: 1 })
      .forEach((doc) => {
        docs.push(doc);
      });
    logger.info({
      message: "Listagem de benefícios consultada",
      quantidade: docs.length,
      rota: "/beneficio"
    });
    res.status(200).json(docs);
  } catch (err) {
    logger.error({
      message: "Erro ao obter a listagem dos benefícios",
      error: err.message,
      rota: "/beneficio"
    });
    res.status(500).json({
      message: "Erro ao obter a listagem dos benefícios",
      error: `${err.message}`,
    });
  }
});

// GET benefícios com filtro gt
router.get("/gt", auth, async (req, res) => {
  const { limit, skip, order } = req.query;
  try {
    const docs = [];
    await db
      .collection(nomeCollection)
      .find({ $or: [{ pontos: { $gt: 200 } }, { pontos: { $lt: 1000 } }] })
      .limit(parseInt(limit) || 10)
      .skip(parseInt(skip) || 0)
      .sort({ order: 1 })
      .forEach((doc) => {
        docs.push(doc);
      });
    logger.info({
      message: "Listagem de benefícios (filtro gt) consultada",
      quantidade: docs.length,
      rota: "/beneficio/gt"
    });
    res.status(200).json(docs);
  } catch (err) {
    logger.error({
      message: "Erro ao obter a listagem dos benefícios (filtro gt)",
      error: err.message,
      rota: "/beneficio/gt"
    });
    res.status(500).json({
      message: "Erro ao obter a listagem dos benefícios",
      error: `${err.message}`,
    });
  }
});

// GET benefício por ID
router.get("/id/:id", auth, async (req, res) => {
  try {
    const docs = [];
    await db
      .collection(nomeCollection)
      .find({ _id: { $eq: new ObjectId(req.params.id) } }, {})
      .forEach((doc) => {
        docs.push(doc);
      });
    logger.info({
      message: "Benefício consultado pelo ID",
      id: req.params.id,
      rota: "/beneficio/id/:id"
    });
    res.status(200).json(docs);
  } catch (err) {
    logger.error({
      message: "Erro ao obter o benefício pelo ID",
      error: err.message,
      id: req.params.id,
      rota: "/beneficio/id/:id"
    });
    res.status(500).json({
      errors: [
        {
          value: `${err.message}`,
          msg: "Erro ao obter o benefício pelo ID",
          param: "/id/:id",
        },
      ],
    });
  }
});

// GET benefício por nome/filtro
router.get("/nome/:filtro", auth, async (req, res) => {
  try {
    const filtro = req.params.filtro.toString();
    const docs = [];
    await db
      .collection(nomeCollection)
      .find({
        $or: [{ nome: { $regex: filtro, $options: "i" } }],
      })
      .forEach((doc) => {
        docs.push(doc);
      });
    logger.info({
      message: "Benefícios consultados por filtro de nome",
      filtro,
      quantidade: docs.length,
      rota: "/beneficio/nome/:filtro"
    });
    res.status(200).json(docs);
  } catch (err) {
    logger.error({
      message: "Erro ao obter o benefício pelo nome",
      error: err.message,
      filtro: req.params.filtro,
      rota: "/beneficio/nome/:filtro"
    });
    res.status(500).json({
      errors: [
        {
          value: `${err.message}`,
          msg: "Erro ao obter o benefícios pelo nome",
          param: "/nome/:filtro",
        },
      ],
    });
  }
});

// DELETE benefício por ID
router.delete("/:id", auth, async (req, res) => {
  try {
    const result = await db.collection(nomeCollection).deleteOne({
      _id: { $eq: new ObjectId(req.params.id) },
    });
    if (result.deletedCount === 0) {
      logger.warn({
        message: "Tentativa de exclusão de benefício não encontrado",
        id: req.params.id,
        rota: "/beneficio/:id"
      });
      res.status(404).json({
        errors: [
          {
            value: `Não há nenhum benefício com o id ${req.params.id}`,
            msg: "Erro ao excluir o benefício",
            param: "/:id",
          },
        ],
      });
    } else {
      logger.info({
        message: "Benefício excluído com sucesso",
        id: req.params.id,
        rota: "/beneficio/:id"
      });
      res.status(200).send(result);
    }
  } catch (err) {
    logger.error({
      message: "Erro ao excluir benefício",
      error: err.message,
      id: req.params.id,
      rota: "/beneficio/:id"
    });
    res.status(500).json({ error: err.message });
  }
});

// POST novo benefício
router.post("/", auth, validaBeneficio, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      logger.warn({
        message: "Falha na validação ao cadastrar benefício",
        errors: errors.array(),
        rota: "/beneficio"
      });
      return res.status(400).json({ errors: errors.array() });
    }
    const beneficio = await db.collection(nomeCollection).insertOne(req.body);
    logger.info({
      message: "Benefício cadastrado com sucesso",
      beneficio: req.body.nome,
      rota: "/beneficio"
    });
    res.status(201).json(beneficio);
  } catch (err) {
    logger.error({
      message: "Erro ao cadastrar benefício",
      error: err.message,
      rota: "/beneficio"
    });
    res.status(500).json({ message: `${err.message} Erro no Server` });
  }
});

// PUT benefício por ID
router.put("/", auth, validaBeneficio, async (req, res) => {
  let idDocumento = req.body._id;
  delete req.body._id;
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      logger.warn({
        message: "Falha na validação ao atualizar benefício",
        errors: errors.array(),
        id: idDocumento,
        rota: "/beneficio"
      });
      return res.status(400).json({ errors: errors.array() });
    }
    const beneficio = await db
      .collection(nomeCollection)
      .updateOne(
        { _id: { $eq: new ObjectId(idDocumento) } },
        { $set: req.body }
      );
    logger.info({
      message: "Benefício atualizado com sucesso",
      id: idDocumento,
      rota: "/beneficio"
    });
    res.status(202).json(beneficio);
  } catch (err) {
    logger.error({
      message: "Erro ao atualizar benefício",
      error: err.message,
      id: idDocumento,
      rota: "/beneficio"
    });
    res.status(500).json({ errors: err.message });
  }
});

// PUT resgate de benefício (atualiza quantidade)
router.put("/resgate", auth, validaQuantidade, async (req, res) => {
  let idDocumento = req.body._id;
  delete req.body._id;
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      logger.warn({
        message: "Falha na validação ao atualizar quantidade do benefício (resgate)",
        errors: errors.array(),
        id: idDocumento,
        rota: "/beneficio/resgate"
      });
      return res.status(400).json({ errors: errors.array() });
    }
    const beneficio = await db
      .collection(nomeCollection)
      .updateOne(
        { _id: { $eq: new ObjectId(idDocumento) } },
        { $set: { quantidade: req.body.quantidade } }
      );
    logger.info({
      message: "Quantidade do benefício atualizada (resgate)",
      id: idDocumento,
      quantidade: req.body.quantidade,
      rota: "/beneficio/resgate"
    });
    res.status(202).json(beneficio);
  } catch (err) {
    logger.error({
      message: "Erro ao atualizar quantidade do benefício (resgate)",
      error: err.message,
      id: idDocumento,
      rota: "/beneficio/resgate"
    });
    res.status(500).json({ errors: err.message });
  }
});

export default router;