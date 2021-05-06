const Sequelize = require('sequelize');
const { generate } = require('shortid');
const { sequelize } = require('./sequelize');

// Model for RingCentral Webhook config data
exports.RCWebhook = sequelize.define('rc-webhooks', {
  id: {
    type: Sequelize.STRING, // rc webhook uri
    primaryKey: true,
  },
  trello_webhook_id: {
    type: Sequelize.STRING, // identity for trello webhook model id
    defaultValue: generate,
  },
  enabled: {
    type: Sequelize.BOOLEAN,
    defaultValue: true
  }
});
