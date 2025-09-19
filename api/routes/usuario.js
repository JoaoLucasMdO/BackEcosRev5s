import express from "express";
import { check, validationResult } from "express-validator";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import auth from "../middleware/auth.js";
import { sendPasswordResetEmail } from "../utils/emailService.js";
import logger from "../config/logger.js";
import {
  findUserByEmail,
  insertUser,
  findAllUsers,
  findUserById,
  findUserPointsById,
  updateUserPoints,
  deleteUserById,
  updateUserPassword,
  findUserForLogin,
  setTemporaryPassword,
  findUserForPasswordReset,
  clearPasswordResetToken,
  findUserMe
} from "../utils/usuarioDb.js";

const router = express.Router();

/************
* VALIDAÇÕES DO USUÁRIO
/***********/
const validaUsuario = [
  check("nome")
    .not()
    .isEmpty()
    .trim()
    .withMessage("É obrigatório informar o nome")
    .isAlpha("pt-BR", { ignore: " " })
    .withMessage("Informe apenas texto")
    .isLength({ min: 3 })
    .withMessage("Informe no mínimo 3 caracteres")
    .isLength({ max: 100 })
    .withMessage("Informe no máximo 100 caracteres")
    .not()
    .matches(/^\d+$/)
    .withMessage("O nome não pode conter apenas números"),
  check("email")
    .not()
    .isEmpty()
    .trim()
    .withMessage("É obrigatório informar o email")
    .isLowercase()
    .withMessage("Não são permitidas maiúsculas")
    .isEmail()
    .withMessage("Informe um email válido")
    .custom(async (value, { req }) => {
      const user = await findUserByEmail(value);
      if (user && !req.params.id) {
        return Promise.reject(`o email ${value} já existe!`);
      }
    }),
  check("senha")
    .not()
    .isEmpty()
    .trim()
    .withMessage("A senha é obrigatória")
    .isLength({ min: 6 })
    .withMessage("A senha deve ter no mínimo 6 carac.")
    .isStrongPassword({
      minLength: 6,
      minLowercase: 1,
      minUppercase: 1,
      minSymbols: 1,
      minNumbers: 1,
    })
    .withMessage(
      "A senha não é segura. Informe no mínimo 1 caractere maiúsculo, 1 minúsculo, 1 número e 1 caractere especial"
    ),
  check("ativo")
    .default(true)
    .isBoolean()
    .withMessage("O valor deve ser um booleano"),
  check("tipo")
    .default("Cliente")
    .isIn(["Admin", "Cliente"])
    .withMessage("O tipo deve ser Admin ou Cliente"),
  check("pontos")
    .default(200),
];

const validaPontos = [
  check("pontos")
    .isInt({ min: 0 })
    .withMessage("Os pontos não podem ser negativos"),
];

// POST de Usuário
router.post("/", validaUsuario, async (req, res) => {
  const schemaErrors = validationResult(req);
  if (!schemaErrors.isEmpty()) {
    logger.warn({
      message: "Falha na validação ao cadastrar usuário",
      errors: schemaErrors.array(),
      rota: "/usuario"
    });
    return res.status(403).json({
      errors: schemaErrors.array(),
    });
  }
  try {
    const salt = await bcrypt.genSalt(10);
    req.body.senha = await bcrypt.hash(req.body.senha, salt);
    const result = await insertUser(req.body);
    logger.info({
      message: "Usuário cadastrado com sucesso",
      usuario: req.body.email,
      rota: "/usuario"
    });
    res.status(201).send(result);
  } catch (err) {
    logger.error({
      message: "Erro ao cadastrar usuário",
      error: err.message,
      rota: "/usuario"
    });
    res.status(400).json({ error: err.message });
  }
});

// GET Usuário
router.get("/", auth, async (req, res) => {
  try {
    const users = await findAllUsers();
    logger.info({
      message: "Listagem de usuários consultada",
      quantidade: users.length,
      rota: "/usuario"
    });
    res.status(200).json(users);
  } catch (err) {
    logger.error({
      message: "Erro ao obter a listagem dos usuários",
      error: err.message,
      rota: "/usuario"
    });
    res.status(500).json({
      message: "Erro ao obter a listagem dos usuários",
      error: `${err.message}`,
    });
  }
});

