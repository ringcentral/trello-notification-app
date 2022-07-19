const request = require('supertest');
const nock = require('nock');
const axios = require('axios');
const { server } = require('../src/server');

const jwt = require('../src/app/lib/jwt');
const { TrelloUser } = require('../src/app/models/trello-user');
const { RcUser } = require('../src/app/models/rc-user');

axios.defaults.adapter = require('axios/lib/adapters/http');

describe('Bot Setup', () => {
  it('should get 200 without webhook uri', async () => {
    const res = await request(server).get('/bot-setup?token=new_token');
    expect(res.status).toEqual(200);
    expect(res.text).toContain('new_token');
  });

  describe('Info', () => {
    it('should get 403 without token', async () => {
      const res = await request(server).get('/bot-info');
      expect(res.status).toEqual(403);
    });

    it('should get 401 with invalid token', async () => {
      const res = await request(server).get('/bot-info?token=123');
      expect(res.status).toEqual(401);
    });

    it('should get 401 with expired token', async () => {
      const token = jwt.generateToken({
        uId: '123',
        bId: '123',
        gId: '111',
      }, '-10s');
      const res = await request(server).get(`/bot-info?token=${token}`);
      expect(res.status).toEqual(401);
    });

    it('should get 200 with botInfo when rc user is not found', async () => {
      const token = jwt.generateToken({
        uId: '123',
        bId: '123',
        gId: '111',
      }, '24h');
      const res = await request(server).get(`/bot-info?token=${token}`);
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
      const res = await request(server).get(`/bot-info?token=${token}`);
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
      const res = await request(server).get(`/bot-info?token=${token}`);
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
      const res = await request(server).get(`/bot-info?token=${token}`);
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
      const res = await request(server).get(`/bot-info?token=${token}`);
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
      const res = await request(server).get(`/bot-info?token=${token}`);
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
      const res = await request(server).get(`/bot-info?token=${token}`);
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
      const res = await request(server).get(`/bot-info?token=${token}`);
      expect(res.status).toEqual(500);
      trelloBoardScope.done();
      await rcUserRecord.destroy();
      await trelloUserRecord.destroy();
    });
  });
});
