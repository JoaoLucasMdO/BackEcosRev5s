import { promisePool } from '../config/db.js';

// Busca usuário por email
export async function findUserByEmail(email) {
  const [rows] = await promisePool.query(
    'SELECT * FROM usuarios WHERE email = ?',
    [email]
  );
  return rows[0];
}

// Insere novo usuário
export async function insertUser(user) {
  const { nome, email, senha, ativo = true, tipo = 'Cliente', pontos = 200 } = user;
  const [result] = await promisePool.query(
    'INSERT INTO usuarios (nome, email, senha, ativo, tipo, pontos) VALUES (?, ?, ?, ?, ?, ?)',
    [nome, email, senha, ativo, tipo, pontos]
  );
  return { insertId: result.insertId };
}

// Busca todos os usuários (sem senha)
export async function findAllUsers() {
  const [rows] = await promisePool.query(
    'SELECT id, nome, email, ativo, tipo, pontos FROM usuarios ORDER BY nome ASC'
  );
  return rows;
}

// Busca usuário por ID
export async function findUserById(id) {
  const [rows] = await promisePool.query(
    'SELECT * FROM usuarios WHERE id = ?',
    [id]
  );
  return rows[0];
}

// Busca pontos do usuário por ID
export async function findUserPointsById(id) {
  const [rows] = await promisePool.query(
    'SELECT pontos FROM usuarios WHERE id = ?',
    [id]
  );
  return rows[0];
}

// Atualiza pontos do usuário por ID
export async function updateUserPoints(id, pontos) {
  const [result] = await promisePool.query(
    'UPDATE usuarios SET pontos = ? WHERE id = ?',
    [pontos, id]
  );
  return result;
}

// Remove usuário por ID
export async function deleteUserById(id) {
  const [result] = await promisePool.query(
    'DELETE FROM usuarios WHERE id = ?',
    [id]
  );
  return result;
}

// Atualiza senha do usuário por ID
export async function updateUserPassword(id, senha) {
  const [result] = await promisePool.query(
    'UPDATE usuarios SET senha = ? WHERE id = ?',
    [senha, id]
  );
  return result;
}

// Busca usuário para login
export async function findUserForLogin(email) {
  const [rows] = await promisePool.query(
    'SELECT * FROM usuarios WHERE email = ?',
    [email]
  );
  return rows[0];
}

// Atualiza senha temporária e token de recuperação
export async function setTemporaryPassword(email, senha, expires) {
  const [result] = await promisePool.query(
    'UPDATE usuarios SET senha = ?, resetPasswordToken = ?, resetPasswordExpires = ? WHERE email = ?',
    [senha, true, expires, email]
  );
  return result;
}

// Busca usuário por email para recuperação de senha
export async function findUserForPasswordReset(email) {
  const [rows] = await promisePool.query(
    'SELECT * FROM usuarios WHERE email = ?',
    [email]
  );
  return rows[0];
}

// Remove token de recuperação após redefinir senha
export async function clearPasswordResetToken(id, senha) {
  const [result] = await promisePool.query(
    'UPDATE usuarios SET senha = ?, resetPasswordToken = NULL, resetPasswordExpires = NULL WHERE id = ?',
    [senha, id]
  );
  return result;
}

// Busca usuário autenticado (sem senha)
export async function findUserMe(id) {
  const [rows] = await promisePool.query(
    'SELECT id, nome, email, ativo, tipo, pontos FROM usuarios WHERE id = ?',
    [id]
  );
  return rows[0];
}