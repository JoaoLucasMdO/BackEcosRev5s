import express from "express";
import { connectToDatabase } from "../utils/mongodb.js";
import { check, validationResult } from "express-validator";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import auth from "../middleware/auth.js";
import { sendPasswordResetEmail } from "../utils/emailService.js";
import logger from "../config/logger.js"; // Adicionado logger

const router = express.Router();
const { db, ObjectId } = await connectToDatabase();
const nomeCollection = "usuarios";

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
    .custom((value, { req }) => {
      return db
        .collection(nomeCollection)
        .find({ email: { $eq: value } })
        .toArray()
        .then((email) => {
          if (email.length && !req.params.id) {
            return Promise.reject(`o email ${value} já existe!`);
          }
        });
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

//POST de Usuário
router.post("/", validaUsuario, async (req, res) => {
  /*
    #swagger.tags = ['Usuário']
    #swagger.summary = 'Post para cadastrar usuário'
    #swagger.description = 'Função chamada para executar o POST do usuário com suas devidas validações'
    #swagger.security = [{
            "apiKeyAuth": []
        }]
  */
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
  } else {
    try {
      const salt = await bcrypt.genSalt(10);
      req.body.senha = await bcrypt.hash(req.body.senha, salt);
      const result = await db
        .collection(nomeCollection)
        .insertOne(req.body);
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
      res.status(400).json(err);
    }
  }
});

// GET Usuário
router.get("/", auth, async (req, res) => {
  /*
    #swagger.tags = ['Usuário']
    #swagger.summary = 'GET recebendo todos usuários'
    #swagger.description = 'Função chamada para executar o GET com todos usuário'
    #swagger.security = [{
            "apiKeyAuth": []
        }]
  */
  try {
    const docs = [];
    await db
      .collection(nomeCollection)
      .find({}, { senha: 0 })
      .sort({ nome: 1 })
      .forEach((doc) => {
        docs.push(doc);
      });
    logger.info({
      message: "Listagem de usuários consultada",
      quantidade: docs.length,
      rota: "/usuario"
    });
    res.status(200).json(docs);
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

router.get("/id/:id", auth, async (req, res) => {
  try {
    /*
      #swagger.tags = ['Usuário']
      #swagger.summary = 'GET recebendo usuário pelo ID'
      #swagger.description = 'Função chamada para executar o GET com o ID de um usuário específico'
      #swagger.security = [{
              "apiKeyAuth": []
          }]
    */
    const docs = [];
    await db
      .collection(nomeCollection)
      .find({ _id: { $eq: new ObjectId(req.params.id) } }, {})
      .forEach((doc) => {
        docs.push(doc);
      });
    logger.info({
      message: "Usuário consultado pelo ID",
      id: req.params.id,
      rota: "/usuario/id/:id"
    });
    res.status(200).json(docs);
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

router.get("/pontos", auth, async (req, res) => {
  /*
    #swagger.tags = ['Usuário']
    #swagger.summary = 'GET recebendo os pontos do usuário'
    #swagger.description = 'Função chamada para executar o GET com a pontuação do usuário'
    #swagger.security = [{
            "apiKeyAuth": []
        }]
  */
  try {
    const docs = [];
    await db
      .collection(nomeCollection)
      .find({ _id: { $eq: new ObjectId(req.usuario.id) } }, {})
      .forEach((doc) => {
        docs.push(doc);
      });
    logger.info({
      message: "Consulta de pontos do usuário",
      id: req.usuario.id,
      rota: "/usuario/pontos"
    });
    res.status(200).json(docs);
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

router.post("/login", validaLogin, async (req, res) => {
  /*
    #swagger.tags = ['Usuário']
    #swagger.summary = 'POST executando o Login do usuário'
    #swagger.description = 'Função chamada para executar o POST do usuário com suas devidas verificações'
    #swagger.security = [{
            "apiKeyAuth": []
        }]
  */
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
    let usuario = await db
      .collection(nomeCollection)
      .find({ email })
      .limit(1)
      .toArray();
    if (!usuario.length) {
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
    const isMatch = await bcrypt.compare(senha, usuario[0].senha);
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
      usuario[0].tipo === "Admin" ? "menu.html" : "menuUser.html";
    jwt.sign(
      { usuario: { id: usuario[0]._id, tipo: usuario[0].tipo } },
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
          tipo: usuario[0].tipo,
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

router.put("/pontos", auth, validaPontos, async (req, res) => {
  /*
    #swagger.tags = ['Usuário']
    #swagger.summary = 'PUT recebendo a pontuação do usuário'
    #swagger.description = 'Função chamada para executar o PUT com a pontuação do usuário a ser modificada'
    #swagger.security = [{
            "apiKeyAuth": []
        }]
  */
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
    const usuario = await db
      .collection(nomeCollection)
      .updateOne(
        { _id: { $eq: new ObjectId(idDocumento) } },
        { $set: { pontos: req.body.pontos } }
      );
    logger.info({
      message: "Pontos do usuário atualizados",
      id: idDocumento,
      pontos: req.body.pontos,
      rota: "/usuario/pontos"
    });
    res.status(202).json(usuario);
  } catch (err) {
    logger.error({
      message: "Erro ao atualizar pontos do usuário",
      error: err.message,
      rota: "/usuario/pontos"
    });
    res.status(500).json({ errors: err.message });
  }
});

router.put("/pontosPut", auth, validaPontos, async (req, res) => {
  /*
    #swagger.tags = ['Usuário']
    #swagger.summary = 'PUT recebendo a pontuação do usuário'
    #swagger.description = 'Função chamada para executar o PUT com a pontuação do usuário afim de ser modificada na pagina de transação'
    #swagger.security = [{
            "apiKeyAuth": []
        }]
  */
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
    const usuario = await db
      .collection(nomeCollection)
      .updateOne(
        { _id: { $eq: new ObjectId(idDocumento) } },
        { $set: { pontos: req.body.pontos } }
      );
    logger.info({
      message: "Pontos do usuário atualizados (pontosPut)",
      id: idDocumento,
      pontos: req.body.pontos,
      rota: "/usuario/pontosPut"
    });
    res.status(202).json(usuario);
  } catch (err) {
    logger.error({
      message: "Erro ao atualizar pontos do usuário (pontosPut)",
      error: err.message,
      rota: "/usuario/pontosPut"
    });
    res.status(500).json({ errors: err.message });
  }
});

router.delete("/:id", auth, async (req, res) => {
  /*
    #swagger.tags = ['Usuarios']
    #swagger.summary = 'DELETE recebendo um usuario pelo ID'
    #swagger.description = 'Função chamada para executar o DELETE de apenas um usuário pelo seu ID'
    #swagger.security = [{
            "apiKeyAuth": []
        }]
  */
  try {
    const result = await db.collection(nomeCollection).deleteOne({
      _id: { $eq: new ObjectId(req.params.id) },
    });
    if (result.deletedCount === 0) {
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
      res.status(200).send(result);
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

router.get("/me", auth, async (req, res) => {
  /*
    #swagger.tags = ['Usuário']
    #swagger.summary = 'GET do usuário logado'
    #swagger.description = 'Retorna os dados do usuário autenticado pelo token JWT'
    #swagger.security = [{
            "apiKeyAuth": []
        }]
  */
  try {
    const usuario = await db
      .collection(nomeCollection)
      .findOne({ _id: new ObjectId(req.usuario.id) }, { projection: { senha: 0 } });

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
    const usuario = await db.collection(nomeCollection).findOne({ _id: new ObjectId(userId) });
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

    await db.collection(nomeCollection).updateOne(
      { _id: new ObjectId(userId) },
      { $set: { senha: senhaHash } }
    );

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

router.post("/forgot-password", [
  check("email")
    .not()
    .isEmpty()
    .trim()
    .withMessage("É obrigatório informar o email")
    .isEmail()
    .withMessage("Informe um email válido")
], async (req, res) => {
  /*
    #swagger.tags = ['Usuário']
    #swagger.summary = 'POST para solicitação de recuperação de senha'
    #swagger.description = 'Função que envia uma senha temporária para o email do usuário usando Gmail'
  */
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
    const usuario = await db.collection(nomeCollection).findOne({ email });
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

    await db.collection(nomeCollection).updateOne(
      { _id: usuario._id },
      { $set: { 
        senha: hashedPassword,
        resetPasswordToken: true,
        resetPasswordExpires: expiracao
      }}
    );

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
  /*
    #swagger.tags = ['Usuário']
    #swagger.summary = 'POST para alterar senha após recuperação'
    #swagger.description = 'Função para definir nova senha após login com senha temporária'
    #swagger.security = [{
      "apiKeyAuth": []
    }]
  */
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
    const usuario = await db.collection(nomeCollection).findOne({ _id: new ObjectId(userId) });
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

    await db.collection(nomeCollection).updateOne(
      { _id: new ObjectId(userId) },
      { 
        $set: { senha: hashedPassword },
        $unset: { resetPasswordToken: "", resetPasswordExpires: "" }
      }
    );

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