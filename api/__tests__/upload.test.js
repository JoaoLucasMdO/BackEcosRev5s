// api/__tests__/upload.test.js
import { jest } from '@jest/globals';

// Mock multer para simular upload de arquivo
const mockMulterSingle = jest.fn((fieldName) => {
  return (req, res, next) => {
    if (req.headers['x-mock-file']) {
      req.file = {
        path: 'https://cloudinary.com/mock-image.jpg',
        filename: 'mock_filename_123',
        originalname: 'test.jpg',
        mimetype: 'image/jpeg',
        size: 1024
      };
    }
    next();
  };
});

const mockMulter = jest.fn(() => ({
  single: mockMulterSingle
}));

jest.unstable_mockModule('multer', () => ({
  default: mockMulter
}));

// Mock multer-storage-cloudinary
jest.unstable_mockModule('multer-storage-cloudinary', () => ({
  CloudinaryStorage: jest.fn()
}));

// Mock uploadDb
jest.unstable_mockModule('../utils/uploadDb.js', () => ({
  insertImage: jest.fn(() => Promise.resolve({ insertId: 1 })),
  findImageById: jest.fn(() => Promise.resolve(null)),
  deleteImageById: jest.fn(() => Promise.resolve({ affectedRows: 0 })),
  updateImageById: jest.fn(() => Promise.resolve({}))
}));

// Mock usuarioDb
jest.unstable_mockModule('../utils/usuarioDb.js', () => ({
  findUserById: jest.fn(() => Promise.resolve(null)),
  updateUserImagemPerfilId: jest.fn(() => Promise.resolve({}))
}));

// Mock cloudinary
const mockCloudinary = {
  uploader: {
    destroy: jest.fn(() => Promise.resolve({ result: 'ok' }))
  }
};

jest.unstable_mockModule('../config/cloudinary.js', () => ({
  default: mockCloudinary
}));

// Importar DEPOIS dos mocks
const uploadDb = await import('../utils/uploadDb.js');
const usuarioDb = await import('../utils/usuarioDb.js');
const { default: uploadRouter } = await import('../routes/upload.js');
const express = (await import('express')).default;
const request = (await import('supertest')).default;
const jwt = (await import('jsonwebtoken')).default;

const app = express();
app.use(express.json());
app.use('/upload', uploadRouter);

