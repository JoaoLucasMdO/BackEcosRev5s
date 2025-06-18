import express from "express";
import { connectToDatabase } from "../utils/mongodb.js";
import { check, validationResult } from "express-validator";
import auth from "../middleware/auth.js";
import { isAfter } from "date-fns";

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

/**
 * GET /api/beneficios
 * Lista todos os benefícios
 * Parâmetros: limit, skip e order
 */
router.get("/", auth, async (req, res) => {
  /*
            #swagger.tags = ['Benefícios']
            #swagger.summary = 'GET recebendo todos os benefícios'
            #swagger.description = 'Função chamada para executar o GET com todos os benefícios a ser exibido'
            #swagger.security = [{
                    "apiKeyAuth": []
                }]
        */
  const { limit, skip, order } = req.query; //Obter da URL
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
    res.status(200).json(docs);
  } catch (err) {
    res.status(500).json({
      message: "Erro ao obter a listagem dos benefícios",
      error: `${err.message}`,
    });
  }
});

router.get("/gt", auth, async (req, res) => {
  /*
            #swagger.tags = ['Benefícios']
            #swagger.summary = 'GET recebendo todos os benefícios com filtros'
            #swagger.description = 'Função chamada para executar o GET com todos os benefícios a ser exibido utilizando um filtro'
            #swagger.security = [{
                    "apiKeyAuth": []
                }]
        */
  const { limit, skip, order } = req.query; //Obter da URL
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
    res.status(200).json(docs);
  } catch (err) {
    res.status(500).json({
      message: "Erro ao obter a listagem dos benefícios",
      error: `${err.message}`,
    });
  }
});

/**
 * GET /api/beneficios/id/:id
 * Lista o benefício pelo id
 * Parâmetros: id
 */
router.get("/id/:id", auth, async (req, res) => {
  /*
            #swagger.tags = ['Benefícios']
            #swagger.summary = 'GET recebendo um benefício pelo ID'
            #swagger.description = 'Função chamada para executar o GET exibindo apenas um único benefício pelo seu ID'
            #swagger.security = [{
                    "apiKeyAuth": []
                }]
        */
  try {
    const docs = [];
    await db
      .collection(nomeCollection)
      .find({ _id: { $eq: new ObjectId(req.params.id) } }, {})
      .forEach((doc) => {
        docs.push(doc);
      });
    res.status(200).json(docs);
  } catch (err) {
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
/**
 * GET /api/beneficios/razao/:filtor
 * Lista o benefício pelo nome
 * Parâmetros: filtro
 */
router.get("/nome/:filtro", auth, async (req, res) => {
  /*
            #swagger.tags = ['Benefícios']
            #swagger.summary = 'GET recebendo todos os benefícios com filtros'
            #swagger.description = 'Função chamada para executar o GET com todos os benefícios a ser exibido utilizando um filtro'
            #swagger.security = [{
                    "apiKeyAuth": []
                }]
        */
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
    res.status(200).json(docs);
  } catch (err) {
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
/**
 * DELETE /api/beneficios/:id
 * Remove os benefícios pelo id
 * Parâmetros: id
 */
router.delete("/:id", auth, async (req, res) => {
  /*
            #swagger.tags = ['Benefícios']
            #swagger.summary = 'DELETE recebendo um benefício pelo ID'
            #swagger.description = 'Função chamada para executar o DELETE de apenas um benefício pelo seu ID'
            #swagger.security = [{
                    "apiKeyAuth": []
                }]
        */
  const result = await db.collection(nomeCollection).deleteOne({
    _id: { $eq: new ObjectId(req.params.id) },
  });
  if (result.deletedCount === 0) {
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
    res.status(200).send(result);
  }
});

/**
 * POST /api/beneficios
 * Insere um novo benefício
 * Parâmetros: Objeto benefício
 */

router.post("/", auth, validaBeneficio, async (req, res) => {
  /*
            #swagger.tags = ['Benefícios']
            #swagger.summary = 'POST para cadastrar um novo benefício'
            #swagger.description = 'Função chamada para executar o POST adicionando um novo benefício'
            #swagger.security = [{
                    "apiKeyAuth": []
                }]
        */
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    const beneficio = await db.collection(nomeCollection).insertOne(req.body);
    res.status(201).json(beneficio); //201 é o status created
  } catch (err) {
    res.status(500).json({ message: `${err.message} Erro no Server` });
  }
});
/**
 * PUT /api/beneficios
 * Altera um benefício pelo _id
 * Parâmetros: Objeto benefício
 */
router.put("/", auth, validaBeneficio, async (req, res) => {
  /*
            #swagger.tags = ['Benefícios']
            #swagger.summary = 'PUT recebendo um único beneficio pelo ID a ser modificado'
            #swagger.description = 'Função chamada para executar o PUT com um único benefício a ser modificado pelo seu ID'
            #swagger.security = [{
                    "apiKeyAuth": []
                }]
        */
  let idDocumento = req.body._id; //armazenamos o _id do documento
  delete req.body._id; //removemos o _id do body que foi recebido na req.
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    const beneficio = await db
      .collection(nomeCollection)
      .updateOne(
        { _id: { $eq: new ObjectId(idDocumento) } },
        { $set: req.body }
      );
    res.status(202).json(beneficio); //Accepted
  } catch (err) {
    res.status(500).json({ errors: err.message });
  }
});

router.put("/resgate", auth, validaQuantidade, async (req, res) => {
  /*
            #swagger.tags = ['Benefícios']
            #swagger.summary = 'PUT recebendo o ID do benefício no qual será alterado pelo resgate'
            #swagger.description = 'Função chamada para executar o PUT com um benefício específico a ser modificado pelo resgate do mesmo'
            #swagger.security = [{
                    "apiKeyAuth": []
                }]
        */
  let idDocumento = req.body._id; //armazenamos o _id do documento
  delete req.body._id; //removemos o _id do body que foi recebido na req.
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    const beneficio = await db
      .collection(nomeCollection)
      .updateOne(
        { _id: { $eq: new ObjectId(idDocumento) } },
        { $set: { quantidade: req.body.quantidade } }
      );
    res.status(202).json(beneficio); //Accepted
  } catch (err) {
    res.status(500).json({ errors: err.message });
  }
});
export default router;
