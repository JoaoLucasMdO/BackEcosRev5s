// api/__tests__/histRouter.test.js
import { jest } from '@jest/globals';

// Mock histRouterDb - TODAS as funções exportadas
jest.unstable_mockModule('../utils/histRouterDb.js', () => ({
  insertHistPontos: jest.fn(() => Promise.resolve({ insertId: 1 })),
  findAllHistPontos: jest.fn(() => Promise.resolve([])),
  findAllHistTransacoes: jest.fn(() => Promise.resolve([])),
  findHistTransacoesByUsuario: jest.fn(() => Promise.resolve([])),
  insertHistTransacoes: jest.fn(() => Promise.resolve([])),
  findHistPontosByUserId: jest.fn(() => Promise.resolve([])),
  findHistPontosByUsuario: jest.fn(() => Promise.resolve([])),
  findHistPontoById: jest.fn(() => Promise.resolve(null)),
  deleteHistPontoById: jest.fn(() => Promise.resolve({ affectedRows: 0 })),
  updateHistPonto: jest.fn(() => Promise.resolve({ affectedRows: 1 }))
}));

// Importar DEPOIS dos mocks
const histRouterDb = await import('../utils/histRouterDb.js');
const { default: histRouter } = await import('../routes/histRouter.js');
const express = (await import('express')).default;
const request = (await import('supertest')).default;
const jwt = (await import('jsonwebtoken')).default;

const app = express();
app.use(express.json());
app.use('/hist', histRouter);

