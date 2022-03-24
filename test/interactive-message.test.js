const request = require('supertest');
const nock = require('nock');
const axios = require('axios');
const { server } = require('../src/server');
const { TrelloWebhook } = require('../src/app/models/trello-webhook');
const { RCWebhook } = require('../src/app/models/rc-webhook');
const { RcUser } = require('../src/app/models/rc-user');
const { TrelloUser } = require('../src/app/models/trello-user');

axios.defaults.adapter = require('axios/lib/adapters/http');

describe('Interactive Messages', () => {
  const rcWebhookId = '12121';
  const rcWebhookUri = `http://test.com/webhook/${rcWebhookId}`;
  let trelloWebhook;

  beforeAll(async () => {
    const rcWebhookRecord = await await RCWebhook.create({
      id: rcWebhookId,
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

  it('should get 400 with empty webhookId', async () => {
    const res = await request(server).post('/interactive-messages').send({
      data: {},
      user: {},
    });
    expect(res.status).toEqual(400);
  });

  it('should get 404 with wrong webhookId', async () => {
    const res = await request(server).post('/interactive-messages').send({
      data: {
        webhookId: '123',
      },
      user: {},
    });
    expect(res.status).toEqual(404);
  });

  it('should get 401 with INTERACTIVE_MESSAGES_SHARED_SECRET and wrong signature', async () => {
    process.env.INTERACTIVE_MESSAGES_SHARED_SECRET = 'test-secret';
    const res = await request(server).post('/interactive-messages').send({
      data: {},
      user: {},
    });
    delete process.env.INTERACTIVE_MESSAGES_SHARED_SECRET;
    expect(res.status).toEqual(401);
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

  it('should save token invalid message when authorize with invalid token', async() => {
    const scope = nock('http://test.com')
      .post('/webhook/12121')
      .reply(200, { result: 'OK' });
    const trelloScope = nock('https://api.trello.com')
      .get(uri => uri.includes('/1/members/me?'))
      .reply(401, { error: 'invalid token' });
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
    expect(requestBody.title).toContain('the token is invalid');
    scope.done();
    trelloScope.done();
  });

  it('should get 403 when request trello user info unsuccessfully', async() => {
    const trelloScope = nock('https://api.trello.com')
      .get(uri => uri.includes('/1/members/me?'))
      .reply(200, {});
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
    expect(res.status).toEqual(403);
    trelloScope.done();
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

  it('should send joined message if user has joined', async() => {
    const scope = nock('http://test.com')
      .post('/webhook/12121')
      .reply(200, { result: 'OK' });
    const cardId = 'test-trello-card-id';
    const trelloScope = nock('https://api.trello.com')
      .get(uri => uri.includes(`/1/cards/${cardId}/members?`))
      .reply(200, [{
        id: 'test-trello-id'
      }]);
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
    expect(requestBody.title).toContain('you had joined the card');
    scope.done();
    trelloScope.done();
  });

  it('should join successfully with trello api', async() => {
    const cardId = 'test-trello-card-id';
    const trelloMembersScope = nock('https://api.trello.com')
      .get(uri => uri.includes(`/1/cards/${cardId}/members?`))
      .reply(200, []);
    const trelloJoinScope = nock('https://api.trello.com')
      .post(uri => uri.includes(`/1/cards/${cardId}/idMembers?`))
      .reply(200, {});
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
    trelloMembersScope.done();
    trelloJoinScope.done();
  });

  it('should comment successfully with trello api', async() => {
    const cardId = 'test-trello-card-id';
    const trelloCommentScope = nock('https://api.trello.com')
      .post(uri => uri.includes(`/1/cards/${cardId}/actions/comments?`))
      .reply(200, {});
    const res = await request(server).post('/interactive-messages').send({
      data: {
        webhookId: trelloWebhook.id,
        action: 'commentCard',
        cardId,
        comment: 'test comment'
      },
      user: {
        id: 'test-user-id1'
      },
    });
    expect(res.status).toEqual(200);
    trelloCommentScope.done();
  });

  it('should set due date successfully with trello api', async() => {
    const cardId = 'test-trello-card-id';
    const trelloScope = nock('https://api.trello.com')
      .put(uri => uri.includes(`/1/cards/${cardId}?`))
      .reply(200, {});
    const res = await request(server).post('/interactive-messages').send({
      data: {
        webhookId: trelloWebhook.id,
        action: 'setCardDueDate',
        cardId,
        dueDate: '2019-01-01'
      },
      user: {
        id: 'test-user-id1'
      },
    });
    expect(res.status).toEqual(200);
    trelloScope.done();
  });

  it('should add label successfully with trello api', async() => {
    const cardId = 'test-trello-card-id';
    const trelloScope = nock('https://api.trello.com')
      .post(uri => uri.includes(`/1/cards/${cardId}/idLabels?`))
      .reply(200, {});
    const res = await request(server).post('/interactive-messages').send({
      data: {
        webhookId: trelloWebhook.id,
        action: 'addLabel',
        cardId,
        addLabel: 'xxx'
      },
      user: {
        id: 'test-user-id1'
      },
    });
    expect(res.status).toEqual(200);
    trelloScope.done();
  });

  it('should add label successfully with trello api', async() => {
    const cardId = 'test-trello-card-id';
    const trelloScope = nock('https://api.trello.com')
      .delete(uri => uri.includes(`/1/cards/${cardId}/idLabels/xxx?`))
      .reply(200, {});
    const res = await request(server).post('/interactive-messages').send({
      data: {
        webhookId: trelloWebhook.id,
        action: 'removeLabel',
        cardId,
        removeLabel: 'xxx'
      },
      user: {
        id: 'test-user-id1'
      },
    });
    expect(res.status).toEqual(200);
    trelloScope.done();
  });

  it('should warn permission message with trello 403', async() => {
    const scope = nock('http://test.com')
      .post('/webhook/12121')
      .reply(200, { result: 'OK' });
    const cardId = 'test-trello-card-id';
    const trelloCommentScope = nock('https://api.trello.com')
      .post(uri => uri.includes(`/1/cards/${cardId}/actions/comments?`))
      .reply(403, {});
    let requestBody = null;
    scope.once('request', ({ headers: requestHeaders }, interceptor, reqBody) => {
      requestBody = JSON.parse(reqBody);
    });
    const res = await request(server).post('/interactive-messages').send({
      data: {
        webhookId: trelloWebhook.id,
        action: 'commentCard',
        cardId,
        comment: 'test comment'
      },
      user: {
        id: 'test-user-id1'
      },
    });
    expect(res.status).toEqual(200);
    expect(requestBody.title).toContain('doesn\'t have permission');
    scope.done();
    trelloCommentScope.done();
  });

  it('should response 500 with trello return 500', async() => {
    const cardId = 'test-trello-card-id';
    const trelloCommentScope = nock('https://api.trello.com')
      .post(uri => uri.includes(`/1/cards/${cardId}/actions/comments?`))
      .reply(500, {});
    const res = await request(server).post('/interactive-messages').send({
      data: {
        webhookId: trelloWebhook.id,
        action: 'commentCard',
        cardId,
        comment: 'test comment'
      },
      user: {
        id: 'test-user-id1'
      },
    });
    expect(res.status).toEqual(500);
    trelloCommentScope.done();
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