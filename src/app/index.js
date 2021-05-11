const path = require('path');
const axios = require('axios');
const cookieSession = require('cookie-session');

const { Trello } = require('./lib/Trello');
const { RCWebhook } = require('./models/rc-webhook');
const { TrelloWebhook } = require('./models/trello-webhook');
const { getFilterId } = require('./lib/filter');

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

  app.get('/webhooks/new', async (req, res) => {
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
        rcWebhookUri,
        authorizationUri: `${process.env.APP_SERVER}/trello/authorize?id=${trelloWebhookId}`,
        authorizationCallbackUri: `${process.env.APP_SERVER}/trello/oauth-callback/${trelloWebhookId}`,
        authorizationRevokeUri: `${process.env.APP_SERVER}/trello/revoke/${trelloWebhookId}`,
        trelloWebhookInfoUri: `${process.env.APP_SERVER}/trello-webhooks/${trelloWebhookId}`,
        webhookCreationUri: `${process.env.APP_SERVER}/webhooks`,
      },
    });
  });

  app.get('/trello-webhooks/:id/authorized', async (req, res) => {
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

  app.get('/trello/revoke/:id', async (req, res) => {
    // TODO clean webhook and token
    const trelloWebhookId = req.params.id;
    const trelloWebhook = await TrelloWebhook.findByPk(trelloWebhookId);
    if (trelloWebhook) {
      trelloWebhook.token = '';
      await trelloWebhook.save();
    }
    res.send('ok');
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
    const token = trelloWebhook && trelloWebhook.token;
    if (!token) {
      res.status(401);
      return;
    }
    const trello = new Trello({
      appKey: process.env.TRELLO_APP_KEY,
      redirectUrl: `${process.env.APP_SERVER}/trello/oauth-callback/${trelloWebhookId}`,
      token,
    });
    const boards = await trello.getBoards();
    const userInfo = await trello.getUserInfo();
    res.json({
      boards,
      userInfo,
      config: trelloWebhook.config || {},
    });
    res.status(200);
  });

  // Create or Update Trello webhook
  app.post('/webhooks', async (req, res) => {
    const rcWebhookUri = req.body.rcWebhook;
    if (!rcWebhookUri) {
      res.send('Not found');
      res.status(404);
      return;
    }
    const boardId = req.body.boardId;
    const filters = req.body.filters;
    if (!boardId || !filters) {
      res.send('Error params');
      res.status(403);
      return;
    }
    let rcWebhookRecord;
    let trelloWebhook;
    try {
      rcWebhookRecord = await RCWebhook.findByPk(rcWebhookUri);
      trelloWebhook = await TrelloWebhook.findByPk(rcWebhookRecord.trello_webhook_id)
      if (!trelloWebhook || !trelloWebhook.token) {
        res.send('Forbidden');
        res.status(401);
        return;
      }
      trelloWebhook.config = {
        boardId,
        filters: String(filters),
      };
      if (!trelloWebhook.rc_webhook_id) {
        trelloWebhook.rc_webhook_id = rcWebhookUri;
      }
      await trelloWebhook.save();
      const trello = new Trello({
        appKey: process.env.TRELLO_APP_KEY,
        token: trelloWebhook.token,
      });
      if (trelloWebhook.trello_webhook_id) {
        const webhook = await trello.updateWebhook({
          id: trelloWebhook.trello_webhook_id,
          description: 'RingCentral Notifications',
          callbackURL: `${process.env.APP_SERVER}/trello-notify/${trelloWebhook.id}`,
          idModel: boardId,
          active: true,
        });
        console.log('update success');
        console.log(webhook);
      } else {
        const webhook = await trello.createWebhook({
          id: trelloWebhook.trello_webhook_id,
          description: 'RingCentral Notifications',
          callbackURL: `${process.env.APP_SERVER}/trello-notify/${trelloWebhook.id}`,
          idModel: boardId,
          active: true,
        });
        trelloWebhook.trello_webhook_id = webhook.id;
        await trelloWebhook.save();
        console.log('create success');
        console.log(webhook);
      }
      res.json({
        result: 'OK',
      });
      res.status(200);
    } catch (e) {
      console.error(e);
      res.send('Internal server error');
      res.status(500);
      return;
    }
  });

  app.post('/trello-notify/:id', async (req, res) => {
    const trelloWebhookId = req.params.id;
    console.log(JSON.stringify(req.body, null, 2));
    try {
      const trelloWebhook = await TrelloWebhook.findByPk(trelloWebhookId);
      const filterId = getFilterId(req.body, trelloWebhook.config.filters);
      if (filterId) {
        console.log(filterId);
        const response = await axios.post(trelloWebhook.rc_webhook_id, {
          title: `${req.body.action.type}`,
        }, {
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json'
          }
        });
        console.log(response.data);
      } else {
        console.log('Filtered message');
      }
    } catch (e) {
      console.error(e)
    }
    res.json({
      result: 'OK',
    });
    res.status(200);
  });

  app.head('/trello-notify/:id', async (req, res) => {
    res.json({
      result: 'OK',
    });
    res.status(200);
  });
}
