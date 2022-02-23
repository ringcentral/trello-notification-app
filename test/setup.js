const { default: Bot } = require('ringcentral-chatbot-core/dist/models/Bot');

const { TrelloWebhook } = require('../src/app/models/trello-webhook');
const { TrelloUser } = require('../src/app/models/trello-user');
const { RCWebhook } = require('../src/app/models/rc-webhook');
const { RcUser } = require('../src/app/models/rc-user');

jest.setTimeout(30000);

beforeAll(async () => {
  await TrelloWebhook.sync();
  await TrelloUser.sync();
  await RCWebhook.sync();
  await RcUser.sync();
  await Bot.sync();
});
