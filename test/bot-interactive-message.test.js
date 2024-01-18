const request = require('supertest');
const nock = require('nock');
const axios = require('axios');
axios.defaults.adapter = 'http';
const { server } = require('../src/server');
const { TrelloWebhook } = require('../src/app/models/trello-webhook');
const { RcUser } = require('../src/app/models/rc-user');
const { TrelloUser } = require('../src/app/models/trello-user');
const { decodeToken } = require('../src/app/lib/jwt');
const { findItemInAdaptiveCard } = require('../src/app/lib/findItemInAdaptiveCard');

const { getRequestBody } = require('./utils');

const mockAdaptiveCardData = require('./mock-data/card.json');
const { default: Bot } = require('ringcentral-chatbot-core/dist/models/Bot');

describe('Bot Notification', () => {
  const botId = '266262004';
  const groupId = '713297005';

  beforeEach(async () => {
    await Bot.create({
      id: botId,
      token: {
        access_token: 'xxxxxx',
        token_type: 'bearer',
        expires_in: 2147483647,
        scope: 'SubscriptionWebhook TeamMessing ReadAccounts',
        owner_id: botId,
        endpoint_id: 'p7GZlEVHRwKDwbx6UkH0YQ'
      },
    });
  });

  afterEach(async () => {
    await Bot.destroy({ where: { id: botId } });
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

  it('should send setup dialog successfully with setup action', async () => {
    const res = await request(server).post('/interactive-messages').send({
      data: {
        messageType: 'Bot',
        botId: botId,
        action: 'setup',
        conversationName: 'Team name',
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
    expect(res.body.type).toEqual('dialog');
    expect(res.body.dialog.title).toEqual('Trello setup for Team name');
    const iframeURL = res.body.dialog.iframeURL;
    expect(iframeURL).toContain('/bot-setup?token=');
    const tokenStr = iframeURL.split('?token=')[1].split('&')[0];
    const token = decodeToken(tokenStr);
    expect(token.bId).toEqual(botId);
    expect(token.uId).toEqual('test_ext_id');
    expect(token.gId).toEqual(groupId);
  });

  it('should send setup dialog successfully with setup action and conversationId', async () => {
    const res = await request(server).post('/interactive-messages').send({
      data: {
        messageType: 'Bot',
        botId: botId,
        action: 'setup',
        conversationId: 'test_conversation_id',
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
    expect(res.body.type).toEqual('dialog');
    expect(res.body.dialog.title).toEqual('Trello setup for this conversation');
    const iframeURL = res.body.dialog.iframeURL;
    expect(iframeURL).toContain('/bot-setup?token=');
    const tokenStr = iframeURL.split('?token=')[1].split('&')[0];
    const token = decodeToken(tokenStr);
    expect(token.bId).toEqual(botId);
    expect(token.uId).toEqual('test_ext_id');
    expect(token.gId).toEqual('test_conversation_id');
  });


  it('should update old card to setup card when have subscribe actions', async () => {
    const rcCardPutScope = nock(process.env.RINGCENTRAL_SERVER)
      .put(uri => uri.includes(`/restapi/v1.0/glip/adaptive-cards/setup_card_id`))
      .reply(200, {
        id: 'auth_card_id',
      });
    const updateCardRequestBodyPromise = getRequestBody(rcCardPutScope);
    const res = await request(server).post('/interactive-messages').send({
      data: {
        messageType: 'Bot',
        botId: botId,
        action: 'subscribe',
        conversationName: 'Team name',
        conversationId: 'conversationId',
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
    const newCardRequestBody = await updateCardRequestBodyPromise;
    expect(res.status).toEqual(200);
    rcCardPutScope.done();
    expect(newCardRequestBody.fallbackText).toContain('Trello setup for **Team name**');
    expect(JSON.stringify(newCardRequestBody)).toContain('Please click following button to finish Trello setup');
  });

  it('should update old card to setup card when have addSubscription actions', async () => {
    const rcCardPutScope = nock(process.env.RINGCENTRAL_SERVER)
      .put(uri => uri.includes(`/restapi/v1.0/glip/adaptive-cards/setup_card_id`))
      .reply(200, {
        id: 'auth_card_id',
      });
    const updateCardRequestBodyPromise = getRequestBody(rcCardPutScope);
    const res = await request(server).post('/interactive-messages').send({
      data: {
        messageType: 'Bot',
        botId: botId,
        action: 'addSubscription',
        conversationName: 'Team name',
        conversationId: 'conversationId',
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
    const newCardRequestBody = await updateCardRequestBodyPromise;
    expect(res.status).toEqual(200);
    rcCardPutScope.done();
    expect(newCardRequestBody.fallbackText).toContain('Trello setup for **Team name**');
    expect(JSON.stringify(newCardRequestBody)).toContain('Please click following button to finish Trello setup');
  });

  it('should update old card to setup card when have editSubscription actions', async () => {
    const rcCardPutScope = nock(process.env.RINGCENTRAL_SERVER)
      .put(uri => uri.includes(`/restapi/v1.0/glip/adaptive-cards/setup_card_id`))
      .reply(200, {
        id: 'auth_card_id',
      });
    const updateCardRequestBodyPromise = getRequestBody(rcCardPutScope);
    const res = await request(server).post('/interactive-messages').send({
      data: {
        messageType: 'Bot',
        botId: botId,
        action: 'editSubscription',
        conversationName: 'Team name',
        conversationId: 'conversationId',
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
    const newCardRequestBody = await updateCardRequestBodyPromise;
    expect(res.status).toEqual(200);
    rcCardPutScope.done();
    expect(newCardRequestBody.fallbackText).toContain('Trello setup for **Team name**');
    expect(JSON.stringify(newCardRequestBody)).toContain('Please click following button to finish Trello setup');
  });

  it('should update old card to setup card when have removeSubscription actions', async () => {
    const rcCardPutScope = nock(process.env.RINGCENTRAL_SERVER)
      .put(uri => uri.includes(`/restapi/v1.0/glip/adaptive-cards/setup_card_id`))
      .reply(200, {
        id: 'auth_card_id',
      });
    const updateCardRequestBodyPromise = getRequestBody(rcCardPutScope);
    const res = await request(server).post('/interactive-messages').send({
      data: {
        messageType: 'Bot',
        botId: botId,
        action: 'removeSubscription',
        conversationName: 'Team name',
        conversationId: 'conversationId',
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
    const newCardRequestBody = await updateCardRequestBodyPromise;
    expect(res.status).toEqual(200);
    rcCardPutScope.done();
    expect(newCardRequestBody.fallbackText).toContain('Trello setup for **Team name**');
    expect(JSON.stringify(newCardRequestBody)).toContain('Please click following button to finish Trello setup');
  });

  it('should send auth dialog successfully with authorize action', async () => {
    const res = await request(server).post('/interactive-messages').send({
      data: {
        messageType: 'Bot',
        botId: botId,
        action: 'authorize',
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
    expect(res.body.type).toEqual('dialog');
    expect(res.body.dialog.title).toEqual('Trello authorization');
    const iframeURL = res.body.dialog.iframeURL;
    expect(iframeURL).toContain('/bot-auth-setup?token=');
    const tokenStr = iframeURL.split('?token=')[1].split('&')[0];
    const token = decodeToken(tokenStr);
    expect(token.bId).toEqual(botId);
    expect(token.uId).toEqual('test_ext_id');
    expect(token.gId).toEqual(groupId);
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

  it('should send auth dialog when have interactive actions and not authorized', async () => {
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
    expect(res.status).toEqual(200);
    expect(res.body.type).toEqual('dialog');
    expect(res.body.dialog.title).toEqual('Trello authorization');
    const iframeURL = res.body.dialog.iframeURL;
    expect(iframeURL).toContain('bot-auth-setup?token=');
    const tokenStr = iframeURL.split('?token=')[1].split('&')[0];
    const token = decodeToken(tokenStr);
    expect(token.bId).toEqual(botId);
    expect(token.uId).toEqual('test_ext_id');
    expect(token.gId).toEqual(groupId);
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

    it('should add label successfully with no label left', async() => {
      const trelloCardId = 'test-trello-card-id';
      const trelloScope = nock('https://api.trello.com')
        .post(uri => uri.includes(`/1/cards/${trelloCardId}/idLabels?`))
        .reply(200, {});
      const rcCardPutScope = nock(process.env.RINGCENTRAL_SERVER)
        .put(uri => uri.includes(`/restapi/v1.0/glip/adaptive-cards/rc_card_id`))
        .reply(200, {
          id: 'rc_card_id',
        });
      const newMockAdaptiveCardData = JSON.parse(JSON.stringify(mockAdaptiveCardData));
      const addLabelChoiceSet = findItemInAdaptiveCard(newMockAdaptiveCardData, 'addLabel');
      addLabelChoiceSet.choices = [addLabelChoiceSet.choices[0]];
      const rcCardGetScope = nock(process.env.RINGCENTRAL_SERVER)
        .get(uri => uri.includes(`/restapi/v1.0/glip/adaptive-cards/rc_card_id`))
        .reply(200, newMockAdaptiveCardData);
      const rcCardRequestBodyPromise = getRequestBody(rcCardPutScope);
      const res = await request(server).post('/interactive-messages').send({
        data: {
          messageType: 'Bot',
          botId: botId,
          action: 'addLabel',
          cardId: trelloCardId,
          addLabel: addLabelChoiceSet.choices[0].value,
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
      const addLabelForm = findItemInAdaptiveCard(rcCardRequestBody, 'addLabelForm');
      expect(addLabelForm.isVisible).toEqual(false);
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
      const removeLabelForm = findItemInAdaptiveCard(rcCardRequestBody, 'removeLabelForm');
      expect(removeLabelForm.isVisible).toEqual(false);
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

    it('should send auth dialog when trello response 401', async() => {
      const trelloCardId = 'test-trello-card-id';
      const trelloCommentScope = nock('https://api.trello.com')
        .post(uri => uri.includes(`/1/cards/${trelloCardId}/actions/comments?`))
        .reply(401, {});
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
      expect(res.body.type).toEqual('dialog');
      expect(res.body.dialog.title).toEqual('Trello authorization');
      const iframeURL = res.body.dialog.iframeURL;
      expect(iframeURL).toContain('/bot-auth-setup?token=');
      const tokenStr = iframeURL.split('?token=')[1].split('&')[0];
      const token = decodeToken(tokenStr);
      expect(token.bId).toEqual(botId);
      expect(token.uId).toEqual(rcUserId);
      expect(token.gId).toEqual(groupId);
      trelloCommentScope.done();
    });
  });
});