// GET Usuário por ID
router.get("/id/:id", auth, async (req, res) => {
  try {
    const user = await findUserById(req.params.id);
    if (!user) {
      logger.warn({
        message: "Usuário não encontrado pelo ID",
        id: req.params.id,
        rota: "/usuario/id/:id"
      });
      return res.status(404).json({ msg: "Usuário não encontrado" });
    }
    logger.info({
      message: "Usuário consultado pelo ID",
      id: req.params.id,
      rota: "/usuario/id/:id"
    });
    res.status(200).json(user);
  } catch (err) {
    logger.error({
      message: "Erro ao obter o usuário pelo ID",
      error: err.message,
      rota: "/usuario/id/:id"
    });
    res.status(500).json({
      errors: [
        {
          value: `${err.message}`,
          msg: "Erro ao obter o usuário pelo ID",
          param: "/id/:id",
        },
      ],
    });
  }
});

const validaLogin = [
  check("email")
    .not()
    .isEmpty()
    .trim()
    .withMessage("O email é obrigatório")
    .isEmail()
    .withMessage("Informe um email válido para o login"),
  check("senha").not().isEmpty().trim().withMessage("A senha é obrigatória"),
];

// GET Pontos do usuário autenticado
router.get("/pontos", auth, async (req, res) => {
  try {
    const pontos = await findUserPointsById(req.usuario.id);
    logger.info({
      message: "Consulta de pontos do usuário",
      id: req.usuario.id,
      rota: "/usuario/pontos"
    });
    res.status(200).json(pontos);
  } catch (err) {
    logger.error({
      message: "Erro ao obter a listagem dos pontos do usuário",
      error: err.message,
      rota: "/usuario/pontos"
    });
    res.status(500).json({
      message: "Erro ao obter a listagem dos pontos do usuário",
      error: `${err.message}`,
    });
  }
});

// POST Login
router.post("/login", validaLogin, async (req, res) => {
  const schemaErrors = validationResult(req);
  if (!schemaErrors.isEmpty()) {
    logger.warn({
      message: "Falha na validação ao fazer login",
      errors: schemaErrors.array(),
      rota: "/usuario/login"
    });
    return res.status(403).json({ errors: schemaErrors.array() });
  }
  const { email, senha } = req.body;
  try {
    const usuario = await findUserForLogin(email);
    if (!usuario) {
      logger.warn({
        message: "Tentativa de login com email não cadastrado",
        email,
        rota: "/usuario/login"
      });
      return res.status(404).json({
        errors: [
          {
            value: `${email}`,
            msg: `O email ${email} não está cadastrado!`,
            param: "email",
          },
        ],
      });
    }
    const isMatch = await bcrypt.compare(senha, usuario.senha);
    if (!isMatch) {
      logger.warn({
        message: "Tentativa de login com senha incorreta",
        email,
        rota: "/usuario/login"
      });
      return res.status(403).json({
        errors: [
          {
            value: "senha",
            msg: "A senha informada está incorreta ",
            param: "senha",
          },
        ],
      });
    }
    const redirectUrl =
      usuario.tipo === "Admin" ? "menu.html" : "menuUser.html";
    jwt.sign(
      { usuario: { id: usuario.id, tipo: usuario.tipo } },
      process.env.SECRET_KEY,
      { expiresIn: process.env.EXPIRES_IN },
      (err, token) => {
        if (err) {
          logger.error({
            message: "Erro ao gerar token JWT no login",
            error: err.message,
            rota: "/usuario/login"
          });
          throw err;
        }
        logger.info({
          message: "Login realizado com sucesso",
          email,
          tipo: usuario.tipo,
          rota: "/usuario/login"
        });
        res.status(200).json({
          access_token: token,
          redirect_url: redirectUrl,
        });
      }
    );
  } catch (e) {
    logger.error({
      message: "Erro ao realizar login",
      error: e.message,
      rota: "/usuario/login"
    });
    res.status(500).json({ error: "Erro ao realizar login", details: e.message });
  }
});

// PUT Pontos do usuário autenticado
router.put("/pontos", auth, validaPontos, async (req, res) => {
  let idDocumento = req.usuario.id;
  delete req.body._id;
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      logger.warn({
        message: "Falha na validação ao atualizar pontos",
        errors: errors.array(),
        rota: "/usuario/pontos"
      });
      return res.status(400).json({ errors: errors.array() });
    }
    await updateUserPoints(idDocumento, req.body.pontos);
    logger.info({
      message: "Pontos do usuário atualizados",
      id: idDocumento,
      pontos: req.body.pontos,
      rota: "/usuario/pontos"
    });
    res.status(202).json({ msg: "Pontos atualizados com sucesso" });
  } catch (err) {
    logger.error({
      message: "Erro ao atualizar pontos do usuário",
      error: err.message,
      rota: "/usuario/pontos"
    });
    res.status(500).json({ errors: err.message });
  }
});

