// api/__tests__/usuario2.test.js
import { jest } from '@jest/globals';

// Mock bcrypt
jest.unstable_mockModule('bcryptjs', () => ({
  default: {
    genSalt: jest.fn(() => Promise.resolve('salt')),
    hash: jest.fn(() => Promise.resolve('hashed_password')),
    compare: jest.fn(() => Promise.resolve(true))
  }
}));

// Mock usuarioDb - TODAS as funções exportadas
jest.unstable_mockModule('../utils/usuarioDb.js', () => ({
  findUserById: jest.fn(() => Promise.resolve(null)),
  findUserByCpf: jest.fn(() => Promise.resolve(null)),
  findUserByEmail: jest.fn(() => Promise.resolve(null)),
  insertUser: jest.fn(() => Promise.resolve({ insertId: 10 })),
  findAllUsers: jest.fn(() => Promise.resolve([])),
  findUserForLogin: jest.fn(() => Promise.resolve(null)),
  findUserPointsById: jest.fn(() => Promise.resolve({ pontos: 0 })),
  updateUserPoints: jest.fn(() => Promise.resolve({})),
  deleteUserById: jest.fn(() => Promise.resolve({ affectedRows: 0 })),
  findUserMe: jest.fn(() => Promise.resolve(null)),
  updateUserPassword: jest.fn(() => Promise.resolve({})),
  findUserForPasswordReset: jest.fn(() => Promise.resolve(null)),
  setTemporaryPassword: jest.fn(() => Promise.resolve({})),
  clearPasswordResetToken: jest.fn(() => Promise.resolve({})),
  updateUserById: jest.fn(() => Promise.resolve({})),
  updateUserImagemPerfilId: jest.fn(() => Promise.resolve({}))
}));

// Mock emailService
jest.unstable_mockModule('../utils/emailService.js', () => ({
  sendPasswordResetEmail: jest.fn(() => Promise.resolve({}))
}));

// Importar DEPOIS dos mocks
const usuarioDb = await import('../utils/usuarioDb.js');
const emailService = await import('../utils/emailService.js');
const bcrypt = (await import('bcryptjs')).default;
const { default: usuarioRouter } = await import('../routes/usuario.js');
const express = (await import('express')).default;
const request = (await import('supertest')).default;
const jwt = (await import('jsonwebtoken')).default;

const app = express();
app.use(express.json());
app.use('/usuario', usuarioRouter);

