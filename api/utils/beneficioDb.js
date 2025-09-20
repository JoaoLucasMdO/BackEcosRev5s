import { promisePool } from '../config/db.js';

// Busca todos os benefícios com paginação e ordenação
export async function findAllBeneficios({ limit = 10, skip = 0, order = 'id' }) {
  const [rows] = await promisePool.query(
    `SELECT * FROM beneficio ORDER BY ?? ASC LIMIT ? OFFSET ?`,
    [order, Number(limit), Number(skip)]
  );
  return rows;
}

// Busca benefícios com filtro de pontos (gt/lt)
export async function findBeneficiosGt({ limit = 10, skip = 0, order = 'id' }) {
  const [rows] = await promisePool.query(
    `SELECT * FROM beneficio WHERE pontos > 200 OR pontos < 1000 ORDER BY ?? ASC LIMIT ? OFFSET ?`,
    [order, Number(limit), Number(skip)]
  );
  return rows;
}

// Busca benefício por ID
export async function findBeneficioById(id) {
  const [rows] = await promisePool.query(
    `SELECT * FROM beneficio WHERE id = ?`,
    [id]
  );
  return rows[0];
}

// Busca benefícios por nome (filtro)
export async function findBeneficioByNome(filtro) {
  const [rows] = await promisePool.query(
    `SELECT * FROM beneficio WHERE nome LIKE ?`,
    [`%${filtro}%`]
  );
  return rows;
}

// Remove benefício por ID
export async function deleteBeneficioById(id) {
  const [result] = await promisePool.query(
    `DELETE FROM beneficio WHERE id = ?`,
    [id]
  );
  return result;
}

// Insere novo benefício
export async function insertBeneficio(beneficio) {
  const { nome, endereco, pontos, data, quantidade } = beneficio;
  const [result] = await promisePool.query(
    `INSERT INTO beneficio (nome, endereco, pontos, data, quantidade) VALUES (?, ?, ?, ?, ?)`,
    [nome, endereco, pontos, data, quantidade]
  );
  return { insertId: result.insertId };
}

// Atualiza benefício por ID
export async function updateBeneficio(id, beneficio) {
  const { nome, endereco, pontos, data, quantidade } = beneficio;
  const [result] = await promisePool.query(
    `UPDATE beneficio SET nome = ?, endereco = ?, pontos = ?, data = ?, quantidade = ? WHERE id = ?`,
    [nome, endereco, pontos, data, quantidade, id]
  );
  return result;
}

// Atualiza quantidade do benefício (resgate)
export async function updateBeneficioQuantidade(id, quantidade) {
  const [result] = await promisePool.query(
    `UPDATE beneficio SET quantidade = ? WHERE id = ?`,
    [quantidade, id]
  );
  return result;
}