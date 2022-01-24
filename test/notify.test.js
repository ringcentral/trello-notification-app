const request = require('supertest');
const nock = require('nock');
const axios = require('axios');
const { server } = require('../src/server');
const { TrelloWebhook } = require('../src/app/models/trello-webhook');
const { TrelloUser } = require('../src/app/models/trello-user');
const { RCWebhook } = require('../src/app/models/rc-webhook');

axios.defaults.adapter = require('axios/lib/adapters/http')

const createListData = require('../example-payloads/createList.json');
const renameListData = require('../example-payloads/updateList-renamed.json');
const archiveListData = require('../example-payloads/updateList-archived.json');
const unarchiveListData = require('../example-payloads/updateList-unarchived.json');

const addMemberToBoardData = require('../example-payloads/addMemberToBoard.json');
const moveListFromBoardData = require('../example-payloads/moveListFromBoard.json');
const renameBoardData = require('../example-payloads/updateBoard-rename.json');

const createCardData = require('../example-payloads/createCard.json');
const commentCardData = require('../example-payloads/commentCard.json');
const addMemberToCard = require('../example-payloads/addMemberToCard.json');
const removeMemberFromCardData = require('../example-payloads/removeMemberFromCard.json');
const addAttachmentToCardData = require('../example-payloads/addAttachmentToCard.json');
const addLabelToCardData = require('../example-payloads/addLabelToCard.json');
const removeLabelFromCardData = require('../example-payloads/removeLabelFromCard.json');

const archiveCardData = require('../example-payloads/updateCard-archived.json');
const unarchiveCardData = require('../example-payloads/updateCard-unarchived.json');
const updateCardDescriptionData = require('../example-payloads/updateCard-description.json');
const addCardDueDateData = require('../example-payloads/updateCard-due-date-added.json');
const changeCardDueDateData = require('../example-payloads/updateCard-due-date-changed.json');
const moveCardData = require('../example-payloads/updateCard-moved.json');
const renameCardData = require('../example-payloads/updateCard-renamed.json');

const addChecklistToCardData = require('../example-payloads/addChecklistToCard.json');
const createCheckItemData = require('../example-payloads/createCheckItem.json');
const completeCheckItemData = require('../example-payloads/updateCheckItemStateOnCard-completed.json');
const incompleteCheckItemData = require('../example-payloads/updateCheckItemStateOnCard-incomplete.json');
const deleteCheckItemData = require('../example-payloads/deleteCheckItem.json');

const createLabelData = require('../example-payloads/createLabel.json');