describe('Usuario Router - Parte 2', () => {
  let token;
  process.env.SECRET_KEY = 'test-secret';

  beforeEach(() => {
    jest.clearAllMocks();
    token = jwt.sign(
      { usuario: { id: 1, tipo: 'Cliente' } },
      process.env.SECRET_KEY
    );
  });

  describe('PUT /usuario/pontos', () => {
    it('deve atualizar pontos do usuário autenticado', async () => {
      usuarioDb.updateUserPoints.mockResolvedValue({});

      const res = await request(app)
        .put('/usuario/pontos')
        .set('access-token', token)
        .send({ pontos: 300 });

      expect(res.status).toBe(202);
      expect(res.body.msg).toBe('Pontos atualizados com sucesso');
      expect(usuarioDb.updateUserPoints).toHaveBeenCalledWith(1, 300);
    });

    it('deve retornar 400 se pontos negativos', async () => {
      const res = await request(app)
        .put('/usuario/pontos')
        .set('access-token', token)
        .send({ pontos: -50 });

      expect(res.status).toBe(400);
    });
  });

  describe('PUT /usuario/pontosPut', () => {
    it('deve atualizar pontos por ID (transação)', async () => {
      usuarioDb.updateUserPoints.mockResolvedValue({});

      const res = await request(app)
        .put('/usuario/pontosPut')
        .set('access-token', token)
        .send({ _id: 5, pontos: 400 });

      expect(res.status).toBe(202);
      expect(usuarioDb.updateUserPoints).toHaveBeenCalledWith(5, 400);
    });
  });

  describe('DELETE /usuario/:id', () => {
    it('deve deletar usuário com sucesso', async () => {
      usuarioDb.deleteUserById.mockResolvedValue({ affectedRows: 1 });

      const res = await request(app)
        .delete('/usuario/1')
        .set('access-token', token);

      expect(res.status).toBe(200);
      expect(res.body.msg).toBe('Usuário excluído com sucesso');
    });

    it('deve retornar 404 se usuário não existe', async () => {
      usuarioDb.deleteUserById.mockResolvedValue({ affectedRows: 0 });

      const res = await request(app)
        .delete('/usuario/999')
        .set('access-token', token);

      expect(res.status).toBe(404);
    });
  });

  describe('GET /usuario/me', () => {
    it('deve retornar dados do usuário autenticado', async () => {
      const mockUser = { id: 1, nome: 'João', email: 'joao@test.com' };
      usuarioDb.findUserMe.mockResolvedValue(mockUser);

      const res = await request(app)
        .get('/usuario/me')
        .set('access-token', token);

      expect(res.status).toBe(200);
      expect(res.body).toEqual(mockUser);
    });

    it('deve retornar 404 se usuário não encontrado', async () => {
      usuarioDb.findUserMe.mockResolvedValue(null);

      const res = await request(app)
        .get('/usuario/me')
        .set('access-token', token);

      expect(res.status).toBe(404);
    });
  });

  describe('PUT /usuario/senha', () => {
    beforeEach(() => {
      bcrypt.genSalt.mockResolvedValue('salt');
      bcrypt.hash.mockResolvedValue('new_hashed_password');
    });

    it('deve atualizar senha com sucesso', async () => {
      usuarioDb.findUserById.mockResolvedValue({
        id: 1,
        senha: 'old_hashed_password'
      });
      bcrypt.compare.mockResolvedValue(true);
      usuarioDb.updateUserPassword.mockResolvedValue({});

      const res = await request(app)
        .put('/usuario/senha')
        .set('access-token', token)
        .send({
          senhaAtual: 'Senha@123',
          novaSenha: 'NovaSenha@456'
        });

      expect(res.status).toBe(200);
      expect(res.body.msg).toBe('Senha atualizada com sucesso');
    });

    it('deve retornar 403 se senha atual incorreta', async () => {
      usuarioDb.findUserById.mockResolvedValue({
        id: 1,
        senha: 'hashed_password'
      });
      bcrypt.compare.mockResolvedValue(false);

      const res = await request(app)
        .put('/usuario/senha')
        .set('access-token', token)
        .send({
          senhaAtual: 'SenhaErrada',
          novaSenha: 'NovaSenha@456'
        });

      expect(res.status).toBe(403);
      expect(res.body.msg).toBe('Senha atual incorreta');
    });

    it('deve retornar 400 se nova senha fraca', async () => {
      const res = await request(app)
        .put('/usuario/senha')
        .set('access-token', token)
        .send({
          senhaAtual: 'Senha@123',
          novaSenha: '123456'
        });

      expect(res.status).toBe(400);
    });

    it('deve retornar 404 se usuário não encontrado', async () => {
      usuarioDb.findUserById.mockResolvedValue(null);

      const res = await request(app)
        .put('/usuario/senha')
        .set('access-token', token)
        .send({
          senhaAtual: 'Senha@123',
          novaSenha: 'NovaSenha@456'
        });

      expect(res.status).toBe(404);
    });
  });

  describe('POST /usuario/forgot-password', () => {
    beforeEach(() => {
      bcrypt.genSalt.mockResolvedValue('salt');
      bcrypt.hash.mockResolvedValue('temp_hashed_password');
    });

    it('deve enviar email de recuperação de senha', async () => {
      usuarioDb.findUserForPasswordReset.mockResolvedValue({
        id: 1,
        email: 'teste@test.com'
      });
      usuarioDb.setTemporaryPassword.mockResolvedValue({});
      emailService.sendPasswordResetEmail.mockResolvedValue({});

      const res = await request(app)
        .post('/usuario/forgot-password')
        .send({ email: 'teste@test.com' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(emailService.sendPasswordResetEmail).toHaveBeenCalled();
    });

    it('deve retornar 404 se email não encontrado', async () => {
      usuarioDb.findUserForPasswordReset.mockResolvedValue(null);

      const res = await request(app)
        .post('/usuario/forgot-password')
        .send({ email: 'naoexiste@test.com' });

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });

    it('deve retornar 200 mesmo se email falhar (segurança)', async () => {
      usuarioDb.findUserForPasswordReset.mockResolvedValue({
        id: 1,
        email: 'teste@test.com'
      });
      usuarioDb.setTemporaryPassword.mockResolvedValue({});
      emailService.sendPasswordResetEmail.mockRejectedValue(new Error('Email error'));

      const res = await request(app)
        .post('/usuario/forgot-password')
        .send({ email: 'teste@test.com' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('deve retornar 400 se email inválido', async () => {
      const res = await request(app)
        .post('/usuario/forgot-password')
        .send({ email: 'emailinvalido' });

      expect(res.status).toBe(400);
    });
  });

  describe('POST /usuario/reset-password', () => {
    beforeEach(() => {
      bcrypt.genSalt.mockResolvedValue('salt');
      bcrypt.hash.mockResolvedValue('new_hashed_password');
    });

    it('deve redefinir senha com sucesso', async () => {
      usuarioDb.findUserById.mockResolvedValue({ id: 1 });
      usuarioDb.clearPasswordResetToken.mockResolvedValue({});

      const res = await request(app)
        .post('/usuario/reset-password')
        .set('access-token', token)
        .send({ novaSenha: 'NovaSenha@123' });

      expect(res.status).toBe(200);
      expect(res.body.msg).toBe('Senha alterada com sucesso');
    });

    it('deve retornar 404 se usuário não encontrado', async () => {
      usuarioDb.findUserById.mockResolvedValue(null);

      const res = await request(app)
        .post('/usuario/reset-password')
        .set('access-token', token)
        .send({ novaSenha: 'NovaSenha@123' });

      expect(res.status).toBe(404);
    });

    it('deve retornar 400 se senha fraca', async () => {
      const res = await request(app)
        .post('/usuario/reset-password')
        .set('access-token', token)
        .send({ novaSenha: '123456' });

      expect(res.status).toBe(400);
    });
  });

  describe('PUT /usuario/me', () => {
    it('deve atualizar dados do usuário autenticado', async () => {
      usuarioDb.findUserById.mockResolvedValue({ id: 1 });
      usuarioDb.findUserByCpf.mockResolvedValue(null);
      usuarioDb.findUserByEmail.mockResolvedValue(null);
      usuarioDb.updateUserById.mockResolvedValue({});

      const res = await request(app)
        .put('/usuario/me')
        .set('access-token', token)
        .send({
          nome: 'João Atualizado',
          celular: '11999999999'
        });

      expect(res.status).toBe(200);
      expect(res.body.msg).toBe('Dados atualizados com sucesso');
    });

    it('deve retornar 404 se usuário não encontrado', async () => {
      usuarioDb.findUserById.mockResolvedValue(null);

      const res = await request(app)
        .put('/usuario/me')
        .set('access-token', token)
        .send({ nome: 'João' });

      expect(res.status).toBe(404);
    });

    it('deve retornar 400 se CPF já cadastrado por outro usuário', async () => {
      usuarioDb.findUserById.mockResolvedValue({ id: 1 });
      usuarioDb.findUserByCpf.mockResolvedValue({ id: 2, cpf: '12345678901' });

      const res = await request(app)
        .put('/usuario/me')
        .set('access-token', token)
        .send({ cpf: '12345678901' });

      expect(res.status).toBe(400);
    });
  });
});