const request = require('supertest');
const nock = require('nock');
const axios = require('axios');
const { default: Bot } = require('ringcentral-chatbot-core/dist/models/Bot');
const { server } = require('../src/server');

const jwt = require('../src/app/lib/jwt');
const { TrelloUser } = require('../src/app/models/trello-user');
const { RcUser } = require('../src/app/models/rc-user');
const { TrelloWebhook } = require('../src/app/models/trello-webhook');

axios.defaults.adapter = 'http';

describe('Bot Setup', () => {
  it('should get 400 at setup page request', async () => {
    const res = await request(server).get('/bot-setup');
    expect(res.status).toEqual(400);
  });

  it('should get 401 at setup page request', async () => {
    const res = await request(server).get('/bot-setup?code=new_token');
    expect(res.status).toEqual(401);
  });

  it('should get 200 at setup page request', async () => {
    const token = jwt.generateToken({
      uId: '123',
      bId: '123',
      gId: '111',
    });
    const res = await request(server).get(`/bot-setup?code=${token}`);
    expect(res.status).toEqual(200);
  });


  describe('Info', () => {
    it('should get 403 without token', async () => {
      const res = await request(server).get('/bot-info');
      expect(res.status).toEqual(403);
    });

    it('should get 401 with invalid token', async () => {
      const res = await request(server)
        .get('/bot-info')
        .set('x-access-token', '123');
      expect(res.status).toEqual(401);
    });

    it('should get 401 with expired token', async () => {
      const token = jwt.generateToken({
        uId: '123',
        bId: '123',
        gId: '111',
      }, '-10s');
      const res = await request(server)
        .get('/bot-info')
        .set('x-access-token', token);
      expect(res.status).toEqual(401);
    });

    it('should get 200 with botInfo when rc user is not found', async () => {
      const token = jwt.generateToken({
        uId: '123',
        bId: '123',
        gId: '111',
      }, '24h');
      const res = await request(server)
        .get('/bot-info')
        .set('x-access-token', token);
      expect(res.status).toEqual(200);
      expect(res.body.trelloAuthorized).toEqual(false);
    });

    it('should get 200 with botInfo when no trello user connected with rc user', async () => {
      const rcUserId = 'test_rc_user_id_123';
      const rcUserRecord = await RcUser.create({
        id: `rcext-${rcUserId}`,
      });
      const token = jwt.generateToken({
        uId: rcUserId,
        bId: '123',
        gId: '111',
      }, '24h');
      const res = await request(server)
        .get('/bot-info')
        .set('x-access-token', token);
      expect(res.status).toEqual(200);
      expect(res.body.trelloAuthorized).toEqual(false);
      await rcUserRecord.destroy();
    });

    it('should get 200 with botInfo when trello user not found with rc user', async () => {
      const rcUserId = 'test_rc_user_id_123';
      const rcUserRecord = await RcUser.create({
        id: `rcext-${rcUserId}`,
        trello_user_id: 'xxx',
      });
      const token = jwt.generateToken({
        uId: rcUserId,
        bId: '123',
        gId: '111',
      }, '24h');
      const res = await request(server)
        .get('/bot-info')
        .set('x-access-token', token);
      expect(res.status).toEqual(200);
      expect(res.body.trelloAuthorized).toEqual(false);
      await rcUserRecord.destroy();
    });

    it('should get 200 with botInfo when trello user does have token', async () => {
      const rcUserId = 'test_rc_user_id_123';
      const trelloUserId = 'trello-user-123';
      const trelloUserRecord = await TrelloUser.create({
        id: trelloUserId,
        writeable_token: '',
      });
      const rcUserRecord = await RcUser.create({
        id: `rcext-${rcUserId}`,
        trello_user_id: trelloUserId,
      });
      const token = jwt.generateToken({
        uId: rcUserId,
        bId: '123',
        gId: '111',
      }, '24h');
      const res = await request(server)
        .get('/bot-info')
        .set('x-access-token', token);
      expect(res.status).toEqual(200);
      expect(res.body.trelloAuthorized).toEqual(false);
      await rcUserRecord.destroy();
      await trelloUserRecord.destroy();
    });

    it('should get 200 with boards when trello user has token', async () => {
      const rcUserId = 'test_rc_user_id_123';
      const trelloUserId = 'trello-user-123';
      const trelloUserRecord = await TrelloUser.create({
        id: trelloUserId,
        writeable_token: 'xxx',
      });
      const rcUserRecord = await RcUser.create({
        id: `rcext-${rcUserId}`,
        trello_user_id: trelloUserId,
      });
      const token = jwt.generateToken({
        uId: rcUserId,
        bId: '123',
        gId: '111',
      }, '24h');
      const trelloBoardScope = nock('https://api.trello.com')
        .get(uri => uri.includes(`/1/members/me/boards?`))
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
      const res = await request(server)
        .get('/bot-info')
        .set('x-access-token', token);
      expect(res.status).toEqual(200);
      expect(res.body.trelloAuthorized).toEqual(true);
      expect(res.body.boards.length).toEqual(2);
      trelloBoardScope.done();
      await rcUserRecord.destroy();
      await trelloUserRecord.destroy();
    });

    it('should get 200 with existing subscriptions', async () => {
      const rcUserId = 'test_rc_user_id_123';
      const trelloUserId = 'trello-user-123';
      const trelloUserRecord = await TrelloUser.create({
        id: trelloUserId,
        writeable_token: 'xxx',
      });
      const rcUserRecord = await RcUser.create({
        id: `rcext-${rcUserId}`,
        trello_user_id: trelloUserId,
        bot_subscriptions: [{
          id: 'test_1',
          conversation_id: 'test_group_1',
          board_id: 'test_board_1',
        }, {
          id: 'test_2',
          conversation_id: 'test_group_2',
          board_id: 'test_board_2',
        }]
      });
      const token = jwt.generateToken({
        uId: rcUserId,
        bId: '123',
        gId: 'test_group_2',
      }, '24h');
      const trelloBoardScope = nock('https://api.trello.com')
        .get(uri => uri.includes(`/1/members/me/boards?`))
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
      const res = await request(server)
        .get('/bot-info')
        .set('x-access-token', token);
      expect(res.status).toEqual(200);
      expect(res.body.trelloAuthorized).toEqual(true);
      expect(res.body.boards.length).toEqual(2);
      expect(res.body.subscriptions.length).toEqual(1);
      expect(res.body.subscriptions[0].id).toEqual('test_2');
      trelloBoardScope.done();
      await rcUserRecord.destroy();
      await trelloUserRecord.destroy();
    });

    it('should get 200 with trelloAuthorized false when require trello 401', async () => {
      const rcUserId = 'test_rc_user_id_123';
      const trelloUserId = 'trello-user-123';
      const trelloUserRecord = await TrelloUser.create({
        id: trelloUserId,
        writeable_token: 'xxx',
      });
      const rcUserRecord = await RcUser.create({
        id: `rcext-${rcUserId}`,
        trello_user_id: trelloUserId,
      });
      const token = jwt.generateToken({
        uId: rcUserId,
        bId: '123',
        gId: '111',
      }, '24h');
      const trelloBoardScope = nock('https://api.trello.com')
        .get(uri => uri.includes(`/1/members/me/boards?`))
        .reply(401, {});
      const res = await request(server)
        .get('/bot-info')
        .set('x-access-token', token);
      expect(res.status).toEqual(200);
      expect(res.body.trelloAuthorized).toEqual(false);
      trelloBoardScope.done();
      await rcUserRecord.destroy();
      await trelloUserRecord.destroy();
    });

    it('should get 500 when require trello 500', async () => {
      const rcUserId = 'test_rc_user_id_123';
      const trelloUserId = 'trello-user-123';
      const trelloUserRecord = await TrelloUser.create({
        id: trelloUserId,
        writeable_token: 'xxx',
      });
      const rcUserRecord = await RcUser.create({
        id: `rcext-${rcUserId}`,
        trello_user_id: trelloUserId,
      });
      const token = jwt.generateToken({
        uId: rcUserId,
        bId: '123',
        gId: '111',
      }, '24h');
      const trelloBoardScope = nock('https://api.trello.com')
        .get(uri => uri.includes(`/1/members/me/boards?`))
        .reply(500, {});
      const res = await request(server)
        .get('/bot-info')
        .set('x-access-token', token);
      expect(res.status).toEqual(500);
      trelloBoardScope.done();
      await rcUserRecord.destroy();
      await trelloUserRecord.destroy();
    });
  });

  describe('Save subscription', () => {
    const botId = '266262009';

    beforeAll(async () => {
      await Bot.create({
        id: botId,
        token: {
          access_token: 'xxx',
          owner_id: 'xxxxx',
        },
      });
    });

    afterAll(async () => {
      await Bot.destroy({
        where: {
          id: botId,
        },
      });
    });

    it('should get 403 without token', async () => {
      const res = await request(server).post('/bot-subscription');
      expect(res.status).toEqual(403);
    });

    it('should get 403 without filters', async () => {
      const res = await request(server).post('/bot-subscription').send({
        token: 'xxx',
      });;
      expect(res.status).toEqual(403);
    });

    it('should get 403 without subscriptionId and boardId', async () => {
      const res = await request(server).post('/bot-subscription').send({
        token: 'xxx',
        filters: ['test'],
      });;
      expect(res.status).toEqual(403);
    });

    it('should get 401 with invalid token and boardId', async () => {
      const res = await request(server).post('/bot-subscription').send({
        token: 'xxx',
        filters: ['test'],
        boardId: 'test',
      });
      expect(res.status).toEqual(401);
    });

    it('should get 401 with invalid token and subscriptionId', async () => {
      const res = await request(server).post('/bot-subscription').send({
        token: 'xxx',
        filters: ['test'],
        subscriptionId: 'test',
      });
      expect(res.status).toEqual(401);
    });

    it('should get 401 with expired token', async () => {
      const token = jwt.generateToken({
        uId: '123',
        bId: '123',
        gId: '111',
      }, '-10s');
      const res = await request(server).post('/bot-subscription').send({
        token,
        filters: ['test'],
        subscriptionId: 'test',
      });
      expect(res.status).toEqual(401);
    });

    it('should get 403 when bot is not found', async () => {
      const token = jwt.generateToken({
        uId: '123',
        bId: '123',
        gId: '111',
      }, '24h');
      const res = await request(server).post('/bot-subscription').send({
        token,
        filters: ['test'],
        boardId: 'test',
      });
      expect(res.status).toEqual(403);
    });

    it('should get 401 when rc user is not found', async () => {
      const token = jwt.generateToken({
        uId: '123',
        bId: botId,
        gId: '111',
      }, '24h');
      const res = await request(server).post('/bot-subscription').send({
        token,
        filters: ['test'],
        subscriptionId: 'test',
      });
      expect(res.status).toEqual(401);
    });

    it('should get 401 when trello user is not found', async () => {
      const rcUserId = '1234444';
      const rcUserRecord = await RcUser.create({
        id: `rcext-${rcUserId}`,
        trello_user_id: 'trello-user-123',
      });
      const token = jwt.generateToken({
        uId: rcUserId,
        bId: botId,
        gId: '111',
      }, '24h');
      const res = await request(server).post('/bot-subscription').send({
        token,
        filters: ['test'],
        subscriptionId: 'test',
      });
      expect(res.status).toEqual(401);
      await rcUserRecord.destroy();
    });

    it('should get 401 when rc user does not connect trello', async () => {
      const rcUserId = '1234444';
      const rcUserRecord = await RcUser.create({
        id: `rcext-${rcUserId}`,
      });
      const token = jwt.generateToken({
        uId: rcUserId,
        bId: botId,
        gId: '111',
      }, '24h');
      const res = await request(server).post('/bot-subscription').send({
        token,
        filters: ['test'],
        subscriptionId: 'test',
      });
      expect(res.status).toEqual(401);
      await rcUserRecord.destroy();
    });

    it('should get 401 when trello user does not have token', async () => {
      const rcUserId = '1234444';
      const trelloUserId = 'trello-user-123456';
      const trelloUserRecord = await TrelloUser.create({
        id: trelloUserId,
        writeable_token: '',
      });
      const rcUserRecord = await RcUser.create({
        id: `rcext-${rcUserId}`,
        trello_user_id: trelloUserId,
      });
      const token = jwt.generateToken({
        uId: rcUserId,
        bId: botId,
        gId: '111',
      }, '24h');
      const res = await request(server).post('/bot-subscription').send({
        token,
        filters: ['test'],
        subscriptionId: 'test',
      });
      expect(res.status).toEqual(401);
      await rcUserRecord.destroy();
      await trelloUserRecord.destroy();
    });

    it('should create subscription successfully with boardId', async () => {
      const rcUserId = '1234444';
      const groupId = '713297119';
      const trelloUserId = 'trello-user-123456';
      const trelloUserRecord = await TrelloUser.create({
        id: trelloUserId,
        writeable_token: 'xxx',
      });
      const rcUserRecord = await RcUser.create({
        id: `rcext-${rcUserId}`,
        trello_user_id: trelloUserId,
      });
      const token = jwt.generateToken({
        uId: rcUserId,
        bId: botId,
        gId: groupId,
      }, '24h');
      const boardId = '5b6893f01cb3228998cf629e';
      const trelloLabelsScope = nock('https://api.trello.com')
        .get(uri => uri.includes(`/1/boards/${boardId}/labels?`))
        .reply(200, [
          { "id":"6094fb83d41eeff1fa76129d", "name":"", "color":"green" },
          { "id":"6094fb83d41eeff1fa7612a1", "name":"", "color":"yellow" },
        ]);
      const trelloWebhooksScope = nock('https://api.trello.com')
        .post(uri => uri.includes('/1/webhooks?'))
        .reply(200, {
          id: 'test_trello_webhook_id_xxx',
        });
      const rcMessageScope = nock(process.env.RINGCENTRAL_SERVER)
        .post(uri => uri.includes(`/restapi/v1.0/glip/groups/${groupId}/posts`))
        .reply(200, {});
      const res = await request(server).post('/bot-subscription').send({
        token,
        filters: ['test', 'test1'],
        boardId,
      });
      expect(res.status).toEqual(200);
      const newRcUserRecord = await RcUser.findByPk(`rcext-${rcUserId}`);
      expect(newRcUserRecord.bot_subscriptions.length).toEqual(1);
      const subscription = newRcUserRecord.bot_subscriptions[0];
      expect(subscription.boardId).toEqual(boardId);
      expect(subscription.conversation_id).toEqual(groupId);
      const trelloWebhookRecord = await TrelloWebhook.findByPk(subscription.id);
      expect(trelloWebhookRecord.bot_id).toEqual(botId);
      expect(trelloWebhookRecord.trello_user_id).toEqual(trelloUserId);
      expect(trelloWebhookRecord.conversation_id).toEqual(groupId);
      expect(trelloWebhookRecord.config.filters).toEqual('test,test1');
      expect(trelloWebhookRecord.config.disableButtons).toEqual(false);
      expect(trelloWebhookRecord.trello_webhook_id).toEqual('test_trello_webhook_id_xxx');
      await rcUserRecord.destroy();
      await trelloUserRecord.destroy();
      await trelloWebhookRecord.destroy();
      trelloLabelsScope.done();
      trelloWebhooksScope.done();
      rcMessageScope.done();
    });

    it('should create subscription successfully with boardId and disableButtons', async () => {
      const rcUserId = '1234444';
      const groupId = '713297119';
      const trelloUserId = 'trello-user-123456';
      const trelloUserRecord = await TrelloUser.create({
        id: trelloUserId,
        writeable_token: 'xxx',
      });
      const rcUserRecord = await RcUser.create({
        id: `rcext-${rcUserId}`,
        trello_user_id: trelloUserId,
      });
      const token = jwt.generateToken({
        uId: rcUserId,
        bId: botId,
        gId: groupId,
      }, '24h');
      const boardId = '5b6893f01cb3228998cf629e';
      const trelloLabelsScope = nock('https://api.trello.com')
        .get(uri => uri.includes(`/1/boards/${boardId}/labels?`))
        .reply(200, [
          { "id":"6094fb83d41eeff1fa76129d", "name":"", "color":"green" },
          { "id":"6094fb83d41eeff1fa7612a1", "name":"", "color":"yellow" },
        ]);
      const trelloWebhooksScope = nock('https://api.trello.com')
        .post(uri => uri.includes('/1/webhooks?'))
        .reply(200, {
          id: 'test_trello_webhook_id_xxx',
        });
      const rcMessageScope = nock(process.env.RINGCENTRAL_SERVER)
        .post(uri => uri.includes(`/restapi/v1.0/glip/groups/${groupId}/posts`))
        .reply(200, {});
      const res = await request(server).post('/bot-subscription').send({
        token,
        filters: ['test', 'test1'],
        boardId,
        disableButtons: true,
      });
      expect(res.status).toEqual(200);
      const newRcUserRecord = await RcUser.findByPk(`rcext-${rcUserId}`);
      expect(newRcUserRecord.bot_subscriptions.length).toEqual(1);
      const subscription = newRcUserRecord.bot_subscriptions[0];
      expect(subscription.boardId).toEqual(boardId);
      expect(subscription.conversation_id).toEqual(groupId);
      const trelloWebhookRecord = await TrelloWebhook.findByPk(subscription.id);
      expect(trelloWebhookRecord.bot_id).toEqual(botId);
      expect(trelloWebhookRecord.trello_user_id).toEqual(trelloUserId);
      expect(trelloWebhookRecord.conversation_id).toEqual(groupId);
      expect(trelloWebhookRecord.config.filters).toEqual('test,test1');
      expect(trelloWebhookRecord.config.disableButtons).toEqual(true);
      expect(trelloWebhookRecord.trello_webhook_id).toEqual('test_trello_webhook_id_xxx');
      await rcUserRecord.destroy();
      await trelloUserRecord.destroy();
      await trelloWebhookRecord.destroy();
      trelloLabelsScope.done();
      trelloWebhooksScope.done();
      rcMessageScope.done();
    });

    it('should update subscription successfully with subscriptionId', async () => {
      const rcUserId = '1234444';
      const groupId = '713297119';
      const trelloUserId = 'trello-user-123456';
      const subscriptionId = 'test_subscription_id';
      const boardId = '5b6893f01cb3228998cf629e';
      const trelloUserRecord = await TrelloUser.create({
        id: trelloUserId,
        writeable_token: 'xxx',
      });
      const rcUserRecord = await RcUser.create({
        id: `rcext-${rcUserId}`,
        trello_user_id: trelloUserId,
        bot_subscriptions: [{
          id: subscriptionId,
          boardId,
          conversation_id: groupId,
        }],
      });
      await TrelloWebhook.create({
        id: subscriptionId,
        bot_id: botId,
        conversation_id: groupId,
        trello_user_id: 'trello-user-123456',
        trello_webhook_id: 'test_trello_webhook_id_xxx',
        config: {
          boardId,
          filters: 'test',
          labels: [],
        },
      });
      const token = jwt.generateToken({
        uId: rcUserId,
        bId: botId,
        gId: groupId,
      }, '24h');
      const trelloLabelsScope = nock('https://api.trello.com')
        .get(uri => uri.includes(`/1/boards/${boardId}/labels?`))
        .reply(200, [
          { "id":"6094fb83d41eeff1fa76129d", "name":"", "color":"green" },
          { "id":"6094fb83d41eeff1fa7612a1", "name":"", "color":"yellow" },
        ]);
      const trelloDeleteWebhooksScope = nock('https://api.trello.com')
        .delete(uri => uri.includes(`/1/webhooks/test_trello_webhook_id_xxx?`))
        .reply(200, {});
      const trelloWebhooksScope = nock('https://api.trello.com')
        .post(uri => uri.includes('/1/webhooks?'))
        .reply(200, {
          id: 'test_trello_webhook_id_xxx1',
        });
      const res = await request(server).post('/bot-subscription').send({
        token,
        filters: ['test', 'test1'],
        subscriptionId,
        disableButtons: false,
      });
      expect(res.status).toEqual(200);
      const newRcUserRecord = await RcUser.findByPk(`rcext-${rcUserId}`);
      expect(newRcUserRecord.bot_subscriptions.length).toEqual(1);
      const subscription = newRcUserRecord.bot_subscriptions[0];
      expect(subscription.boardId).toEqual(boardId);
      expect(subscription.conversation_id).toEqual(groupId);
      const newTrelloWebhookRecord = await TrelloWebhook.findByPk(subscription.id);
      expect(newTrelloWebhookRecord.bot_id).toEqual(botId);
      expect(newTrelloWebhookRecord.conversation_id).toEqual(groupId);
      expect(newTrelloWebhookRecord.config.filters).toEqual('test,test1');
      expect(newTrelloWebhookRecord.config.disableButtons).toEqual(false);
      expect(newTrelloWebhookRecord.trello_webhook_id).toEqual('test_trello_webhook_id_xxx1');
      await rcUserRecord.destroy();
      await trelloUserRecord.destroy();
      await newTrelloWebhookRecord.destroy();
      trelloLabelsScope.done();
      trelloWebhooksScope.done();
      trelloDeleteWebhooksScope.done();
    });

    it('should update subscription successfully with subscriptionId with disableButtons', async () => {
      const rcUserId = '1234444';
      const groupId = '713297119';
      const trelloUserId = 'trello-user-123456';
      const subscriptionId = 'test_subscription_id';
      const boardId = '5b6893f01cb3228998cf629e';
      const trelloUserRecord = await TrelloUser.create({
        id: trelloUserId,
        writeable_token: 'xxx',
      });
      const rcUserRecord = await RcUser.create({
        id: `rcext-${rcUserId}`,
        trello_user_id: trelloUserId,
        bot_subscriptions: [{
          id: subscriptionId,
          boardId,
          conversation_id: groupId,
        }],
      });
      await TrelloWebhook.create({
        id: subscriptionId,
        bot_id: botId,
        conversation_id: groupId,
        trello_user_id: 'trello-user-123456',
        trello_webhook_id: 'test_trello_webhook_id_xxx',
        config: {
          boardId,
          filters: 'test',
          labels: [],
          disableButtons: false,
        },
      });
      const token = jwt.generateToken({
        uId: rcUserId,
        bId: botId,
        gId: groupId,
      }, '24h');
      const trelloLabelsScope = nock('https://api.trello.com')
        .get(uri => uri.includes(`/1/boards/${boardId}/labels?`))
        .reply(200, [
          { "id":"6094fb83d41eeff1fa76129d", "name":"", "color":"green" },
          { "id":"6094fb83d41eeff1fa7612a1", "name":"", "color":"yellow" },
        ]);
      const trelloDeleteWebhooksScope = nock('https://api.trello.com')
        .delete(uri => uri.includes(`/1/webhooks/test_trello_webhook_id_xxx?`))
        .reply(200, {});
      const trelloWebhooksScope = nock('https://api.trello.com')
        .post(uri => uri.includes('/1/webhooks?'))
        .reply(200, {
          id: 'test_trello_webhook_id_xxx1',
        });
      const res = await request(server).post('/bot-subscription').send({
        token,
        filters: ['test', 'test1'],
        subscriptionId,
        disableButtons: true,
      });
      expect(res.status).toEqual(200);
      const newRcUserRecord = await RcUser.findByPk(`rcext-${rcUserId}`);
      expect(newRcUserRecord.bot_subscriptions.length).toEqual(1);
      const subscription = newRcUserRecord.bot_subscriptions[0];
      expect(subscription.boardId).toEqual(boardId);
      expect(subscription.conversation_id).toEqual(groupId);
      const newTrelloWebhookRecord = await TrelloWebhook.findByPk(subscription.id);
      expect(newTrelloWebhookRecord.bot_id).toEqual(botId);
      expect(newTrelloWebhookRecord.conversation_id).toEqual(groupId);
      expect(newTrelloWebhookRecord.config.filters).toEqual('test,test1');
      expect(newTrelloWebhookRecord.config.disableButtons).toEqual(true);
      expect(newTrelloWebhookRecord.trello_webhook_id).toEqual('test_trello_webhook_id_xxx1');
      await rcUserRecord.destroy();
      await trelloUserRecord.destroy();
      await newTrelloWebhookRecord.destroy();
      trelloLabelsScope.done();
      trelloWebhooksScope.done();
      trelloDeleteWebhooksScope.done();
    });

    it('should return 404 with subscription is not found', async () => {
      const rcUserId = '1234444';
      const groupId = '713297119';
      const trelloUserId = 'trello-user-123456';
      const subscriptionId = 'test_subscription_id';
      const trelloUserRecord = await TrelloUser.create({
        id: trelloUserId,
        writeable_token: 'xxx',
      });
      const rcUserRecord = await RcUser.create({
        id: `rcext-${rcUserId}`,
        trello_user_id: trelloUserId,
      });
      const token = jwt.generateToken({
        uId: rcUserId,
        bId: botId,
        gId: groupId,
      }, '24h');
      const res = await request(server).post('/bot-subscription').send({
        token,
        filters: ['test', 'test1'],
        subscriptionId,
      });
      expect(res.status).toEqual(404);
      await rcUserRecord.destroy();
      await trelloUserRecord.destroy();
    });

    it('should return 404 with subscription is not belongs to the user', async () => {
      const rcUserId = '1234444';
      const groupId = '713297119';
      const trelloUserId = 'trello-user-123456';
      const boardId = '5b6893f01cb3228998cf629e';
      const subscriptionId = 'test_subscription_id';
      const trelloUserRecord = await TrelloUser.create({
        id: trelloUserId,
        writeable_token: 'xxx',
      });
      const rcUserRecord = await RcUser.create({
        id: `rcext-${rcUserId}`,
        trello_user_id: trelloUserId,
      });
      const trelloWebhookRecord = await TrelloWebhook.create({
        id: subscriptionId,
        bot_id: botId,
        conversation_id: groupId,
        trello_user_id: 'xxx',
        trello_webhook_id: 'test_trello_webhook_id_xxx',
        config: {
          boardId,
          filters: 'test',
          labels: [],
        },
      });
      const token = jwt.generateToken({
        uId: rcUserId,
        bId: botId,
        gId: groupId,
      }, '24h');
      const res = await request(server).post('/bot-subscription').send({
        token,
        filters: ['test', 'test1'],
        subscriptionId,
      });
      expect(res.status).toEqual(404);
      await rcUserRecord.destroy();
      await trelloUserRecord.destroy();
      await trelloWebhookRecord.destroy();
    });

    it('should return 401 when fetch trello labels 401 at create subscription', async () => {
      const rcUserId = '1234444';
      const groupId = '713297119';
      const trelloUserId = 'trello-user-123456';
      const trelloUserRecord = await TrelloUser.create({
        id: trelloUserId,
        writeable_token: 'xxx',
      });
      const rcUserRecord = await RcUser.create({
        id: `rcext-${rcUserId}`,
        trello_user_id: trelloUserId,
      });
      const token = jwt.generateToken({
        uId: rcUserId,
        bId: botId,
        gId: groupId,
      }, '24h');
      const boardId = '5b6893f01cb3228998cf629e';
      const trelloLabelsScope = nock('https://api.trello.com')
        .get(uri => uri.includes(`/1/boards/${boardId}/labels?`))
        .reply(401, {});
      const res = await request(server).post('/bot-subscription').send({
        token,
        filters: ['test', 'test1'],
        boardId,
      });
      expect(res.status).toEqual(401);
      const newTrelloUserRecord = await TrelloUser.findByPk(trelloUserId);
      expect(newTrelloUserRecord.writeable_token).toEqual('');
      await rcUserRecord.destroy();
      await trelloUserRecord.destroy();
      trelloLabelsScope.done();
    });

    it('should return 401 when fetch trello labels 401 at update subscription', async () => {
      const rcUserId = '1234444';
      const groupId = '713297119';
      const trelloUserId = 'trello-user-123456';
      const subscriptionId = 'test_subscription_id';
      const boardId = '5b6893f01cb3228998cf629e';
      const trelloUserRecord = await TrelloUser.create({
        id: trelloUserId,
        writeable_token: 'xxx',
      });
      const rcUserRecord = await RcUser.create({
        id: `rcext-${rcUserId}`,
        trello_user_id: trelloUserId,
      });
      const trelloWebhookRecord = await TrelloWebhook.create({
        id: subscriptionId,
        bot_id: botId,
        conversation_id: groupId,
        trello_user_id: 'trello-user-123456',
        trello_webhook_id: 'test_trello_webhook_id_xxx',
        config: {
          boardId,
          filters: 'test',
          labels: [],
        },
      });
      const token = jwt.generateToken({
        uId: rcUserId,
        bId: botId,
        gId: groupId,
      }, '24h');
      const trelloLabelsScope = nock('https://api.trello.com')
        .get(uri => uri.includes(`/1/boards/${boardId}/labels?`))
        .reply(401, {});
      const res = await request(server).post('/bot-subscription').send({
        token,
        filters: ['test', 'test1'],
        subscriptionId,
      });
      expect(res.status).toEqual(401);
      const newTrelloUserRecord = await TrelloUser.findByPk(trelloUserId);
      expect(newTrelloUserRecord.writeable_token).toEqual('');
      await rcUserRecord.destroy();
      await trelloUserRecord.destroy();
      await trelloWebhookRecord.destroy();
      trelloLabelsScope.done();
    });

    it('should return 500 when fetch trello labels 500 at create subscription', async () => {
      const rcUserId = '1234444';
      const groupId = '713297119';
      const trelloUserId = 'trello-user-123456';
      const trelloUserRecord = await TrelloUser.create({
        id: trelloUserId,
        writeable_token: 'xxx',
      });
      const rcUserRecord = await RcUser.create({
        id: `rcext-${rcUserId}`,
        trello_user_id: trelloUserId,
      });
      const token = jwt.generateToken({
        uId: rcUserId,
        bId: botId,
        gId: groupId,
      }, '24h');
      const boardId = '5b6893f01cb3228998cf629e';
      const trelloLabelsScope = nock('https://api.trello.com')
        .get(uri => uri.includes(`/1/boards/${boardId}/labels?`))
        .reply(500, {});
      const res = await request(server).post('/bot-subscription').send({
        token,
        filters: ['test', 'test1'],
        boardId,
      });
      expect(res.status).toEqual(500);
      await rcUserRecord.destroy();
      await trelloUserRecord.destroy();
      trelloLabelsScope.done();
    });
  });

  describe('Get Subscription', () => {
    it('should get 403 without token', async () => {
      const res = await request(server).get('/bot-subscription');
      expect(res.status).toEqual(403);
    });

    it('should get 403 without subscription id', async () => {
      const res = await request(server)
        .get('/bot-subscription')
        .set('x-access-token', '123');
      expect(res.status).toEqual(403);
    });

    it('should get 401 with invalid token', async () => {
      const res = await request(server)
        .get('/bot-subscription?id=xxx')
        .set('x-access-token', '123');
      expect(res.status).toEqual(401);
    });

    it('should get 401 with expired token', async () => {
      const token = jwt.generateToken({
        uId: '123',
        bId: '123',
        gId: '111',
      }, '-10s');
      const res = await request(server).get(`/bot-subscription?id=xxx`)
        .set('x-access-token', token);
      expect(res.status).toEqual(401);
    });

    it('should get 401 with rc user not found', async () => {
      const token = jwt.generateToken({
        uId: '123',
        bId: '123',
        gId: '111',
      }, '24h');
      const res = await request(server).get(`/bot-subscription?id=xxx`)
        .set('x-access-token', token);
      expect(res.status).toEqual(401);
    });

    it('should get 404 when subscription id is not found', async () => {
      const rcUserId = 'test_rc_user_id_123';
      const rcUserRecord = await RcUser.create({
        id: `rcext-${rcUserId}`,
      });
      const token = jwt.generateToken({
        uId: rcUserId,
        bId: '123',
        gId: '111',
      }, '24h');
      const res = await request(server).get(`/bot-subscription?id=xxx`)
        .set('x-access-token', token);
      expect(res.status).toEqual(404);
      await rcUserRecord.destroy();
    });

    it('should get 404 when subscription id not belongs to user', async () => {
      const rcUserId = 'test_rc_user_id_123';
      const groupId = '713297119';
      const trelloUserId = 'trello-user-123456';
      const boardId = '5b6893f01cb3228998cf629e';
      const subscriptionId = 'test_subscription_id';
      const rcUserRecord = await RcUser.create({
        id: `rcext-${rcUserId}`,
        trello_user_id: trelloUserId,
      });
      const trelloWebhookRecord = await TrelloWebhook.create({
        id: subscriptionId,
        bot_id: 'xxxx',
        conversation_id: groupId,
        trello_user_id: 'xxx',
        trello_webhook_id: 'test_trello_webhook_id_xxx',
        config: {
          boardId,
          filters: 'test',
          labels: [],
        },
      });
      const token = jwt.generateToken({
        uId: rcUserId,
        bId: '123',
        gId: '111',
      }, '24h');
      const res = await request(server).get(`/bot-subscription?id=${subscriptionId}`)
        .set('x-access-token', token);
      expect(res.status).toEqual(404);
      await rcUserRecord.destroy();
      await trelloWebhookRecord.destroy();
    });

    it('should get subscription successfully', async () => {
      const rcUserId = 'test_rc_user_id_123';
      const groupId = '713297119';
      const trelloUserId = 'trello-user-123456';
      const boardId = '5b6893f01cb3228998cf629e';
      const subscriptionId = 'test_subscription_id';
      const rcUserRecord = await RcUser.create({
        id: `rcext-${rcUserId}`,
        trello_user_id: trelloUserId,
      });
      const trelloWebhookRecord = await TrelloWebhook.create({
        id: subscriptionId,
        bot_id: 'xxxx',
        conversation_id: groupId,
        trello_user_id: trelloUserId,
        trello_webhook_id: 'test_trello_webhook_id_xxx',
        config: {
          boardId,
          filters: 'test,test1',
          labels: [],
        },
      });
      const token = jwt.generateToken({
        uId: rcUserId,
        bId: '123',
        gId: '111',
      }, '24h');
      const res = await request(server).get(`/bot-subscription?id=${subscriptionId}`)
        .set('x-access-token', token);
      expect(res.status).toEqual(200);
      expect(res.body.id).toEqual(subscriptionId);
      expect(res.body.config.filters).toEqual('test,test1');
      await rcUserRecord.destroy();
      await trelloWebhookRecord.destroy();
    });
  });

  describe('Remove subscription', () => {
    const botId = '266262009';

    beforeAll(async () => {
      await Bot.create({
        id: botId,
        token: {
          access_token: 'xxx',
          owner_id: 'xxxxx',
        },
      });
    });

    afterAll(async () => {
      await Bot.destroy({
        where: {
          id: botId,
        },
      });
    });


    it('should get 403 without token', async () => {
      const res = await request(server).delete('/bot-subscription');
      expect(res.status).toEqual(403);
    });

    it('should get 403 without subscription id', async () => {
      const res = await request(server).delete('/bot-subscription').send({
        token: 'xxx',
      });
      expect(res.status).toEqual(403);
    });

    it('should get 401 with invalid token', async () => {
      const res = await request(server).delete('/bot-subscription').send({
        token: 'xxx',
        id: 'xxxx',
      });;
      expect(res.status).toEqual(401);
    });

    it('should get 401 with rc user not found', async () => {
      const token = jwt.generateToken({
        uId: '123',
        bId: '123',
        gId: '111',
      }, '24h');
      const res = await request(server).delete('/bot-subscription').send({
        token: token,
        id: 'xxxx',
      });;
      expect(res.status).toEqual(401);
    });

    it('should get 401 without trello user id', async () => {
      const rcUserId = '1234444';
      const rcUserRecord = await RcUser.create({
        id: `rcext-${rcUserId}`,
      });
      const token = jwt.generateToken({
        uId: rcUserId,
        bId: '123',
        gId: '111',
      }, '24h');
      const res = await request(server).delete('/bot-subscription').send({
        token: token,
        id: 'xxxx',
      });
      expect(res.status).toEqual(401);
      await rcUserRecord.destroy();
    });

    it('should get 401 with trello user not found', async () => {
      const rcUserId = '1234444';
      const rcUserRecord = await RcUser.create({
        id: `rcext-${rcUserId}`,
        trello_user_id: 'trello-user-123',
      });
      const token = jwt.generateToken({
        uId: rcUserId,
        bId: '123',
        gId: '111',
      }, '24h');
      const res = await request(server).delete('/bot-subscription').send({
        token: token,
        id: 'xxxx',
      });
      expect(res.status).toEqual(401);
      await rcUserRecord.destroy();
    });

    it('should get 401 with trello user does not have token', async () => {
      const rcUserId = '1234444';
      const trelloUserId = 'trello-user-123456';
      const trelloUserRecord = await TrelloUser.create({
        id: trelloUserId,
        writeable_token: '',
      });
      const rcUserRecord = await RcUser.create({
        id: `rcext-${rcUserId}`,
        trello_user_id: trelloUserId,
      });
      const token = jwt.generateToken({
        uId: rcUserId,
        bId: '123',
        gId: '111',
      }, '24h');
      const res = await request(server).delete('/bot-subscription').send({
        token: token,
        id: 'xxxx',
      });;
      expect(res.status).toEqual(401);
      await rcUserRecord.destroy();
      await trelloUserRecord.destroy();
    });

    it('should get 404 with subscription id is not found', async () => {
      const rcUserId = '1234444';
      const trelloUserId = 'trello-user-123456';
      const trelloUserRecord = await TrelloUser.create({
        id: trelloUserId,
        writeable_token: 'xxxx',
      });
      const rcUserRecord = await RcUser.create({
        id: `rcext-${rcUserId}`,
        trello_user_id: trelloUserId,
      });
      const token = jwt.generateToken({
        uId: rcUserId,
        bId: '123',
        gId: '111',
      }, '24h');
      const res = await request(server).delete('/bot-subscription').send({
        token: token,
        id: 'xxxx',
      });;
      expect(res.status).toEqual(404);
      await rcUserRecord.destroy();
      await trelloUserRecord.destroy();
    });

    it('should get 404 with subscription id does not belongs to the user', async () => {
      const rcUserId = '1234444';
      const trelloUserId = 'trello-user-123456';
      const boardId = '5b6893f01cb3228998cf629e';
      const subscriptionId = 'test_subscription_id';
      const groupId = '713297119';
      const trelloUserRecord = await TrelloUser.create({
        id: trelloUserId,
        writeable_token: 'xxxx',
      });
      const rcUserRecord = await RcUser.create({
        id: `rcext-${rcUserId}`,
        trello_user_id: trelloUserId,
      });
      const trelloWebhookRecord = await TrelloWebhook.create({
        id: subscriptionId,
        bot_id: 'xxxx',
        conversation_id: groupId,
        trello_user_id: 'xxx',
        trello_webhook_id: 'test_trello_webhook_id_xxx',
        config: {
          boardId,
          filters: 'test',
          labels: [],
        },
      });
      const token = jwt.generateToken({
        uId: rcUserId,
        bId: '123',
        gId: '111',
      }, '24h');
      const res = await request(server).delete('/bot-subscription').send({
        token: token,
        id: 'xxxx',
      });;
      expect(res.status).toEqual(404);
      await rcUserRecord.destroy();
      await trelloUserRecord.destroy();
      await trelloWebhookRecord.destroy();
    });

    it('should remove successfully with trello webhook id', async () => {
      const rcUserId = '1234444';
      const trelloUserId = 'trello-user-123456';
      const boardId = '5b6893f01cb3228998cf629e';
      const subscriptionId = 'test_subscription_id';
      const groupId = '713297119';
      const trelloUserRecord = await TrelloUser.create({
        id: trelloUserId,
        writeable_token: 'xxxx',
      });
      const rcUserRecord = await RcUser.create({
        id: `rcext-${rcUserId}`,
        trello_user_id: trelloUserId,
        bot_subscriptions: [{
          id: subscriptionId,
          boardId,
          conversation_id: groupId,
        }],
      });
      await TrelloWebhook.create({
        id: subscriptionId,
        bot_id: botId,
        conversation_id: groupId,
        trello_user_id: trelloUserId,
        trello_webhook_id: 'test_trello_webhook_id_xxx',
        config: {
          boardId,
          filters: 'test',
          labels: [],
        },
      });
      const trelloDeleteWebhooksScope = nock('https://api.trello.com')
        .delete(uri => uri.includes(`/1/webhooks/test_trello_webhook_id_xxx?`))
        .reply(200, {});
      const rcMessageScope = nock(process.env.RINGCENTRAL_SERVER)
        .post(uri => uri.includes(`/restapi/v1.0/glip/groups/${groupId}/posts`))
        .reply(200, {});
      const token = jwt.generateToken({
        uId: rcUserId,
        bId: botId,
        gId: groupId,
      }, '24h');
      const res = await request(server).delete('/bot-subscription').send({
        token: token,
        id: subscriptionId,
      });;
      expect(res.status).toEqual(200);
      const newRcUserRecord = await RcUser.findByPk(`rcext-${rcUserId}`);
      expect(newRcUserRecord.bot_subscriptions.length).toEqual(0);
      const newTrelloWebhookRecord = await TrelloWebhook.findByPk(subscriptionId);
      expect(!!newTrelloWebhookRecord).toEqual(false);
      await rcUserRecord.destroy();
      await trelloUserRecord.destroy();
      trelloDeleteWebhooksScope.done();
      rcMessageScope.done();
    });

    it('should remove successfully without trello webhook id', async () => {
      const rcUserId = '1234444';
      const trelloUserId = 'trello-user-123456';
      const boardId = '5b6893f01cb3228998cf629e';
      const subscriptionId = 'test_subscription_id';
      const groupId = '713297119';
      const trelloUserRecord = await TrelloUser.create({
        id: trelloUserId,
        writeable_token: 'xxxx',
      });
      const rcUserRecord = await RcUser.create({
        id: `rcext-${rcUserId}`,
        trello_user_id: trelloUserId,
        bot_subscriptions: [{
          id: subscriptionId,
          boardId,
          conversation_id: groupId,
        }],
      });
      await TrelloWebhook.create({
        id: subscriptionId,
        bot_id: botId,
        conversation_id: groupId,
        trello_user_id: trelloUserId,
        config: {
          boardId,
          filters: 'test',
          labels: [],
        },
      });
      const rcMessageScope = nock(process.env.RINGCENTRAL_SERVER)
        .post(uri => uri.includes(`/restapi/v1.0/glip/groups/${groupId}/posts`))
        .reply(200, {});
      const token = jwt.generateToken({
        uId: rcUserId,
        bId: botId,
        gId: groupId,
      }, '24h');
      const res = await request(server).delete('/bot-subscription').send({
        token: token,
        id: subscriptionId,
      });;
      expect(res.status).toEqual(200);
      const newRcUserRecord = await RcUser.findByPk(`rcext-${rcUserId}`);
      expect(newRcUserRecord.bot_subscriptions.length).toEqual(0);
      const newTrelloWebhookRecord = await TrelloWebhook.findByPk(subscriptionId);
      expect(!!newTrelloWebhookRecord).toEqual(false);
      await rcUserRecord.destroy();
      await trelloUserRecord.destroy();
      rcMessageScope.done();
    });

    it('should remove successfully without bot id', async () => {
      const rcUserId = '1234444';
      const trelloUserId = 'trello-user-123456';
      const boardId = '5b6893f01cb3228998cf629e';
      const subscriptionId = 'test_subscription_id';
      const groupId = '713297119';
      const trelloUserRecord = await TrelloUser.create({
        id: trelloUserId,
        writeable_token: 'xxxx',
      });
      const rcUserRecord = await RcUser.create({
        id: `rcext-${rcUserId}`,
        trello_user_id: trelloUserId,
        bot_subscriptions: [{
          id: subscriptionId,
          boardId,
          conversation_id: groupId,
        }],
      });
      await TrelloWebhook.create({
        id: subscriptionId,
        bot_id: 'xxx',
        conversation_id: groupId,
        trello_user_id: trelloUserId,
        trello_webhook_id: 'test_trello_webhook_id_xxx',
        config: {
          boardId,
          filters: 'test',
          labels: [],
        },
      });
      const trelloDeleteWebhooksScope = nock('https://api.trello.com')
        .delete(uri => uri.includes(`/1/webhooks/test_trello_webhook_id_xxx?`))
        .reply(200, {});
      const token = jwt.generateToken({
        uId: rcUserId,
        bId: 'xxx',
        gId: groupId,
      }, '24h');
      const res = await request(server).delete('/bot-subscription').send({
        token: token,
        id: subscriptionId,
      });;
      expect(res.status).toEqual(200);
      const newRcUserRecord = await RcUser.findByPk(`rcext-${rcUserId}`);
      expect(newRcUserRecord.bot_subscriptions.length).toEqual(0);
      const newTrelloWebhookRecord = await TrelloWebhook.findByPk(subscriptionId);
      expect(!!newTrelloWebhookRecord).toEqual(false);
      await rcUserRecord.destroy();
      await trelloUserRecord.destroy();
      trelloDeleteWebhooksScope.done();
    });
  });
});
