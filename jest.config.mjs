export default {
  testEnvironment: 'node',
  transform: {},
  testMatch: [
    '**/api/__tests__/**/*.test.js'
  ],
  collectCoverageFrom: [
    'api/routes/**/*.js',
    'api/middleware/**/*.js',
    '!**/node_modules/**',
    '!**/__tests__/**'
  ],
  coverageDirectory: 'coverage',
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70
    }
  },
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  testTimeout: 10000,
  moduleFileExtensions: ['js', 'mjs'],
  // Não é necessário extensionsToTreatAsEsm quando type: "module" está no package.json
  // Importante: não resetar os mocks entre testes
  resetMocks: false,
  restoreMocks: false,
  clearMocks: true
};