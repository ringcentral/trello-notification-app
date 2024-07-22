const Sequelize = require('sequelize');
const crypto = require('crypto');
const { sequelize } = require('./sequelize');

function getCipherKey() {
  if (!process.env.APP_SERVER_SECRET_KEY) {
    throw new Error('APP_SERVER_SECRET_KEY is not defined');
  }
  if (process.env.APP_SERVER_SECRET_KEY.length < 32) {
    // pad secret key with spaces if it is less than 32 bytes
    return process.env.APP_SERVER_SECRET_KEY.padEnd(32, ' ');
  }
  if (process.env.APP_SERVER_SECRET_KEY.length > 32) {
    // truncate secret key if it is more than 32 bytes
    return process.env.APP_SERVER_SECRET_KEY.slice(0, 32);
  }
  return process.env.APP_SERVER_SECRET_KEY;
}

// Model for Trello User data
const TrelloUser = sequelize.define('trello-users', {
  id: {
    type: Sequelize.STRING, // identify for trello user
    primaryKey: true,
  },
  username: {
    type: Sequelize.STRING // no need, will be cleaned up in DB
  },
  fullName: {
    type: Sequelize.STRING // no need, will be cleaned up in DB
  },
  token: {
    type: Sequelize.STRING
  },
  writeable_token: {
    type: Sequelize.STRING
  },
  encrypted_token: {
    type: Sequelize.STRING
  },
  encrypted_writeable_token: {
    type: Sequelize.STRING
  },
});

function encodeToken(token) {
  const cipher = crypto.createCipheriv('aes-256-cbc', getCipherKey(), Buffer.alloc(16, 0));
  return cipher.update(token, 'utf8', 'hex') + cipher.final('hex');
}

function decodedCode(encryptedData) {
  const decipher = crypto.createDecipheriv('aes-256-cbc', getCipherKey(), Buffer.alloc(16, 0));
  return decipher.update(encryptedData, 'hex', 'utf8') + decipher.final('utf8');
}

const originalSave = TrelloUser.prototype.save;
TrelloUser.prototype.save = async function () {
  if (this.token) {
    // encode data to encryptedData
    this.encrypted_token = encodeToken(this.token);
    this.token = '';
  }
  if (this.writeable_token) {
    // encode data to encryptedData
    this.encrypted_writeable_token = encodeToken(this.writeable_token);
    this.writeable_token = '';
  }
  return originalSave.call(this);
}

TrelloUser.prototype.removeToken = function () {
  this.token = '';
  this.encrypted_token = '';
};

TrelloUser.prototype.removeWriteableToken = function () {
  this.writeable_token = '';
  this.encrypted_writeable_token = '';
};

TrelloUser.prototype.getToken = function () {
  if (this.encrypted_token) {
    return decodedCode(this.encrypted_token);
  }
  return this.token;
};

TrelloUser.prototype.getWriteableToken = function () {
  if (this.encrypted_writeable_token) {
    return decodedCode(this.encrypted_writeable_token);
  }
  return this.writeable_token;
}

exports.TrelloUser = TrelloUser;
