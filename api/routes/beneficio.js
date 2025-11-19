//beneficio.js
import express from "express";
import { check, validationResult } from "express-validator";
import auth from "../middleware/auth.js";
import { isAfter } from "date-fns";
import {
  findAllBeneficios,
  findBeneficiosGt,
  findBeneficioById,
  findBeneficioByNome,
  deleteBeneficioById,
  insertBeneficio,
  updateBeneficio,
  updateBeneficioQuantidade
} from "../utils/beneficioDb.js";

const router = express.Router();

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
    const docs = await findAllBeneficios({
      limit: limit || 10,
      skip: skip || 0,
      order: order || "id"
    });
    res.status(200).json(docs);
  } catch (err) {
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
    const docs = await findBeneficiosGt({
      limit: limit || 10,
      skip: skip || 0,
      order: order || "id"
    });
    res.status(200).json(docs);
  } catch (err) {
    res.status(500).json({
      message: "Erro ao obter a listagem dos benefícios",
      error: `${err.message}`,
    });
  }
});

// GET benefício por ID
router.get("/id/:id", auth, async (req, res) => {
  try {
    const doc = await findBeneficioById(req.params.id);
    if (!doc) {
      return res.status(404).json({ msg: "Benefício não encontrado" });
    }
    res.status(200).json(doc);
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

// GET benefício por nome/filtro
router.get("/nome/:filtro", auth, async (req, res) => {
  try {
    const filtro = req.params.filtro.toString();
    const docs = await findBeneficioByNome(filtro);
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

// DELETE benefício por ID
router.delete("/:id", auth, async (req, res) => {
  try {
    const result = await deleteBeneficioById(req.params.id);
    if (result.affectedRows === 0) {
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
      res.status(200).send({ msg: "Benefício excluído com sucesso" });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST novo benefício
router.post("/", auth, validaBeneficio, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    const result = await insertBeneficio(req.body);
    res.status(201).json(result);
  } catch (err) {
    res.status(500).json({ message: `${err.message} Erro no Server` });
  }
});

// PUT benefício por ID
router.put("/", auth, validaBeneficio, async (req, res) => {
  let idDocumento = req.body.id;
  delete req.body.id;
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    const result = await updateBeneficio(idDocumento, req.body);
    res.status(202).json(result);
  } catch (err) {
    res.status(500).json({ errors: err.message });
  }
});

// PUT resgate de benefício (atualiza quantidade)
router.put("/resgate", auth, validaQuantidade, async (req, res) => {
  let idDocumento = req.body.id;
  delete req.body.id;
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    const result = await updateBeneficioQuantidade(idDocumento, req.body.quantidade);
    res.status(202).json(result);
  } catch (err) {
    res.status(500).json({ errors: err.message });
  }
});

export default router;