// PUT Pontos por ID (transação)
router.put("/pontosPut", auth, validaPontos, async (req, res) => {
  let idDocumento = req.body._id;
  delete req.body._id;
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      logger.warn({
        message: "Falha na validação ao atualizar pontos (pontosPut)",
        errors: errors.array(),
        rota: "/usuario/pontosPut"
      });
      return res.status(400).json({ errors: errors.array() });
    }
    await updateUserPoints(idDocumento, req.body.pontos);
    logger.info({
      message: "Pontos do usuário atualizados (pontosPut)",
      id: idDocumento,
      pontos: req.body.pontos,
      rota: "/usuario/pontosPut"
    });
    res.status(202).json({ msg: "Pontos atualizados com sucesso" });
  } catch (err) {
    logger.error({
      message: "Erro ao atualizar pontos do usuário (pontosPut)",
      error: err.message,
      rota: "/usuario/pontosPut"
    });
    res.status(500).json({ errors: err.message });
  }
});

// DELETE Usuário por ID
router.delete("/:id", auth, async (req, res) => {
  try {
    const result = await deleteUserById(req.params.id);
    if (result.affectedRows === 0) {
      logger.warn({
        message: "Tentativa de exclusão de usuário não encontrado",
        id: req.params.id,
        rota: "/usuario/:id"
      });
      res.status(404).json({
        errors: [
          {
            value: `Não há nenhum usuário com o id ${req.params.id}`,
            msg: "Erro ao excluir o usuário",
            param: "/:id",
          },
        ],
      });
    } else {
      logger.info({
        message: "Usuário excluído com sucesso",
        id: req.params.id,
        rota: "/usuario/:id"
      });
      res.status(200).send({ msg: "Usuário excluído com sucesso" });
    }
  } catch (err) {
    logger.error({
      message: "Erro ao excluir usuário",
      error: err.message,
      id: req.params.id,
      rota: "/usuario/:id"
    });
    res.status(500).json({ error: err.message });
  }
});

// GET Usuário autenticado
router.get("/me", auth, async (req, res) => {
  try {
    const usuario = await findUserMe(req.usuario.id);
    if (!usuario) {
      logger.warn({
        message: "Usuário logado não encontrado",
        id: req.usuario.id,
        rota: "/usuario/me"
      });
      return res.status(404).json({ msg: "Usuário não encontrado" });
    }
    logger.info({
      message: "Consulta de dados do usuário logado",
      id: req.usuario.id,
      rota: "/usuario/me"
    });
    res.status(200).json(usuario);
  } catch (err) {
    logger.error({
      message: "Erro ao buscar dados do usuário logado",
      error: err.message,
      id: req.usuario.id,
      rota: "/usuario/me"
    });
    res.status(500).json({
      msg: "Erro ao buscar dados do usuário logado",
      error: err.message,
    });
  }
});

// PUT Senha do usuário autenticado
router.put("/senha", auth, [
  check("senhaAtual").notEmpty().withMessage("A senha atual é obrigatória"),
  check("novaSenha")
    .notEmpty()
    .withMessage("A nova senha é obrigatória")
    .isLength({ min: 6 })
    .withMessage("A senha deve ter no mínimo 6 caracteres")
    .isStrongPassword({
      minLength: 6,
      minLowercase: 1,
      minUppercase: 1,
      minNumbers: 1,
      minSymbols: 1,
    })
    .withMessage("A senha deve conter pelo menos uma letra maiúscula, uma minúscula, um número e um símbolo")
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    logger.warn({
      message: "Falha na validação ao atualizar senha",
      errors: errors.array(),
      rota: "/usuario/senha"
    });
    return res.status(400).json({ errors: errors.array() });
  }

  const { senhaAtual, novaSenha } = req.body;
  const userId = req.usuario.id;

  try {
    const usuario = await findUserById(userId);
    if (!usuario) {
      logger.warn({
        message: "Usuário não encontrado ao tentar atualizar senha",
        id: userId,
        rota: "/usuario/senha"
      });
      return res.status(404).json({ msg: "Usuário não encontrado" });
    }

    const senhaCorreta = await bcrypt.compare(senhaAtual, usuario.senha);
    if (!senhaCorreta) {
      logger.warn({
        message: "Senha atual incorreta ao tentar atualizar senha",
        id: userId,
        rota: "/usuario/senha"
      });
      return res.status(403).json({ msg: "Senha atual incorreta" });
    }

    const salt = await bcrypt.genSalt(10);
    const senhaHash = await bcrypt.hash(novaSenha, salt);

    await updateUserPassword(userId, senhaHash);

    logger.info({
      message: "Senha atualizada com sucesso",
      id: userId,
      rota: "/usuario/senha"
    });
    res.status(200).json({ msg: "Senha atualizada com sucesso" });
  } catch (err) {
    logger.error({
      message: "Erro ao atualizar a senha",
      error: err.message,
      id: userId,
      rota: "/usuario/senha"
    });
    res.status(500).json({ msg: "Erro ao atualizar a senha", error: err.message });
  }
});

