const request = require('supertest');
const { server } = require('../src/server');
const { TrelloUser } = require('../src/app/models/trello-user');

describe('Maintain', () => {
  it('should return 404 when no MAINTAIN_TOKEN env', async () => {
    const res = await request(server).get('/maintain/remove-user-name');
    expect(res.status).toEqual(404);
  });

  it('should return 403 when maintain_token is invalid', async () => {
    process.env.MAINTAIN_TOKEN = 'valid';
    const res = await request(server).get('/maintain/remove-user-name?maintain_token=invalid');
    expect(res.status).toEqual(403);
    delete process.env.MAINTAIN_TOKEN;
  });

  it('should return 200 when maintain_token is valid', async () => {
    await TrelloUser.create({
      id: '111',
      username: 'test',
      fullName: 'test',
      writeable_token: 'test111',
    });
    await TrelloUser.create({
      id: '222',
      username: '',
      fullName: '',
      writeable_token: 'test222',
    });
    await TrelloUser.create({
      id: '333',
      username: '333name',
      fullName: '333name',
      writeable_token: 'test333',
    });
    process.env.MAINTAIN_TOKEN = 'valid';
    const res = await request(server).get(`/maintain/remove-user-name?maintain_token=${process.env.MAINTAIN_TOKEN}`);
    expect(res.status).toEqual(200);
    expect(res.body.lastKey).toEqual('');
    const user1 = await TrelloUser.findByPk('111');
    expect(user1.username).toEqual('');
    expect(user1.fullName).toEqual('');
    expect(user1.getWriteableToken()).toEqual('test111');
    const user2 = await TrelloUser.findByPk('222');
    expect(user2.username).toEqual('');
    expect(user2.fullName).toEqual('');
    expect(user2.getWriteableToken()).toEqual('test222');
    const user3 = await TrelloUser.findByPk('333');
    expect(user3.username).toEqual('');
    expect(user3.fullName).toEqual('');
    expect(user3.getWriteableToken()).toEqual('test333');
    delete process.env.MAINTAIN_TOKEN;
    await TrelloUser.destroy({ where: { id: '111' } });
    await TrelloUser.destroy({ where: { id: '222' } });
    await TrelloUser.destroy({ where: { id: '333' } });
  });

  it('should return 200 when maintain_token is valid', async () => {
    await TrelloUser.create({
      id: '111',
      username: 'test',
      fullName: 'test',
      writeable_token: 'test111',
    });
    await TrelloUser.create({
      id: '222',
      username: '',
      fullName: '',
      writeable_token: 'test222',
    });
    await TrelloUser.create({
      id: '333',
      username: '333name',
      fullName: '333name',
      writeable_token: 'test333',
    });
    process.env.MAINTAIN_TOKEN = 'valid';
    const res = await request(server).get(`/maintain/remove-user-name?maintain_token=${process.env.MAINTAIN_TOKEN}&last_key=111`);
    expect(res.status).toEqual(200);
    delete process.env.MAINTAIN_TOKEN;
    await TrelloUser.destroy({ where: { id: '111' } });
    await TrelloUser.destroy({ where: { id: '222' } });
    await TrelloUser.destroy({ where: { id: '333' } });
  });
});