describe('Upload Router', () => {
  let token;
  const userId = 1;

  beforeEach(() => {
    jest.clearAllMocks();
    token = jwt.sign(
      { usuario: { id: userId, tipo: 'Cliente' } },
      process.env.SECRET_KEY || 'test-secret'
    );
  });

  describe('POST /upload/image', () => {
    it('deve retornar 401 sem token', async () => {
      const res = await request(app)
        .post('/upload/image');

      expect(res.status).toBe(401);
    });

    it('deve retornar 400 se nenhuma imagem for enviada', async () => {
      const res = await request(app)
        .post('/upload/image')
        .set('access-token', token);

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Nenhuma imagem enviada');
    });

    it('deve fazer upload de nova imagem com sucesso', async () => {
      // Mock do usuário sem imagem prévia
      usuarioDb.findUserById.mockResolvedValue({ id: userId, imagemPerfilId: null });
      uploadDb.insertImage.mockResolvedValue({ insertId: 10 });
      usuarioDb.updateUserImagemPerfilId.mockResolvedValue({});

      const res = await request(app)
        .post('/upload/image')
        .set('access-token', token)
        .set('x-mock-file', 'true')
        .send({});

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('id', 10);
      expect(res.body).toHaveProperty('url');
      expect(uploadDb.insertImage).toHaveBeenCalled();
      expect(usuarioDb.updateUserImagemPerfilId).toHaveBeenCalledWith(userId, 10);
    });

    it('deve substituir imagem existente', async () => {
      const existingImageId = 5;
      const existingImage = {
        id: existingImageId,
        public_id: 'old_image_123',
        url: 'https://cloudinary.com/old.jpg'
      };

      // Mock do usuário com imagem prévia
      usuarioDb.findUserById.mockResolvedValue({ 
        id: userId, 
        imagemPerfilId: existingImageId 
      });
      uploadDb.findImageById.mockResolvedValue(existingImage);
      mockCloudinary.uploader.destroy.mockResolvedValue({ result: 'ok' });
      uploadDb.updateImageById.mockResolvedValue({});

      const res = await request(app)
        .post('/upload/image')
        .set('access-token', token)
        .set('x-mock-file', 'true')
        .send({});

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('id', existingImageId);
      expect(mockCloudinary.uploader.destroy).toHaveBeenCalledWith('old_image_123');
      expect(uploadDb.updateImageById).toHaveBeenCalledWith(
        existingImageId,
        expect.objectContaining({
          url: expect.any(String),
          public_id: expect.any(String)
        })
      );
    });

    it('deve retornar 500 se erro ao remover imagem antiga do Cloudinary', async () => {
      const existingImageId = 5;
      const existingImage = {
        id: existingImageId,
        public_id: 'old_image_123'
      };

      usuarioDb.findUserById.mockResolvedValue({ 
        id: userId, 
        imagemPerfilId: existingImageId 
      });
      uploadDb.findImageById.mockResolvedValue(existingImage);
      mockCloudinary.uploader.destroy.mockRejectedValue(new Error('Cloudinary error'));

      const res = await request(app)
        .post('/upload/image')
        .set('access-token', token)
        .set('x-mock-file', 'true')
        .send({});

      expect(res.status).toBe(500);
      expect(res.body.error).toBe('Erro ao remover imagem antiga do Cloudinary');
    });

    it('deve substituir imagem mesmo se existing não tiver public_id', async () => {
      const existingImageId = 5;
      const existingImage = {
        id: existingImageId,
        public_id: null // sem public_id
      };

      usuarioDb.findUserById.mockResolvedValue({ 
        id: userId, 
        imagemPerfilId: existingImageId 
      });
      uploadDb.findImageById.mockResolvedValue(existingImage);
      uploadDb.updateImageById.mockResolvedValue({});

      const res = await request(app)
        .post('/upload/image')
        .set('access-token', token)
        .set('x-mock-file', 'true')
        .send({});

      expect(res.status).toBe(200);
      // Não deve chamar destroy se não tem public_id
      expect(mockCloudinary.uploader.destroy).not.toHaveBeenCalled();
      expect(uploadDb.updateImageById).toHaveBeenCalled();
    });

    it('deve retornar 500 em caso de erro genérico', async () => {
      usuarioDb.findUserById.mockRejectedValue(new Error('Database error'));

      const res = await request(app)
        .post('/upload/image')
        .set('access-token', token)
        .set('x-mock-file', 'true')
        .send({});

      expect(res.status).toBe(500);
      expect(res.body.error).toBe('Erro ao enviar imagem');
      expect(res.body.details).toBe('Database error');
    });
  });

  describe('GET /upload/:id', () => {
    it('deve retornar imagem por ID', async () => {
      const mockImage = {
        id: 1,
        url: 'https://cloudinary.com/test.jpg',
        public_id: 'test_123'
      };
      uploadDb.findImageById.mockResolvedValue(mockImage);

      const res = await request(app).get('/upload/1');

      expect(res.status).toBe(200);
      expect(res.body).toEqual(mockImage);
    });

    it('deve retornar 404 se imagem não encontrada', async () => {
      uploadDb.findImageById.mockResolvedValue(null);

      const res = await request(app).get('/upload/999');

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Registro não encontrado');
    });

    it('deve retornar 500 em caso de erro', async () => {
      uploadDb.findImageById.mockRejectedValue(new Error('Database error'));

      const res = await request(app).get('/upload/1');

      expect(res.status).toBe(500);
      expect(res.body.error).toBe('Database error');
    });
  });

  describe('DELETE /upload/:id', () => {
    it('deve deletar imagem com sucesso', async () => {
      const mockImage = {
        id: 1,
        public_id: 'test_123'
      };
      uploadDb.findImageById.mockResolvedValue(mockImage);
      mockCloudinary.uploader.destroy.mockResolvedValue({ result: 'ok' });
      uploadDb.deleteImageById.mockResolvedValue({ affectedRows: 1 });

      const res = await request(app).delete('/upload/1');

      expect(res.status).toBe(200);
      expect(res.body.msg).toBe('Arquivo e metadados excluídos com sucesso');
      expect(mockCloudinary.uploader.destroy).toHaveBeenCalledWith('test_123');
    });

    it('deve deletar mesmo sem public_id', async () => {
      const mockImage = {
        id: 1,
        public_id: null // sem public_id
      };
      uploadDb.findImageById.mockResolvedValue(mockImage);
      uploadDb.deleteImageById.mockResolvedValue({ affectedRows: 1 });

      const res = await request(app).delete('/upload/1');

      expect(res.status).toBe(200);
      expect(res.body.msg).toBe('Arquivo e metadados excluídos com sucesso');
      // Não deve tentar destruir no Cloudinary
      expect(mockCloudinary.uploader.destroy).not.toHaveBeenCalled();
    });

    it('deve retornar 404 se imagem não encontrada', async () => {
      uploadDb.findImageById.mockResolvedValue(null);

      const res = await request(app).delete('/upload/999');

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Registro não encontrado');
    });

    it('deve retornar 500 se erro ao remover do Cloudinary', async () => {
      uploadDb.findImageById.mockResolvedValue({
        id: 1,
        public_id: 'test_123'
      });
      mockCloudinary.uploader.destroy.mockRejectedValue(new Error('Cloudinary error'));

      const res = await request(app).delete('/upload/1');

      expect(res.status).toBe(500);
      expect(res.body.error).toBe('Erro ao remover arquivo do Cloudinary');
    });

    it('deve retornar 404 se registro não deletado do DB', async () => {
      uploadDb.findImageById.mockResolvedValue({
        id: 1,
        public_id: 'test_123'
      });
      mockCloudinary.uploader.destroy.mockResolvedValue({ result: 'ok' });
      uploadDb.deleteImageById.mockResolvedValue({ affectedRows: 0 });

      const res = await request(app).delete('/upload/1');

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Registro não encontrado ao tentar excluir do DB');
    });

    it('deve retornar 500 em caso de erro genérico', async () => {
      uploadDb.findImageById.mockRejectedValue(new Error('Database error'));

      const res = await request(app).delete('/upload/1');

      expect(res.status).toBe(500);
      expect(res.body.error).toBe('Database error');
    });
  });
});