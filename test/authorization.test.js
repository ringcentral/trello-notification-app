const request = require('supertest');
const nock = require('nock');
const axios = require('axios');
const { server } = require('../src/server');
const jwt = require('../src/app/lib/jwt');

const { TrelloUser } = require('../src/app/models/trello-user');
const { RcUser } = require('../src/app/models/rc-user');

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
    await trelloUser.destroy();
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
    await trelloUser.destroy();
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
    expect(trelloUserRecord.token).toEqual('');
    await trelloUserRecord.destroy();
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
    expect(trelloUserRecord.token).toEqual('');
    await trelloUserRecord.destroy();
    trelloRevokeScope.done();
  });
});
