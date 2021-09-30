const request = require('supertest');
const { server } = require('../src/server');
// const { TrelloWebhook } = require('../src/app/models/trello-webhook');
// const { RCWebhook } = require('../src/app/models/rc-webhook');

describe('Webhook new', () => {
  it('should get 404 without webhook uri', async () => {
    const res = await request(server).get('/webhooks/new');
    expect(res.status).toEqual(404);
  });

  it('should get new webhook page successfully', async () => {
    const res = await request(server).get('/webhooks/new?webhook=test.com');
    expect(res.status).toEqual(404);
  });

  it('should get new webhook page successfully', async () => {
    const res = await request(server).get('/webhooks/new?webhook=http://test.com');
    expect(res.status).toEqual(200);
  });

  it('should get new webhook page successfully', async () => {
    const res = await request(server).get('/webhooks/new?webhook=https://test.com');
    expect(res.status).toEqual(200);
  });
});