const DynamoDbLocal = require('dynamodb-local');
const { default: Bot } = require('ringcentral-chatbot-core/dist/models/Bot');

const { TrelloWebhook } = require('../src/app/models/trello-webhook');
const { TrelloUser } = require('../src/app/models/trello-user');
const { RCWebhook } = require('../src/app/models/rc-webhook');
const { RcUser } = require('../src/app/models/rc-user');

jest.setTimeout(30000);

beforeAll(async () => {
  if (process.env.DIALECT === 'dynamodb' && !global.__DYNAMODB_PORT) {
    global.__DYNAMODB_PORT = Number.parseInt(process.env.DYNAMODB_LOCALHOST.split(':')[2]);
    await DynamoDbLocal.launch(global.__DYNAMODB_PORT, null, [], true);
  }
  await TrelloWebhook.sync();
  await TrelloUser.sync();
  await RCWebhook.sync();
  await RcUser.sync();
  await Bot.sync();
});

afterAll(async () => {
  if (global.__DYNAMODB_PORT) {
    const port = global.__DYNAMODB_PORT;
    global.__DYNAMODB_PORT = null;
    await DynamoDbLocal.stop(port);
  }
});
