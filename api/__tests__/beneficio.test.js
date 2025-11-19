// api/__tests__/beneficio.test.js
import { jest } from '@jest/globals';

// Mock ANTES de importar o router
jest.unstable_mockModule('../utils/beneficioDb.js', () => ({
  findAllBeneficios: jest.fn(() => Promise.resolve([])),
  findBeneficiosGt: jest.fn(() => Promise.resolve([])),
  findBeneficioById: jest.fn(() => Promise.resolve(null)),
  findBeneficioByNome: jest.fn(() => Promise.resolve([])),
  deleteBeneficioById: jest.fn(() => Promise.resolve({ affectedRows: 0 })),
  insertBeneficio: jest.fn(() => Promise.resolve({ insertId: 1 })),
  updateBeneficio: jest.fn(() => Promise.resolve({ affectedRows: 1 })),
  updateBeneficioQuantidade: jest.fn(() => Promise.resolve({ affectedRows: 1 }))
}));

// Importar DEPOIS do mock
const beneficioDb = await import('../utils/beneficioDb.js');
const { default: beneficioRouter } = await import('../routes/beneficio.js');
const express = (await import('express')).default;
const request = (await import('supertest')).default;
const jwt = (await import('jsonwebtoken')).default;

const app = express();
app.use(express.json());
app.use('/beneficio', beneficioRouter);