describe('Notify', () => {
  const rcWebhookId = '12121';
  const rcWebhookUri = `http://test.com/webhook/${rcWebhookId}`;
  let trelloWebhook;
  let trelloUser;

  beforeAll(async () => {
    const rcWebhookRecord = await await RCWebhook.create({
      id: rcWebhookId,
    });
    const filters = "addChecklistToCard,updateCheckItemStateOnCard,createCheckItem,createCard,changeCardDescription,moveCard,changeCardDueDate,renameCard,commentCard,archiveUnarchiveCard,addAttachmentToCard,addLabelToCard,removeLabelFromCard,addMemberToCard,removeMemberFromCard,createList,archiveUnarchiveList,renameList,renameBoard,moveListFromBoard,addMemberToBoard";
    const trelloUser = await TrelloUser.create({
      id: 'test-trello-user-id',
      token: 'test-token',
    });
    trelloWebhook = await TrelloWebhook.create({
      id: rcWebhookRecord.trello_webhook_id,
      rc_webhook_id: rcWebhookUri,
      trello_user_id: trelloUser.id,
      config: {
        boardId: 'test-board-id',
        filters: String(filters),
      },
    });
  });

  it('should get 404 with wrong webhook id', async () => {
    const res = await request(server).post('/trello-notify/1234');
    expect(res.status).toEqual(404);
  });

  it('should get 200 with createListData message', async () => {
    const scope = nock('http://test.com')
      .post('/webhook/12121')
      .reply(200, { result: 'OK' });
    let requestBody = null;
    scope.once('request', ({ headers: requestHeaders }, interceptor, reqBody) => {
      requestBody = JSON.parse(reqBody);
    });
    const res = await request(server)
      .post(`/trello-notify/${trelloWebhook.id}`)
      .send(createListData);
    expect(res.status).toEqual(200);
    expect(requestBody.attachments[0].type).toContain('AdaptiveCard');
    scope.done();
  });

  it('should get 200 with renameListData message', async () => {
    const scope = nock('http://test.com')
      .post('/webhook/12121')
      .reply(200, { result: 'OK' });
    let requestBody = null;
    scope.once('request', ({ headers: requestHeaders }, interceptor, reqBody) => {
      requestBody = JSON.parse(reqBody);
    });
    const res = await request(server)
      .post(`/trello-notify/${trelloWebhook.id}`)
      .send(renameListData);
    expect(res.status).toEqual(200);
    expect(requestBody.attachments[0].type).toContain('AdaptiveCard');
    scope.done();
  });

  it('should get 200 with archiveListData message', async () => {
    const scope = nock('http://test.com')
      .post('/webhook/12121')
      .reply(200, { result: 'OK' });
    let requestBody = null;
    scope.once('request', ({ headers: requestHeaders }, interceptor, reqBody) => {
      requestBody = JSON.parse(reqBody);
    });
    const res = await request(server)
      .post(`/trello-notify/${trelloWebhook.id}`)
      .send(archiveListData);
    expect(res.status).toEqual(200);
    expect(requestBody.attachments[0].type).toContain('AdaptiveCard');
    scope.done();
  });

  it('should get 200 with unarchiveListData message', async () => {
    const scope = nock('http://test.com')
      .post('/webhook/12121')
      .reply(200, { result: 'OK' });
    let requestBody = null;
    scope.once('request', ({ headers: requestHeaders }, interceptor, reqBody) => {
      requestBody = JSON.parse(reqBody);
    });
    const res = await request(server)
      .post(`/trello-notify/${trelloWebhook.id}`)
      .send(unarchiveListData);
    expect(res.status).toEqual(200);
    expect(requestBody.attachments[0].type).toContain('AdaptiveCard');
    scope.done();
  });

  it('should get 200 with addMemberToBoardData message', async () => {
    const scope = nock('http://test.com')
      .post('/webhook/12121')
      .reply(200, { result: 'OK' });
    let requestBody = null;
    scope.once('request', ({ headers: requestHeaders }, interceptor, reqBody) => {
      requestBody = JSON.parse(reqBody);
    });
    const res = await request(server)
      .post(`/trello-notify/${trelloWebhook.id}`)
      .send(addMemberToBoardData);
    expect(res.status).toEqual(200);
    expect(requestBody.attachments[0].type).toContain('AdaptiveCard');
    scope.done();
  });

  it('should get 200 with moveListFromBoardData message', async () => {
    const scope = nock('http://test.com')
      .post('/webhook/12121')
      .reply(200, { result: 'OK' });
    let requestBody = null;
    scope.once('request', ({ headers: requestHeaders }, interceptor, reqBody) => {
      requestBody = JSON.parse(reqBody);
    });
    const res = await request(server)
      .post(`/trello-notify/${trelloWebhook.id}`)
      .send(moveListFromBoardData);
    expect(res.status).toEqual(200);
    expect(requestBody.attachments[0].type).toContain('AdaptiveCard');
    scope.done();
  });

  it('should get 200 with renameBoardData message', async () => {
    const scope = nock('http://test.com')
      .post('/webhook/12121')
      .reply(200, { result: 'OK' });
    let requestBody = null;
    scope.once('request', ({ headers: requestHeaders }, interceptor, reqBody) => {
      requestBody = JSON.parse(reqBody);
    });
    const res = await request(server)
      .post(`/trello-notify/${trelloWebhook.id}`)
      .send(renameBoardData);
    expect(res.status).toEqual(200);
    expect(requestBody.attachments[0].type).toContain('AdaptiveCard');
    scope.done();
  });

  it('should get 200 with createCardData message', async () => {
    const scope = nock('http://test.com')
      .post('/webhook/12121')
      .reply(200, { result: 'OK' });
    const trelloCardScope = nock('https://api.trello.com')
      .get(uri => uri.includes('1/cards'))
      .reply(200, {
        id: 'test-card-id',
        name: 'test-card-name',
        labels: [],
      });
    const trelloBoardLabelsScope = nock('https://api.trello.com')
      .get(uri => uri.includes('labels'))
      .reply(200, [{
        id: 'test-label-id',
        name: 'test-label-name',
      }]);
    let requestBody = null;
    scope.once('request', ({ headers: requestHeaders }, interceptor, reqBody) => {
      requestBody = JSON.parse(reqBody);
    });
    const res = await request(server)
      .post(`/trello-notify/${trelloWebhook.id}`)
      .send(createCardData);
    expect(res.status).toEqual(200);
    expect(requestBody.attachments[0].type).toContain('AdaptiveCard');
    scope.done();
    trelloCardScope.done();
    trelloBoardLabelsScope.done();
  });

  it('should get 200 with commentCardData message', async () => {
    const scope = nock('http://test.com')
      .post('/webhook/12121')
      .reply(200, { result: 'OK' });
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
    let requestBody = null;
    scope.once('request', ({ headers: requestHeaders }, interceptor, reqBody) => {
      requestBody = JSON.parse(reqBody);
    });
    const res = await request(server)
      .post(`/trello-notify/${trelloWebhook.id}`)
      .send(commentCardData);
    expect(res.status).toEqual(200);
    expect(requestBody.attachments[0].type).toContain('AdaptiveCard');
    scope.done();
    trelloCardScope.done();
  });

  it('should get 200 with addMemberToCard message', async () => {
    const scope = nock('http://test.com')
      .post('/webhook/12121')
      .reply(200, { result: 'OK' });
    const trelloCardScope = nock('https://api.trello.com')
      .get(uri => uri.includes('1/cards'))
      .reply(200, {
        id: 'test-card-id',
        name: 'test-card-name',
        labels: [
          {
            id: 'test-label-id',
            name: 'test-label-name',
          }
        ],
      });
    let requestBody = null;
    scope.once('request', ({ headers: requestHeaders }, interceptor, reqBody) => {
      requestBody = JSON.parse(reqBody);
    });
    const res = await request(server)
      .post(`/trello-notify/${trelloWebhook.id}`)
      .send(addMemberToCard);
    expect(res.status).toEqual(200);
    expect(requestBody.attachments[0].type).toContain('AdaptiveCard');
    scope.done();
    trelloCardScope.done();
  });

  it('should get 200 with removeMemberFromCardData message', async () => {
    const scope = nock('http://test.com')
      .post('/webhook/12121')
      .reply(200, { result: 'OK' });
    const trelloCardScope = nock('https://api.trello.com')
      .get(uri => uri.includes('1/cards'))
      .reply(200, {
        id: 'test-card-id',
        name: 'test-card-name',
        labels: [],
      });
    let requestBody = null;
    scope.once('request', ({ headers: requestHeaders }, interceptor, reqBody) => {
      requestBody = JSON.parse(reqBody);
    });
    const res = await request(server)
      .post(`/trello-notify/${trelloWebhook.id}`)
      .send(removeMemberFromCardData);
    expect(res.status).toEqual(200);
    expect(requestBody.attachments[0].type).toContain('AdaptiveCard');
    scope.done();
    trelloCardScope.done();
  });

  it('should get 200 with addAttachmentToCard message', async () => {
    const scope = nock('http://test.com')
      .post('/webhook/12121')
      .reply(200, { result: 'OK' });
    const trelloCardScope = nock('https://api.trello.com')
      .get(uri => uri.includes('1/cards'))
      .reply(200, {
        id: 'test-card-id',
        name: 'test-card-name',
        labels: [],
      });
    let requestBody = null;
    scope.once('request', ({ headers: requestHeaders }, interceptor, reqBody) => {
      requestBody = JSON.parse(reqBody);
    });
    const res = await request(server)
      .post(`/trello-notify/${trelloWebhook.id}`)
      .send(addAttachmentToCardData);
    expect(res.status).toEqual(200);
    expect(requestBody.attachments[0].type).toContain('AdaptiveCard');
    scope.done();
    trelloCardScope.done();
  });

  it('should get 200 with addLabelToCardData message', async () => {
    const scope = nock('http://test.com')
      .post('/webhook/12121')
      .reply(200, { result: 'OK' });
    const trelloCardScope = nock('https://api.trello.com')
      .get(uri => uri.includes('1/cards'))
      .reply(200, {
        id: 'test-card-id',
        name: 'test-card-name',
        labels: [],
      });
    let requestBody = null;
    scope.once('request', ({ headers: requestHeaders }, interceptor, reqBody) => {
      requestBody = JSON.parse(reqBody);
    });
    const res = await request(server)
      .post(`/trello-notify/${trelloWebhook.id}`)
      .send(addLabelToCardData);
    expect(res.status).toEqual(200);
    expect(requestBody.attachments[0].type).toContain('AdaptiveCard');
    scope.done();
    trelloCardScope.done();
  });

  it('should get 200 with removeLabelFromCardData message', async () => {
    const scope = nock('http://test.com')
      .post('/webhook/12121')
      .reply(200, { result: 'OK' });
    const trelloCardScope = nock('https://api.trello.com')
      .get(uri => uri.includes('1/cards'))
      .reply(200, {
        id: 'test-card-id',
        name: 'test-card-name',
        labels: [],
      });
    let requestBody = null;
    scope.once('request', ({ headers: requestHeaders }, interceptor, reqBody) => {
      requestBody = JSON.parse(reqBody);
    });
    const res = await request(server)
      .post(`/trello-notify/${trelloWebhook.id}`)
      .send(removeLabelFromCardData);
    expect(res.status).toEqual(200);
    expect(requestBody.attachments[0].type).toContain('AdaptiveCard');
    scope.done();
    trelloCardScope.done();
  });


  it('should get 200 with archiveCardData message', async () => {
    const scope = nock('http://test.com')
      .post('/webhook/12121')
      .reply(200, { result: 'OK' });
    const trelloCardScope = nock('https://api.trello.com')
      .get(uri => uri.includes('1/cards'))
      .reply(200, {
        id: 'test-card-id',
        name: 'test-card-name',
        labels: [],
      });
    let requestBody = null;
    scope.once('request', ({ headers: requestHeaders }, interceptor, reqBody) => {
      requestBody = JSON.parse(reqBody);
    });
    const res = await request(server)
      .post(`/trello-notify/${trelloWebhook.id}`)
      .send(archiveCardData);
    expect(res.status).toEqual(200);
    expect(requestBody.attachments[0].type).toContain('AdaptiveCard');
    scope.done();
    trelloCardScope.done();
  });

  it('should get 200 with unarchiveCardData message', async () => {
    const scope = nock('http://test.com')
      .post('/webhook/12121')
      .reply(200, { result: 'OK' });
    const trelloCardScope = nock('https://api.trello.com')
      .get(uri => uri.includes('1/cards'))
      .reply(200, {
        id: 'test-card-id',
        name: 'test-card-name',
        labels: [],
      });
    let requestBody = null;
    scope.once('request', ({ headers: requestHeaders }, interceptor, reqBody) => {
      requestBody = JSON.parse(reqBody);
    });
    const res = await request(server)
      .post(`/trello-notify/${trelloWebhook.id}`)
      .send(unarchiveCardData);
    expect(res.status).toEqual(200);
    expect(requestBody.attachments[0].type).toContain('AdaptiveCard');
    scope.done();
    trelloCardScope.done();
  });

  it('should get 200 with updateCardDescriptionData message', async () => {
    const scope = nock('http://test.com')
      .post('/webhook/12121')
      .reply(200, { result: 'OK' });
    const trelloCardScope = nock('https://api.trello.com')
      .get(uri => uri.includes('1/cards'))
      .reply(200, {
        id: 'test-card-id',
        name: 'test-card-name',
        labels: [],
      });
    let requestBody = null;
    scope.once('request', ({ headers: requestHeaders }, interceptor, reqBody) => {
      requestBody = JSON.parse(reqBody);
    });
    const res = await request(server)
      .post(`/trello-notify/${trelloWebhook.id}`)
      .send(updateCardDescriptionData);
    expect(res.status).toEqual(200);
    expect(requestBody.attachments[0].type).toContain('AdaptiveCard');
    scope.done();
    trelloCardScope.done();
  });

  it('should get 200 with addCardDueDateData message', async () => {
    const scope = nock('http://test.com')
      .post('/webhook/12121')
      .reply(200, { result: 'OK' });
    const trelloCardScope = nock('https://api.trello.com')
      .get(uri => uri.includes('1/cards'))
      .reply(200, {
        id: 'test-card-id',
        name: 'test-card-name',
        labels: [],
      });
    let requestBody = null;
    scope.once('request', ({ headers: requestHeaders }, interceptor, reqBody) => {
      requestBody = JSON.parse(reqBody);
    });
    const res = await request(server)
      .post(`/trello-notify/${trelloWebhook.id}`)
      .send(addCardDueDateData);
    expect(res.status).toEqual(200);
    expect(requestBody.attachments[0].type).toContain('AdaptiveCard');
    scope.done();
    trelloCardScope.done();
  });

  it('should get 200 with changeCardDueDateData message', async () => {
    const scope = nock('http://test.com')
      .post('/webhook/12121')
      .reply(200, { result: 'OK' });
    const trelloCardScope = nock('https://api.trello.com')
      .get(uri => uri.includes('1/cards'))
      .reply(200, {
        id: 'test-card-id',
        name: 'test-card-name',
        labels: [],
      });
    let requestBody = null;
    scope.once('request', ({ headers: requestHeaders }, interceptor, reqBody) => {
      requestBody = JSON.parse(reqBody);
    });
    const res = await request(server)
      .post(`/trello-notify/${trelloWebhook.id}`)
      .send(changeCardDueDateData);
    expect(res.status).toEqual(200);
    expect(requestBody.attachments[0].type).toContain('AdaptiveCard');
    scope.done();
    trelloCardScope.done();
  });

  it('should get 200 with moveCardData message', async () => {
    const scope = nock('http://test.com')
      .post('/webhook/12121')
      .reply(200, { result: 'OK' });
    const trelloCardScope = nock('https://api.trello.com')
      .get(uri => uri.includes('1/cards'))
      .reply(200, {
        id: 'test-card-id',
        name: 'test-card-name',
        labels: [],
      });
    let requestBody = null;
    scope.once('request', ({ headers: requestHeaders }, interceptor, reqBody) => {
      requestBody = JSON.parse(reqBody);
    });
    const res = await request(server)
      .post(`/trello-notify/${trelloWebhook.id}`)
      .send(moveCardData);
    expect(res.status).toEqual(200);
    expect(requestBody.attachments[0].type).toContain('AdaptiveCard');
    scope.done();
    trelloCardScope.done();
  });

  it('should get 200 with renameCardData message', async () => {
    const scope = nock('http://test.com')
      .post('/webhook/12121')
      .reply(200, { result: 'OK' });
    const trelloCardScope = nock('https://api.trello.com')
      .get(uri => uri.includes('1/cards'))
      .reply(200, {
        id: 'test-card-id',
        name: 'test-card-name',
        labels: [],
      });
    let requestBody = null;
    scope.once('request', ({ headers: requestHeaders }, interceptor, reqBody) => {
      requestBody = JSON.parse(reqBody);
    });
    const res = await request(server)
      .post(`/trello-notify/${trelloWebhook.id}`)
      .send(renameCardData);
    expect(res.status).toEqual(200);
    expect(requestBody.attachments[0].type).toContain('AdaptiveCard');
    scope.done();
    trelloCardScope.done();
  });

  it('should get 200 with addChecklistToCardData message', async () => {
    const scope = nock('http://test.com')
      .post('/webhook/12121')
      .reply(200, { result: 'OK' });
    let requestBody = null;
    scope.once('request', ({ headers: requestHeaders }, interceptor, reqBody) => {
      requestBody = JSON.parse(reqBody);
    });
    const res = await request(server)
      .post(`/trello-notify/${trelloWebhook.id}`)
      .send(addChecklistToCardData);
    expect(res.status).toEqual(200);
    expect(requestBody.attachments[0].type).toContain('AdaptiveCard');
    scope.done();
  });

  it('should get 200 with createCheckItemData message', async () => {
    const scope = nock('http://test.com')
      .post('/webhook/12121')
      .reply(200, { result: 'OK' });
    let requestBody = null;
    scope.once('request', ({ headers: requestHeaders }, interceptor, reqBody) => {
      requestBody = JSON.parse(reqBody);
    });
    const res = await request(server)
      .post(`/trello-notify/${trelloWebhook.id}`)
      .send(createCheckItemData);
    expect(res.status).toEqual(200);
    expect(requestBody.attachments[0].type).toContain('AdaptiveCard');
    scope.done();
  });

  it('should get 200 with completeCheckItemData message', async () => {
    const scope = nock('http://test.com')
      .post('/webhook/12121')
      .reply(200, { result: 'OK' });
    let requestBody = null;
    scope.once('request', ({ headers: requestHeaders }, interceptor, reqBody) => {
      requestBody = JSON.parse(reqBody);
    });
    const res = await request(server)
      .post(`/trello-notify/${trelloWebhook.id}`)
      .send(completeCheckItemData);
    expect(res.status).toEqual(200);
    expect(requestBody.attachments[0].type).toContain('AdaptiveCard');
    scope.done();
  });

  it('should get 200 with incompleteCheckItemData message', async () => {
    const scope = nock('http://test.com')
      .post('/webhook/12121')
      .reply(200, { result: 'OK' });
    let requestBody = null;
    scope.once('request', ({ headers: requestHeaders }, interceptor, reqBody) => {
      requestBody = JSON.parse(reqBody);
    });
    const res = await request(server)
      .post(`/trello-notify/${trelloWebhook.id}`)
      .send(incompleteCheckItemData);
    expect(res.status).toEqual(200);
    expect(requestBody.attachments[0].type).toContain('AdaptiveCard');
    scope.done();
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

  it('should get 200 with deleteCheckItemData message', async () => {
    const scope = nock('http://test.com')
      .post('/webhook/12121')
      .reply(200, { result: 'OK' });
    let requestBody = null;
    scope.once('request', ({ headers: requestHeaders }, interceptor, reqBody) => {
      requestBody = JSON.parse(reqBody);
    });
    const res = await request(server)
      .post(`/trello-notify/${trelloWebhook.id}`)
      .send(deleteCheckItemData);
    expect(res.status).toEqual(200);
    expect(requestBody).toEqual(null);
    nock.restore();
  });
});
