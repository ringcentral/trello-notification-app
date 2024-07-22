const Sequelize = require('sequelize');
const { sequelize } = require('./sequelize');

// Model for Trello User data
exports.TrelloUser = sequelize.define('trello-users', {
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
  }
});
