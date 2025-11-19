// ============================================
// api/__tests__/usuario.test.js
// ============================================
import { jest } from '@jest/globals';

// Mock bcrypt ANTES de qualquer importação
jest.unstable_mockModule('bcryptjs', () => ({
  default: {
    genSalt: jest.fn(() => Promise.resolve('salt')),
    hash: jest.fn(() => Promise.resolve('hashed_password')),
    compare: jest.fn(() => Promise.resolve(true))
  }
}));

// Mock usuarioDb
jest.unstable_mockModule('../utils/usuarioDb.js', () => ({
  findUserByCpf: jest.fn(() => Promise.resolve(null)),
  findUserByEmail: jest.fn(() => Promise.resolve(null)),
  insertUser: jest.fn(() => Promise.resolve({ insertId: 10 })),
  findAllUsers: jest.fn(() => Promise.resolve([])),
  findUserById: jest.fn(() => Promise.resolve(null)),
  findUserForLogin: jest.fn(() => Promise.resolve(null)),
  findUserPointsById: jest.fn(() => Promise.resolve({ pontos: 0 })),
  updateUserPoints: jest.fn(() => Promise.resolve({})),
  deleteUserById: jest.fn(() => Promise.resolve({ affectedRows: 0 })),
  findUserMe: jest.fn(() => Promise.resolve(null)),
  updateUserPassword: jest.fn(() => Promise.resolve({})),
  findUserForPasswordReset: jest.fn(() => Promise.resolve(null)),
  setTemporaryPassword: jest.fn(() => Promise.resolve({})),
  clearPasswordResetToken: jest.fn(() => Promise.resolve({})),
  updateUserById: jest.fn(() => Promise.resolve({}))
}));

// Mock uploadDb
jest.unstable_mockModule('../utils/uploadDb.js', () => ({
  findImageById: jest.fn(() => Promise.resolve(null))
}));

// Mock emailService
jest.unstable_mockModule('../utils/emailService.js', () => ({
  sendPasswordResetEmail: jest.fn(() => Promise.resolve({}))
}));

// Importar módulos DEPOIS dos mocks
const usuarioDb = await import('../utils/usuarioDb.js');
const uploadDb = await import('../utils/uploadDb.js');
const emailService = await import('../utils/emailService.js');
const bcrypt = (await import('bcryptjs')).default;
const { default: usuarioRouter } = await import('../routes/usuario.js');
const express = (await import('express')).default;
const request = (await import('supertest')).default;
const jwt = (await import('jsonwebtoken')).default;

const app = express();
app.use(express.json());
app.use('/usuario', usuarioRouter);

