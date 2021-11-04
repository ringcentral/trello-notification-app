const Sequelize = require('sequelize');
const { sequelize } = require('./sequelize');

// Model for RC User data
exports.RcUser = sequelize.define('rc-users', {
  id: {
    type: Sequelize.STRING, // identify for rc user
    primaryKey: true,
  },
  trello_user_id: {
    type: Sequelize.STRING,
  },
});
