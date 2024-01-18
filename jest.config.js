const path = require('path');
let envFile = '.env.test';
if (process.env.DB === 'dynamodb') {
  envFile = '.env.dynamo.test';
}
require('dotenv').config({ path: path.resolve(__dirname, envFile) });

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
  moduleNameMapper: {
    "^axios$": 'axios/dist/node/axios.cjs'
  },
};
