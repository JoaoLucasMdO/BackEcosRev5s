import { promisePool } from "../config/db.js";

// Insere metadados da imagem no banco (tabela 'imgPerfilUsuario')
export async function insertImage(meta) {
  const { url, public_id, originalname, mimetype, size, created_at = null } = meta;
  const [result] = await promisePool.query(
    `INSERT INTO imgPerfilUsuario (url, public_id, originalname, mimetype, size, created_at) VALUES (?, ?, ?, ?, ?, ?)`,
    [url, public_id, originalname, mimetype, size, created_at]
  );
  return { insertId: result.insertId };
}

export async function findImageById(id) {
  const [rows] = await promisePool.query(
    `SELECT id, url, public_id, originalname, mimetype, size, created_at FROM imgPerfilUsuario WHERE id = ?`,
    [id]
  );
  return rows[0];
}

export async function deleteImageById(id) {
  const [result] = await promisePool.query(
    `DELETE FROM imgPerfilUsuario WHERE id = ?`,
    [id]
  );
  return result;
}

// Atualiza os metadados de uma imagem existente (mantém mesmo id)
export async function updateImageById(id, meta) {
  const { url, public_id, originalname, mimetype, size, created_at } = meta;
  const [result] = await promisePool.query(
    `UPDATE imgPerfilUsuario SET url = ?, public_id = ?, originalname = ?, mimetype = ?, size = ?, created_at = ? WHERE id = ?`,
    [url, public_id, originalname, mimetype, size, created_at, id]
  );
  return result;
}
