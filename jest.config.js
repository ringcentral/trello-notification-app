const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env.test') });

module.exports = {
  testMatch: [
    '**/test/**/*.test.js'
  ],
  "setupFilesAfterEnv": [
    '<rootDir>/test/setup.js',
  ],
  reporters: ['default'],
  maxConcurrency: 1,
  testEnvironment: 'node',
  coveragePathIgnorePatterns: ['/node_modules/'],
};
