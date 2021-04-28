const Sequelize = require('sequelize');
const { sequelize } = require('./sequelize');

exports.TrelloWebhook = sequelize.define('trello-webhooks', {
  id: {
    type: Sequelize.STRING,
    primaryKey: true,
  },
  rc_webhook_id: {
    type: Sequelize.STRING
  },
  token: {
    type: Sequelize.STRING
  },
  enabled: {
    type: Sequelize.BOOLEAN,
    defaultValue: true
  },
});
