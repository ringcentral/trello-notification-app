const path = require('path');
const axios = require('axios')
const cookieSession = require('cookie-session');

const { Trello } = require('./lib/Trello');
const { RCWebhook } = require('./models/rc-webhook');
const { TrelloWebhook } = require('./models/trello-webhook');

// extends or override express app as you need
exports.appExtend = (app) => {
  app.set('views', path.resolve(__dirname, './views'));
  app.set('view engine', 'pug');
  // cookie session config
  app.use(cookieSession({
    name: 'session',
    keys: [process.env.APP_SERVER_SECRET_KEY],
    httpOnly: true,
    signed: true,
    maxAge: 24 * 60 * 60 * 1000 // 1 day
  }));
  app.get('/webhook/new', async (req, res) => {
    const csrfToken = Math.random().toString(36);
    req.session.csrfToken = csrfToken;
    const rcWebhookUri = req.query.webhook;
    if (!rcWebhookUri) {
      res.end(404);
      return;
    }
    let rcWebhookRecord = {};
    try {
      rcWebhookRecord = await RCWebhook.findByPk(rcWebhookUri);
      if (!rcWebhookRecord) {
        rcWebhookRecord = await RCWebhook.create({
          id: rcWebhookUri,
        });
      }
    } catch (e) {
      console.error(e);
      res.send('Internal server error');
      res.end(500);
      return;
    }
    res.render('new', {
      rcWebhookUri: rcWebhookRecord.id,
      trelloWebhookId: rcWebhookRecord.trello_webhook_id,
    });
  });

  app.get('/trello/authorize', async (req, res) => {
    const trello = new Trello({
      appKey: process.env.TRELLO_APP_KEY,
      redirectUrl: `${process.env.APP_SERVER}/trello/oauth-callback`
    });
    res.redirect(trello.authorizationUrl());
  });

  app.get('/trello/oauth-callback/:webhookId', async (req, res) => {
    res.render('oauth-callback');
  });
  app.post('/trello/oauth-callback/:webhookId', async (req, res) => {
    console.log(res.query);
    res.send('ok');
  });
}
