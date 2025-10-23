import express from "express";
import multer from "multer";
import { CloudinaryStorage } from "multer-storage-cloudinary";
import cloudinary from "../config/cloudinary.js";
import { insertImage, findImageById, deleteImageById } from "../utils/uploadDb.js";
import auth from "../middleware/auth.js"; // proteger rota e atrelarmos ao usuário autenticado

const router = express.Router();

const storage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: "ecosrev/imgPerfilUsuario",
    allowed_formats: ["jpg", "jpeg", "png", "webp"],
    transformation: [{ width: 1600, crop: "limit" }],
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
});

// POST /image - envia um arquivo no campo 'image' e salva metadados no MySQL
// Rota protegida: associa o upload ao usuário autenticado
router.post("/image", auth, upload.single("image"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "Nenhuma imagem enviada" });
    }

    const userId = req.usuario.id;

    const meta = {
      url: req.file.path,
      public_id: req.file.filename,
      originalname: req.file.originalname,
      mimetype: req.file.mimetype,
      size: req.file.size,
      created_at: new Date(),
      idUsuario: userId,
    };

    const result = await insertImage(meta);

  // Não atualizamos a tabela `usuarios` — usamos apenas a FK em `imgPerfilUsuario` para associar o avatar.
    res.status(201).json({ id: result.insertId, ...meta });
  } catch (err) {
    res.status(500).json({ error: "Erro ao enviar imagem", details: err.message });
  }
});

// GET /:id - busca metadados pelo id do registro (não pelo public_id)
router.get("/:id", async (req, res) => {
  try {
    const row = await findImageById(req.params.id);
    if (!row) return res.status(404).json({ error: "Registro não encontrado" });
    res.status(200).json(row);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /:id - remove registro do banco e também o arquivo do Cloudinary
router.delete("/:id", async (req, res) => {
  try {
    const id = req.params.id;
    const row = await findImageById(id);
    if (!row) {
      return res.status(404).json({ error: "Registro não encontrado" });
    }

    // Remove do Cloudinary usando public_id
    try {
      if (row.public_id) {
        await cloudinary.uploader.destroy(row.public_id);
      }
    } catch (cloudErr) {
      // Log do erro e continua para tentar remover metadados do DB
      console.error("Erro ao remover do Cloudinary:", cloudErr);
      return res.status(500).json({ error: "Erro ao remover arquivo do Cloudinary", details: cloudErr.message });
    }

    const result = await deleteImageById(id);
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Registro não encontrado ao tentar excluir do DB" });
    }

    res.status(200).json({ msg: "Arquivo e metadados excluídos com sucesso" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
