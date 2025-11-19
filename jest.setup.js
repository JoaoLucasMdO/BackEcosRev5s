process.env.SECRET_KEY = 'test-secret-key';
process.env.EXPIRES_IN = '1h';
process.env.NODE_ENV = 'test';

// Remova ou comente essas linhas que usam jest.fn()
// Deixe o console normal durante os testes ou use funções vazias
global.console = {
  ...console,
  error: () => {},  // Função vazia ao invés de jest.fn()
  warn: () => {},
  log: console.log,  // Mantém o log para debug se necessário
};