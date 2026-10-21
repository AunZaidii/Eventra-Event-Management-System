// Jest runs every *.test.js file under tests/. Tests share one test database,
// so they run one file at a time (--runInBand in package.json).
module.exports = {
  testEnvironment: 'node',
  testMatch: ['<rootDir>/tests/**/*.test.js'],
  collectCoverageFrom: ['src/**/*.js', '!src/server.js'],
  coverageReporters: ['text-summary', 'lcov'],
  testTimeout: 20000,
};
