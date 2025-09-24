import { promisePool } from '../config/db.js';

// Insere registro de pontos
export async function insertHistPontos({ id, pontos, idUsuario, data }) {
  const [result] = await promisePool.execute(
    `INSERT INTO histPontos (id, pontos, idUsuario, data) VALUES (?, ?, ?, ?)`,
    [id, pontos, idUsuario, data]
  );
  return result;
}

// Insere registro de transação e relacionamento benefício-usuário
export async function insertHistTransacoes({ descricao, pontos, idUsuario, idBeneficio, data }) {
  const [result] = await promisePool.execute(
    `INSERT INTO histTransacoes (descricao, pontos, idUsuario, data) VALUES (?, ?, ?, ?)`,
    [descricao, pontos, idUsuario, data]
  );
  // Insere na tabela de relacionamento
  if (idBeneficio) {
    await promisePool.execute(
      `INSERT INTO beneficiosDoUsuario (idUsuario, idBeneficio) VALUES (?, ?)`,
      [idUsuario, idBeneficio]
    );
  }
  return result;
}

// Busca histórico de pontos por usuário e período
export async function findHistPontosByUsuario(idUsuario, startDateTime, endDateTime) {
  const [rows] = await promisePool.execute(
    `SELECT id, idUsuario, pontos, data, 'ponto' AS tipo FROM histPontos 
     WHERE idUsuario = ? AND data BETWEEN ? AND ?`,
    [idUsuario, startDateTime, endDateTime]
  );
  return rows;
}

// Busca histórico de transações por usuário e período
export async function findHistTransacoesByUsuario(idUsuario, startDateTime, endDateTime) {
  const [rows] = await promisePool.execute(
    `SELECT id, idUsuario, descricao, pontos, data, 'transacao' AS tipo FROM histTransacoes 
     WHERE idUsuario = ? AND data BETWEEN ? AND ?`,
    [idUsuario, startDateTime, endDateTime]
  );
  return rows;
}

// Busca histórico de pontos de todos os usuários por período
export async function findAllHistPontos(startDateTime, endDateTime) {
  const [rows] = await promisePool.execute(
    `SELECT id, idUsuario, pontos, data, 'ponto' AS tipo FROM histPontos 
     WHERE data BETWEEN ? AND ?`,
    [startDateTime, endDateTime]
  );
  return rows;
}

// Busca histórico de transações de todos os usuários por período
export async function findAllHistTransacoes(startDateTime, endDateTime) {
  const [rows] = await promisePool.execute(
    `SELECT id, idUsuario, descricao, pontos, data, 'transacao' AS tipo FROM histTransacoes 
     WHERE data BETWEEN ? AND ?`,
    [startDateTime, endDateTime]
  );
  return rows;
}