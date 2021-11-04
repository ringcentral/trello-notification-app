const request = require('supertest');
const nock = require('nock');
const axios = require('axios');
const { server } = require('../src/server');
const { TrelloWebhook } = require('../src/app/models/trello-webhook');
const { RCWebhook } = require('../src/app/models/rc-webhook');
const { RcUser } = require('../src/app/models/rc-user');
const { TrelloUser } = require('../src/app/models/trello-user');

axios.defaults.adapter = require('axios/lib/adapters/http')

describe('Interactive Messages', () => {
  const rcWebhookUri = 'http://test.com/webhook/12121';
  let trelloWebhook;

  beforeAll(async () => {
    const rcWebhookRecord = await await RCWebhook.create({
      id: rcWebhookUri,
    });
    const filters = "addChecklistToCard,updateCheckItemStateOnCard,createCheckItem,createCard,changeCardDescription,moveCard,changeCardDueDate,renameCard,commentCard,archiveUnarchiveCard,addAttachmentToCard,addLabelToCard,removeLabelFromCard,addMemberToCard,removeMemberFromCard,createList,archiveUnarchiveList,renameList,renameBoard,moveListFromBoard,addMemberToBoard";
    trelloWebhook = await TrelloWebhook.create({
      id: rcWebhookRecord.trello_webhook_id,
      rc_webhook_id: rcWebhookUri,
      trello_user_id: 'test-user-id',
      config: {
        boardId: 'test-board-id',
        filters: String(filters),
      },
    });
  });

  it('should get 400 with wrong body params', async () => {
    const res = await request(server).post('/interactive-messages');
    expect(res.status).toEqual(400);
    const res1 = await request(server).post('/interactive-messages').send({ data: {} });
    expect(res1.status).toEqual(400);
  });

  it('should get 404 with wrong webhookId', async () => {
    const res = await request(server).post('/interactive-messages').send({
      data: {},
      user: {},
    });
    expect(res.status).toEqual(404);
  });

  it('should send auth card with new rc user', async () => {
    const scope = nock('http://test.com')
      .post('/webhook/12121')
      .reply(200, { result: 'OK' });
    let requestBody = null;
    scope.once('request', ({ headers: requestHeaders }, interceptor, reqBody) => {
      requestBody = JSON.parse(reqBody);
    });
    const res = await request(server).post('/interactive-messages').send({
      data: {
        webhookId: trelloWebhook.id
      },
      user: {
        id: 'test-user-id',
      },
    });
    expect(res.status).toEqual(200);
    expect(requestBody.attachments[0].type).toContain('AdaptiveCard');
    expect(JSON.stringify(requestBody.attachments[0])).toContain('Submit token');
    scope.done();
  });

  it('should send auth card with existing rc user', async () => {
    const scope = nock('http://test.com')
      .post('/webhook/12121')
      .reply(200, { result: 'OK' });
    let requestBody = null;
    scope.once('request', ({ headers: requestHeaders }, interceptor, reqBody) => {
      requestBody = JSON.parse(reqBody);
    });
    await RcUser.create({
      id: 'test-user-id',
      trello_user_id: 'test-trello-id',
    });
    const res = await request(server).post('/interactive-messages').send({
      data: {
        webhookId: trelloWebhook.id
      },
      user: {
        id: 'test-user-id',
      },
    });
    expect(res.status).toEqual(200);
    expect(requestBody.attachments[0].type).toContain('AdaptiveCard');
    expect(JSON.stringify(requestBody.attachments[0])).toContain('Submit token');
    scope.done();
  });

  it('should send auth card with existing rc user and trello user', async () => {
    const scope = nock('http://test.com')
      .post('/webhook/12121')
      .reply(200, { result: 'OK' });
    let requestBody = null;
    scope.once('request', ({ headers: requestHeaders }, interceptor, reqBody) => {
      requestBody = JSON.parse(reqBody);
    });
    await RcUser.create({
      id: 'test-user-id1',
      trello_user_id: 'test-trello-id',
    });
    await TrelloUser.create({
      id: 'test-trello-id',
      token: '',
      username: '',
      fullName: '',
    });
    const res = await request(server).post('/interactive-messages').send({
      data: {
        webhookId: trelloWebhook.id
      },
      user: {
        id: 'test-user-id1',
      },
    });
    expect(res.status).toEqual(200);
    expect(requestBody.attachments[0].type).toContain('AdaptiveCard');
    expect(JSON.stringify(requestBody.attachments[0])).toContain('Submit token');
    scope.done();
  });

  it('should save authorization token successfully for new user', async() => {
    const scope = nock('http://test.com')
      .post('/webhook/12121')
      .reply(200, { result: 'OK' });
    const trelloScope = nock('https://api.trello.com')
      .get(uri => uri.includes('/1/members/me?'))
      .reply(200, {
        id: 'test-trello-id1',
        username: 'test-trello-username',
        fullName: 'test-trello-full-name',
      });
    let requestBody = null;
    scope.once('request', ({ headers: requestHeaders }, interceptor, reqBody) => {
      requestBody = JSON.parse(reqBody);
    });
    const res = await request(server).post('/interactive-messages').send({
      data: {
        webhookId: trelloWebhook.id,
        token: 'test-token',
        action: 'authorize',
      },
      user: {
        id: 'test-user-id2',
      },
    });
    expect(res.status).toEqual(200);
    expect(requestBody.title).toContain('have authorized');
    scope.done();
    trelloScope.done();
  });

  it('should save authorization token successfully for existing rc user', async() => {
    const scope = nock('http://test.com')
      .post('/webhook/12121')
      .reply(200, { result: 'OK' });
    const trelloScope = nock('https://api.trello.com')
      .get(uri => uri.includes('/1/members/me?'))
      .reply(200, {
        id: 'test-trello-id2',
        username: 'test-trello-username',
        fullName: 'test-trello-full-name',
      });
    let requestBody = null;
    scope.once('request', ({ headers: requestHeaders }, interceptor, reqBody) => {
      requestBody = JSON.parse(reqBody);
    });
    const res = await request(server).post('/interactive-messages').send({
      data: {
        webhookId: trelloWebhook.id,
        token: 'test-token',
        action: 'authorize',
      },
      user: {
        id: 'test-user-id'
      },
    });
    expect(res.status).toEqual(200);
    expect(requestBody.title).toContain('have authorized');
    scope.done();
    trelloScope.done();
  });

  it('should save authorization token successfully for existing trello user', async() => {
    const scope = nock('http://test.com')
      .post('/webhook/12121')
      .reply(200, { result: 'OK' });
    const trelloScope = nock('https://api.trello.com')
      .get(uri => uri.includes('/1/members/me?'))
      .reply(200, {
        id: 'test-trello-id',
        username: 'test-trello-username',
        fullName: 'test-trello-full-name',
      });
    let requestBody = null;
    scope.once('request', ({ headers: requestHeaders }, interceptor, reqBody) => {
      requestBody = JSON.parse(reqBody);
    });
    const res = await request(server).post('/interactive-messages').send({
      data: {
        webhookId: trelloWebhook.id,
        token: 'test-token',
        action: 'authorize',
      },
      user: {
        id: 'test-user-id1'
      },
    });
    expect(res.status).toEqual(200);
    expect(requestBody.title).toContain('have authorized');
    scope.done();
    trelloScope.done();
  });

  it('should send auth card when request trello 401', async() => {
    const scope = nock('http://test.com')
      .post('/webhook/12121')
      .reply(200, { result: 'OK' });
    const cardId = 'test-trello-card-id';
    const trelloScope = nock('https://api.trello.com')
      .get(uri => uri.includes(`/1/cards/${cardId}/members?`))
      .reply(401);
    let requestBody = null;
    scope.once('request', ({ headers: requestHeaders }, interceptor, reqBody) => {
      requestBody = JSON.parse(reqBody);
    });
    const res = await request(server).post('/interactive-messages').send({
      data: {
        webhookId: trelloWebhook.id,
        action: 'joinCard',
        cardId,
      },
      user: {
        id: 'test-user-id1'
      },
    });
    expect(res.status).toEqual(200);
    expect(requestBody.attachments[0].type).toContain('AdaptiveCard');
    expect(JSON.stringify(requestBody.attachments[0])).toContain('Submit token');
    scope.done();
    trelloScope.done();
  });
});