describe('Benefício Router', () => {
  let token;

  beforeEach(() => {
    jest.clearAllMocks();
    token = jwt.sign(
      { usuario: { id: 1, tipo: 'Admin' } },
      process.env.SECRET_KEY || 'test-secret'
    );
  });

  describe('GET /beneficio', () => {
    it('deve retornar lista de benefícios', async () => {
      const mockBeneficios = [
        { id: 1, nome: 'Desconto 10%', pontos: 100 },
        { id: 2, nome: 'Frete grátis', pontos: 200 }
      ];
      beneficioDb.findAllBeneficios.mockResolvedValue(mockBeneficios);

      const res = await request(app)
        .get('/beneficio')
        .set('access-token', token);

      expect(res.status).toBe(200);
      expect(res.body).toEqual(mockBeneficios);
      expect(beneficioDb.findAllBeneficios).toHaveBeenCalledWith({
        limit: 10,
        skip: 0,
        order: 'id'
      });
    });

    it('deve usar query params personalizados', async () => {
      beneficioDb.findAllBeneficios.mockResolvedValue([]);

      await request(app)
        .get('/beneficio?limit=20&skip=10&order=nome')
        .set('access-token', token);

      expect(beneficioDb.findAllBeneficios).toHaveBeenCalledWith({
        limit: '20',
        skip: '10',
        order: 'nome'
      });
    });

    it('deve retornar 500 em caso de erro', async () => {
      beneficioDb.findAllBeneficios.mockRejectedValue(new Error('DB error'));

      const res = await request(app)
        .get('/beneficio')
        .set('access-token', token);

      expect(res.status).toBe(500);
      expect(res.body.message).toBe('Erro ao obter a listagem dos benefícios');
    });
  });

  describe('GET /beneficio/gt', () => {
    it('deve retornar benefícios com filtro gt', async () => {
      const mockBeneficios = [{ id: 1, nome: 'Benefício 1' }];
      beneficioDb.findBeneficiosGt.mockResolvedValue(mockBeneficios);

      const res = await request(app)
        .get('/beneficio/gt')
        .set('access-token', token);

      expect(res.status).toBe(200);
      expect(res.body).toEqual(mockBeneficios);
    });
  });

  describe('GET /beneficio/id/:id', () => {
    it('deve retornar benefício por ID', async () => {
      const mockBeneficio = { id: 1, nome: 'Desconto 10%' };
      beneficioDb.findBeneficioById.mockResolvedValue(mockBeneficio);

      const res = await request(app)
        .get('/beneficio/id/1')
        .set('access-token', token);

      expect(res.status).toBe(200);
      expect(res.body).toEqual(mockBeneficio);
    });

    it('deve retornar 404 se benefício não encontrado', async () => {
      beneficioDb.findBeneficioById.mockResolvedValue(null);

      const res = await request(app)
        .get('/beneficio/id/999')
        .set('access-token', token);

      expect(res.status).toBe(404);
      expect(res.body.msg).toBe('Benefício não encontrado');
    });
  });

  describe('GET /beneficio/nome/:filtro', () => {
    it('deve retornar benefícios por nome/filtro', async () => {
      const mockBeneficios = [{ id: 1, nome: 'Desconto' }];
      beneficioDb.findBeneficioByNome.mockResolvedValue(mockBeneficios);

      const res = await request(app)
        .get('/beneficio/nome/Desconto')
        .set('access-token', token);

      expect(res.status).toBe(200);
      expect(res.body).toEqual(mockBeneficios);
    });
  });

  describe('DELETE /beneficio/:id', () => {
    it('deve deletar benefício com sucesso', async () => {
      beneficioDb.deleteBeneficioById.mockResolvedValue({ affectedRows: 1 });

      const res = await request(app)
        .delete('/beneficio/1')
        .set('access-token', token);

      expect(res.status).toBe(200);
      expect(res.body.msg).toBe('Benefício excluído com sucesso');
    });

    it('deve retornar 404 se benefício não existe', async () => {
      beneficioDb.deleteBeneficioById.mockResolvedValue({ affectedRows: 0 });

      const res = await request(app)
        .delete('/beneficio/999')
        .set('access-token', token);

      expect(res.status).toBe(404);
      expect(res.body.errors[0].msg).toBe('Erro ao excluir o benefício');
    });
  });

  describe('POST /beneficio', () => {
    const validBeneficio = {
      nome: 'Desconto de 15%',
      endereco: 'Rua Teste, 123',
      pontos: 150,
      data: '2026-12-31',
      quantidade: 100
    };

    it('deve criar benefício com dados válidos', async () => {
      beneficioDb.insertBeneficio.mockResolvedValue({ insertId: 10 });

      const res = await request(app)
        .post('/beneficio')
        .set('access-token', token)
        .send(validBeneficio);

      expect(res.status).toBe(201);
      expect(beneficioDb.insertBeneficio).toHaveBeenCalled();
    });

    it('deve retornar 400 se nome for muito curto', async () => {
      const res = await request(app)
        .post('/beneficio')
        .set('access-token', token)
        .send({ ...validBeneficio, nome: 'abc' });

      expect(res.status).toBe(400);
      expect(res.body.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            msg: 'O nome é muito curto. Mínimo de 5'
          })
        ])
      );
    });

    it('deve retornar 400 se pontos forem negativos', async () => {
      const res = await request(app)
        .post('/beneficio')
        .set('access-token', token)
        .send({ ...validBeneficio, pontos: -10 });

      expect(res.status).toBe(400);
      expect(res.body.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            msg: 'Os pontos não podem ser negativos'
          })
        ])
      );
    });

    it('deve retornar 400 se data for inválida', async () => {
      const res = await request(app)
        .post('/beneficio')
        .set('access-token', token)
        .send({ ...validBeneficio, data: '2020-01-01' });

      expect(res.status).toBe(400);
      expect(res.body.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            msg: 'A data deve ser maior do que o dia de hoje'
          })
        ])
      );
    });
  });

  describe('PUT /beneficio', () => {
    it('deve atualizar benefício com dados válidos', async () => {
      const updateData = {
        id: 1,
        nome: 'Desconto Atualizado',
        endereco: 'Novo Endereço, 456',
        pontos: 200,
        data: '2026-12-31',
        quantidade: 50
      };
      beneficioDb.updateBeneficio.mockResolvedValue({ affectedRows: 1 });

      const res = await request(app)
        .put('/beneficio')
        .set('access-token', token)
        .send(updateData);

      expect(res.status).toBe(202);
      expect(beneficioDb.updateBeneficio).toHaveBeenCalledWith(
        1,
        expect.not.objectContaining({ id: 1 })
      );
    });
  });

  describe('PUT /beneficio/resgate', () => {
    it('deve atualizar quantidade do benefício', async () => {
      beneficioDb.updateBeneficioQuantidade.mockResolvedValue({ affectedRows: 1 });

      const res = await request(app)
        .put('/beneficio/resgate')
        .set('access-token', token)
        .send({ id: 1, quantidade: 90 });

      expect(res.status).toBe(202);
      expect(beneficioDb.updateBeneficioQuantidade).toHaveBeenCalledWith(1, 90);
    });

    it('deve retornar 400 se quantidade for negativa', async () => {
      const res = await request(app)
        .put('/beneficio/resgate')
        .set('access-token', token)
        .send({ id: 1, quantidade: -5 });

      expect(res.status).toBe(400);
    });
  });
});