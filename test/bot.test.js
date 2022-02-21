const request = require('supertest');
const nock = require('nock');
const axios = require('axios');
const { default: Bot } = require('ringcentral-chatbot-core/dist/models/Bot');

const { TrelloUser } = require('../src/app/models/trello-user');
const { RcUser } = require('../src/app/models/rc-user');

axios.defaults.adapter = require('axios/lib/adapters/http');

const { server } = require('../src/server');

describe('Bot', () => {
  const botId = '266262004';
  const groupId = '713297005';

  it('should install bot successfully', async () => {
    const rcTokenScope = nock(process.env.RINGCENTRAL_SERVER)
      .post(uri => uri.includes('/restapi/oauth/token'))
      .reply(200, {
        access_token: 'xxxxxx',
        token_type: 'bearer',
        expires_in: 2147483647,
        scope: 'SubscriptionWebhook TeamMessing ReadAccounts',
        owner_id: botId,
        endpoint_id: 'p7GZlEVHRwKDwbx6UkH0Y1'
      });
    const rcWebhookScope = nock(process.env.RINGCENTRAL_SERVER)
      .post(uri => uri.includes('/restapi/v1.0/subscription'))
      .reply(200, {});
    const res = await request(server).get('/bot/oauth?code=xxxxxx&client_id=xxxxxx');
    expect(res.status).toBe(200);
    const bot = await Bot.findByPk(botId);
    expect(bot.id).toEqual(botId);
    rcWebhookScope.done();
    rcTokenScope.done();
  });

  it('should send help card when bot join a new group', async () => {
    const rcCardScope = nock(process.env.RINGCENTRAL_SERVER)
      .post(uri => uri.includes(`/restapi/v1.0/glip/chats/${groupId}/adaptive-cards`))
      .reply(200, {});
    let requestBody = null;
    rcCardScope.once('request', ({ headers: requestHeaders }, interceptor, reqBody) => {
      requestBody = JSON.parse(reqBody);
    });
    const res = await request(server).post('/bot/webhook').send({
      "uuid": "54666613415546054",
      "event": "/restapi/v1.0/glip/groups",
      "timestamp": "2022-02-11T09:42:57.811Z",
      "subscriptionId": "0a7fb1f2-9e7c-456f-8078-148d1e7c3638",
      "ownerId": botId,
      "body": {
        "id": groupId,
        "name": "Bot test",
        "description": null,
        "type": "Team",
        "status": "Active",
        "members": [
          "170848004",
          "170853004",
          "713297005"
        ],
        "isPublic": false,
        "creationTime": "2022-02-08T09:02:59.677Z",
        "lastModifiedTime": "2022-02-11T09:42:57.471Z",
        "eventType": "GroupJoined"
      }
    });
    expect(res.status).toEqual(200);
    expect(requestBody.type).toContain('AdaptiveCard');
    expect(requestBody.fallbackText).toContain('I am Trello Bot');
    rcCardScope.done();
  });

  it('should still send reponse 200 when send help card error', async () => {
    const rcCardScope = nock(process.env.RINGCENTRAL_SERVER)
      .post(uri => uri.includes(`/restapi/v1.0/glip/chats/${groupId}/adaptive-cards`))
      .reply(500, {});
    let requestBody = null;
    rcCardScope.once('request', ({ headers: requestHeaders }, interceptor, reqBody) => {
      requestBody = JSON.parse(reqBody);
    });
    const res = await request(server).post('/bot/webhook').send({
      "uuid": "54666613415546054",
      "event": "/restapi/v1.0/glip/groups",
      "timestamp": "2022-02-11T09:42:57.811Z",
      "subscriptionId": "0a7fb1f2-9e7c-456f-8078-148d1e7c3638",
      "ownerId": botId,
      "body": {
        "id": groupId,
        "name": "Bot test",
        "description": null,
        "type": "Team",
        "status": "Active",
        "members": [
          "170848004",
          "170853004",
          "713297005"
        ],
        "isPublic": false,
        "creationTime": "2022-02-08T09:02:59.677Z",
        "lastModifiedTime": "2022-02-11T09:42:57.471Z",
        "eventType": "GroupJoined"
      }
    });
    expect(res.status).toEqual(200);
    rcCardScope.done();
  });

  it('should send help card when bot get help command', async () => {
    const rcCardScope = nock(process.env.RINGCENTRAL_SERVER)
      .post(uri => uri.includes(`/restapi/v1.0/glip/chats/${groupId}/adaptive-cards`))
      .reply(200, {});
    const rcGroupScope = nock(process.env.RINGCENTRAL_SERVER)
      .get(uri => uri.includes(`/restapi/v1.0/glip/groups/${groupId}`))
      .reply(200, {
        id: groupId,
        members: [
          "170848004",
          "170853004",
          "713297005"
        ]
      });
    let requestBody = null;
    rcCardScope.once('request', ({ headers: requestHeaders }, interceptor, reqBody) => {
      requestBody = JSON.parse(reqBody);
    });
    const res = await request(server).post('/bot/webhook').send({
      "uuid": "5794186355105264737",
      "event": "/restapi/v1.0/glip/posts",
      "timestamp": "2022-02-11T09:49:55.091Z",
      "subscriptionId": "0a7fb1f2-9e7c-456f-8078-148d1e7c3638",
      "ownerId": botId,
      "body": {
        "id": "5852045316",
        "groupId": groupId,
        "type": "TextMessage",
        "text": `![:Person](${botId}) help`,
        "creatorId": "170848004",
        "addedPersonIds": null,
        "creationTime": "2022-02-11T09:49:54.614Z",
        "lastModifiedTime": "2022-02-11T09:49:54.614Z",
        "attachments": null,
        "activity": null,
        "title": null,
        "iconUri": null,
        "iconEmoji": null,
        "mentions": [
          {
            "id": botId,
            "type": "Person",
            "name": "Trello Bot"
          }
        ],
        "eventType": "PostAdded"
      }
    });
    expect(res.status).toEqual(200);
    expect(requestBody.type).toContain('AdaptiveCard');
    expect(requestBody.fallbackText).toContain('I am Trello Bot');
    rcCardScope.done();
    rcGroupScope.done();
  });

  it('should send authorize card to direct message when bot get authorize command at direct conversation', async () => {
    const rcCardScope = nock(process.env.RINGCENTRAL_SERVER)
      .post(uri => uri.includes(`/restapi/v1.0/glip/chats/${groupId}/adaptive-cards`))
      .reply(200, {
        id: 'auth_card_id',
      });
    const rcAuthCardPutScope = nock(process.env.RINGCENTRAL_SERVER)
      .put(uri => uri.includes(`/restapi/v1.0/glip/adaptive-cards/auth_card_id`))
      .reply(200, {
        id: 'auth_card_id',
      });
    const rcGroupScope = nock(process.env.RINGCENTRAL_SERVER)
      .get(uri => uri.includes(`/restapi/v1.0/glip/groups/${groupId}`))
      .reply(200, {
        id: groupId,
        members: [
          "170848004",
          "713297005"
        ]
      });
    const rcDirectGroupScope = nock(process.env.RINGCENTRAL_SERVER)
      .post(uri => uri.includes(`/restapi/v1.0/glip/conversations`))
      .reply(200, {
        id: groupId,
        members: [
          "170848004",
          "713297005"
        ]
      });
    let requestBody = null;
    rcAuthCardPutScope.once('request', ({ headers: requestHeaders }, interceptor, reqBody) => {
      requestBody = JSON.parse(reqBody);
    });
    const res = await request(server).post('/bot/webhook').send({
      "uuid": "5794186355105264737",
      "event": "/restapi/v1.0/glip/posts",
      "timestamp": "2022-02-11T09:49:55.091Z",
      "subscriptionId": "0a7fb1f2-9e7c-456f-8078-148d1e7c3638",
      "ownerId": botId,
      "body": {
        "id": "5852045316",
        "groupId": groupId,
        "type": "TextMessage",
        "text": `authorize`,
        "creatorId": "170848004",
        "addedPersonIds": null,
        "creationTime": "2022-02-11T09:49:54.614Z",
        "lastModifiedTime": "2022-02-11T09:49:54.614Z",
        "attachments": null,
        "activity": null,
        "title": null,
        "iconUri": null,
        "iconEmoji": null,
        "mentions": [
          {
            "id": botId,
            "type": "Person",
            "name": "Trello Bot"
          }
        ],
        "eventType": "PostAdded"
      }
    });
    expect(res.status).toEqual(200);
    expect(requestBody.type).toContain('AdaptiveCard');
    expect(requestBody.fallbackText).toContain('Connect with Trello');
    rcCardScope.done();
    rcGroupScope.done();
    rcDirectGroupScope.done();
  });

  it('should send authorize card to direct message when bot get authorize command at team conversation', async () => {
    const directGroupId = 'direct_group_id';
    const rcDirectGroupScope = nock(process.env.RINGCENTRAL_SERVER)
      .post(uri => uri.includes(`/restapi/v1.0/glip/conversations`))
      .reply(200, {
        id: directGroupId,
        members: [
          "170848004",
          "713297005"
        ]
      });
    const rcCardScope = nock(process.env.RINGCENTRAL_SERVER)
      .post(uri => uri.includes(`/restapi/v1.0/glip/chats/${directGroupId}/adaptive-cards`))
      .reply(200, {
        id: 'auth_card_id',
      });
    const rcMessageScope = nock(process.env.RINGCENTRAL_SERVER)
      .post(uri => uri.includes(`/restapi/v1.0/glip/groups/${groupId}/posts`))
      .reply(200, {});
    const rcAuthCardPutScope = nock(process.env.RINGCENTRAL_SERVER)
      .put(uri => uri.includes(`/restapi/v1.0/glip/adaptive-cards/auth_card_id`))
      .reply(200, {
        id: 'auth_card_id',
      });
    const rcGroupScope = nock(process.env.RINGCENTRAL_SERVER)
      .get(uri => uri.includes(`/restapi/v1.0/glip/groups/${groupId}`))
      .reply(200, {
        id: groupId,
        members: [
          "170848004",
          "170853004",
          "713297005"
        ]
      });
    let cardRequestBody = null;
    rcAuthCardPutScope.once('request', ({ headers: requestHeaders }, interceptor, reqBody) => {
      cardRequestBody = JSON.parse(reqBody);
    });
    let messageRequestBody = null;
    rcMessageScope.once('request', ({ headers: requestHeaders }, interceptor, reqBody) => {
      messageRequestBody = JSON.parse(reqBody);
    });
    const res = await request(server).post('/bot/webhook').send({
      "uuid": "5794186355105264737",
      "event": "/restapi/v1.0/glip/posts",
      "timestamp": "2022-02-11T09:49:55.091Z",
      "subscriptionId": "0a7fb1f2-9e7c-456f-8078-148d1e7c3638",
      "ownerId": botId,
      "body": {
        "id": "5852045316",
        "groupId": groupId,
        "type": "TextMessage",
        "text": `![:Person](${botId}) authorize`,
        "creatorId": "170848004",
        "addedPersonIds": null,
        "creationTime": "2022-02-11T09:49:54.614Z",
        "lastModifiedTime": "2022-02-11T09:49:54.614Z",
        "attachments": null,
        "activity": null,
        "title": null,
        "iconUri": null,
        "iconEmoji": null,
        "mentions": [
          {
            "id": botId,
            "type": "Person",
            "name": "Trello Bot"
          }
        ],
        "eventType": "PostAdded"
      }
    });
    expect(res.status).toEqual(200);
    expect(cardRequestBody.type).toContain('AdaptiveCard');
    expect(cardRequestBody.fallbackText).toContain('Connect with Trello');
    expect(messageRequestBody.text).toContain('I just sent you a **Private** message');
    rcCardScope.done();
    rcGroupScope.done();
    rcDirectGroupScope.done();
    rcMessageScope.done();
  });

  it('should send authorized when bot get authorize command and user authorized', async () => {
    const rcUserId = '170848004';
    const trelloToken = 'test_trello_user_token';
    const trelloUserRecord = await TrelloUser.create({
      id: 'test_trello_user_id',
      writeable_token: trelloToken,
    });
    const rcUserRecord = await RcUser.create({
      id: `rcext-${rcUserId}`,
      trello_user_id: trelloUserRecord.id,
    });
    const rcMessageScope = nock(process.env.RINGCENTRAL_SERVER)
      .post(uri => uri.includes(`/restapi/v1.0/glip/groups/${groupId}/posts`))
      .reply(200, {});
    const rcGroupScope = nock(process.env.RINGCENTRAL_SERVER)
      .get(uri => uri.includes(`/restapi/v1.0/glip/groups/${groupId}`))
      .reply(200, {
        id: groupId,
        members: [
          "170848004",
          "170853004",
          "713297005"
        ]
      });
    let messageRequestBody = null;
    rcMessageScope.once('request', ({ headers: requestHeaders }, interceptor, reqBody) => {
      messageRequestBody = JSON.parse(reqBody);
    });
    const res = await request(server).post('/bot/webhook').send({
      "uuid": "5794186355105264737",
      "event": "/restapi/v1.0/glip/posts",
      "timestamp": "2022-02-11T09:49:55.091Z",
      "subscriptionId": "0a7fb1f2-9e7c-456f-8078-148d1e7c3638",
      "ownerId": botId,
      "body": {
        "id": "5852045316",
        "groupId": groupId,
        "type": "TextMessage",
        "text": `![:Person](${botId}) authorize`,
        "creatorId": rcUserId,
        "addedPersonIds": null,
        "creationTime": "2022-02-11T09:49:54.614Z",
        "lastModifiedTime": "2022-02-11T09:49:54.614Z",
        "attachments": null,
        "activity": null,
        "title": null,
        "iconUri": null,
        "iconEmoji": null,
        "mentions": [
          {
            "id": botId,
            "type": "Person",
            "name": "Trello Bot"
          }
        ],
        "eventType": "PostAdded"
      }
    });
    expect(res.status).toEqual(200);
    expect(messageRequestBody.text).toContain('you have authorized Trello');
    rcGroupScope.done();
    rcMessageScope.done();
    await rcUserRecord.destroy();
    await trelloUserRecord.destroy();
  });

  it('should send not authorized when bot get unauthorize command and user is authorized', async () => {
    const rcMessageScope = nock(process.env.RINGCENTRAL_SERVER)
      .post(uri => uri.includes(`/restapi/v1.0/glip/groups/${groupId}/posts`))
      .reply(200, {});
    const rcGroupScope = nock(process.env.RINGCENTRAL_SERVER)
      .get(uri => uri.includes(`/restapi/v1.0/glip/groups/${groupId}`))
      .reply(200, {
        id: groupId,
        members: [
          "170848004",
          "170853004",
          "713297005"
        ]
      });
    let messageRequestBody = null;
      rcMessageScope.once('request', ({ headers: requestHeaders }, interceptor, reqBody) => {
        messageRequestBody = JSON.parse(reqBody);
      });
    const res = await request(server).post('/bot/webhook').send({
      "uuid": "5794186355105264737",
      "event": "/restapi/v1.0/glip/posts",
      "timestamp": "2022-02-11T09:49:55.091Z",
      "subscriptionId": "0a7fb1f2-9e7c-456f-8078-148d1e7c3638",
      "ownerId": botId,
      "body": {
        "id": "5852045316",
        "groupId": groupId,
        "type": "TextMessage",
        "text": `![:Person](${botId}) unauthorize`,
        "creatorId": "170848004",
        "addedPersonIds": null,
        "creationTime": "2022-02-11T09:49:54.614Z",
        "lastModifiedTime": "2022-02-11T09:49:54.614Z",
        "attachments": null,
        "activity": null,
        "title": null,
        "iconUri": null,
        "iconEmoji": null,
        "mentions": [
          {
            "id": botId,
            "type": "Person",
            "name": "Trello Bot"
          }
        ],
        "eventType": "PostAdded"
      }
    });
    expect(res.status).toEqual(200);
    expect(messageRequestBody.text).toContain('you have not authorized Trello yet');
    rcMessageScope.done();
    rcGroupScope.done();
  });

  it('should send unauthorized successfully when bot get unauthorize command and user has no subscriptions', async () => {
    const rcMessageScope = nock(process.env.RINGCENTRAL_SERVER)
      .post(uri => uri.includes(`/restapi/v1.0/glip/groups/${groupId}/posts`))
      .reply(200, {});
    const rcGroupScope = nock(process.env.RINGCENTRAL_SERVER)
      .get(uri => uri.includes(`/restapi/v1.0/glip/groups/${groupId}`))
      .reply(200, {
        id: groupId,
        members: [
          "170848004",
          "170853004",
          "713297005"
        ]
      });
    let messageRequestBody = null;
    rcMessageScope.once('request', ({ headers: requestHeaders }, interceptor, reqBody) => {
      messageRequestBody = JSON.parse(reqBody);
    });
    const trelloToken = 'test_trello_user_token';
    const rcUserId = '170848004';
    const trelloUserRecord = await TrelloUser.create({
      id: 'test_trello_user_id',
      writeable_token: trelloToken,
    });
    const rcUserRecord = await RcUser.create({
      id: `rcext-${rcUserId}`,
      trello_user_id: trelloUserRecord.id,
      bot_subscriptions: null,
    });
    const trelloScope = nock('https://api.trello.com')
      .delete(uri => uri.includes(`/1/tokens/${trelloToken}`))
      .reply(200, {});
    const res = await request(server).post('/bot/webhook').send({
      "uuid": "5794186355105264737",
      "event": "/restapi/v1.0/glip/posts",
      "timestamp": "2022-02-11T09:49:55.091Z",
      "subscriptionId": "0a7fb1f2-9e7c-456f-8078-148d1e7c3638",
      "ownerId": botId,
      "body": {
        "id": "5852045316",
        "groupId": groupId,
        "type": "TextMessage",
        "text": `![:Person](${botId}) unauthorize`,
        "creatorId": rcUserId,
        "addedPersonIds": null,
        "creationTime": "2022-02-11T09:49:54.614Z",
        "lastModifiedTime": "2022-02-11T09:49:54.614Z",
        "attachments": null,
        "activity": null,
        "title": null,
        "iconUri": null,
        "iconEmoji": null,
        "mentions": [
          {
            "id": botId,
            "type": "Person",
            "name": "Trello Bot"
          }
        ],
        "eventType": "PostAdded"
      }
    });
    expect(res.status).toEqual(200);
    expect(messageRequestBody.text).toContain('you have unauthorized Trello successfully');
    rcMessageScope.done();
    rcGroupScope.done();
    trelloScope.done();
    await rcUserRecord.destroy();
    await trelloUserRecord.destroy();
  });

  it('should send unauthorize warning card when bot get unauthorize command and user has subscriptions', async () => {
    const rcCardScope = nock(process.env.RINGCENTRAL_SERVER)
      .post(uri => uri.includes(`/restapi/v1.0/glip/chats/${groupId}/adaptive-cards`))
      .reply(200, {
        id: 'auth_card_id',
      });
    const rcGroupScope = nock(process.env.RINGCENTRAL_SERVER)
      .get(uri => uri.includes(`/restapi/v1.0/glip/groups/${groupId}`))
      .reply(200, {
        id: groupId,
        members: [
          "170848004",
          "170853004",
          "713297005"
        ]
      });
    let cardRequestBody = null;
    rcCardScope.once('request', ({ headers: requestHeaders }, interceptor, reqBody) => {
      cardRequestBody = JSON.parse(reqBody);
    });
    const rcUserId = '170848005';
    const trelloToken = 'test_trello_user_token';
    const trelloUserRecord = await TrelloUser.create({
      id: 'test_trello_user_id_1',
      writeable_token: trelloToken,
    });
    const rcUserRecord = await RcUser.create({
      id: `rcext-${rcUserId}`,
      trello_user_id: trelloUserRecord.id,
      bot_subscriptions: [{ id: 'test_scubscription_id' }],
    });
    const res = await request(server).post('/bot/webhook').send({
      "uuid": "5794186355105264737",
      "event": "/restapi/v1.0/glip/posts",
      "timestamp": "2022-02-11T09:49:55.091Z",
      "subscriptionId": "0a7fb1f2-9e7c-456f-8078-148d1e7c3638",
      "ownerId": botId,
      "body": {
        "id": "5852045316",
        "groupId": groupId,
        "type": "TextMessage",
        "text": `![:Person](${botId}) unauthorize`,
        "creatorId": rcUserId,
        "addedPersonIds": null,
        "creationTime": "2022-02-11T09:49:54.614Z",
        "lastModifiedTime": "2022-02-11T09:49:54.614Z",
        "attachments": null,
        "activity": null,
        "title": null,
        "iconUri": null,
        "iconEmoji": null,
        "mentions": [
          {
            "id": botId,
            "type": "Person",
            "name": "Trello Bot"
          }
        ],
        "eventType": "PostAdded"
      }
    });
    expect(res.status).toEqual(200);
    expect(cardRequestBody.type).toContain('AdaptiveCard');
    expect(cardRequestBody.fallbackText).toContain('Unauthorize Trello');
    rcCardScope.done();
    rcGroupScope.done();
    await rcUserRecord.destroy();
    await trelloUserRecord.destroy();
  });

  it('should send setup card not support at group conversation', async () => {
    const rcGroupScope = nock(process.env.RINGCENTRAL_SERVER)
      .get(uri => uri.includes(`/restapi/v1.0/glip/groups/${groupId}`))
      .reply(200, {
        id: groupId,
        type: 'Group',
        members: [
          "170848004",
          "170853004",
          "713297005"
        ]
      });
    const rcMessageScope = nock(process.env.RINGCENTRAL_SERVER)
      .post(uri => uri.includes(`/restapi/v1.0/glip/groups/${groupId}/posts`))
      .reply(200, {});
    let messageRequestBody = null;
    rcMessageScope.once('request', ({ headers: requestHeaders }, interceptor, reqBody) => {
      messageRequestBody = JSON.parse(reqBody);
    });
    const res = await request(server).post('/bot/webhook').send({
      "uuid": "5794186355105264737",
      "event": "/restapi/v1.0/glip/posts",
      "timestamp": "2022-02-11T09:49:55.091Z",
      "subscriptionId": "0a7fb1f2-9e7c-456f-8078-148d1e7c3638",
      "ownerId": botId,
      "body": {
        "id": "5852045316",
        "groupId": groupId,
        "type": "TextMessage",
        "text": `![:Person](${botId}) setup`,
        "creatorId": "170848004",
        "addedPersonIds": null,
        "creationTime": "2022-02-11T09:49:54.614Z",
        "lastModifiedTime": "2022-02-11T09:49:54.614Z",
        "attachments": null,
        "activity": null,
        "title": null,
        "iconUri": null,
        "iconEmoji": null,
        "mentions": [
          {
            "id": botId,
            "type": "Person",
            "name": "Trello Bot"
          }
        ],
        "eventType": "PostAdded"
      }
    });
    expect(res.status).toEqual(200);
    expect(messageRequestBody.text).toContain('only support to connect Trello for **Team** conversation');
    rcGroupScope.done();
    rcMessageScope.done();
  });

  it('should send setup with authorize card when get setup command and not unauthorized', async () => {
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
        ]
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
    let messageRequestBody = null;
    rcMessageScope.once('request', ({ headers: requestHeaders }, interceptor, reqBody) => {
      messageRequestBody = JSON.parse(reqBody);
    });
    let cardRequestBody = null;
    rcAuthCardPutScope.once('request', ({ headers: requestHeaders }, interceptor, reqBody) => {
      cardRequestBody = JSON.parse(reqBody);
    });
    const rcUserId = '170848010';
    const res = await request(server).post('/bot/webhook').send({
      "uuid": "5794186355105264737",
      "event": "/restapi/v1.0/glip/posts",
      "timestamp": "2022-02-11T09:49:55.091Z",
      "subscriptionId": "0a7fb1f2-9e7c-456f-8078-148d1e7c3638",
      "ownerId": botId,
      "body": {
        "id": "5852045316",
        "groupId": groupId,
        "type": "TextMessage",
        "text": `![:Person](${botId}) setup`,
        "creatorId": rcUserId,
        "addedPersonIds": null,
        "creationTime": "2022-02-11T09:49:54.614Z",
        "lastModifiedTime": "2022-02-11T09:49:54.614Z",
        "attachments": null,
        "activity": null,
        "title": null,
        "iconUri": null,
        "iconEmoji": null,
        "mentions": [
          {
            "id": botId,
            "type": "Person",
            "name": "Trello Bot"
          }
        ],
        "eventType": "PostAdded"
      }
    });
    expect(res.status).toEqual(200);
    expect(cardRequestBody.fallbackText).toContain('Trello setup');
    expect(JSON.stringify(cardRequestBody)).toContain('Please click following button to authorize');
    expect(messageRequestBody.text).toContain('I just sent you a **Private** message');
    rcGroupScope.done();
    rcMessageScope.done();
    rcCardScope.done();
    rcDirectGroupScope.done();
    rcAuthCardPutScope.done();
  });

  it('should send setup with authorize card when get setup command and request trello 401', async () => {
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
    const trelloScope = nock('https://api.trello.com')
      .get(uri => uri.includes(`/1/members/me/boards?`))
      .reply(401);
    let messageRequestBody = null;
    rcMessageScope.once('request', ({ headers: requestHeaders }, interceptor, reqBody) => {
      messageRequestBody = JSON.parse(reqBody);
    });
    let cardRequestBody = null;
    rcAuthCardPutScope.once('request', ({ headers: requestHeaders }, interceptor, reqBody) => {
      cardRequestBody = JSON.parse(reqBody);
    });
    const rcUserId = '170848010';
    const trelloToken = 'test_trello_user_token';
    const trelloUserRecord = await TrelloUser.create({
      id: 'test_trello_user_id',
      writeable_token: trelloToken,
    });
    const rcUserRecord = await RcUser.create({
      id: `rcext-${rcUserId}`,
      trello_user_id: trelloUserRecord.id,
    });
    const res = await request(server).post('/bot/webhook').send({
      "uuid": "5794186355105264737",
      "event": "/restapi/v1.0/glip/posts",
      "timestamp": "2022-02-11T09:49:55.091Z",
      "subscriptionId": "0a7fb1f2-9e7c-456f-8078-148d1e7c3638",
      "ownerId": botId,
      "body": {
        "id": "5852045316",
        "groupId": groupId,
        "type": "TextMessage",
        "text": `![:Person](${botId}) setup`,
        "creatorId": rcUserId,
        "addedPersonIds": null,
        "creationTime": "2022-02-11T09:49:54.614Z",
        "lastModifiedTime": "2022-02-11T09:49:54.614Z",
        "attachments": null,
        "activity": null,
        "title": null,
        "iconUri": null,
        "iconEmoji": null,
        "mentions": [
          {
            "id": botId,
            "type": "Person",
            "name": "Trello Bot"
          }
        ],
        "eventType": "PostAdded"
      }
    });
    expect(res.status).toEqual(200);
    expect(cardRequestBody.fallbackText).toContain('Trello setup');
    expect(JSON.stringify(cardRequestBody)).toContain('Please click following button to authorize');
    expect(messageRequestBody.text).toContain('I just sent you a **Private** message');
    rcGroupScope.done();
    rcMessageScope.done();
    rcCardScope.done();
    rcDirectGroupScope.done();
    rcAuthCardPutScope.done();
    trelloScope.done();
    await rcUserRecord.destroy();
    await trelloUserRecord.destroy();
  });

  it('should send setup with authorize card when get setup command without trello token', async () => {
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
    let messageRequestBody = null;
    rcMessageScope.once('request', ({ headers: requestHeaders }, interceptor, reqBody) => {
      messageRequestBody = JSON.parse(reqBody);
    });
    let cardRequestBody = null;
    rcAuthCardPutScope.once('request', ({ headers: requestHeaders }, interceptor, reqBody) => {
      cardRequestBody = JSON.parse(reqBody);
    });
    const rcUserId = '170848010';
    const trelloUserRecord = await TrelloUser.create({
      id: 'test_trello_user_id',
      writeable_token: '',
    });
    const rcUserRecord = await RcUser.create({
      id: `rcext-${rcUserId}`,
      trello_user_id: trelloUserRecord.id,
    });
    const res = await request(server).post('/bot/webhook').send({
      "uuid": "5794186355105264737",
      "event": "/restapi/v1.0/glip/posts",
      "timestamp": "2022-02-11T09:49:55.091Z",
      "subscriptionId": "0a7fb1f2-9e7c-456f-8078-148d1e7c3638",
      "ownerId": botId,
      "body": {
        "id": "5852045316",
        "groupId": groupId,
        "type": "TextMessage",
        "text": `![:Person](${botId}) setup`,
        "creatorId": rcUserId,
        "addedPersonIds": null,
        "creationTime": "2022-02-11T09:49:54.614Z",
        "lastModifiedTime": "2022-02-11T09:49:54.614Z",
        "attachments": null,
        "activity": null,
        "title": null,
        "iconUri": null,
        "iconEmoji": null,
        "mentions": [
          {
            "id": botId,
            "type": "Person",
            "name": "Trello Bot"
          }
        ],
        "eventType": "PostAdded"
      }
    });
    expect(res.status).toEqual(200);
    expect(cardRequestBody.fallbackText).toContain('Trello setup');
    expect(JSON.stringify(cardRequestBody)).toContain('Please click following button to authorize');
    expect(messageRequestBody.text).toContain('I just sent you a **Private** message');
    rcGroupScope.done();
    rcMessageScope.done();
    rcCardScope.done();
    rcDirectGroupScope.done();
    rcAuthCardPutScope.done();
    await rcUserRecord.destroy();
    await trelloUserRecord.destroy();
  });

  it('should send subscribe card when get setup command and trello authorized', async () => {
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
    const rcMessageScope = nock(process.env.RINGCENTRAL_SERVER)
      .post(uri => uri.includes(`/restapi/v1.0/glip/groups/${groupId}/posts`))
      .reply(200, {});
    const trelloScope = nock('https://api.trello.com')
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
    let messageRequestBody = null;
    rcMessageScope.once('request', ({ headers: requestHeaders }, interceptor, reqBody) => {
      messageRequestBody = JSON.parse(reqBody);
    });
    let cardRequestBody = null;
    rcCardScope.once('request', ({ headers: requestHeaders }, interceptor, reqBody) => {
      cardRequestBody = JSON.parse(reqBody);
    });
    const rcUserId = '170848010';
    const trelloToken = 'test_trello_user_token';
    const trelloUserRecord = await TrelloUser.create({
      id: 'test_trello_user_id',
      writeable_token: trelloToken,
    });
    const rcUserRecord = await RcUser.create({
      id: `rcext-${rcUserId}`,
      trello_user_id: trelloUserRecord.id,
    });
    const res = await request(server).post('/bot/webhook').send({
      "uuid": "5794186355105264737",
      "event": "/restapi/v1.0/glip/posts",
      "timestamp": "2022-02-11T09:49:55.091Z",
      "subscriptionId": "0a7fb1f2-9e7c-456f-8078-148d1e7c3638",
      "ownerId": botId,
      "body": {
        "id": "5852045316",
        "groupId": groupId,
        "type": "TextMessage",
        "text": `![:Person](${botId}) setup`,
        "creatorId": rcUserId,
        "addedPersonIds": null,
        "creationTime": "2022-02-11T09:49:54.614Z",
        "lastModifiedTime": "2022-02-11T09:49:54.614Z",
        "attachments": null,
        "activity": null,
        "title": null,
        "iconUri": null,
        "iconEmoji": null,
        "mentions": [
          {
            "id": botId,
            "type": "Person",
            "name": "Trello Bot"
          }
        ],
        "eventType": "PostAdded"
      }
    });
    expect(res.status).toEqual(200);
    expect(cardRequestBody.fallbackText).toContain('Trello setup');
    expect(JSON.stringify(cardRequestBody)).toContain('Select board');
    expect(messageRequestBody.text).toContain('I just sent you a **Private** message');
    rcGroupScope.done();
    rcMessageScope.done();
    rcCardScope.done();
    rcDirectGroupScope.done();
    trelloScope.done();
    await rcUserRecord.destroy();
    await trelloUserRecord.destroy();
  });

  it('should send subscriptions card when get setup command and have subscriptions', async () => {
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
    const rcMessageScope = nock(process.env.RINGCENTRAL_SERVER)
      .post(uri => uri.includes(`/restapi/v1.0/glip/groups/${groupId}/posts`))
      .reply(200, {});
    const trelloScope = nock('https://api.trello.com')
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
    let messageRequestBody = null;
    rcMessageScope.once('request', ({ headers: requestHeaders }, interceptor, reqBody) => {
      messageRequestBody = JSON.parse(reqBody);
    });
    let cardRequestBody = null;
    rcCardScope.once('request', ({ headers: requestHeaders }, interceptor, reqBody) => {
      cardRequestBody = JSON.parse(reqBody);
    });
    const rcUserId = '170848010';
    const trelloToken = 'test_trello_user_token';
    const trelloUserRecord = await TrelloUser.create({
      id: 'test_trello_user_id',
      writeable_token: trelloToken,
    });
    const rcUserRecord = await RcUser.create({
      id: `rcext-${rcUserId}`,
      trello_user_id: trelloUserRecord.id,
      bot_subscriptions: [{
        id: 'trello_webhook_id',
        conversation_id: groupId,
        boardId: '5b6893f01cb3228998cf629e',
      }]
    });
    const res = await request(server).post('/bot/webhook').send({
      "uuid": "5794186355105264737",
      "event": "/restapi/v1.0/glip/posts",
      "timestamp": "2022-02-11T09:49:55.091Z",
      "subscriptionId": "0a7fb1f2-9e7c-456f-8078-148d1e7c3638",
      "ownerId": botId,
      "body": {
        "id": "5852045316",
        "groupId": groupId,
        "type": "TextMessage",
        "text": `![:Person](${botId}) setup`,
        "creatorId": rcUserId,
        "addedPersonIds": null,
        "creationTime": "2022-02-11T09:49:54.614Z",
        "lastModifiedTime": "2022-02-11T09:49:54.614Z",
        "attachments": null,
        "activity": null,
        "title": null,
        "iconUri": null,
        "iconEmoji": null,
        "mentions": [
          {
            "id": botId,
            "type": "Person",
            "name": "Trello Bot"
          }
        ],
        "eventType": "PostAdded"
      }
    });
    expect(res.status).toEqual(200);
    expect(cardRequestBody.fallbackText).toContain('Trello setup');
    expect(JSON.stringify(cardRequestBody)).toContain('Existing subscriptions');
    expect(messageRequestBody.text).toContain('I just sent you a **Private** message');
    rcGroupScope.done();
    rcMessageScope.done();
    rcCardScope.done();
    rcDirectGroupScope.done();
    trelloScope.done();
    await rcUserRecord.destroy();
    await trelloUserRecord.destroy();
  });

  it('should send subscribe card when get setup command from direct conversation', async () => {
    const directGroupId = 'test_direct_group_id';
    const rcGroupScope = nock(process.env.RINGCENTRAL_SERVER)
      .get(uri => uri.includes(`/restapi/v1.0/glip/groups/${directGroupId}`))
      .reply(200, {
        id: directGroupId,
        type: 'Team',
        members: [
          "170848004",
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
    const trelloScope = nock('https://api.trello.com')
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
    let cardRequestBody = null;
    rcCardScope.once('request', ({ headers: requestHeaders }, interceptor, reqBody) => {
      cardRequestBody = JSON.parse(reqBody);
    });
    const rcUserId = '170848010';
    const trelloToken = 'test_trello_user_token';
    const trelloUserRecord = await TrelloUser.create({
      id: 'test_trello_user_id',
      writeable_token: trelloToken,
    });
    const rcUserRecord = await RcUser.create({
      id: `rcext-${rcUserId}`,
      trello_user_id: trelloUserRecord.id,
    });
    const res = await request(server).post('/bot/webhook').send({
      "uuid": "5794186355105264737",
      "event": "/restapi/v1.0/glip/posts",
      "timestamp": "2022-02-11T09:49:55.091Z",
      "subscriptionId": "0a7fb1f2-9e7c-456f-8078-148d1e7c3638",
      "ownerId": botId,
      "body": {
        "id": "5852045316",
        "groupId": directGroupId,
        "type": "TextMessage",
        "text": `![:Person](${botId}) setup`,
        "creatorId": rcUserId,
        "addedPersonIds": null,
        "creationTime": "2022-02-11T09:49:54.614Z",
        "lastModifiedTime": "2022-02-11T09:49:54.614Z",
        "attachments": null,
        "activity": null,
        "title": null,
        "iconUri": null,
        "iconEmoji": null,
        "mentions": [
          {
            "id": botId,
            "type": "Person",
            "name": "Trello Bot"
          }
        ],
        "eventType": "PostAdded"
      }
    });
    expect(res.status).toEqual(200);
    expect(cardRequestBody.fallbackText).toContain('Trello setup');
    expect(JSON.stringify(cardRequestBody)).toContain('Select board');
    rcGroupScope.done();
    rcCardScope.done();
    rcDirectGroupScope.done();
    trelloScope.done();
    await rcUserRecord.destroy();
    await trelloUserRecord.destroy();
  });
});
