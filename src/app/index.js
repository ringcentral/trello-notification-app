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
    let trelloAuthorized = false;
    try {
      rcWebhookRecord = await RCWebhook.findByPk(rcWebhookUri);
      if (rcWebhookRecord) {
        const trelloWebhook = await TrelloWebhook.findByPk(rcWebhookRecord.trello_webhook_id)
        if (trelloWebhook && trelloWebhook.token && trelloWebhook.token.length > 0) {
          trelloAuthorized = true;
        }
      } else {
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
    const trelloWebhookId = rcWebhookRecord.trello_webhook_id;
    res.render('new', {
      csrfToken,
      assetsPath: process.env.ASSETS_PATH,
      data: {
        trelloAuthorized,
        trelloWebhookId,
        authorizationUri: `${process.env.APP_SERVER}/trello/authorize?id=${trelloWebhookId}`,
        authorizationStatusUri: `${process.env.APP_SERVER}/trello-webhooks/${trelloWebhookId}`,
        authorizationCallbackUri: `${process.env.APP_SERVER}/trello/oauth-callback/${trelloWebhookId}`,
      },
    });
  });

  app.get('/trello-webhooks/:id', async (req, res) => {
    const trelloWebhookId = req.params.id;
    let trelloWebhook;
    try {
      trelloWebhook = await TrelloWebhook.findByPk(trelloWebhookId);
    } catch (e) {
      console.error(e);
      // ignore
    }
    res.json({
      authorized: !!(
        trelloWebhook &&
        trelloWebhook.token &&
        trelloWebhook.token.length > 0
      )
    });
    res.status(200);
  });

  app.get('/trello/authorize', async (req, res) => {
    const trelloWebhookId = req.query.id;
    const trello = new Trello({
      appKey: process.env.TRELLO_APP_KEY,
      redirectUrl: `${process.env.APP_SERVER}/trello/oauth-callback/${trelloWebhookId}`,
    });
    res.redirect(trello.authorizationUrl());
  });

  app.get('/trello/oauth-callback/:id', async (req, res) => {
    res.render('oauth-callback');
  });

  app.post('/trello/oauth-callback/:id', async (req, res) => {
    const token = req.query.token;
    const trelloWebhookId = req.params.id;
    let trelloWebhook;
    if (token) {
      trelloWebhook = await TrelloWebhook.findByPk(trelloWebhookId);
      if (trelloWebhook) {
        trelloWebhook.token = token;
        await trelloWebhook.save();
      } else {
        trelloWebhook = await TrelloWebhook.create({
          id: trelloWebhookId,
          token,
        });
      }
    }
    res.send('ok');
  });

  app.post('/trello/revoke/:id', async (req, res) => {
    const trelloWebhookId = req.params.id;
    const trelloWebhook = await TrelloWebhook.findByPk(trelloWebhookId);
    if (trelloWebhook) {
      trelloWebhook.token = '';
      await trelloWebhook.save();
    }
    res.send('ok');
  });
}
