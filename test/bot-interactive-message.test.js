const request = require('supertest');
const nock = require('nock');
const axios = require('axios');
const { server } = require('../src/server');
const { TrelloWebhook } = require('../src/app/models/trello-webhook');
const { RcUser } = require('../src/app/models/rc-user');
const { TrelloUser } = require('../src/app/models/trello-user');

axios.defaults.adapter = require('axios/lib/adapters/http');

describe('Bot Notification', () => {
  const botId = '266262004';
  const groupId = '713297005';

  beforeAll(async () => {
    const rcTokenScope = nock(process.env.RINGCENTRAL_SERVER)
      .post(uri => uri.includes('/restapi/oauth/token'))
      .reply(200, {
        access_token: 'xxxxxx',
        token_type: 'bearer',
        expires_in: 2147483647,
        scope: 'SubscriptionWebhook TeamMessing ReadAccounts',
        owner_id: botId,
        endpoint_id: 'p7GZlEVHRwKDwbx6UkH0YQ'
      });
    const rcWebhookScope = nock(process.env.RINGCENTRAL_SERVER)
      .post(uri => uri.includes('/restapi/v1.0/subscription'))
      .reply(200, {});
    await request(server).get('/bot/oauth?code=xxxxxx&client_id=xxxxxx');
    rcTokenScope.done();
    rcWebhookScope.done();
  });

  it('should get 400 with wrong body params', async () => {
    const res = await request(server).post('/interactive-messages');
    expect(res.status).toEqual(400);
    const res1 = await request(server).post('/interactive-messages').send({ data: {} });
    expect(res1.status).toEqual(400);
  });

  it('should get 400 with wrong bot body params', async () => {
    const res = await request(server).post('/interactive-messages').send({
      data: {
        messageType: 'Bot',
      },
      user: {},
    });
    expect(res.status).toEqual(400);
    const res1 = await request(server).post('/interactive-messages').send({
      data: {
        messageType: 'Bot',
      },
      card: {},
      user: {},
    });
    expect(res1.status).toEqual(400);
  });

  it('should get 401 with RINGCENTRAL_CHATBOT_INTERACTIVE_MESSAGES_SHARED_SECRET and wrong signature', async () => {
    process.env.RINGCENTRAL_CHATBOT_INTERACTIVE_MESSAGES_SHARED_SECRET = 'test-secret';
    const res = await request(server).post('/interactive-messages').send({
      data: {
        messageType: 'Bot',
      },
      user: {},
      card: {},
      conversation: {},
    });
    delete process.env.RINGCENTRAL_CHATBOT_INTERACTIVE_MESSAGES_SHARED_SECRET;
    expect(res.status).toEqual(401);
  });

  it('should get 404 with wrong bot id', async () => {
    const res = await request(server).post('/interactive-messages').send({
      data: {
        messageType: 'Bot',
        botId: 'xxx',
      },
      user: {},
      card: {},
      conversation: {},
    });
    expect(res.status).toEqual(404);
  });
});
