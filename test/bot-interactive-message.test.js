const request = require('supertest');
const nock = require('nock');
const axios = require('axios');
axios.defaults.adapter = require('axios/lib/adapters/http');
const { server } = require('../src/server');
const { TrelloWebhook } = require('../src/app/models/trello-webhook');
const { RcUser } = require('../src/app/models/rc-user');
const { TrelloUser } = require('../src/app/models/trello-user');

const { getRequestBody } = require('./utils');

const mockAdaptiveCardData = require('./mock-data/card.json');

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

  it('should send setup card successfully with setup action', async () => {
    const directGroupId = 'test_direct_group_id';
    const rcGroupScope = nock(process.env.RINGCENTRAL_SERVER)
      .get(uri => uri.includes(`/restapi/v1.0/glip/groups/${groupId}`))
      .reply(200, {
        id: groupId,
        type: 'Team',
        members: [
          "170848004",
          "170853004",
          "713297005"
        ]
      });
    const rcDirectGroupScope = nock(process.env.RINGCENTRAL_SERVER)
      .post(uri => uri.includes(`/restapi/v1.0/glip/conversations`))
      .reply(200, {
        id: directGroupId,
        members: [
          "170848004",
          "713297005"
        ],
      });
    const rcCardScope = nock(process.env.RINGCENTRAL_SERVER)
      .post(uri => uri.includes(`/restapi/v1.0/glip/chats/${directGroupId}/adaptive-cards`))
      .reply(200, {
        id: 'auth_card_id',
      });
    const rcAuthCardPutScope = nock(process.env.RINGCENTRAL_SERVER)
      .put(uri => uri.includes(`/restapi/v1.0/glip/adaptive-cards/auth_card_id`))
      .reply(200, {
        id: 'auth_card_id',
      });
    const rcMessageScope = nock(process.env.RINGCENTRAL_SERVER)
      .post(uri => uri.includes(`/restapi/v1.0/glip/groups/${groupId}/posts`))
      .reply(200, {});
    const authCardRequestBodyPromise = getRequestBody(rcAuthCardPutScope);
    const messageRequestBodyPromise = getRequestBody(rcMessageScope);
    const res = await request(server).post('/interactive-messages').send({
      data: {
        messageType: 'Bot',
        botId: botId,
        action: 'setup',
      },
      user: {
        firstName: 'Test',
        lastName: 'Test1',
        extId: 'test_ext_id',
      },
      card: {},
      conversation: {
        id: groupId,
      },
    });
    expect(res.status).toEqual(200);
    const authCardRequestBody = await authCardRequestBodyPromise;
    const messageRequestBody = await messageRequestBodyPromise;
    expect(authCardRequestBody.fallbackText).toContain('Trello setup');
    expect(messageRequestBody.text).toContain('I just sent you a **Private** message');
    rcGroupScope.done();
    rcDirectGroupScope.done();
    rcCardScope.done();
    rcAuthCardPutScope.done();
    rcMessageScope.done();
  });

  it('should send not authorized yet when unauthorize but not authorized', async () => {
    const rcAuthCardPutScope = nock(process.env.RINGCENTRAL_SERVER)
      .put(uri => uri.includes(`/restapi/v1.0/glip/adaptive-cards/auth_card_id`))
      .reply(200, {
        id: 'auth_card_id',
      });
    const authCardRequestBodyPromise = getRequestBody(rcAuthCardPutScope);
    const res = await request(server).post('/interactive-messages').send({
      data: {
        messageType: 'Bot',
        botId: botId,
        action: 'unauthorize',
      },
      user: {
        firstName: 'Test',
        lastName: 'Test1',
        extId: 'test_ext_id',
      },
      card: {
        id: 'auth_card_id',
      },
      conversation: {
        id: groupId,
      },
    });
    const authCardRequestBody = await authCardRequestBodyPromise;
    expect(res.status).toEqual(200)
    expect(authCardRequestBody.fallbackText).toContain('have not authorized');
    rcAuthCardPutScope.done();
  });

  it('should send not authorized yet when user has been unauthorized', async () => {
    const rcUserId = '170848010';
    const trelloUserRecord = await TrelloUser.create({
      id: 'test_trello_user_id',
      writeable_token: '',
    });
    const rcUserRecord = await RcUser.create({
      id: `rcext-${rcUserId}`,
      trello_user_id: trelloUserRecord.id,
    });
    const rcAuthCardPutScope = nock(process.env.RINGCENTRAL_SERVER)
      .put(uri => uri.includes(`/restapi/v1.0/glip/adaptive-cards/auth_card_id`))
      .reply(200, {
        id: 'auth_card_id',
      });
    const authCardRequestBodyPromise = getRequestBody(rcAuthCardPutScope);
    const res = await request(server).post('/interactive-messages').send({
      data: {
        messageType: 'Bot',
        botId: botId,
        action: 'unauthorize',
      },
      user: {
        firstName: 'Test',
        lastName: 'Test1',
        extId: rcUserId,
      },
      card: {
        id: 'auth_card_id',
      },
      conversation: {
        id: groupId,
      },
    });
    const authCardRequestBody = await authCardRequestBodyPromise;
    expect(res.status).toEqual(200)
    expect(authCardRequestBody.fallbackText).toContain('have not authorized');
    rcAuthCardPutScope.done();
    await TrelloUser.destroy({ where: { id: trelloUserRecord.id }});
    await RcUser.destroy({ where: { id: rcUserRecord.id }});
  });

  it('should unauthorized successfully without bot_subscriptions', async () => {
    const rcUserId = '170848010';
    const trelloToken = 'test_trello_user_token';
    let trelloUserRecord = await TrelloUser.create({
      id: 'test_trello_user_id',
      writeable_token: trelloToken,
    });
    const rcUserRecord = await RcUser.create({
      id: `rcext-${rcUserId}`,
      trello_user_id: trelloUserRecord.id,
    });
    const rcAuthCardPutScope = nock(process.env.RINGCENTRAL_SERVER)
      .put(uri => uri.includes(`/restapi/v1.0/glip/adaptive-cards/auth_card_id`))
      .reply(200, {
        id: 'auth_card_id',
      });
    const trelloRevokeScope = nock('https://api.trello.com')
      .delete(uri => uri.includes(`/1/tokens/${trelloToken}?`))
      .reply(200, {});
    const authCardRequestBodyPromise = getRequestBody(rcAuthCardPutScope);
    const res = await request(server).post('/interactive-messages').send({
      data: {
        messageType: 'Bot',
        botId: botId,
        action: 'unauthorize',
      },
      user: {
        firstName: 'Test',
        lastName: 'Test1',
        extId: rcUserId,
      },
      card: {
        id: 'auth_card_id',
      },
      conversation: {
        id: groupId,
      },
    });
    const authCardRequestBody = await authCardRequestBodyPromise;
    expect(res.status).toEqual(200)
    expect(authCardRequestBody.fallbackText).toContain('unauthorized Trello successfully');
    trelloUserRecord = await TrelloUser.findByPk(trelloUserRecord.id);
    expect(!!trelloUserRecord.writeable_token).toEqual(false);
    rcAuthCardPutScope.done();
    trelloRevokeScope.done();
    await TrelloUser.destroy({ where: { id: trelloUserRecord.id }});
    await RcUser.destroy({ where: { id: rcUserRecord.id }});
  });

  it('should unauthorized successfully with bot_subscriptions', async () => {
    const rcUserId = '170848010';
    const trelloToken = 'test_trello_user_token';
    let trelloUserRecord = await TrelloUser.create({
      id: 'test_trello_user_id',
      writeable_token: trelloToken,
    });
    let rcUserRecord = await RcUser.create({
      id: `rcext-${rcUserId}`,
      trello_user_id: trelloUserRecord.id,
      bot_subscriptions: [{
        id: 'test_subscription_id',
        conversation_id: groupId,
        boardId: 'test_board_id',
      }],
    });
    await TrelloWebhook.create({
      id: 'test_subscription_id',
      bot_id: botId,
      conversation_id: groupId,
      trello_user_id: trelloUserRecord.id,
      config: {
        boardId: 'test-board-id',
        filters: '',
        labels: [],
      },
    });
    const rcAuthCardPutScope = nock(process.env.RINGCENTRAL_SERVER)
      .put(uri => uri.includes(`/restapi/v1.0/glip/adaptive-cards/auth_card_id`))
      .reply(200, {
        id: 'auth_card_id',
      });
    const trelloRevokeScope = nock('https://api.trello.com')
      .delete(uri => uri.includes(`/1/tokens/${trelloToken}?`))
      .reply(200, {});
    const authCardRequestBodyPromise = getRequestBody(rcAuthCardPutScope);
    const res = await request(server).post('/interactive-messages').send({
      data: {
        messageType: 'Bot',
        botId: botId,
        action: 'unauthorize',
      },
      user: {
        firstName: 'Test',
        lastName: 'Test1',
        extId: rcUserId,
      },
      card: {
        id: 'auth_card_id',
      },
      conversation: {
        id: groupId,
      },
    });
    const authCardRequestBody = await authCardRequestBodyPromise;
    expect(res.status).toEqual(200)
    expect(authCardRequestBody.fallbackText).toContain('unauthorized Trello successfully');
    trelloUserRecord = await TrelloUser.findByPk(trelloUserRecord.id);
    expect(!!trelloUserRecord.writeable_token).toEqual(false);
    rcUserRecord = await RcUser.findByPk(rcUserRecord.id);
    expect(!!rcUserRecord.bot_subscriptions).toEqual(false);
    const trelloWebhook = await TrelloWebhook.findByPk('test_subscription_id');
    expect(!!trelloWebhook).toEqual(false);
    rcAuthCardPutScope.done();
    trelloRevokeScope.done();
    await TrelloUser.destroy({ where: { id: trelloUserRecord.id }});
    await RcUser.destroy({ where: { id: rcUserRecord.id }});
  });

  it('should send auth card when have not setup action and not authorized', async () => {
    const directGroupId = 'test_direct_group_id';
    const rcDirectGroupScope = nock(process.env.RINGCENTRAL_SERVER)
      .post(uri => uri.includes(`/restapi/v1.0/glip/conversations`))
      .reply(200, {
        id: directGroupId,
        members: [
          "170848004",
          "713297005"
        ],
      });
    const rcCardScope = nock(process.env.RINGCENTRAL_SERVER)
      .post(uri => uri.includes(`/restapi/v1.0/glip/chats/${directGroupId}/adaptive-cards`))
      .reply(200, {
        id: 'auth_card_id',
      });
    const rcAuthCardPutScope = nock(process.env.RINGCENTRAL_SERVER)
      .put(uri => uri.includes(`/restapi/v1.0/glip/adaptive-cards/auth_card_id`))
      .reply(200, {
        id: 'auth_card_id',
      });
    const rcMessageScope = nock(process.env.RINGCENTRAL_SERVER)
      .post(uri => uri.includes(`/restapi/v1.0/glip/groups/${groupId}/posts`))
      .reply(200, {});
    const authCardRequestBodyPromise = getRequestBody(rcAuthCardPutScope);
    const messageRequestBodyPromise = getRequestBody(rcMessageScope);
    const res = await request(server).post('/interactive-messages').send({
      data: {
        messageType: 'Bot',
        botId: botId,
        action: 'joinCard',
        cardId: 'trello_card_id',
      },
      user: {
        firstName: 'Test',
        lastName: 'Test1',
        extId: 'test_ext_id',
      },
      card: {
        id: 'auth_card_id',
      },
      conversation: {
        id: groupId,
      },
    });
    const authCardRequestBody = await authCardRequestBodyPromise;
    const messageRequestBody = await messageRequestBodyPromise;
    expect(res.status).toEqual(200)
    expect(authCardRequestBody.fallbackText).toContain('Connect with Trello');
    expect(messageRequestBody.text).toContain('I just sent you a **Private** message');
    rcAuthCardPutScope.done();
    rcDirectGroupScope.done();
    rcCardScope.done();
    rcMessageScope.done();
  });

  it('should send auth card when have setup actions and not authorized', async () => {
    const rcAuthCardPutScope = nock(process.env.RINGCENTRAL_SERVER)
      .put(uri => uri.includes(`/restapi/v1.0/glip/adaptive-cards/setup_card_id`))
      .reply(200, {
        id: 'auth_card_id',
      });
    const authCardRequestBodyPromise = getRequestBody(rcAuthCardPutScope);
    const res = await request(server).post('/interactive-messages').send({
      data: {
        messageType: 'Bot',
        botId: botId,
        action: 'subscribe',
        cardId: 'trello_card_id',
      },
      user: {
        firstName: 'Test',
        lastName: 'Test1',
        extId: 'test_ext_id',
      },
      card: {
        id: 'setup_card_id',
      },
      conversation: {
        id: groupId,
      },
    });
    const authCardRequestBody = await authCardRequestBodyPromise;
    expect(res.status).toEqual(200)
    expect(authCardRequestBody.fallbackText).toContain('Trello notification setup');
    rcAuthCardPutScope.done();
  });

  it('should send setup card when have addSubscription actions', async () => {
    const rcUserId = '170848010';
    const trelloToken = 'test_trello_user_token';
    let trelloUserRecord = await TrelloUser.create({
      id: 'test_trello_user_id',
      writeable_token: trelloToken,
    });
    let rcUserRecord = await RcUser.create({
      id: `rcext-${rcUserId}`,
      trello_user_id: trelloUserRecord.id,
      bot_subscriptions: [],
    });
    const rcCardPutScope = nock(process.env.RINGCENTRAL_SERVER)
      .put(uri => uri.includes(`/restapi/v1.0/glip/adaptive-cards/rc_card_id`))
      .reply(200, {
        id: 'rc_card_id',
      });
    const trelloBoardsScope = nock('https://api.trello.com')
      .get(uri => uri.includes('/1/members/me/boards?'))
      .reply(200, [
        {
          "name": "Greatest Product Roadmap",
          "id": "5b6893f01cb3228998cf629e",
        },
        {
          "name": "Never ending Backlog",
          "id": "5b689b3228998cf3f01c629e",
        },
      ]);
    const rcCardRequestBodyPromise = getRequestBody(rcCardPutScope);
    const res = await request(server).post('/interactive-messages').send({
      data: {
        messageType: 'Bot',
        botId: botId,
        action: 'addSubscription',
      },
      user: {
        firstName: 'Test',
        lastName: 'Test1',
        extId: rcUserId,
      },
      card: {
        id: 'rc_card_id',
      },
      conversation: {
        id: groupId,
      },
    });
    const rcCardRequestBody = await rcCardRequestBodyPromise;
    expect(res.status).toEqual(200)
    expect(rcCardRequestBody.fallbackText).toContain('Trello setup');
    rcCardPutScope.done();
    trelloBoardsScope.done();
    await RcUser.destroy({ where: { id: rcUserRecord.id }});
    await TrelloUser.destroy({ where: { id: trelloUserRecord.id }});
  });

  it('should respond 404 when have editSubscription with wrong subscription id', async () => {
    const rcUserId = '170848010';
    const trelloToken = 'test_trello_user_token';
    let trelloUserRecord = await TrelloUser.create({
      id: 'test_trello_user_id',
      writeable_token: trelloToken,
    });
    let rcUserRecord = await RcUser.create({
      id: `rcext-${rcUserId}`,
      trello_user_id: trelloUserRecord.id,
      bot_subscriptions: [],
    });
    const res = await request(server).post('/interactive-messages').send({
      data: {
        messageType: 'Bot',
        botId: botId,
        action: 'editSubscription',
        subscriptionId: 'xxx'
      },
      user: {
        firstName: 'Test',
        lastName: 'Test1',
        extId: rcUserId,
      },
      card: {
        id: 'rc_card_id',
      },
      conversation: {
        id: groupId,
      },
    });
    expect(res.status).toEqual(404)
    await RcUser.destroy({ where: { id: rcUserRecord.id }});
    await TrelloUser.destroy({ where: { id: trelloUserRecord.id }});
  });

  it('should send setup card when have editSubscription actions', async () => {
    const rcUserId = '170848010';
    const trelloToken = 'test_trello_user_token';
    let trelloUserRecord = await TrelloUser.create({
      id: 'test_trello_user_id',
      writeable_token: trelloToken,
    });
    let rcUserRecord = await RcUser.create({
      id: `rcext-${rcUserId}`,
      trello_user_id: trelloUserRecord.id,
      bot_subscriptions: [],
    });
    const rcCardPutScope = nock(process.env.RINGCENTRAL_SERVER)
      .put(uri => uri.includes(`/restapi/v1.0/glip/adaptive-cards/rc_card_id`))
      .reply(200, {
        id: 'rc_card_id',
      });
    const trelloWebhook = await TrelloWebhook.create({
      id: 'test_subscription_id',
      bot_id: botId,
      conversation_id: groupId,
      trello_user_id: trelloUserRecord.id,
      config: {
        boardId: 'test-board-id',
        filters: '',
        labels: [],
      },
    });
    const trelloBoardsScope = nock('https://api.trello.com')
      .get(uri => uri.includes('/1/members/me/boards?'))
      .reply(200, [
        {
          "name": "Greatest Product Roadmap",
          "id": "5b6893f01cb3228998cf629e",
        },
        {
          "name": "Never ending Backlog",
          "id": "5b689b3228998cf3f01c629e",
        },
      ]);
    const rcCardRequestBodyPromise = getRequestBody(rcCardPutScope);
    const res = await request(server).post('/interactive-messages').send({
      data: {
        messageType: 'Bot',
        botId: botId,
        action: 'editSubscription',
        subscriptionId: 'test_subscription_id',
      },
      user: {
        firstName: 'Test',
        lastName: 'Test1',
        extId: rcUserId,
      },
      card: {
        id: 'rc_card_id',
      },
      conversation: {
        id: groupId,
      },
    });
    const rcCardRequestBody = await rcCardRequestBodyPromise;
    expect(res.status).toEqual(200)
    expect(rcCardRequestBody.fallbackText).toContain('Trello setup');
    rcCardPutScope.done();
    trelloBoardsScope.done();
    await RcUser.destroy({ where: { id: rcUserRecord.id }});
    await TrelloUser.destroy({ where: { id: trelloUserRecord.id }});
    await TrelloWebhook.destroy({ where: { id: trelloWebhook.id }});
  });

  it('should respond 404 when have removeSubscription with wrong subscription id', async () => {
    const rcUserId = '170848010';
    const trelloToken = 'test_trello_user_token';
    let trelloUserRecord = await TrelloUser.create({
      id: 'test_trello_user_id',
      writeable_token: trelloToken,
    });
    let rcUserRecord = await RcUser.create({
      id: `rcext-${rcUserId}`,
      trello_user_id: trelloUserRecord.id,
      bot_subscriptions: [],
    });
    const res = await request(server).post('/interactive-messages').send({
      data: {
        messageType: 'Bot',
        botId: botId,
        action: 'removeSubscription',
        subscriptionId: 'xxx'
      },
      user: {
        firstName: 'Test',
        lastName: 'Test1',
        extId: rcUserId,
      },
      card: {
        id: 'rc_card_id',
      },
      conversation: {
        id: groupId,
      },
    });
    expect(res.status).toEqual(404);
    await RcUser.destroy({ where: { id: rcUserRecord.id }});
    await TrelloUser.destroy({ where: { id: trelloUserRecord.id }});
  });

  it('should remove subscription successfully', async () => {
    const rcUserId = '170848010';
    const trelloToken = 'test_trello_user_token';
    let trelloUserRecord = await TrelloUser.create({
      id: 'test_trello_user_id',
      writeable_token: trelloToken,
    });
    let rcUserRecord = await RcUser.create({
      id: `rcext-${rcUserId}`,
      trello_user_id: trelloUserRecord.id,
      bot_subscriptions: [{
        id: 'test_subscription_id',
        conversation_id: groupId,
        boardId: 'test_board_id',
      }, {
        id: 'test_subscription_id_1',
        conversation_id: groupId,
        boardId: 'test_board_id',
      }],
    });
    const rcCardPutScope = nock(process.env.RINGCENTRAL_SERVER)
      .put(uri => uri.includes(`/restapi/v1.0/glip/adaptive-cards/rc_card_id`))
      .reply(200, {
        id: 'rc_card_id',
      });
    await TrelloWebhook.create({
      id: 'test_subscription_id',
      bot_id: botId,
      conversation_id: groupId,
      trello_user_id: trelloUserRecord.id,
      trello_webhook_id: 'test_webhook_id',
      config: {
        boardId: 'test-board-id',
        filters: '',
        labels: [],
      },
    });
    const trelloDeleteWebhooksScope = nock('https://api.trello.com')
      .delete(uri => uri.includes(`/1/webhooks/test_webhook_id?`))
      .reply(200, {});
    const rcCardRequestBodyPromise = getRequestBody(rcCardPutScope);
    const res = await request(server).post('/interactive-messages').send({
      data: {
        messageType: 'Bot',
        botId: botId,
        action: 'removeSubscription',
        subscriptionId: 'test_subscription_id',
        boardName: 'TestBoard',
      },
      user: {
        firstName: 'Test',
        lastName: 'Test1',
        extId: rcUserId,
      },
      card: {
        id: 'rc_card_id',
      },
      conversation: {
        id: groupId,
      },
    });
    const rcCardRequestBody = await rcCardRequestBodyPromise;
    expect(res.status).toEqual(200)
    expect(JSON.stringify(rcCardRequestBody)).toContain('removed successfully');
    const trelloWebhook = await TrelloWebhook.findByPk('test_subscription_id');
    expect(!!trelloWebhook).toEqual(false);
    rcCardPutScope.done();
    trelloDeleteWebhooksScope.done();
    await RcUser.destroy({ where: { id: rcUserRecord.id }});
    await TrelloUser.destroy({ where: { id: trelloUserRecord.id }});
  });

  describe('subscription', () => {
    const rcUserId = '170848010';
    const trelloToken = 'test_trello_user_token';
    let rcUserRecord;
    let trelloUserRecord

    beforeAll(async () => {
      trelloUserRecord = await TrelloUser.create({
        id: 'test_trello_user_id',
        writeable_token: trelloToken,
      });
      rcUserRecord = await RcUser.create({
        id: `rcext-${rcUserId}`,
        trello_user_id: trelloUserRecord.id,
        bot_subscriptions: [],
      });
    });

    afterAll(async () => {
      await RcUser.destroy({ where: { id: rcUserRecord.id }});
      await TrelloUser.destroy({ where: { id: trelloUserRecord.id }});
    });

    it('should create subscription successfully', async () => {
      const rcCardPutScope = nock(process.env.RINGCENTRAL_SERVER)
        .put(uri => uri.includes(`/restapi/v1.0/glip/adaptive-cards/rc_card_id`))
        .reply(200, {
          id: 'rc_card_id',
        });
      const trelloBoardsScope = nock('https://api.trello.com')
        .get(uri => uri.includes('/1/members/me/boards?'))
        .reply(200, [
          {
            "name": "Greatest Product Roadmap",
            "id": "5b6893f01cb3228998cf629e",
          },
          {
            "name": "Never ending Backlog",
            "id": "5b689b3228998cf3f01c629e",
          },
        ]);
      const trelloLabelsScope = nock('https://api.trello.com')
        .get(uri => uri.includes(`/1/boards/5b6893f01cb3228998cf629e/labels?`))
        .reply(200, [
          { "id":"6094fb83d41eeff1fa76129d", "name":"", "color":"green" },
          { "id":"6094fb83d41eeff1fa7612a1", "name":"", "color":"yellow" },
        ]);
      const trelloWebhooksScope = nock('https://api.trello.com')
        .post(uri => uri.includes('/1/webhooks?'))
        .reply(200, {
          id: 'test_trello_webhook_id',
        });
      const rcCardRequestBodyPromise = getRequestBody(rcCardPutScope);
      const res = await request(server).post('/interactive-messages').send({
        data: {
          messageType: 'Bot',
          botId: botId,
          action: 'subscribe',
          boardId: '5b6893f01cb3228998cf629e',
          conversationName: 'TestTeam',
          listFilters: 'createList',
          cardFilters: 'createCard',
          checklistFilters: '',
        },
        user: {
          firstName: 'Test',
          lastName: 'Test1',
          extId: rcUserId,
        },
        card: {
          id: 'rc_card_id',
        },
        conversation: {
          id: groupId,
        },
      });
      const rcCardRequestBody = await rcCardRequestBodyPromise;
      expect(res.status).toEqual(200)
      expect(JSON.stringify(rcCardRequestBody)).toContain('Existing subscriptions');
      rcUserRecord = await RcUser.findByPk(`rcext-${rcUserId}`);
      expect(rcUserRecord.bot_subscriptions.length).toEqual(1);
      const trelloWebhook = await TrelloWebhook.findByPk(rcUserRecord.bot_subscriptions[0].id);
      expect(trelloWebhook.trello_webhook_id).toEqual('test_trello_webhook_id');
      rcCardPutScope.done();
      trelloBoardsScope.done();
      trelloLabelsScope.done();
      trelloWebhooksScope.done();
    });

    it('should respond 404 with wrong subscription id', async () => {
      const res = await request(server).post('/interactive-messages').send({
        data: {
          messageType: 'Bot',
          botId: botId,
          action: 'subscribe',
          boardId: '5b6893f01cb3228998cf629e',
          conversationName: 'TestTeam',
          subscriptionId: 'xxxx',
          listFilters: '',
          cardFilters: '',
          checklistFilters: 'addChecklistToCard',
        },
        user: {
          firstName: 'Test',
          lastName: 'Test1',
          extId: rcUserId,
        },
        card: {
          id: 'rc_card_id',
        },
        conversation: {
          id: groupId,
        },
      });
      expect(res.status).toEqual(404)
    });
  
    it('should update subscription successfully', async () => {
      const rcCardPutScope = nock(process.env.RINGCENTRAL_SERVER)
        .put(uri => uri.includes(`/restapi/v1.0/glip/adaptive-cards/rc_card_id`))
        .reply(200, {
          id: 'rc_card_id',
        });
      const trelloBoardsScope = nock('https://api.trello.com')
        .get(uri => uri.includes('/1/members/me/boards?'))
        .reply(200, [
          {
            "name": "Greatest Product Roadmap",
            "id": "5b6893f01cb3228998cf629e",
          },
          {
            "name": "Never ending Backlog",
            "id": "5b689b3228998cf3f01c629e",
          },
        ]);
      const trelloLabelsScope = nock('https://api.trello.com')
        .get(uri => uri.includes(`/1/boards/5b6893f01cb3228998cf629e/labels?`))
        .reply(200, [
          { "id":"6094fb83d41eeff1fa76129d", "name":"", "color":"green" },
          { "id":"6094fb83d41eeff1fa7612a1", "name":"", "color":"yellow" },
        ]);
      const trelloWebhooksScope = nock('https://api.trello.com')
        .post(uri => uri.includes('/1/webhooks?'))
        .reply(200, {
          id: 'new_test_trello_webhook_id',
        });
      const trelloDeleteWebhooksScope = nock('https://api.trello.com')
        .delete(uri => uri.includes(`/1/webhooks/test_trello_webhook_id?`))
        .reply(200, {});
      const rcCardRequestBodyPromise = getRequestBody(rcCardPutScope);
      const res = await request(server).post('/interactive-messages').send({
        data: {
          messageType: 'Bot',
          botId: botId,
          action: 'subscribe',
          boardId: '5b6893f01cb3228998cf629e',
          conversationName: 'TestTeam',
          subscriptionId: rcUserRecord.bot_subscriptions[0].id,
          listFilters: '',
          cardFilters: '',
          checklistFilters: 'addChecklistToCard',
        },
        user: {
          firstName: 'Test',
          lastName: 'Test1',
          extId: rcUserId,
        },
        card: {
          id: 'rc_card_id',
        },
        conversation: {
          id: groupId,
        },
      });
      const rcCardRequestBody = await rcCardRequestBodyPromise;
      expect(res.status).toEqual(200)
      expect(JSON.stringify(rcCardRequestBody)).toContain('Existing subscriptions');
      rcUserRecord = await RcUser.findByPk(`rcext-${rcUserId}`);
      expect(rcUserRecord.bot_subscriptions.length).toEqual(1);
      const trelloWebhook = await TrelloWebhook.findByPk(rcUserRecord.bot_subscriptions[0].id);
      expect(trelloWebhook.trello_webhook_id).toEqual('new_test_trello_webhook_id');
      rcCardPutScope.done();
      trelloBoardsScope.done();
      trelloLabelsScope.done();
      trelloWebhooksScope.done();
      trelloDeleteWebhooksScope.done();
    });
  });

  describe('card actions', () => {
    const rcUserId = '170848010';
    const trelloUserId = 'test_trello_user_id';
    let trelloUserRecord;
    let rcUserRecord;
    beforeAll(async () => {
      trelloUserRecord = await TrelloUser.create({
        id: trelloUserId,
        writeable_token: 'test_trello_user_token',
      });
      rcUserRecord = await RcUser.create({
        id: `rcext-${rcUserId}`,
        trello_user_id: trelloUserRecord.id,
        bot_subscriptions: [],
      });
    });

    afterAll(async () => {
      await RcUser.destroy({ where: { id: rcUserRecord.id }});
      await TrelloUser.destroy({ where: { id: trelloUserRecord.id }});
    });

    it('should send joined message if user has joined', async() => {
      const rcMessageScope = nock(process.env.RINGCENTRAL_SERVER)
        .post(uri => uri.includes(`/restapi/v1.0/glip/groups/${groupId}/posts`))
        .reply(200, {});
      const trelloCardId = 'test-trello-card-id';
      const trelloMembersScope = nock('https://api.trello.com')
        .get(uri => uri.includes(`/1/cards/${trelloCardId}/members?`))
        .reply(200, [{
          id: trelloUserId
        }]);
      let requestBody = null;
      rcMessageScope.once('request', ({ headers: requestHeaders }, interceptor, reqBody) => {
        requestBody = JSON.parse(reqBody);
      });
      const res = await request(server).post('/interactive-messages').send({
        data: {
          messageType: 'Bot',
          botId: botId,
          action: 'joinCard',
          cardId: trelloCardId,
        },
        user: {
          firstName: 'Test',
          lastName: 'Test1',
          extId: rcUserId,
        },
        card: {
          id: 'rc_card_id',
        },
        conversation: {
          id: groupId,
        },
      });
      expect(res.status).toEqual(200);
      expect(requestBody.text).toContain('you had joined the card');
      rcMessageScope.done();
      trelloMembersScope.done();
    });

    it('should join successfully', async() => {
      const trelloCardId = 'test-trello-card-id';
      const trelloMembersScope = nock('https://api.trello.com')
        .get(uri => uri.includes(`/1/cards/${trelloCardId}/members?`))
        .reply(200, []);
      const trelloJoinScope = nock('https://api.trello.com')
        .post(uri => uri.includes(`/1/cards/${trelloCardId}/idMembers?`))
        .reply(200, {});
      const rcCardPutScope = nock(process.env.RINGCENTRAL_SERVER)
        .put(uri => uri.includes(`/restapi/v1.0/glip/adaptive-cards/rc_card_id`))
        .reply(200, {
          id: 'rc_card_id',
        });
      const rcCardGetScope = nock(process.env.RINGCENTRAL_SERVER)
        .get(uri => uri.includes(`/restapi/v1.0/glip/adaptive-cards/rc_card_id`))
        .reply(200, mockAdaptiveCardData);
      const rcCardRequestBodyPromise = getRequestBody(rcCardPutScope);
      const res = await request(server).post('/interactive-messages').send({
        data: {
          messageType: 'Bot',
          botId: botId,
          action: 'joinCard',
          cardId: trelloCardId,
        },
        user: {
          firstName: 'Test',
          lastName: 'Test1',
          extId: rcUserId,
        },
        card: {
          id: 'rc_card_id',
        },
        conversation: {
          id: groupId,
        },
      });
      expect(res.status).toEqual(200);
      const rcCardRequestBody = await rcCardRequestBodyPromise;
      expect(JSON.stringify(rcCardRequestBody)).toContain('joined the card');
      rcCardPutScope.done();
      trelloMembersScope.done();
      trelloJoinScope.done();
      rcCardGetScope.done();
    });

    it('should comment successfully', async() => {
      const trelloCardId = 'test-trello-card-id';
      const trelloCommentScope = nock('https://api.trello.com')
        .post(uri => uri.includes(`/1/cards/${trelloCardId}/actions/comments?`))
        .reply(200, {});
      const rcCardPutScope = nock(process.env.RINGCENTRAL_SERVER)
        .put(uri => uri.includes(`/restapi/v1.0/glip/adaptive-cards/rc_card_id`))
        .reply(200, {
          id: 'rc_card_id',
        });
      const rcCardGetScope = nock(process.env.RINGCENTRAL_SERVER)
        .get(uri => uri.includes(`/restapi/v1.0/glip/adaptive-cards/rc_card_id`))
        .reply(200, mockAdaptiveCardData);
      const rcCardRequestBodyPromise = getRequestBody(rcCardPutScope);
      const res = await request(server).post('/interactive-messages').send({
        data: {
          messageType: 'Bot',
          botId: botId,
          action: 'commentCard',
          cardId: trelloCardId,
          comment: 'test comment',
        },
        user: {
          firstName: 'Test',
          lastName: 'Test1',
          extId: rcUserId,
        },
        card: {
          id: 'rc_card_id',
        },
        conversation: {
          id: groupId,
        },
      });
      expect(res.status).toEqual(200);
      const rcCardRequestBody = await rcCardRequestBodyPromise;
      expect(JSON.stringify(rcCardRequestBody)).toContain('commented at');
      rcCardPutScope.done();
      trelloCommentScope.done();
      rcCardGetScope.done();
    });

    it('should set due data successfully', async() => {
      const trelloCardId = 'test-trello-card-id';
      const trelloScope = nock('https://api.trello.com')
        .put(uri => uri.includes(`/1/cards/${trelloCardId}?`))
        .reply(200, {});
      const rcCardPutScope = nock(process.env.RINGCENTRAL_SERVER)
        .put(uri => uri.includes(`/restapi/v1.0/glip/adaptive-cards/rc_card_id`))
        .reply(200, {
          id: 'rc_card_id',
        });
      const rcCardGetScope = nock(process.env.RINGCENTRAL_SERVER)
        .get(uri => uri.includes(`/restapi/v1.0/glip/adaptive-cards/rc_card_id`))
        .reply(200, mockAdaptiveCardData);
      const rcCardRequestBodyPromise = getRequestBody(rcCardPutScope);
      const res = await request(server).post('/interactive-messages').send({
        data: {
          messageType: 'Bot',
          botId: botId,
          action: 'setCardDueDate',
          cardId: trelloCardId,
          dueDate: '2019-01-01'
        },
        user: {
          firstName: 'Test',
          lastName: 'Test1',
          extId: rcUserId,
        },
        card: {
          id: 'rc_card_id',
        },
        conversation: {
          id: groupId,
        },
      });
      expect(res.status).toEqual(200);
      const rcCardRequestBody = await rcCardRequestBodyPromise;
      expect(JSON.stringify(rcCardRequestBody)).toContain('set the due date');
      rcCardPutScope.done();
      trelloScope.done();
      rcCardGetScope.done();
    });

    it('should add label successfully', async() => {
      const trelloCardId = 'test-trello-card-id';
      const trelloScope = nock('https://api.trello.com')
        .post(uri => uri.includes(`/1/cards/${trelloCardId}/idLabels?`))
        .reply(200, {});
      const rcCardPutScope = nock(process.env.RINGCENTRAL_SERVER)
        .put(uri => uri.includes(`/restapi/v1.0/glip/adaptive-cards/rc_card_id`))
        .reply(200, {
          id: 'rc_card_id',
        });
      const rcCardGetScope = nock(process.env.RINGCENTRAL_SERVER)
        .get(uri => uri.includes(`/restapi/v1.0/glip/adaptive-cards/rc_card_id`))
        .reply(200, mockAdaptiveCardData);
      const rcCardRequestBodyPromise = getRequestBody(rcCardPutScope);
      const res = await request(server).post('/interactive-messages').send({
        data: {
          messageType: 'Bot',
          botId: botId,
          action: 'addLabel',
          cardId: trelloCardId,
          addLabel: '6094fb83d41eeff1fa7612a1'
        },
        user: {
          firstName: 'Test',
          lastName: 'Test1',
          extId: rcUserId,
        },
        card: {
          id: 'rc_card_id',
        },
        conversation: {
          id: groupId,
        },
      });
      expect(res.status).toEqual(200);
      const rcCardRequestBody = await rcCardRequestBodyPromise;
      expect(JSON.stringify(rcCardRequestBody)).toContain('added the label');
      rcCardPutScope.done();
      trelloScope.done();
      rcCardGetScope.done();
    });

    it('should remove label successfully', async() => {
      const trelloCardId = 'test-trello-card-id';
      const trelloScope = nock('https://api.trello.com')
        .delete(uri => uri.includes(`/1/cards/${trelloCardId}/idLabels/6094fb83d41eeff1fa76129d?`))
        .reply(200, {});
      const rcCardPutScope = nock(process.env.RINGCENTRAL_SERVER)
        .put(uri => uri.includes(`/restapi/v1.0/glip/adaptive-cards/rc_card_id`))
        .reply(200, {
          id: 'rc_card_id',
        });
      const rcCardGetScope = nock(process.env.RINGCENTRAL_SERVER)
        .get(uri => uri.includes(`/restapi/v1.0/glip/adaptive-cards/rc_card_id`))
        .reply(200, mockAdaptiveCardData);
      const rcCardRequestBodyPromise = getRequestBody(rcCardPutScope);
      const res = await request(server).post('/interactive-messages').send({
        data: {
          messageType: 'Bot',
          botId: botId,
          action: 'removeLabel',
          cardId: trelloCardId,
          removeLabel: '6094fb83d41eeff1fa76129d'
        },
        user: {
          firstName: 'Test',
          lastName: 'Test1',
          extId: rcUserId,
        },
        card: {
          id: 'rc_card_id',
        },
        conversation: {
          id: groupId,
        },
      });
      expect(res.status).toEqual(200);
      const rcCardRequestBody = await rcCardRequestBodyPromise;
      expect(JSON.stringify(rcCardRequestBody)).toContain('removed the label');
      rcCardPutScope.done();
      trelloScope.done();
      rcCardGetScope.done();
    });

    it('should respond 500 when trello response 500', async() => {
      const trelloCardId = 'test-trello-card-id';
      const trelloCommentScope = nock('https://api.trello.com')
        .post(uri => uri.includes(`/1/cards/${trelloCardId}/actions/comments?`))
        .reply(500, {});
      const res = await request(server).post('/interactive-messages').send({
        data: {
          messageType: 'Bot',
          botId: botId,
          action: 'commentCard',
          cardId: trelloCardId,
          comment: 'test comment',
        },
        user: {
          firstName: 'Test',
          lastName: 'Test1',
          extId: rcUserId,
        },
        card: {
          id: 'rc_card_id',
        },
        conversation: {
          id: groupId,
        },
      });
      expect(res.status).toEqual(500);
      trelloCommentScope.done();
    });

    it('should send auth card when trello response 401', async() => {
      const directGroupId = 'test_direct_group_id';
      const rcDirectGroupScope = nock(process.env.RINGCENTRAL_SERVER)
        .post(uri => uri.includes(`/restapi/v1.0/glip/conversations`))
        .reply(200, {
          id: directGroupId,
          members: [
            "170848004",
            "713297005"
          ],
        });
      const rcCardScope = nock(process.env.RINGCENTRAL_SERVER)
        .post(uri => uri.includes(`/restapi/v1.0/glip/chats/${directGroupId}/adaptive-cards`))
        .reply(200, {
          id: 'auth_card_id',
        });
      const rcAuthCardPutScope = nock(process.env.RINGCENTRAL_SERVER)
        .put(uri => uri.includes(`/restapi/v1.0/glip/adaptive-cards/auth_card_id`))
        .reply(200, {
          id: 'auth_card_id',
        });
      const rcMessageScope = nock(process.env.RINGCENTRAL_SERVER)
        .post(uri => uri.includes(`/restapi/v1.0/glip/groups/${groupId}/posts`))
        .reply(200, {});
      const trelloCardId = 'test-trello-card-id';
      const trelloCommentScope = nock('https://api.trello.com')
        .post(uri => uri.includes(`/1/cards/${trelloCardId}/actions/comments?`))
        .reply(401, {});
      const rcAuthCardRequestBodyPromise = getRequestBody(rcAuthCardPutScope);
      const messageRequestBodyPromise = getRequestBody(rcMessageScope);
      const res = await request(server).post('/interactive-messages').send({
        data: {
          messageType: 'Bot',
          botId: botId,
          action: 'commentCard',
          cardId: trelloCardId,
          comment: 'test comment',
        },
        user: {
          firstName: 'Test',
          lastName: 'Test1',
          extId: rcUserId,
        },
        card: {
          id: 'rc_card_id',
        },
        conversation: {
          id: groupId,
        },
      });
      const authCardRequestBody = await rcAuthCardRequestBodyPromise;
      const messageRequestBody = await messageRequestBodyPromise;
      expect(res.status).toEqual(200);
      expect(authCardRequestBody.fallbackText).toContain('Connect with Trello');
      expect(messageRequestBody.text).toContain('I just sent you a **Private** message');
      trelloCommentScope.done();
      rcDirectGroupScope.done();
      rcCardScope.done();
      rcAuthCardPutScope.done();
      rcMessageScope.done();
    });
  });
});
