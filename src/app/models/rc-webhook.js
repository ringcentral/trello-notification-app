const Sequelize = require('sequelize');
const { nanoid } = require('nanoid');
const { sequelize } = require('./sequelize');

// Model for RingCentral Webhook config data
exports.RCWebhook = sequelize.define('rcWebhooks', {
  id: {
    type: Sequelize.STRING, // rc webhook id
    primaryKey: true,
  },
  trello_webhook_id: {
    type: Sequelize.STRING, // identity for trello webhook model id
    defaultValue: () => nanoid(15),
  },
  enabled: {
    type: Sequelize.BOOLEAN,
    defaultValue: true
  },
});
