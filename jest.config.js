module.exports = {
    testEnvironment: 'node',
    testMatch: ['**/tests/**/*.test.js'],
    collectCoverageFrom: [
        'managers/**/*.js',
        'mws/**/*.js',
        '!managers/**/index.js',
        '!**/node_modules/**'
    ],
    coverageDirectory: 'coverage',
    coverageReporters: ['text', 'lcov', 'html'],
    setupFilesAfterEnv: ['./tests/setup.js'],
    testTimeout: 30000,
    verbose: true
};
