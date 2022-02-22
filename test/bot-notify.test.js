const request = require('supertest');
const nock = require('nock');
const axios = require('axios');
const { generate } = require('shortid');
const { default: Bot } = require('ringcentral-chatbot-core/dist/models/Bot');
const { server } = require('../src/server');
const { TrelloWebhook } = require('../src/app/models/trello-webhook');
const { TrelloUser } = require('../src/app/models/trello-user');

axios.defaults.adapter = require('axios/lib/adapters/http');

const createListData = require('../example-payloads/createList.json');
const addMemberToBoardData = require('../example-payloads/addMemberToBoard.json');
const createCardData = require('../example-payloads/createCard.json');
const addChecklistToCardData = require('../example-payloads/addChecklistToCard.json');
const createLabelData = require('../example-payloads/createLabel.json');

describe('Bot Notify', () => {
  const botId = '12121';
  const conversationId = '123123';
  let trelloWebhook;

  beforeAll(async () => {
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

  it('should get 404 when bot id is not found', async () => {
    trelloWebhook.bot_id = 'xxx';
    await trelloWebhook.save();
    const res = await request(server)
      .post(`/trello-notify/${trelloWebhook.id}`)
      .send(createListData);
    expect(res.status).toEqual(404);
  });
});