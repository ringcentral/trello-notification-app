const request = require('supertest');
const nock = require('nock');
const axios = require('axios');
const { generate } = require('shortid');
const { default: Bot } = require('ringcentral-chatbot-core/dist/models/Bot');
const { server } = require('../src/server');
const { TrelloWebhook } = require('../src/app/models/trello-webhook');
const { TrelloUser } = require('../src/app/models/trello-user');
const { findItemInAdaptiveCard } = require('../src/app/lib/findItemInAdaptiveCard');

axios.defaults.adapter = require('axios/lib/adapters/http');

const createListData = require('../example-payloads/createList.json');
const addMemberToBoardData = require('../example-payloads/addMemberToBoard.json');
const createCardData = require('../example-payloads/createCard.json');
const addChecklistToCardData = require('../example-payloads/addChecklistToCard.json');
const createLabelData = require('../example-payloads/createLabel.json');
const updateCardDescriptionData = require('../example-payloads/updateCard-description.json');
const commentCardData = require('../example-payloads/commentCard.json');
const archiveCardData = require('../example-payloads/updateCard-archived.json');

describe('Bot Notify', () => {
  const botId = '12121';
  const conversationId = '123123';
  let trelloWebhook;

  beforeEach(async () => {
    await Bot.create({
      id: botId,
      token: {
        access_token: 'xxx',
        owner_id: 'xxxxx',
      },
    });
    const filters = "addChecklistToCard,updateCheckItemStateOnCard,createCheckItem,createCard,changeCardDescription,moveCard,changeCardDueDate,renameCard,commentCard,archiveUnarchiveCard,addAttachmentToCard,addLabelToCard,removeLabelFromCard,addMemberToCard,removeMemberFromCard,createList,archiveUnarchiveList,renameList,renameBoard,moveListFromBoard,addMemberToBoard";
    const trelloUser = await TrelloUser.create({
      id: 'test-trello-user-id',
      writeable_token: 'test-token',
    });
    trelloWebhook = await TrelloWebhook.create({
      id: generate(),
      bot_id: botId,
      conversation_id: conversationId,
      trello_user_id: trelloUser.id,
      trello_webhook_id: 'test-trello-webhook-id',
      config: {
        boardId: 'test-board-id',
        filters: String(filters),
        labels: [
          { "id":"6094fb83d41eeff1fa76129d", "name":"", "color":"green" },
          { "id":"6094fb83d41eeff1fa7612a1", "name":"", "color":"yellow" }
        ],
      },
    });
  });

  afterEach(async () => {
    await TrelloWebhook.destroy({ where: { id: trelloWebhook.id } });
    await Bot.destroy({ where: { id: botId } });
    await TrelloUser.destroy({ where: { id: 'test-trello-user-id' } });
  });

  it('should get 404 with wrong webhook id', async () => {
    const res = await request(server).post('/trello-notify/1234');
    expect(res.status).toEqual(404);
  });

  it('should get 200 with createListData message', async () => {
    const rcCardScope = nock(process.env.RINGCENTRAL_SERVER)
      .post(uri => uri.includes(`/restapi/v1.0/glip/chats/${conversationId}/adaptive-cards`))
      .reply(200, {});
    let requestBody = null;
    rcCardScope.once('request', ({ headers: requestHeaders }, interceptor, reqBody) => {
      requestBody = JSON.parse(reqBody);
    });
    const res = await request(server)
      .post(`/trello-notify/${trelloWebhook.id}`)
      .send(createListData);
    expect(res.status).toEqual(200);
    expect(requestBody.fallbackText).toContain('created New list');
    rcCardScope.done();
  });

  it('should get 200 with addMemberToBoardData message', async () => {
    const rcCardScope = nock(process.env.RINGCENTRAL_SERVER)
      .post(uri => uri.includes(`/restapi/v1.0/glip/chats/${conversationId}/adaptive-cards`))
      .reply(200, {});
    let requestBody = null;
    rcCardScope.once('request', ({ headers: requestHeaders }, interceptor, reqBody) => {
      requestBody = JSON.parse(reqBody);
    });
    const res = await request(server)
      .post(`/trello-notify/${trelloWebhook.id}`)
      .send(addMemberToBoardData);
    expect(res.status).toEqual(200);
    expect(requestBody.fallbackText).toContain('added');
    rcCardScope.done();
  });

  it('should get 200 with createCardData message', async () => {
    const rcCardScope = nock(process.env.RINGCENTRAL_SERVER)
      .post(uri => uri.includes(`/restapi/v1.0/glip/chats/${conversationId}/adaptive-cards`))
      .reply(200, {});
    const trelloCardScope = nock('https://api.trello.com')
      .get(uri => uri.includes('1/cards'))
      .reply(200, {
        id: 'test-card-id',
        name: 'test-card-name',
        labels: [],
      });
    let requestBody = null;
    rcCardScope.once('request', ({ headers: requestHeaders }, interceptor, reqBody) => {
      requestBody = JSON.parse(reqBody);
    });
    const res = await request(server)
      .post(`/trello-notify/${trelloWebhook.id}`)
      .send(createCardData);
    expect(res.status).toEqual(200);
    expect(requestBody.fallbackText).toContain('New card created');
    const actionContainer1 = findItemInAdaptiveCard(requestBody, 'actionContainer1');
    expect(actionContainer1.isVisible).toEqual(undefined);
    const actionContainer2 = findItemInAdaptiveCard(requestBody, 'actionContainer2');
    expect(actionContainer2.isVisible).toEqual(undefined);
    rcCardScope.done();
    trelloCardScope.done();
  });

  it('should get 200 with createCardData message with disableButtons false', async () => {
    const rcCardScope = nock(process.env.RINGCENTRAL_SERVER)
      .post(uri => uri.includes(`/restapi/v1.0/glip/chats/${conversationId}/adaptive-cards`))
      .reply(200, {});
    const trelloCardScope = nock('https://api.trello.com')
      .get(uri => uri.includes('1/cards'))
      .reply(200, {
        id: 'test-card-id',
        name: 'test-card-name',
        labels: [],
      });
    let requestBody = null;
    rcCardScope.once('request', ({ headers: requestHeaders }, interceptor, reqBody) => {
      requestBody = JSON.parse(reqBody);
    });
    trelloWebhook.config = {
      ...trelloWebhook.config,
      disableButtons: false,
    };
    await trelloWebhook.save();
    const res = await request(server)
      .post(`/trello-notify/${trelloWebhook.id}`)
      .send(createCardData);
    expect(res.status).toEqual(200);
    expect(requestBody.fallbackText).toContain('New card created');
    const actionContainer1 = findItemInAdaptiveCard(requestBody, 'actionContainer1');
    expect(actionContainer1.isVisible).toEqual(undefined);
    const actionContainer2 = findItemInAdaptiveCard(requestBody, 'actionContainer2');
    expect(actionContainer2.isVisible).toEqual(undefined);
    rcCardScope.done();
    trelloCardScope.done();
  });

  it('should get 200 with createCardData message with disableButtons true', async () => {
    const rcCardScope = nock(process.env.RINGCENTRAL_SERVER)
      .post(uri => uri.includes(`/restapi/v1.0/glip/chats/${conversationId}/adaptive-cards`))
      .reply(200, {});
    const trelloCardScope = nock('https://api.trello.com')
      .get(uri => uri.includes('1/cards'))
      .reply(200, {
        id: 'test-card-id',
        name: 'test-card-name',
        labels: [],
      });
    let requestBody = null;
    rcCardScope.once('request', ({ headers: requestHeaders }, interceptor, reqBody) => {
      requestBody = JSON.parse(reqBody);
    });
    trelloWebhook.config = {
      ...trelloWebhook.config,
      disableButtons: true,
    };
    await trelloWebhook.save();
    const res = await request(server)
      .post(`/trello-notify/${trelloWebhook.id}`)
      .send(createCardData);
    expect(res.status).toEqual(200);
    expect(requestBody.fallbackText).toContain('New card created');
    const actionContainer1 = findItemInAdaptiveCard(requestBody, 'actionContainer1');
    expect(actionContainer1.isVisible).toEqual(false);
    const actionContainer2 = findItemInAdaptiveCard(requestBody, 'actionContainer2');
    expect(actionContainer2.isVisible).toEqual(false);
    rcCardScope.done();
    trelloCardScope.done();
  });

  it('should get 200 with archiveCardData message', async () => {
    const rcCardScope = nock(process.env.RINGCENTRAL_SERVER)
      .post(uri => uri.includes(`/restapi/v1.0/glip/chats/${conversationId}/adaptive-cards`))
      .reply(200, {});
    const trelloCardScope = nock('https://api.trello.com')
      .get(uri => uri.includes('1/cards'))
      .reply(200, {
        id: 'test-card-id',
        name: 'test-card-name',
        labels: [],
      });
    let requestBody = null;
    rcCardScope.once('request', ({ headers: requestHeaders }, interceptor, reqBody) => {
      requestBody = JSON.parse(reqBody);
    });
    const res = await request(server)
      .post(`/trello-notify/${trelloWebhook.id}`)
      .send(archiveCardData);
    expect(res.status).toEqual(200);
    expect(requestBody.fallbackText).toContain('archived');
    const actionContainer1 = findItemInAdaptiveCard(requestBody, 'actionContainer1');
    expect(actionContainer1.isVisible).toEqual(false);
    const actionContainer2 = findItemInAdaptiveCard(requestBody, 'actionContainer2');
    expect(actionContainer2.isVisible).toEqual(false);
    rcCardScope.done();
    trelloCardScope.done();
  });

  it('should get 200 with addChecklistToCardData message', async () => {
    const rcCardScope = nock(process.env.RINGCENTRAL_SERVER)
      .post(uri => uri.includes(`/restapi/v1.0/glip/chats/${conversationId}/adaptive-cards`))
      .reply(200, {});
    let requestBody = null;
    rcCardScope.once('request', ({ headers: requestHeaders }, interceptor, reqBody) => {
      requestBody = JSON.parse(reqBody);
    });
    const res = await request(server)
      .post(`/trello-notify/${trelloWebhook.id}`)
      .send(addChecklistToCardData);
    expect(res.status).toEqual(200);
    expect(requestBody.fallbackText).toContain('added new checklist');
    rcCardScope.done();
  });

  it('should get 200 with createLabel message', async () => {
    const trelloBoardLabelsScope = nock('https://api.trello.com')
      .get(uri => uri.includes('labels'))
      .reply(200, [{
        id: 'test-label-id',
        name: 'test-label-name',
      }]);
    const res = await request(server)
      .post(`/trello-notify/${trelloWebhook.id}`)
      .send(createLabelData);
    expect(res.status).toEqual(200);
    trelloBoardLabelsScope.done();
  });

  it('should get 200 and unsubscribe trello when bot id is not found at list event request', async () => {
    trelloWebhook.bot_id = 'xxx';
    await trelloWebhook.save();
    const trelloDeleteWebhookScope = nock('https://api.trello.com')
      .delete(uri => uri.includes(`/1/webhooks/${trelloWebhook.trello_webhook_id}?`))
      .reply(200, {});
    const res = await request(server)
      .post(`/trello-notify/${trelloWebhook.id}`)
      .send(createListData);
    expect(res.status).toEqual(200);
    trelloDeleteWebhookScope.done();
  });

  it('should get 200 and unsubscribe trello when bot id is not found at card event request', async () => {
    trelloWebhook.bot_id = 'xxx';
    await trelloWebhook.save();
    const trelloDeleteWebhookScope = nock('https://api.trello.com')
      .delete(uri => uri.includes(`/1/webhooks/${trelloWebhook.trello_webhook_id}?`))
      .reply(200, {});
    const trelloCardScope = nock('https://api.trello.com')
      .get(uri => uri.includes('1/cards'))
      .reply(200, {
        id: 'test-card-id',
        name: 'test-card-name',
        labels: [],
      });
    const res = await request(server)
      .post(`/trello-notify/${trelloWebhook.id}`)
      .send(createCardData);
    expect(res.status).toEqual(200);
    trelloDeleteWebhookScope.done();
    trelloCardScope.done();
  });

  it('should get 200 and unsubscribe trello when bot is removed from conversation', async () => {
    await trelloWebhook.save();
    const rcCardScope = nock(process.env.RINGCENTRAL_SERVER)
      .post(uri => uri.includes(`/restapi/v1.0/glip/chats/${conversationId}/adaptive-cards`))
      .reply(404, {});
    const trelloDeleteWebhookScope = nock('https://api.trello.com')
      .delete(uri => uri.includes(`/1/webhooks/${trelloWebhook.trello_webhook_id}?`))
      .reply(200, {});
    const trelloCardScope = nock('https://api.trello.com')
      .get(uri => uri.includes('1/cards'))
      .reply(200, {
        id: 'test-card-id',
        name: 'test-card-name',
        labels: [],
      });
    const res = await request(server)
      .post(`/trello-notify/${trelloWebhook.id}`)
      .send(createCardData);
    expect(res.status).toEqual(200);
    trelloDeleteWebhookScope.done();
    trelloCardScope.done();
    rcCardScope.done();
  });

  it('should get 200 and unsubscribe trello when the conversation is archived', async () => {
    await trelloWebhook.save();
    const rcCardScope = nock(process.env.RINGCENTRAL_SERVER)
      .post(uri => uri.includes(`/restapi/v1.0/glip/chats/${conversationId}/adaptive-cards`))
      .reply(403, {});
    const trelloDeleteWebhookScope = nock('https://api.trello.com')
      .delete(uri => uri.includes(`/1/webhooks/${trelloWebhook.trello_webhook_id}?`))
      .reply(200, {});
    const trelloCardScope = nock('https://api.trello.com')
      .get(uri => uri.includes('1/cards'))
      .reply(200, {
        id: 'test-card-id',
        name: 'test-card-name',
        labels: [],
      });
    const res = await request(server)
      .post(`/trello-notify/${trelloWebhook.id}`)
      .send(createCardData);
    expect(res.status).toEqual(200);
    trelloDeleteWebhookScope.done();
    trelloCardScope.done();
    rcCardScope.done();
  });

  it('should get 200 when bot send card with 502', async () => {
    await trelloWebhook.save();
    const rcCardScope = nock(process.env.RINGCENTRAL_SERVER)
      .post(uri => uri.includes(`/restapi/v1.0/glip/chats/${conversationId}/adaptive-cards`))
      .reply(502, {});
    const trelloCardScope = nock('https://api.trello.com')
      .get(uri => uri.includes('1/cards'))
      .reply(200, {
        id: 'test-card-id',
        name: 'test-card-name',
        labels: [],
      });
    const res = await request(server)
      .post(`/trello-notify/${trelloWebhook.id}`)
      .send(createCardData);
    expect(res.status).toEqual(200);
    trelloCardScope.done();
    rcCardScope.done();
  });

  it('should send card successfully when label color and name is null', async () => {
    trelloWebhook.config = {
      ...trelloWebhook.config,
      labels: [
        ...trelloWebhook.config.labels,
        { "id":"6094fb83d41eeff1fa7612a1", "color": null }
      ],
    };
    await trelloWebhook.save();
    const rcCardScope = nock(process.env.RINGCENTRAL_SERVER)
      .post(uri => uri.includes(`/restapi/v1.0/glip/chats/${conversationId}/adaptive-cards`))
      .reply(200, {});
    const trelloCardScope = nock('https://api.trello.com')
      .get(uri => uri.includes('1/cards'))
      .reply(200, {
        id: 'test-card-id',
        name: 'test-card-name',
        labels: [],
      });
    let requestRawBody = null;
    rcCardScope.once('request', ({ headers: requestHeaders }, interceptor, reqBody) => {
      requestRawBody = reqBody;
    });
    const res = await request(server)
      .post(`/trello-notify/${trelloWebhook.id}`)
      .send(createCardData);
    expect(res.status).toEqual(200);
    expect(requestRawBody).toContain('No color');
    rcCardScope.done();
    trelloCardScope.done();
  });

  it('should get 200 with updateCardDescriptionData message and truncateText the text', async () => {
    const rcCardScope = nock(process.env.RINGCENTRAL_SERVER)
      .post(uri => uri.includes(`/restapi/v1.0/glip/chats/${conversationId}/adaptive-cards`))
      .reply(200, {});
    const trelloCardScope = nock('https://api.trello.com')
      .get(uri => uri.includes('1/cards'))
      .reply(200, {
        id: 'test-card-id',
        name: 'test-card-name',
        labels: [],
      });
    let requestRawBody = null;
    rcCardScope.once('request', ({ headers: requestHeaders }, interceptor, reqBody) => {
      requestRawBody = reqBody;
    });
    const trelloMessage = {
      ...updateCardDescriptionData,
      action: {
        ...updateCardDescriptionData.action,
        data: {
          ...updateCardDescriptionData.action.data,
          card: {
            ...updateCardDescriptionData.action.data.card,
            desc: 'a'.repeat(1000),
          }
        }
      }
    };
    const res = await request(server)
      .post(`/trello-notify/${trelloWebhook.id}`)
      .send(trelloMessage);
    expect(res.status).toEqual(200);
    expect(requestRawBody).toContain('...');
    rcCardScope.done();
    trelloCardScope.done();
  });

  it('should get 200 with commentCardData message and truncateText the text', async () => {
    const rcCardScope = nock(process.env.RINGCENTRAL_SERVER)
      .post(uri => uri.includes(`/restapi/v1.0/glip/chats/${conversationId}/adaptive-cards`))
      .reply(200, {});
    const trelloCardScope = nock('https://api.trello.com')
      .get(uri => uri.includes('1/cards'))
      .reply(200, {
        id: 'test-card-id',
        name: 'test-card-name',
        labels: [{
          id: 'test-label-id',
          name: 'test-label-name',
          color: 'blue',
        }],
      });
    let requestRawBody = null;
    rcCardScope.once('request', ({ headers: requestHeaders }, interceptor, reqBody) => {
      requestRawBody = reqBody;
    });
    const trelloMessage = {
      ...commentCardData,
      action: {
        ...commentCardData.action,
        data: {
          ...commentCardData.action.data,
          text: 'a'.repeat(1000),
        }
      }
    };
    const res = await request(server)
      .post(`/trello-notify/${trelloWebhook.id}`)
      .send(trelloMessage);
    expect(res.status).toEqual(200);
    expect(requestRawBody).toContain('...');
    rcCardScope.done();
    trelloCardScope.done();
  });
});
