const { Trello } = require('../lib/Trello');
const { RCWebhook } = require('../models/rc-webhook');
const { TrelloWebhook } = require('../models/trello-webhook');

async function newWebhook(req, res) {
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
      authorizationUri: `${process.env.APP_SERVER}/trello/authorize`,
      authorizationTokenUri: `${process.env.APP_SERVER}/trello/token`,
      authorizationRevokeUri: `${process.env.APP_SERVER}/trello/revoke`,
      webhookInfoUri: `${process.env.APP_SERVER}/webhooks/info`,
      webhookCreationUri: `${process.env.APP_SERVER}/webhooks`,
    },
  });
}

async function webhookInfo (req, res) {
  const rcWebhookUri = req.query.rcWebhook;
  let trelloWebhook;
  try {
    const rcWebhookRecord = await RCWebhook.findByPk(rcWebhookUri);
    if (!rcWebhookRecord) {
      res.status(403);
      return;
    }
    trelloWebhook = await TrelloWebhook.findByPk(rcWebhookRecord.trello_webhook_id);
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
    token,
  });
  try {
    const boards = await trello.getBoards();
    const userInfo = await trello.getUserInfo();
    res.json({
      boards,
      userInfo,
      config: trelloWebhook.config || {},
    });
    res.status(200);
  } catch (e) {
    if (e.response && e.response.status === 401) {
      if (trelloWebhook) {
        trelloWebhook.token = '';
        trelloWebhook.trello_webhook_id = '';
        await trelloWebhook.save();
      }
      res.send('Unauthorized.');
      res.status(401);
      return;
    }
    console.error(e);
    res.send('Internal server error.');
    res.status(500);
  }
}

async function createWebhook(req, res) {
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
    const trello = new Trello({
      appKey: process.env.TRELLO_APP_KEY,
      token: trelloWebhook.token,
    });
    const oldBoardId = trelloWebhook.config && trelloWebhook.config.boardId;
    if (oldBoardId !== boardId && trelloWebhook.trello_webhook_id) {
      await trello.deleteWebhook({ id: trelloWebhook.trello_webhook_id });
      trelloWebhook.trello_webhook_id = '';
    }
    trelloWebhook.config = {
      boardId,
      filters: String(filters),
    };
    if (!trelloWebhook.rc_webhook_id) {
      trelloWebhook.rc_webhook_id = rcWebhookUri;
    }
    await trelloWebhook.save();
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
    if (e.response && e.response.status === 401) {
      if (trelloWebhook) {
        trelloWebhook.token = '';
        trelloWebhook.trello_webhook_id = '';
        await trelloWebhook.save();
      }
      res.send('Unauthorized');
      res.status(401);
      return;
    }
    console.error(e);
    res.send('Internal server error');
    res.status(500);
    return;
  }
}

exports.newWebhook = newWebhook;
exports.webhookInfo = webhookInfo;
exports.createWebhook = createWebhook;
