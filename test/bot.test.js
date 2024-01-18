const request = require('supertest');
const nock = require('nock');
const axios = require('axios');
const { default: Bot } = require('ringcentral-chatbot-core/dist/models/Bot');

const { TrelloUser } = require('../src/app/models/trello-user');
const { RcUser } = require('../src/app/models/rc-user');

axios.defaults.adapter = 'http';

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
    const res = await request(server).get('/bot/oauth?code=xxxxxx&client_id=xxxxxx&creator_account_id=xx&creator_extension_id=xxx');
    expect(res.status).toBe(200);
    const bot = await Bot.findByPk(botId);
    expect(bot.id).toEqual(botId);
    expect(bot.token.creator_extension_id).toEqual('xxx');
    rcWebhookScope.done();
    rcTokenScope.done();
  });

  it('should send welcome card when bot install successfully', async () => {
    const rcDirectGroupScope = nock(process.env.RINGCENTRAL_SERVER)
      .post(uri => uri.includes(`/restapi/v1.0/glip/conversations`))
      .reply(200, {
        id: groupId,
        members: [
          botId,
          "xxx"
        ]
      });
    const rcCardScope = nock(process.env.RINGCENTRAL_SERVER)
      .post(uri => uri.includes(`/restapi/v1.0/glip/chats/${groupId}/adaptive-cards`))
      .reply(200, {});
    let requestBody = null;
    rcCardScope.once('request', ({ headers: requestHeaders }, interceptor, reqBody) => {
      requestBody = JSON.parse(reqBody);
    });
    const res = await request(server).post('/bot/webhook').send({
      "uuid": "adt-pod01-39-8363489-438938469",
      "event": "/restapi/v1.0/account/256825004/extension/311556004",
      "timestamp": "2022-04-19T07:49:27.879Z",
      "subscriptionId": "fdc10486-87ed-4047-aeec-a641c5b4de20",
      "ownerId": botId,
      "body": {
        "extensionId": botId,
        "eventType": "Create",
        "hints": [
          "ExtensionInfo"
        ]
      }
    });
    expect(res.status).toEqual(200);
    expect(requestBody.type).toContain('AdaptiveCard');
    expect(requestBody.fallbackText).toContain('I am Trello Bot');
    rcDirectGroupScope.done();
    rcCardScope.done();
  });

  it('should not send help card when bot join a direct conversation', async () => {
    const res = await request(server).post('/bot/webhook').send({
      "uuid": "54666613415546054",
      "event": "/restapi/v1.0/glip/groups",
      "timestamp": "2022-02-11T09:42:57.811Z",
      "subscriptionId": "0a7fb1f2-9e7c-456f-8078-148d1e7c3638",
      "ownerId": botId,
      "body": {
        "id": groupId,
        "description": null,
        "type": "PrivateChat",
        "status": "Active",
        "members": [
          "170848004",
          "713297005"
        ],
        "isPublic": false,
        "creationTime": "2022-02-08T09:02:59.677Z",
        "lastModifiedTime": "2022-02-11T09:42:57.471Z",
        "eventType": "GroupJoined"
      }
    });
    expect(res.status).toEqual(200);
  });

  it('should not send help card when bot join a group conversation', async () => {
    const res = await request(server).post('/bot/webhook').send({
      "uuid": "54666613415546054",
      "event": "/restapi/v1.0/glip/groups",
      "timestamp": "2022-02-11T09:42:57.811Z",
      "subscriptionId": "0a7fb1f2-9e7c-456f-8078-148d1e7c3638",
      "ownerId": botId,
      "body": {
        "id": groupId,
        "description": null,
        "type": "Group",
        "status": "Active",
        "members": [
          "170848004",
          "713297005"
        ],
        "isPublic": false,
        "creationTime": "2022-02-08T09:02:59.677Z",
        "lastModifiedTime": "2022-02-11T09:42:57.471Z",
        "eventType": "GroupJoined"
      }
    });
    expect(res.status).toEqual(200);
  });

  it('should send help card when bot join a new team', async () => {
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

  it('should still send response 200 when send help card error', async () => {
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
        type: 'Team',
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

  it('should send no support message when bot get help command at group conversation', async () => {
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
    expect(messageRequestBody.text).toContain('only support to connect Trello for **Team** conversation');
    rcMessageScope.done();
    rcGroupScope.done();
  });

  it('should send authorize card to conversation when bot get authorize command', async () => {
    const rcCardScope = nock(process.env.RINGCENTRAL_SERVER)
      .post(uri => uri.includes(`/restapi/v1.0/glip/chats/${groupId}/adaptive-cards`))
      .reply(200, {
        id: 'auth_card_id',
      });
    const rcGroupScope = nock(process.env.RINGCENTRAL_SERVER)
      .get(uri => uri.includes(`/restapi/v1.0/glip/groups/${groupId}`))
      .reply(200, {
        id: groupId,
        type: 'PrivateChat',
        members: [
          "170848004",
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
    expect(JSON.stringify(requestBody)).toContain('Please click following button for authorization');
    expect(JSON.stringify(requestBody)).toContain(botId);
    rcCardScope.done();
    rcGroupScope.done();
  });

  it('should send authorize card to the conversation when bot get authorize command at team conversation', async () => {
    const rcCardScope = nock(process.env.RINGCENTRAL_SERVER)
      .post(uri => uri.includes(`/restapi/v1.0/glip/chats/${groupId}/adaptive-cards`))
      .reply(200, {
        id: 'auth_card_id',
      });
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
    let cardRequestBody = null;
    rcCardScope.once('request', ({ headers: requestHeaders }, interceptor, reqBody) => {
      cardRequestBody = JSON.parse(reqBody);
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
    expect(JSON.stringify(cardRequestBody)).toContain('Please click following button for authorization');
    expect(JSON.stringify(cardRequestBody)).toContain(botId);
    rcCardScope.done();
    rcGroupScope.done();
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
    await RcUser.destroy({ where: { id: rcUserRecord.id }});
    await TrelloUser.destroy({ where: { id: trelloUserRecord.id }});
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
    await RcUser.destroy({ where: { id: rcUserRecord.id }});
    await TrelloUser.destroy({ where: { id: trelloUserRecord.id }});
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
    await RcUser.destroy({ where: { id: rcUserRecord.id }});
    await TrelloUser.destroy({ where: { id: trelloUserRecord.id }});
  });

  it('should not send setup card at group conversation with setup command', async () => {
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

  it('should send setup card when get setup command', async () => {
    const rcGroupScope = nock(process.env.RINGCENTRAL_SERVER)
      .get(uri => uri.includes(`/restapi/v1.0/glip/groups/${groupId}`))
      .reply(200, {
        id: groupId,
        type: 'Team',
        name: 'test_team_name',
        members: [
          "170848004",
          "170853004",
          "713297005"
        ]
      });
    const rcCardScope = nock(process.env.RINGCENTRAL_SERVER)
      .post(uri => uri.includes(`/restapi/v1.0/glip/chats/${groupId}/adaptive-cards`))
      .reply(200, {
        id: 'card_id',
      });
    let cardRequestBody = null;
    rcCardScope.once('request', ({ headers: requestHeaders }, interceptor, reqBody) => {
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
    expect(cardRequestBody.fallbackText).toContain('Trello setup for **test_team_name**');
    expect(JSON.stringify(cardRequestBody)).toContain('Please click following button to finish Trello setup');
    rcGroupScope.done();
    rcCardScope.done();
  });
});