// POST Recuperação de senha
router.post("/forgot-password", [
  check("email")
    .not()
    .isEmpty()
    .trim()
    .withMessage("É obrigatório informar o email")
    .isEmail()
    .withMessage("Informe um email válido")
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    logger.warn({
      message: "Falha na validação ao solicitar recuperação de senha",
      errors: errors.array(),
      rota: "/usuario/forgot-password"
    });
    return res.status(400).json({ errors: errors.array() });
  }

  const { email } = req.body;

  try {
    const usuario = await findUserForPasswordReset(email);
    if (!usuario) {
      logger.warn({
        message: "Email não encontrado ao solicitar recuperação de senha",
        email,
        rota: "/usuario/forgot-password"
      });
      return res.status(404).json({
        success: false,
        message: 'Email não encontrado no sistema.'
      });
    }

    const tempPassword = Math.random().toString(36).slice(-8);
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(tempPassword, salt);
    const expiracao = new Date();
    expiracao.setHours(expiracao.getHours() + 1);

    await setTemporaryPassword(email, hashedPassword, expiracao);

    try {
      await sendPasswordResetEmail(email, tempPassword);
      logger.info({
        message: "Senha temporária enviada por email",
        email,
        rota: "/usuario/forgot-password"
      });
      res.status(200).json({
        success: true,
        message: 'Um email com instruções de recuperação de senha foi enviado para o seu endereço de email.'
      });
    } catch (emailError) {
      logger.error({
        message: "Erro ao enviar email de recuperação de senha",
        error: emailError.message,
        email,
        rota: "/usuario/forgot-password"
      });
      res.status(200).json({
        success: true,
        message: 'Um email com instruções de recuperação de senha foi enviado para o seu endereço de email.'
      });
    }
  } catch (err) {
    logger.error({
      message: "Erro ao processar solicitação de recuperação de senha",
      error: err.message,
      email,
      rota: "/usuario/forgot-password"
    });
    res.status(500).json({
      success: false,
      message: 'Ocorreu um erro ao processar sua solicitação. Por favor, tente novamente mais tarde.'
    });
  }
});

// POST Reset de senha após recuperação
router.post("/reset-password", auth, [
  check("novaSenha")
    .not()
    .isEmpty()
    .trim()
    .withMessage("A nova senha é obrigatória")
    .isLength({ min: 6 })
    .withMessage("A nova senha deve ter no mínimo 6 caracteres")
    .isStrongPassword({
      minLength: 6,
      minLowercase: 1,
      minUppercase: 1,
      minSymbols: 1,
      minNumbers: 1,
    })
    .withMessage("A senha não é segura. Informe no mínimo 1 caractere maiúsculo, 1 minúsculo, 1 número e 1 caractere especial")
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    logger.warn({
      message: "Falha na validação ao redefinir senha",
      errors: errors.array(),
      rota: "/usuario/reset-password"
    });
    return res.status(400).json({ errors: errors.array() });
  }

  const { novaSenha } = req.body;
  const userId = req.usuario.id;

  try {
    const usuario = await findUserById(userId);
    if (!usuario) {
      logger.warn({
        message: "Usuário não encontrado ao redefinir senha",
        id: userId,
        rota: "/usuario/reset-password"
      });
      return res.status(404).json({ msg: "Usuário não encontrado" });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(novaSenha, salt);

    await clearPasswordResetToken(userId, hashedPassword);

    logger.info({
      message: "Senha redefinida com sucesso",
      id: userId,
      rota: "/usuario/reset-password"
    });
    res.status(200).json({ msg: "Senha alterada com sucesso" });

  } catch (err) {
    logger.error({
      message: "Erro ao redefinir a senha",
      error: err.message,
      id: userId,
      rota: "/usuario/reset-password"
    });
    res.status(500).json({
      msg: "Erro ao redefinir a senha",
      error: err.message
    });
  }
});

export default router;