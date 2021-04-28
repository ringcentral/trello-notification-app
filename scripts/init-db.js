require('dotenv').config();
const { RCWebhook } = require('../src/app/models/rc-webhook');
const { TrelloWebhook } = require('../src/app/models/trello-webhook');

async function initDB() {
  await RCWebhook.sync();
  await TrelloWebhook.sync();
}

initDB();
