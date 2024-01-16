const request = require('supertest');
const nock = require('nock');
const axios = require('axios');
const { default: Bot } = require('ringcentral-chatbot-core/dist/models/Bot');

const { server } = require('../src/server');
const jwt = require('../src/app/lib/jwt');

const { TrelloUser } = require('../src/app/models/trello-user');
const { RcUser } = require('../src/app/models/rc-user');
const { TrelloWebhook } = require('../src/app/models/trello-webhook');

axios.defaults.adapter = require('axios/lib/adapters/http');

describe('Trello Authorization', () => {
  it('should redirect to Trello authorization page', async () => {
    const res = await request(server).get('/trello/authorize');
    expect(res.status).toEqual(302);
    expect(res.headers.location).toContain('scope=read');
  });

  it('should redirect to Trello full authorization page', async () => {
    const res = await request(server).get('/trello/full-authorize');
    expect(res.status).toEqual(302);
    expect(res.headers.location).toContain('scope=read%2Cwrite');
  });

  it('should render oauthCallback page successfully', async () => {
    const res = await request(server).get('/trello/oauth-callback?token=xxx');
    expect(res.status).toEqual(200);
    expect(res.text).toContain('copyArea');
  });

  it('should render bot oauthCallback page successfully', async () => {
    const res = await request(server).get('/trello/bot-oauth-callback/botToken?token=xxx');
    expect(res.status).toEqual(200);
    expect(res.text).toContain('Wait a moment');
  });

  it('should get 200 at auth setup page request', async () => {
    const token = jwt.generateToken({
      id: 'xxx',
    });
    const res = await request(server).get(`/bot-auth-setup?token=${token}`);
    expect(res.status).toEqual(200);
    expect(res.text).toContain(token);
  });

  it('should response 403 when save token without token', async () => {
    const res = await request(server).post('/trello/token');
    expect(res.status).toEqual(403);
  });

  it('should response 403 when trello token invalid', async () => {
    const trelloUserScope = nock('https://api.trello.com')
      .get(uri => uri.includes(`/1/members/me?`))
      .reply(401, {});
    const res = await request(server).post('/trello/token').send({
      token: 'xxx',
    });
    expect(res.status).toEqual(403);
    trelloUserScope.done();
  });

  it('should response 500 when trello response 500 for user info', async () => {
    const trelloUserScope = nock('https://api.trello.com')
      .get(uri => uri.includes(`/1/members/me?`))
      .reply(500, {});
    const res = await request(server).post('/trello/token').send({
      token: 'xxx',
    });
    expect(res.status).toEqual(500);
    trelloUserScope.done();
  });

  it('should response 403 when trello user info return empty', async () => {
    const trelloUserScope = nock('https://api.trello.com')
      .get(uri => uri.includes(`/1/members/me?`))
      .reply(200, {});
    const res = await request(server).post('/trello/token').send({
      token: 'xxx',
    });
    expect(res.status).toEqual(403);
    trelloUserScope.done();
  });

  it('should save trello token successfully for new user', async () => {
    const trelloUserId = 'trello-user-xxx';
    const trelloUserScope = nock('https://api.trello.com')
      .get(uri => uri.includes(`/1/members/me?`))
      .reply(200, {
        id: trelloUserId,
      });
    const res = await request(server).post('/trello/token').send({
      token: 'xxxx',
    });
    expect(res.status).toEqual(200);
    expect(JSON.parse(res.text).authorize).toEqual(true);
    const trelloUser = await TrelloUser.findByPk(trelloUserId);
    expect(trelloUser.token).toEqual('xxxx');
    await TrelloUser.destroy({ where: { id: trelloUser.id }});
    trelloUserScope.done();
  });

  it('should save trello token successfully for existing user', async () => {
    const trelloUserId = 'trello-user-xxx';
    const trelloUserScope = nock('https://api.trello.com')
      .get(uri => uri.includes(`/1/members/me?`))
      .reply(200, {
        id: trelloUserId,
      });
    await TrelloUser.create({
      id: trelloUserId,
      token: 'xxxx',
    });
    const res = await request(server).post('/trello/token').send({
      token: 'new_token',
    });
    expect(res.status).toEqual(200);
    expect(JSON.parse(res.text).authorize).toEqual(true);
    const trelloUser = await TrelloUser.findByPk(trelloUserId);
    expect(trelloUser.token).toEqual('new_token');
    await TrelloUser.destroy({ where: { id: trelloUser.id }});
    trelloUserScope.done();
  });

  it('should response 403 when revoke trello without token', async () => {
    const res = await request(server).post('/trello/revoke');
    expect(res.status).toEqual(403);
  });

  it('should response 401 when revoke trello with invalid token', async () => {
    const res = await request(server).post('/trello/revoke').send({
      token: 'xxx',
    });
    expect(res.status).toEqual(401);
  });

  it('should response 200 when revoke trello with user not found', async () => {
    const token = jwt.generateToken({
      id: 'xxx',
    });
    const res = await request(server).post('/trello/revoke').send({
      token,
    });
    expect(res.status).toEqual(200);
  });

  it('should revoke trello successfully with valid token', async () => {
    const trelloUserId = 'trello_user_id';
    let trelloUserRecord = await TrelloUser.create({
      id: trelloUserId,
      token: 'xxx',
    });
    const token = jwt.generateToken({
      id: trelloUserId,
    });
    const trelloRevokeScope = nock('https://api.trello.com')
      .delete(uri => uri.includes(`/1/tokens/${trelloUserRecord.token}?`))
      .reply(200, {});
    const res = await request(server).post('/trello/revoke').send({
      token,
    });
    expect(res.status).toEqual(200);
    trelloUserRecord = await TrelloUser.findByPk(trelloUserId);
    expect(!!trelloUserRecord.token).toEqual(false);
    await TrelloUser.destroy({ where: { id: trelloUserRecord.id }});
    trelloRevokeScope.done();
  });

  it('should response 200 when trello revoke return error', async () => {
    const trelloUserId = 'trello_user_id';
    let trelloUserRecord = await TrelloUser.create({
      id: trelloUserId,
      token: 'xxx',
    });
    const token = jwt.generateToken({
      id: trelloUserId,
    });
    const trelloRevokeScope = nock('https://api.trello.com')
      .delete(uri => uri.includes(`/1/tokens/${trelloUserRecord.token}?`))
      .reply(404, {});
    const res = await request(server).post('/trello/revoke').send({
      token,
    });
    expect(res.status).toEqual(200);
    trelloUserRecord = await TrelloUser.findByPk(trelloUserId);
    expect(!!trelloUserRecord.token).toEqual(false);
    await TrelloUser.destroy({ where: { id: trelloUserRecord.id }});
    trelloRevokeScope.done();
  });

  describe('Bot Save Token', () => {
    it('should response 401 when save bot token with invalid bot token', async () => {
      const res = await request(server).post('/trello/bot-oauth-callback/xxx');
      expect(res.status).toEqual(401);
    });
  
    it('should response 401 when save bot token with invalid trello token', async () => {
      const botToken = jwt.generateToken({
        uId: 'rcUserId',
        bId: 'botId',
        cId: 'cardId',
        gId: 'conversationId',
      });
      const res = await request(server).post(`/trello/bot-oauth-callback/${botToken}`);
      expect(res.status).toEqual(401);
    });
  
    it('should response 403 when fetch trello user data with empty data', async () => {
      const botToken = jwt.generateToken({
        uId: 'rcUserId',
        bId: 'botId',
        cId: 'cardId',
        gId: 'conversationId',
      });
      const trelloUserScope = nock('https://api.trello.com')
        .get(uri => uri.includes(`/1/members/me?`))
        .reply(200, {});
      const res = await request(server).post(`/trello/bot-oauth-callback/${botToken}?token=xxx`);
      expect(res.status).toEqual(403);
      trelloUserScope.done();
    });
  
    it('should response 401 when fetch trello user data with 401', async () => {
      const botToken = jwt.generateToken({
        uId: 'rcUserId',
        bId: 'botId',
        cId: 'cardId',
        gId: 'conversationId',
      });
      const trelloUserScope = nock('https://api.trello.com')
        .get(uri => uri.includes(`/1/members/me?`))
        .reply(401, {});
      const res = await request(server).post(`/trello/bot-oauth-callback/${botToken}?token=xxx`);
      expect(res.status).toEqual(401);
      trelloUserScope.done();
    });

    it('should response 500 when fetch trello user data with 500', async () => {
      const botToken = jwt.generateToken({
        uId: 'rcUserId',
        bId: 'botId',
        cId: 'cardId',
        gId: 'conversationId',
      });
      const trelloUserScope = nock('https://api.trello.com')
        .get(uri => uri.includes(`/1/members/me?`))
        .reply(500, {});
      const res = await request(server).post(`/trello/bot-oauth-callback/${botToken}?token=xxx`);
      expect(res.status).toEqual(500);
      trelloUserScope.done();
    });

    it('should response 404 when bot is not found', async () => {
      const botToken = jwt.generateToken({
        uId: 'rcUserId',
        bId: 'botId',
        cId: 'cardId',
        gId: 'conversationId',
      });
      const trelloUserId = 'test_trello_user_id';
      const trelloUserScope = nock('https://api.trello.com')
        .get(uri => uri.includes(`/1/members/me?`))
        .reply(200, {
          id: trelloUserId,
          fullName: 'test name',
        });
      const res = await request(server).post(`/trello/bot-oauth-callback/${botToken}?token=xxx`);
      expect(res.status).toEqual(404);
      trelloUserScope.done();
    });

    it('should save token successfully for new user and send auth success card', async () => {
      const rcUserId = 'test_rc_user_id';
      const botId = 'test_bot_id';
      const cardId = 'test_card_id';
      const botToken = jwt.generateToken({
        uId: rcUserId,
        bId: botId,
        cId: cardId,
        gId: 'conversationId',
      });
      const bot = await Bot.create({
        id: botId,
        token: {
          access_token: 'xxx',
          owner_id: 'xxxxx',
        },
      });
      const trelloUserId = 'test_trello_user_id';
      const trelloUserScope = nock('https://api.trello.com')
        .get(uri => uri.includes(`/1/members/me?`))
        .reply(200, {
          id: trelloUserId,
          fullName: 'test name',
        });
      const rcAuthCardPutScope = nock(process.env.RINGCENTRAL_SERVER)
        .put(uri => uri.includes(`/restapi/v1.0/glip/adaptive-cards/${cardId}`))
        .reply(200, {
          id: 'auth_card_id',
        });
      let requestBody = null;
      rcAuthCardPutScope.once('request', ({ headers: requestHeaders }, interceptor, reqBody) => {
        requestBody = JSON.parse(reqBody);
      });
      const res = await request(server).post(`/trello/bot-oauth-callback/${botToken}?token=xxx`);
      expect(res.status).toEqual(200);
      expect(requestBody.fallbackText).toContain('Connected with Trello successfully');
      const rcUser = await RcUser.findByPk(`rcext-${rcUserId}`);
      expect(rcUser.trello_user_id).toEqual(trelloUserId);
      const trelloUser = await TrelloUser.findByPk(trelloUserId);
      expect(trelloUser.writeable_token).toEqual('xxx');
      await RcUser.destroy({ where: { id: rcUser.id } });
      await TrelloUser.destroy({ where: { id: trelloUser.id }});
      await Bot.destroy({ where: { id: bot.id }});
      trelloUserScope.done();
      rcAuthCardPutScope.done();
    });

    it('should save token successfully for existing user and send auth success card', async () => {
      const rcUserId = 'test_rc_user_id';
      const botId = 'test_bot_id';
      const cardId = 'test_card_id';
      const botToken = jwt.generateToken({
        uId: rcUserId,
        bId: botId,
        cId: cardId,
        gId: 'conversationId',
      });
      const bot = await Bot.create({
        id: botId,
        token: {
          access_token: 'xxx',
          owner_id: 'xxxxx',
        },
      });
      let trelloUserRecord = await TrelloUser.create({
        id: 'test_trello_user_id',
        writeable_token: 'aaa',
      });
      const rcUserRecord = await RcUser.create({
        id: `rcext-${rcUserId}`,
        trello_user_id: trelloUserRecord.id,
      });
      const trelloUserId = 'test_trello_user_id';
      const trelloUserScope = nock('https://api.trello.com')
        .get(uri => uri.includes(`/1/members/me?`))
        .reply(200, {
          id: trelloUserId,
          fullName: 'test name',
        });
      const rcAuthCardPutScope = nock(process.env.RINGCENTRAL_SERVER)
        .put(uri => uri.includes(`/restapi/v1.0/glip/adaptive-cards/${cardId}`))
        .reply(200, {
          id: 'auth_card_id',
        });
      let requestBody = null;
      rcAuthCardPutScope.once('request', ({ headers: requestHeaders }, interceptor, reqBody) => {
        requestBody = JSON.parse(reqBody);
      });
      const res = await request(server).post(`/trello/bot-oauth-callback/${botToken}?token=xxx`);
      expect(res.status).toEqual(200);
      expect(requestBody.fallbackText).toContain('Connected with Trello successfully');
      trelloUserRecord = await TrelloUser.findByPk(trelloUserId);
      expect(trelloUserRecord.writeable_token).toEqual('xxx');
      await RcUser.destroy({ where: { id: rcUserRecord.id } });
      await TrelloUser.destroy({ where: { id: trelloUserRecord.id }});
      await Bot.destroy({ where: { id: bot.id }});
      trelloUserScope.done();
      rcAuthCardPutScope.done();
    });

    it('should save token successfully for existing user and not update card without cardId', async () => {
      const rcUserId = 'test_rc_user_id';
      const botId = 'test_bot_id';
      const botToken = jwt.generateToken({
        uId: rcUserId,
        bId: botId,
        gId: 'conversationId',
      });
      const bot = await Bot.create({
        id: botId,
        token: {
          access_token: 'xxx',
          owner_id: 'xxxxx',
        },
      });
      let trelloUserRecord = await TrelloUser.create({
        id: 'test_trello_user_id',
        writeable_token: 'aaa',
      });
      const rcUserRecord = await RcUser.create({
        id: `rcext-${rcUserId}`,
        trello_user_id: trelloUserRecord.id,
      });
      const trelloUserId = 'test_trello_user_id';
      const trelloUserScope = nock('https://api.trello.com')
        .get(uri => uri.includes(`/1/members/me?`))
        .reply(200, {
          id: trelloUserId,
          fullName: 'test name',
        });
      const res = await request(server).post(`/trello/bot-oauth-callback/${botToken}?token=xxx`);
      expect(res.status).toEqual(200);
      trelloUserRecord = await TrelloUser.findByPk(trelloUserId);
      expect(trelloUserRecord.writeable_token).toEqual('xxx');
      await RcUser.destroy({ where: { id: rcUserRecord.id } });
      await TrelloUser.destroy({ where: { id: trelloUserRecord.id }});
      await Bot.destroy({ where: { id: bot.id }});
      trelloUserScope.done();
    });

    it('should save token successfully for new user and send setup card', async () => {
      const rcUserId = 'test_rc_user_id';
      const botId = 'test_bot_id';
      const cardId = 'test_card_id';
      const groupId = 'test_group_id';
      const botToken = jwt.generateToken({
        uId: rcUserId,
        bId: botId,
        cId: cardId,
        gId: groupId,
        next: 'subscribe',
      });
      const bot = await Bot.create({
        id: botId,
        token: {
          access_token: 'xxx',
          owner_id: 'xxxxx',
        },
      });
      const trelloUserId = 'test_trello_user_id';
      const trelloUserScope = nock('https://api.trello.com')
        .get(uri => uri.includes(`/1/members/me?`))
        .reply(200, {
          id: trelloUserId,
          fullName: 'test name',
        });
      const rcCardPutScope = nock(process.env.RINGCENTRAL_SERVER)
        .put(uri => uri.includes(`/restapi/v1.0/glip/adaptive-cards/${cardId}`))
        .reply(200, {
          id: 'auth_card_id',
        });
      const rcGroupScope = nock(process.env.RINGCENTRAL_SERVER)
        .get(uri => uri.includes(`/restapi/v1.0/glip/groups/${groupId}`))
        .reply(200, {
          id: groupId,
          type: 'Team',
          name: 'test team',
          members: [
            "170848004",
            "170853004",
            "713297005"
          ]
        });
      let requestBody = null;
      rcCardPutScope.once('request', ({ headers: requestHeaders }, interceptor, reqBody) => {
        requestBody = JSON.parse(reqBody);
      });
      const res = await request(server).post(`/trello/bot-oauth-callback/${botToken}?token=xxx`);
      expect(res.status).toEqual(200);
      expect(requestBody.fallbackText).toContain('Trello setup for **test team**');
      const rcUser = await RcUser.findByPk(`rcext-${rcUserId}`);
      expect(rcUser.trello_user_id).toEqual(trelloUserId);
      const trelloUser = await TrelloUser.findByPk(trelloUserId);
      expect(trelloUser.writeable_token).toEqual('xxx');
      await RcUser.destroy({ where: { id: rcUser.id } });
      await TrelloUser.destroy({ where: { id: trelloUser.id }});
      await Bot.destroy({ where: { id: bot.id }});
      trelloUserScope.done();
      rcCardPutScope.done();
      rcGroupScope.done();
    });
  });

  describe('Bot Revoke Token', () => {
    it('should response 403 when revoke bot token without token', async () => {
      const res = await request(server).post('/trello/bot-revoke');
      expect(res.status).toEqual(403);
    });
  
    it('should response 401 when revoke bot token with invalid trello token', async () => {
      const botToken = 'xxxx';
      const res = await request(server).post('/trello/bot-revoke').send({ token: botToken });
      expect(res.status).toEqual(401);
    });

    it('should response 200 when rc user is not found', async () => {
      const botToken = jwt.generateToken({
        uId: 'rcUserIdxxx',
        bId: 'botId',
        gId: 'conversationId',
      });
      const res = await request(server).post('/trello/bot-revoke').send({ token: botToken });
      expect(res.status).toEqual(200);
    });

    it('should response 200 when rc user does not have trello user connected', async () => {
      const rcUserId = 'rcUserId-xxx';
      const botToken = jwt.generateToken({
        uId: rcUserId,
        bId: 'botId',
        gId: 'conversationId',
      });
      const rcUserRecord = await RcUser.create({
        id: `rcext-${rcUserId}`,
      });
      const res = await request(server).post('/trello/bot-revoke').send({ token: botToken });
      expect(res.status).toEqual(200);
      await RcUser.destroy({ where: { id: rcUserRecord.id } });
    });

    it('should response 200 when trello user not found', async () => {
      const rcUserId = 'rcUserId-xxx';
      const botToken = jwt.generateToken({
        uId: rcUserId,
        bId: 'botId',
        gId: 'conversationId',
      });
      const rcUserRecord = await RcUser.create({
        id: `rcext-${rcUserId}`,
        trello_user_id: 'xxx',
      });
      const res = await request(server).post('/trello/bot-revoke').send({ token: botToken });
      expect(res.status).toEqual(200);
      await RcUser.destroy({ where: { id: rcUserRecord.id } });
    });

    it('should response 200 when trello user does not have token', async () => {
      const rcUserId = 'rcUserId-xxx';
      const botToken = jwt.generateToken({
        uId: rcUserId,
        bId: 'botId',
        gId: 'conversationId',
      });
      const rcUserRecord = await RcUser.create({
        id: `rcext-${rcUserId}`,
        trello_user_id: 'test_trello_user_id_xxx',
      });
      const trelloUserRecord = await TrelloUser.create({
        id: 'test_trello_user_id_xxx',
        writeable_token: '',
      });
      const res = await request(server).post('/trello/bot-revoke').send({ token: botToken });
      expect(res.status).toEqual(200);
      await RcUser.destroy({ where: { id: rcUserRecord.id } });
      await TrelloUser.destroy({ where: { id: trelloUserRecord.id } });
    });

    it('should response 200 when trello user has token', async () => {
      const rcUserId = 'rcUserId-xxx';
      const botToken = jwt.generateToken({
        uId: rcUserId,
        bId: 'botId',
        gId: 'conversationId',
      });
      const rcUserRecord = await RcUser.create({
        id: `rcext-${rcUserId}`,
        trello_user_id: 'test_trello_user_id_xxx',
      });
      const trelloUserRecord = await TrelloUser.create({
        id: 'test_trello_user_id_xxx',
        writeable_token: 'xxxxx',
      });
      const trelloRevokeScope = nock('https://api.trello.com')
        .delete(uri => uri.includes(`/1/tokens/${trelloUserRecord.writeable_token}?`))
        .reply(200, {});
      const res = await request(server).post('/trello/bot-revoke').send({ token: botToken });
      expect(res.status).toEqual(200);
      const newTrelloUserRecord = await TrelloUser.findByPk('test_trello_user_id_xxx');
      expect(newTrelloUserRecord.writeable_token).toEqual('');
      await RcUser.destroy({ where: { id: rcUserRecord.id } });
      await TrelloUser.destroy({ where: { id: trelloUserRecord.id } });
      trelloRevokeScope.done();
    });

    it('should response 200 and remove bot subscriptions', async () => {
      const rcUserId = 'rcUserId-xxx';
      const botToken = jwt.generateToken({
        uId: rcUserId,
        bId: 'botId',
        gId: 'conversationId',
      });
      const rcUserRecord = await RcUser.create({
        id: `rcext-${rcUserId}`,
        trello_user_id: 'test_trello_user_id_xxx',
        bot_subscriptions: [{
          id: 'test_subscription_id_xxx',
          conversation_id: 'xxxx',
          boardId: 'test_board_id',
        }],
      });
      const trelloUserRecord = await TrelloUser.create({
        id: 'test_trello_user_id_xxx',
        writeable_token: 'xxxxx',
      });
      await TrelloWebhook.create({
        id: 'test_subscription_id_xxx',
        bot_id: 'botId',
        conversation_id: 'xxx',
        trello_user_id: trelloUserRecord.id,
        config: {
          boardId: 'test-board-id',
          filters: '',
          labels: [],
        },
      });
      const trelloRevokeScope = nock('https://api.trello.com')
        .delete(uri => uri.includes(`/1/tokens/${trelloUserRecord.writeable_token}?`))
        .reply(200, {});
      const res = await request(server).post('/trello/bot-revoke').send({ token: botToken });
      expect(res.status).toEqual(200);
      const trelloWebhook = await TrelloWebhook.findByPk('test_subscription_id_xxx');
      expect(!!trelloWebhook).toEqual(false);
      const newRcUserRecord = await RcUser.findByPk(`rcext-${rcUserId}`);
      expect(newRcUserRecord.bot_subscriptions).toEqual(null);
      const newTrelloUserRecord = await TrelloUser.findByPk('test_trello_user_id_xxx');
      expect(newTrelloUserRecord.writeable_token).toEqual('');
      await RcUser.destroy({ where: { id: rcUserRecord.id } });
      await TrelloUser.destroy({ where: { id: trelloUserRecord.id } });
      trelloRevokeScope.done();
    });

    it('should response 200 when trello revoke return 401', async () => {
      const rcUserId = 'rcUserId-xxx';
      const botToken = jwt.generateToken({
        uId: rcUserId,
        bId: 'botId',
        gId: 'conversationId',
      });
      const rcUserRecord = await RcUser.create({
        id: `rcext-${rcUserId}`,
        trello_user_id: 'test_trello_user_id_xxx',
      });
      const trelloUserRecord = await TrelloUser.create({
        id: 'test_trello_user_id_xxx',
        writeable_token: 'xxxxx',
      });
      const trelloRevokeScope = nock('https://api.trello.com')
        .delete(uri => uri.includes(`/1/tokens/${trelloUserRecord.writeable_token}?`))
        .reply(401, {});
      const res = await request(server).post('/trello/bot-revoke').send({ token: botToken });
      expect(res.status).toEqual(200);
      const newTrelloUserRecord = await TrelloUser.findByPk('test_trello_user_id_xxx');
      expect(newTrelloUserRecord.writeable_token).toEqual('');
      await RcUser.destroy({ where: { id: rcUserRecord.id } });
      await TrelloUser.destroy({ where: { id: trelloUserRecord.id } });
      trelloRevokeScope.done();
    });
  });
});
