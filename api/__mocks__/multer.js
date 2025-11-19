const multer = jest.fn(() => ({
  single: jest.fn(() => (req, res, next) => next())
}));

export default multer;