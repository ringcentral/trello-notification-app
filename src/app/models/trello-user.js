const Sequelize = require('sequelize');
const { sequelize } = require('./sequelize');

// Model for Trello User data
exports.TrelloUser = sequelize.define('trello-users', {
  id: {
    type: Sequelize.STRING, // identify for trello user
    primaryKey: true,
  },
  username: {
    type: Sequelize.STRING
  },
  fullName: {
    type: Sequelize.STRING
  },
  token: {
    type: Sequelize.STRING
  },
  writeable_token: {
    type: Sequelize.STRING
  }
});