describe('Usuario Router - Parte 1', () => {
  let token;
  process.env.SECRET_KEY = 'test-secret';
  process.env.EXPIRES_IN = '1h';

  beforeEach(() => {
    jest.clearAllMocks();
    token = jwt.sign(
      { usuario: { id: 1, tipo: 'Admin' } },
      process.env.SECRET_KEY
    );
    
    usuarioDb.findUserByCpf.mockResolvedValue(null);
    usuarioDb.findUserByEmail.mockResolvedValue(null);
    bcrypt.genSalt.mockResolvedValue('salt');
    bcrypt.hash.mockResolvedValue('hashed_password');
  });

  describe('POST /usuario', () => {
    const validUser = {
      nome: 'João Silva',
      cpf: '12345678901',
      email: 'joao@test.com',
      senha: 'Senha@123',
      celular: '11987654321',
      ativo: true,
      tipo: 'Cliente'
    };

    it('deve criar usuário com dados válidos', async () => {
      usuarioDb.insertUser.mockResolvedValue({ insertId: 10 });

      const res = await request(app)
        .post('/usuario')
        .send(validUser);

      expect(res.status).toBe(201);
      expect(bcrypt.hash).toHaveBeenCalled();
      expect(usuarioDb.insertUser).toHaveBeenCalled();
    });

    it('deve retornar 403 se nome muito curto', async () => {
      const res = await request(app)
        .post('/usuario')
        .send({ ...validUser, nome: 'ab' });

      expect(res.status).toBe(403);
      expect(res.body.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            msg: 'Informe no mínimo 3 caracteres'
          })
        ])
      );
    });

    it('deve retornar 403 se CPF inválido', async () => {
      const res = await request(app)
        .post('/usuario')
        .send({ ...validUser, cpf: '123' });

      expect(res.status).toBe(403);
      expect(res.body.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            msg: 'Informe um CPF válido com 11 dígitos'
          })
        ])
      );
    });

    it('deve retornar 403 se CPF já cadastrado', async () => {
      usuarioDb.findUserByCpf.mockResolvedValue({ id: 2, cpf: '12345678901' });

      const res = await request(app)
        .post('/usuario')
        .send(validUser);

      expect(res.status).toBe(403);
      expect(res.body.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            msg: expect.stringContaining('já está cadastrado')
          })
        ])
      );
    });

    it('deve retornar 403 se email já existe', async () => {
      usuarioDb.findUserByEmail.mockResolvedValue({ id: 2, email: 'joao@test.com' });

      const res = await request(app)
        .post('/usuario')
        .send(validUser);

      expect(res.status).toBe(403);
      expect(res.body.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            msg: expect.stringContaining('já existe')
          })
        ])
      );
    });

    it('deve retornar 403 se senha fraca', async () => {
      const res = await request(app)
        .post('/usuario')
        .send({ ...validUser, senha: '123456' });

      expect(res.status).toBe(403);
      expect(res.body.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            msg: expect.stringContaining('senha não é segura')
          })
        ])
      );
    });

    it('deve normalizar email para minúsculo', async () => {
      usuarioDb.insertUser.mockResolvedValue({ insertId: 10 });

      await request(app)
        .post('/usuario')
        .send({ ...validUser, email: 'JOAO@TEST.COM' });

      expect(usuarioDb.insertUser).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'joao@test.com'
        })
      );
    });
  });

  describe('GET /usuario', () => {
    it('deve retornar lista de usuários', async () => {
      const mockUsers = [
        { id: 1, nome: 'João' },
        { id: 2, nome: 'Maria' }
      ];
      usuarioDb.findAllUsers.mockResolvedValue(mockUsers);

      const res = await request(app)
        .get('/usuario')
        .set('access-token', token);

      expect(res.status).toBe(200);
      expect(res.body).toEqual(mockUsers);
    });

    it('deve retornar 500 em caso de erro', async () => {
      usuarioDb.findAllUsers.mockRejectedValue(new Error('DB error'));

      const res = await request(app)
        .get('/usuario')
        .set('access-token', token);

      expect(res.status).toBe(500);
    });
  });

  describe('GET /usuario/id/:id', () => {
    it('deve retornar usuário por ID', async () => {
      const mockUser = { id: 1, nome: 'João' };
      usuarioDb.findUserById.mockResolvedValue(mockUser);

      const res = await request(app)
        .get('/usuario/id/1')
        .set('access-token', token);

      expect(res.status).toBe(200);
      expect(res.body).toEqual(mockUser);
    });

    it('deve retornar 404 se usuário não encontrado', async () => {
      usuarioDb.findUserById.mockResolvedValue(null);

      const res = await request(app)
        .get('/usuario/id/999')
        .set('access-token', token);

      expect(res.status).toBe(404);
      expect(res.body.msg).toBe('Usuário não encontrado');
    });
  });

  describe('GET /usuario/avatar/:id', () => {
    it('deve retornar URL do avatar', async () => {
      usuarioDb.findUserById.mockResolvedValue({ id: 1, imagemPerfilId: 5 });
      uploadDb.findImageById.mockResolvedValue({ id: 5, url: 'https://example.com/avatar.jpg' });

      const res = await request(app).get('/usuario/avatar/1');

      expect(res.status).toBe(200);
      expect(res.body.url).toBe('https://example.com/avatar.jpg');
    });

    it('deve retornar 404 se usuário sem avatar', async () => {
      usuarioDb.findUserById.mockResolvedValue({ id: 1, imagemPerfilId: null });

      const res = await request(app).get('/usuario/avatar/1');

      expect(res.status).toBe(404);
    });
  });

  describe('POST /usuario/login', () => {
    beforeEach(() => {
      bcrypt.compare.mockResolvedValue(true);
    });

    it('deve fazer login com credenciais válidas - Cliente', async () => {
      const mockUser = {
        id: 1,
        email: 'cliente@test.com',
        senha: 'hashed_password',
        tipo: 'Cliente'
      };
      usuarioDb.findUserForLogin.mockResolvedValue(mockUser);

      const res = await request(app)
        .post('/usuario/login')
        .send({ email: 'cliente@test.com', senha: 'Senha@123' });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('access_token');
      expect(res.body.redirect_url).toBe('menuUser.html');
    });

    it('deve fazer login com credenciais válidas - Admin', async () => {
      const mockUser = {
        id: 2,
        email: 'admin@test.com',
        senha: 'hashed_password',
        tipo: 'Admin'
      };
      usuarioDb.findUserForLogin.mockResolvedValue(mockUser);

      const res = await request(app)
        .post('/usuario/login')
        .send({ email: 'admin@test.com', senha: 'Admin@123' });

      expect(res.status).toBe(200);
      expect(res.body.redirect_url).toBe('menu.html');
    });

    it('deve retornar 404 se email não cadastrado', async () => {
      usuarioDb.findUserForLogin.mockResolvedValue(null);

      const res = await request(app)
        .post('/usuario/login')
        .send({ email: 'naoexiste@test.com', senha: 'Senha@123' });

      expect(res.status).toBe(404);
      expect(res.body.errors[0].msg).toContain('não está cadastrado');
    });

    it('deve retornar 403 se senha incorreta', async () => {
      usuarioDb.findUserForLogin.mockResolvedValue({
        id: 1,
        email: 'teste@test.com',
        senha: 'hashed_password'
      });
      bcrypt.compare.mockResolvedValue(false);

      const res = await request(app)
        .post('/usuario/login')
        .send({ email: 'teste@test.com', senha: 'SenhaErrada' });

      expect(res.status).toBe(403);
      expect(res.body.errors[0].msg).toContain('senha informada está incorreta');
    });

    it('deve retornar 403 se email inválido', async () => {
      const res = await request(app)
        .post('/usuario/login')
        .send({ email: 'emailinvalido', senha: 'Senha@123' });

      expect(res.status).toBe(403);
    });
  });

  describe('GET /usuario/pontos', () => {
    it('deve retornar pontos do usuário autenticado', async () => {
      usuarioDb.findUserPointsById.mockResolvedValue({ pontos: 500 });

      const res = await request(app)
        .get('/usuario/pontos')
        .set('access-token', token);

      expect(res.status).toBe(200);
      expect(res.body.pontos).toBe(500);
    });
  });
});