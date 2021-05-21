require('dotenv').config();
const { RCWebhook } = require('../src/app/models/rc-webhook');
const { TrelloWebhook } = require('../src/app/models/trello-webhook');
const { TrelloUser } = require('../src/app/models/trello-user');

async function initDB() {
  await RCWebhook.sync();
  await TrelloWebhook.sync();
  await TrelloUser.sync();
}

initDB();
