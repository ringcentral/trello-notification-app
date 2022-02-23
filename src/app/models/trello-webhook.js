const Sequelize = require('sequelize');
const { sequelize } = require('./sequelize');

// Model for Trello Webhook data
exports.TrelloWebhook = sequelize.define('trello-webhooks', {
  id: {
    type: Sequelize.STRING, // identify for trello webhooks callback uri
    primaryKey: true,
  },
  rc_webhook_id: {
    type: Sequelize.STRING // rc webhook uri
  },
  trello_webhook_id: {
    type: Sequelize.STRING // identify for trello webhook id  https://developer.atlassian.com/cloud/trello/rest/api-group-webhooks/#api-webhooks-post
  },
  trello_user_id: {
    type: Sequelize.STRING // identify for trello webhook id  https://developer.atlassian.com/cloud/trello/rest/api-group-webhooks/#api-webhooks-post
  },
  config: {
    type: Sequelize.JSON,
  },
  enabled: {
    type: Sequelize.BOOLEAN,
    defaultValue: true
  },
  bot_id: {
    type: Sequelize.STRING,
  },
  conversation_id: {
    type: Sequelize.STRING,
  },
});
