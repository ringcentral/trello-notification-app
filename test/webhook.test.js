const request = require('supertest');
const nock = require('nock');
const axios = require('axios');
const { server } = require('../src/server');
const jwt = require('../src/app/lib/jwt');

const { TrelloUser } = require('../src/app/models/trello-user');
const { TrelloWebhook } = require('../src/app/models/trello-webhook');
const { RCWebhook } = require('../src/app/models/rc-webhook');

axios.defaults.adapter = 'http';

describe('Notification Webhooks', () => {
  it('should get 404 without webhook uri', async () => {
    const res = await request(server).get('/webhooks/new');
    expect(res.status).toEqual(404);
  });

  it('should get new webhook page successfully', async () => {
    const res = await request(server).get('/webhooks/new?webhook=test.com');
    expect(res.status).toEqual(404);
  });

  it('should get new webhook page successfully', async () => {
    const res = await request(server).get('/webhooks/new?webhook=http://test.com/webhook/12111');
    expect(res.status).toEqual(200);
  });

  it('should get 403 when request webhook info without token', async () => {
    const res = await request(server).get('/webhooks/info');
    expect(res.status).toEqual(403);
  });

  it('should get 403 when request webhook info without rcWebhookUri', async () => {
    const res = await request(server).get('/webhooks/info')
      .set('x-access-token', 'xxx');
    expect(res.status).toEqual(403);
  });

  it('should get 403 when request webhook info with wrong rcWebhook', async () => {
    const res = await request(server).get('/webhooks/info?rcWebhook=tel://123')
      .set('x-access-token', 'xxx');
    expect(res.status).toEqual(403);
  });

  it('should get 401 when request webhook info with invalid token', async () => {
    const res = await request(server).get('/webhooks/info?rcWebhook=http://test.com/webhook/12111')
      .set('x-access-token', 'xxx');
    expect(res.status).toEqual(401);
  });

  it('should get 401 when request webhook info with no found user id in token', async () => {
    const token = jwt.generateToken({
      id: 'wrong_user_id',
    });
    const res = await request(server).get(`/webhooks/info?rcWebhook=http://test.com/webhook/12111`)
      .set('x-access-token', token);
    expect(res.status).toEqual(401);
  });

  it('should get 401 when request webhook info with Trello user token is empty', async () => {
    const trelloUserId = 'trello_user_id';
    const trelloUserRecord = await TrelloUser.create({
      id: trelloUserId,
      token: '',
    });
    const token = jwt.generateToken({
      id: trelloUserId,
    });
    const res = await request(server)
      .get(`/webhooks/info?rcWebhook=http://test.com/webhook/12111`)
      .set('x-access-token', token);
    expect(res.status).toEqual(401);
    await TrelloUser.destroy({ where: { id: trelloUserRecord.id }});
  });

  it('should get webhook info successfully with Trello user token', async () => {
    const trelloUserId = 'trello_user_id';
    const trelloUserRecord = await TrelloUser.create({
      id: trelloUserId,
      token: 'test_token',
    });
    const token = jwt.generateToken({
      id: trelloUserId,
    });
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
    const trelloUserScope = nock('https://api.trello.com')
      .get(uri => uri.includes(`/1/members/me?`))
      .reply(200, {
        fullName: 'test_user',
      });
    const res = await request(server)
      .get(`/webhooks/info?&rcWebhook=http://test.com/webhook/12111`)
      .set('x-access-token', token);
    expect(res.status).toEqual(200);
    expect(res.body.userInfo.fullName).toEqual('test_user');
    expect(res.body.boards.length).toEqual(2);
    await TrelloUser.destroy({ where: { id: trelloUserRecord.id }});
    trelloBoardScope.done();
    trelloUserScope.done();
  });

  it('should get 401 when Trello response 401', async () => {
    const trelloUserId = 'trello_user_id';
    const trelloUserRecord = await TrelloUser.create({
      id: trelloUserId,
      token: 'test_token',
    });
    const token = jwt.generateToken({
      id: trelloUserId,
    });
    const trelloBoardScope = nock('https://api.trello.com')
      .get(uri => uri.includes(`/1/members/me/boards?`))
      .reply(401, {});
    const res = await request(server)
      .get(`/webhooks/info?rcWebhook=http://test.com/webhook/12111`)
      .set('x-access-token', token);
    expect(res.status).toEqual(401);
    await TrelloUser.destroy({ where: { id: trelloUserRecord.id }});
    trelloBoardScope.done();
  });

  it('should get 500 when Trello response 500', async () => {
    const trelloUserId = 'trello_user_id';
    const trelloUserRecord = await TrelloUser.create({
      id: trelloUserId,
      token: 'test_token',
    });
    const token = jwt.generateToken({
      id: trelloUserId,
    });
    const trelloBoardScope = nock('https://api.trello.com')
      .get(uri => uri.includes(`/1/members/me/boards?`))
      .reply(500, {});
    const res = await request(server)
      .get(`/webhooks/info?rcWebhook=http://test.com/webhook/12111`)
      .set('x-access-token', token);
    expect(res.status).toEqual(500);
    await TrelloUser.destroy({ where: { id: trelloUserRecord.id }});
    trelloBoardScope.done();
  });

  it('should get webhook info successfully with trello webhook config', async () => {
    const trelloUserId = 'trello_user_id';
    const trelloUserRecord = await TrelloUser.create({
      id: trelloUserId,
      token: 'test_token',
    });
    const rcWebhookId = '12121';
    const rcWebhookRecord = await await RCWebhook.create({
      id: rcWebhookId,
    });
    const trelloWebhook = await TrelloWebhook.create({
      id: rcWebhookRecord.trello_webhook_id,
      rc_webhook_id: `http://test.com/webhook/${rcWebhookId}`,
      trello_user_id: trelloUserId,
      config: {
        boardId: 'test-board-id',
        filters: 'addChecklistToCard',
      },
    });
    const token = jwt.generateToken({
      id: trelloUserId,
    });
    const trelloBoardScope = nock('https://api.trello.com')
      .get(uri => uri.includes(`/1/members/me/boards?`))
      .reply(200, [
        {
         "name": "Greatest Product Roadmap",
         "id": "5b6893f01cb3228998cf629e",
        },
      ]);
    const trelloUserScope = nock('https://api.trello.com')
      .get(uri => uri.includes(`/1/members/me?`))
      .reply(200, {
        fullName: 'test_user',
      });
    const res = await request(server)
      .get(`/webhooks/info?rcWebhook=http://test.com/webhook/${rcWebhookId}`)
      .set('x-access-token', token);
    expect(res.status).toEqual(200);
    expect(res.body.userInfo.fullName).toEqual('test_user');
    expect(res.body.config.boardId).toEqual('test-board-id');
    await TrelloUser.destroy({ where: { id: trelloUserRecord.id }});
    await TrelloWebhook.destroy({ where: { id: trelloWebhook.id }});
    await RCWebhook.destroy({ where: { id: rcWebhookRecord.id }});;
    trelloBoardScope.done();
    trelloUserScope.done();
  });

  it('should get webhook info successfully without trello webhook config', async () => {
    const trelloUserId = 'trello_user_id';
    const trelloUserRecord = await TrelloUser.create({
      id: trelloUserId,
      token: 'test_token',
    });
    const rcWebhookId = '12121';
    const rcWebhookRecord = await await RCWebhook.create({
      id: rcWebhookId,
    });
    const token = jwt.generateToken({
      id: trelloUserId,
    });
    const trelloBoardScope = nock('https://api.trello.com')
      .get(uri => uri.includes(`/1/members/me/boards?`))
      .reply(200, [
        {
         "name": "Greatest Product Roadmap",
         "id": "5b6893f01cb3228998cf629e",
        },
      ]);
    const trelloUserScope = nock('https://api.trello.com')
      .get(uri => uri.includes(`/1/members/me?`))
      .reply(200, {
        fullName: 'test_user',
      });
    const res = await request(server)
      .get(`/webhooks/info?rcWebhook=http://test.com/webhook/${rcWebhookId}`)
      .set('x-access-token', token);
    expect(res.status).toEqual(200);
    expect(res.body.userInfo.fullName).toEqual('test_user');
    expect(res.body.config.boardId).toEqual(undefined);
    await TrelloUser.destroy({ where: { id: trelloUserRecord.id }});
    await RCWebhook.destroy({ where: { id: rcWebhookRecord.id }});;
    trelloBoardScope.done();
    trelloUserScope.done();
  });

  it('should get 403 when create webhook info without token', async () => {
    const res = await request(server).post('/webhooks');
    expect(res.status).toEqual(403);
  });

  it('should get 403 when create webhook info without rcWebhook', async () => {
    const res = await request(server).post('/webhooks').send({
      token: 'test_token',
    });
    expect(res.status).toEqual(403);
  });

  it('should get 403 when create webhook info without boardId', async () => {
    const res = await request(server).post('/webhooks').send({
      token: 'test_token',
      rcWebhook: 'http://test.com/webhook/12121',
    });
    expect(res.status).toEqual(403);
  });

  it('should get 403 when create webhook info without filters', async () => {
    const res = await request(server).post('/webhooks').send({
      token: 'test_token',
      rcWebhook: 'http://test.com/webhook/12121',
      boardId: 'test_board_id',
    });
    expect(res.status).toEqual(403);
  });

  it('should get 401 when create webhook info without invalid token', async () => {
    const res = await request(server).post('/webhooks').send({
      token: 'test_token',
      rcWebhook: 'http://test.com/webhook/12121',
      boardId: 'test_board_id',
      filters: 'addChecklistToCard',
    });
    expect(res.status).toEqual(401);
  });

  it('should get 401 when create webhook info with no found user id in token', async () => {
    const token = jwt.generateToken({
      id: 'wrong_user_id',
    });
    const res = await request(server).post('/webhooks').send({
      token,
      rcWebhook: 'http://test.com/webhook/12121',
      boardId: 'test_board_id',
      filters: 'addChecklistToCard',
    });
    expect(res.status).toEqual(401);
  });

  it('should get 401 when create webhook info with trello user token empty', async () => {
    const trelloUserId = 'trello_user_id';
    const trelloUserRecord = await TrelloUser.create({
      id: trelloUserId,
      token: '',
    });
    const token = jwt.generateToken({
      id: trelloUserId,
    });
    const res = await request(server).post('/webhooks').send({
      token,
      rcWebhook: 'http://test.com/webhook/12121',
      boardId: 'test_board_id',
      filters: 'addChecklistToCard',
    });
    expect(res.status).toEqual(401);
    await TrelloUser.destroy({ where: { id: trelloUserRecord.id }});
  });

  it('should create webhook successfully at new subscription', async () => {
    const trelloUserId = 'trello_user_id';
    const trelloUserRecord = await TrelloUser.create({
      id: trelloUserId,
      token: 'test_token',
    });
    const token = jwt.generateToken({
      id: trelloUserId,
    });
    const boardId = 'test_board_id';
    const trelloLabelsScope = nock('https://api.trello.com')
      .get(uri => uri.includes(`/1/boards/${boardId}/labels?`))
      .reply(200, [
        { "id":"6094fb83d41eeff1fa76129d", "name":"", "color":"green" },
        { "id":"6094fb83d41eeff1fa7612a1", "name":"", "color":"yellow" },
      ]);
    const trelloWebhookId = 'test_webhook_id';
    const trelloWebhooksScope = nock('https://api.trello.com')
      .post(uri => uri.includes('/1/webhooks?'))
      .reply(200, {
        id: trelloWebhookId,
      });
    const rcWebhookId = '12121';
    const res = await request(server).post('/webhooks').send({
      token,
      rcWebhook: `http://test.com/webhook/${rcWebhookId}`,
      boardId,
      filters: 'addChecklistToCard',
    });
    expect(res.status).toEqual(200);
    await TrelloUser.destroy({ where: { id: trelloUserRecord.id }});
    const rcWebhookRecord = await RCWebhook.findByPk(rcWebhookId);
    const trelloWebhookRecord = await TrelloWebhook.findByPk(rcWebhookRecord.trello_webhook_id);
    expect(trelloWebhookRecord.trello_webhook_id).toEqual(trelloWebhookId);
    trelloLabelsScope.done();
    trelloWebhooksScope.done();
    await RCWebhook.destroy({ where: { id: rcWebhookRecord.id }});;
    await TrelloWebhook.destroy({ where: { id: trelloWebhookRecord.id }});
  });

  it('should create webhook successfully with existing rcWebhook record', async () => {
    const trelloUserId = 'trello_user_id';
    const trelloUserRecord = await TrelloUser.create({
      id: trelloUserId,
      token: 'test_token',
    });
    const rcWebhookId = '12121';
    const rcWebhookRecord = await RCWebhook.create({
      id: rcWebhookId,
    });
    const token = jwt.generateToken({
      id: trelloUserId,
    });
    const boardId = 'test_board_id';
    const trelloLabelsScope = nock('https://api.trello.com')
      .get(uri => uri.includes(`/1/boards/${boardId}/labels?`))
      .reply(200, [
        { "id":"6094fb83d41eeff1fa76129d", "name":"", "color":"green" },
        { "id":"6094fb83d41eeff1fa7612a1", "name":"", "color":"yellow" },
      ]);
    const trelloWebhookId = 'test_webhook_id';
    const trelloWebhooksScope = nock('https://api.trello.com')
      .post(uri => uri.includes('/1/webhooks?'))
      .reply(200, {
        id: trelloWebhookId,
      });
    const res = await request(server).post('/webhooks').send({
      token,
      rcWebhook: `http://test.com/webhook/${rcWebhookId}`,
      boardId,
      filters: 'addChecklistToCard,commentCard',
    });
    expect(res.status).toEqual(200);
    const trelloWebhookRecord = await TrelloWebhook.findByPk(rcWebhookRecord.trello_webhook_id);
    expect(trelloWebhookRecord.trello_webhook_id).toEqual(trelloWebhookId);
    trelloLabelsScope.done();
    trelloWebhooksScope.done();
    await RCWebhook.destroy({ where: { id: rcWebhookRecord.id }});;
    await TrelloWebhook.destroy({ where: { id: trelloWebhookRecord.id }});
    await TrelloUser.destroy({ where: { id: trelloUserRecord.id }});
  });

  it('should create webhook successfully with existing trello webhook record', async () => {
    const trelloUserId = 'trello_user_id';
    const trelloUserRecord = await TrelloUser.create({
      id: trelloUserId,
      token: 'test_token',
    });
    const rcWebhookId = '12121';
    const rcWebhookRecord = await RCWebhook.create({
      id: rcWebhookId,
    });
    const boardId = 'test_board_id';
    const oldTrelloWebhookId = 'test_trello_webhook_id';
    let trelloWebhookRecord = await TrelloWebhook.create({
      id: rcWebhookRecord.trello_webhook_id,
      rc_webhook_id: `http://test.com/webhook/${rcWebhookId}`,
      trello_user_id: trelloUserId,
      trello_webhook_id: oldTrelloWebhookId,
      config: {
        boardId,
        labels: [],
        filters: '',
      },
    });
    const token = jwt.generateToken({
      id: trelloUserId,
    });
    const trelloLabelsScope = nock('https://api.trello.com')
      .get(uri => uri.includes(`/1/boards/${boardId}/labels?`))
      .reply(200, [
        { "id":"6094fb83d41eeff1fa76129d", "name":"", "color":"green" },
        { "id":"6094fb83d41eeff1fa7612a1", "name":"", "color":"yellow" },
      ]);
    const trelloWebhookId = 'test_webhook_id';
    const trelloWebhooksScope = nock('https://api.trello.com')
      .post(uri => uri.includes('/1/webhooks?'))
      .reply(200, {
        id: trelloWebhookId,
      });
    const trelloDeleteWebhooksScope = nock('https://api.trello.com')
      .delete(uri => uri.includes(`/1/webhooks/${oldTrelloWebhookId}?`))
      .reply(200, {
        id: trelloWebhookId,
      });
    const res = await request(server).post('/webhooks').send({
      token,
      rcWebhook: `http://test.com/webhook/${rcWebhookId}`,
      boardId,
      filters: 'addChecklistToCard',
    });
    expect(res.status).toEqual(200);
    trelloWebhookRecord = await TrelloWebhook.findByPk(rcWebhookRecord.trello_webhook_id);
    expect(trelloWebhookRecord.trello_webhook_id).toEqual(trelloWebhookId);
    trelloLabelsScope.done();
    trelloWebhooksScope.done();
    trelloDeleteWebhooksScope.done();
    await RCWebhook.destroy({ where: { id: rcWebhookRecord.id }});;
    await TrelloWebhook.destroy({ where: { id: trelloWebhookRecord.id }});
    await TrelloUser.destroy({ where: { id: trelloUserRecord.id }});
  });

  it('should response 401 when trello api return 401', async () => {
    const trelloUserId = 'trello_user_id';
    const trelloUserRecord = await TrelloUser.create({
      id: trelloUserId,
      token: 'test_token',
    });
    const token = jwt.generateToken({
      id: trelloUserId,
    });
    const boardId = 'test_board_id';
    const trelloLabelsScope = nock('https://api.trello.com')
      .get(uri => uri.includes(`/1/boards/${boardId}/labels?`))
      .reply(401, {});
    const rcWebhookId = '12121';
    const res = await request(server).post('/webhooks').send({
      token,
      rcWebhook: `http://test.com/webhook/${rcWebhookId}`,
      boardId,
      filters: 'addChecklistToCard',
    });
    expect(res.status).toEqual(401);
    await TrelloUser.destroy({ where: { id: trelloUserRecord.id }});
    trelloLabelsScope.done();
  });

  it('should response 500 when trello api return 500', async () => {
    const trelloUserId = 'trello_user_id';
    const trelloUserRecord = await TrelloUser.create({
      id: trelloUserId,
      token: 'test_token',
    });
    const token = jwt.generateToken({
      id: trelloUserId,
    });
    const boardId = 'test_board_id';
    const trelloLabelsScope = nock('https://api.trello.com')
      .get(uri => uri.includes(`/1/boards/${boardId}/labels?`))
      .reply(500, {});
    const rcWebhookId = '12121';
    const res = await request(server).post('/webhooks').send({
      token,
      rcWebhook: `http://test.com/webhook/${rcWebhookId}`,
      boardId,
      filters: 'addChecklistToCard',
    });
    expect(res.status).toEqual(500);
    await TrelloUser.destroy({ where: { id: trelloUserRecord.id }});
    trelloLabelsScope.done();
  });
});
