require('dotenv').config();
const { default: Bot } = require('ringcentral-chatbot-core/dist/models/Bot');

const { RCWebhook } = require('../src/app/models/rc-webhook');
const { TrelloWebhook } = require('../src/app/models/trello-webhook');
const { TrelloUser } = require('../src/app/models/trello-user');
const { RcUser } = require('../src/app/models/rc-user');

async function initDB() {
  await RCWebhook.sync();
  await TrelloWebhook.sync();
  await TrelloUser.sync();
  await RcUser.sync();
  await Bot.sync();
}

initDB();
