// __tests__/middleware/auth.test.js
import { jest } from '@jest/globals';
import jwt from 'jsonwebtoken';
import auth from '../../middleware/auth.js';

describe('Auth Middleware', () => {
  let req, res, next;

  beforeEach(() => {
    req = {
      header: jest.fn()
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
      send: jest.fn()
    };
    next = jest.fn();
    process.env.SECRET_KEY = 'test-secret-key';
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ... resto do código

  it('deve retornar 401 se token não for fornecido', async () => {
    req.header.mockReturnValue(null);

    await auth(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      msg: 'Acesso negado. É obrigatório o envio do token JWT'
    });
    expect(next).not.toHaveBeenCalled();
  });

  it('deve retornar 403 se token for inválido', async () => {
    req.header.mockReturnValue('invalid-token');

    await auth(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.send).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.stringContaining('Token inválido')
      })
    );
    expect(next).not.toHaveBeenCalled();
  });

  it('deve decodificar token válido e chamar next()', async () => {
    const usuario = { id: 1, tipo: 'Cliente' };
    const token = jwt.sign({ usuario }, process.env.SECRET_KEY);
    req.header.mockReturnValue(token);

    await auth(req, res, next);

    expect(req.usuario).toEqual(usuario);
    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('deve retornar 403 se token expirado', async () => {
    const usuario = { id: 1, tipo: 'Cliente' };
    const token = jwt.sign({ usuario }, process.env.SECRET_KEY, { expiresIn: '0s' });
    req.header.mockReturnValue(token);

    // Aguarda para garantir que o token expire
    await new Promise(resolve => setTimeout(resolve, 100));

    await auth(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.send).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.stringContaining('Token inválido')
      })
    );
    expect(next).not.toHaveBeenCalled();
  });

  it('deve funcionar com diferentes tipos de usuário', async () => {
    const usuario = { id: 5, tipo: 'Admin' };
    const token = jwt.sign({ usuario }, process.env.SECRET_KEY);
    req.header.mockReturnValue(token);

    await auth(req, res, next);

    expect(req.usuario).toEqual(usuario);
    expect(req.usuario.tipo).toBe('Admin');
    expect(next).toHaveBeenCalled();
  });
});