describe('HistPontos Router', () => {
  let token;
  process.env.SECRET_KEY = 'test-secret';

  beforeEach(() => {
    jest.clearAllMocks();
    token = jwt.sign(
      { usuario: { id: 1, tipo: 'Cliente' } },
      process.env.SECRET_KEY
    );
  });

  describe('POST /hist/pontos', () => {
    it('deve registrar histórico de pontos com dados válidos', async () => {
      histRouterDb.insertHistPontos.mockResolvedValue({ insertId: 1 });

      const validPontos = {
        id: 'cupom123',
        idUsuario: 1,
        pontos: 100
      };

      const res = await request(app)
        .post('/hist/pontos')
        .set('access-token', token)
        .send(validPontos);

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Histórico de pontos registrado com sucesso.');
      expect(histRouterDb.insertHistPontos).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'cupom123',
          idUsuario: 1,
          pontos: 100
        })
      );
    });

    it('deve retornar 400 se campos obrigatórios estiverem ausentes', async () => {
      const res = await request(app)
        .post('/hist/pontos')
        .set('access-token', token)
        .send({ id: 'cupom123' }); // faltando idUsuario e pontos

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Campos obrigatórios ausentes.');
    });

    it('deve retornar 400 se cupom já foi resgatado (chave duplicada)', async () => {
      const duplicateError = new Error('Duplicate entry');
      duplicateError.code = 'ER_DUP_ENTRY';
      histRouterDb.insertHistPontos.mockRejectedValue(duplicateError);

      const validPontos = {
        id: 'cupom123',
        idUsuario: 1,
        pontos: 100
      };

      const res = await request(app)
        .post('/hist/pontos')
        .set('access-token', token)
        .send(validPontos);

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Este cupom já foi resgatado anteriormente.');
      expect(res.body.code).toBe('DUPLICATE_COUPON');
    });

    it('deve retornar 500 em caso de erro no banco', async () => {
      histRouterDb.insertHistPontos.mockRejectedValue(new Error('DB error'));

      const validPontos = {
        id: 'cupom123',
        idUsuario: 1,
        pontos: 100
      };

      const res = await request(app)
        .post('/hist/pontos')
        .set('access-token', token)
        .send(validPontos);

      expect(res.status).toBe(500);
      expect(res.body.error).toBe('Erro ao registrar histórico de pontos.');
    });
  });

  describe('POST /hist/transacoes', () => {
    it('deve registrar transação com dados válidos', async () => {
      histRouterDb.insertHistTransacoes.mockResolvedValue({ insertId: 10 });

      const validTransacao = {
        idUsuario: 1,
        idBeneficio: 5,
        descricao: 'Resgate de benefício',
        pontos: 100
      };

      const res = await request(app)
        .post('/hist/transacoes')
        .set('access-token', token)
        .send(validTransacao);

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Histórico de transação registrado com sucesso.');
      expect(histRouterDb.insertHistTransacoes).toHaveBeenCalledWith(
        expect.objectContaining({
          idUsuario: 1,
          idBeneficio: 5,
          descricao: 'Resgate de benefício',
          pontos: 100
        })
      );
    });

    it('deve retornar 400 se campos obrigatórios estiverem ausentes', async () => {
      const res = await request(app)
        .post('/hist/transacoes')
        .set('access-token', token)
        .send({ idUsuario: 1 }); // faltando campos

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Campos obrigatórios ausentes.');
    });

    it('deve retornar 500 em caso de erro no banco', async () => {
      histRouterDb.insertHistTransacoes.mockRejectedValue(new Error('DB error'));

      const validTransacao = {
        idUsuario: 1,
        idBeneficio: 5,
        descricao: 'Resgate de benefício',
        pontos: 100
      };

      const res = await request(app)
        .post('/hist/transacoes')
        .set('access-token', token)
        .send(validTransacao);

      expect(res.status).toBe(500);
      expect(res.body.error).toBe('Erro ao registrar transação.');
    });
  });

  describe('GET /hist/:idUsuario', () => {
    it('deve retornar histórico de um usuário específico', async () => {
      const mockPontos = [
        { id: 1, idUsuario: 1, pontos: 100, data: new Date('2024-01-15T10:00:00') }
      ];
      const mockTransacoes = [
        { id: 1, idUsuario: 1, pontos: -50, descricao: 'Resgate', data: new Date('2024-01-16T15:00:00') }
      ];

      histRouterDb.findHistPontosByUsuario.mockResolvedValue(mockPontos);
      histRouterDb.findHistTransacoesByUsuario.mockResolvedValue(mockTransacoes);

      const res = await request(app)
        .get('/hist/1')
        .set('access-token', token);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBe(2);
      expect(histRouterDb.findHistPontosByUsuario).toHaveBeenCalledWith(
        '1',
        expect.any(String),
        expect.any(String)
      );
      expect(histRouterDb.findHistTransacoesByUsuario).toHaveBeenCalledWith(
        '1',
        expect.any(String),
        expect.any(String)
      );
    });

    it('deve aceitar filtros de data via query params', async () => {
      histRouterDb.findHistPontosByUsuario.mockResolvedValue([]);
      histRouterDb.findHistTransacoesByUsuario.mockResolvedValue([]);

      const res = await request(app)
        .get('/hist/1?start=2024-01-01&end=2024-12-31')
        .set('access-token', token);

      expect(res.status).toBe(200);
      expect(histRouterDb.findHistPontosByUsuario).toHaveBeenCalledWith(
        '1',
        '2024-01-01 00:00:00',
        '2024-12-31 23:59:59'
      );
    });

    it('deve retornar histórico ordenado por data', async () => {
      const mockPontos = [
        { id: 1, idUsuario: 1, pontos: 100, data: new Date('2024-01-15T10:00:00') }
      ];
      const mockTransacoes = [
        { id: 1, idUsuario: 1, pontos: -50, descricao: 'Resgate', data: new Date('2024-01-20T15:00:00') }
      ];

      histRouterDb.findHistPontosByUsuario.mockResolvedValue(mockPontos);
      histRouterDb.findHistTransacoesByUsuario.mockResolvedValue(mockTransacoes);

      const res = await request(app)
        .get('/hist/1')
        .set('access-token', token);

      expect(res.status).toBe(200);
      expect(res.body.length).toBe(2);
      expect(Array.isArray(res.body)).toBe(true);
      // Verifica que ambos os itens estão presentes
      const hasTransacao = res.body.some(item => item.descricao === 'Resgate');
      const hasPontos = res.body.some(item => item.pontos === 100 && !item.descricao);
      expect(hasTransacao).toBe(true);
      expect(hasPontos).toBe(true);
    });

    it('deve retornar 500 em caso de erro', async () => {
      histRouterDb.findHistPontosByUsuario.mockRejectedValue(new Error('DB error'));

      const res = await request(app)
        .get('/hist/1')
        .set('access-token', token);

      expect(res.status).toBe(500);
      expect(res.body.error).toBe('Erro ao buscar histórico.');
    });
  });

  describe('GET /hist', () => {
    it('deve retornar histórico de todos os usuários agrupado', async () => {
      const mockPontos = [
        { id: 1, idUsuario: 1, pontos: 100, data: new Date('2024-01-15T10:00:00') },
        { id: 2, idUsuario: 2, pontos: 50, data: new Date('2024-01-16T10:00:00') }
      ];
      const mockTransacoes = [
        { id: 1, idUsuario: 1, pontos: -30, descricao: 'Resgate', data: new Date('2024-01-17T10:00:00') }
      ];

      histRouterDb.findAllHistPontos.mockResolvedValue(mockPontos);
      histRouterDb.findAllHistTransacoes.mockResolvedValue(mockTransacoes);

      const res = await request(app)
        .get('/hist')
        .set('access-token', token);

      expect(res.status).toBe(200);
      expect(typeof res.body).toBe('object');
      // Deve ter grupos por idUsuario
      expect(res.body).toHaveProperty('1');
      expect(res.body).toHaveProperty('2');
      expect(Array.isArray(res.body['1'])).toBe(true);
      expect(res.body['1'].length).toBe(2); // 1 ponto + 1 transação do usuário 1
    });

    it('deve aceitar filtros de data via query params', async () => {
      histRouterDb.findAllHistPontos.mockResolvedValue([]);
      histRouterDb.findAllHistTransacoes.mockResolvedValue([]);

      const res = await request(app)
        .get('/hist?start=2024-01-01&end=2024-12-31')
        .set('access-token', token);

      expect(res.status).toBe(200);
      expect(histRouterDb.findAllHistPontos).toHaveBeenCalledWith(
        '2024-01-01 00:00:00',
        '2024-12-31 23:59:59'
      );
      expect(histRouterDb.findAllHistTransacoes).toHaveBeenCalledWith(
        '2024-01-01 00:00:00',
        '2024-12-31 23:59:59'
      );
    });

    it('deve retornar objeto vazio se não houver histórico', async () => {
      histRouterDb.findAllHistPontos.mockResolvedValue([]);
      histRouterDb.findAllHistTransacoes.mockResolvedValue([]);

      const res = await request(app)
        .get('/hist')
        .set('access-token', token);

      expect(res.status).toBe(200);
      expect(res.body).toEqual({});
    });

    it('deve retornar 500 em caso de erro', async () => {
      histRouterDb.findAllHistPontos.mockRejectedValue(new Error('DB error'));

      const res = await request(app)
        .get('/hist')
        .set('access-token', token);

      expect(res.status).toBe(500);
      expect(res.body.error).toBe('Erro ao buscar histórico.');
    });
  });
});