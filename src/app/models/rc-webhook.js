const Sequelize = require('sequelize');
const { generate } = require('shortid');
const { sequelize } = require('./sequelize');

exports.RCWebhook = sequelize.define('rc-webhooks', {
  id: {
    type: Sequelize.STRING, //  rc webhook uri
    primaryKey: true,
  },
  trello_webhook_id: {
    type: Sequelize.STRING,
    defaultValue: generate,
  },
  enabled: {
    type: Sequelize.BOOLEAN,
    defaultValue: true
  }
});
