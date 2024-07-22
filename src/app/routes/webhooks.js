const { Trello } = require('../lib/Trello');
const { decodeToken } = require('../lib/jwt');

const { RCWebhook } = require('../models/rc-webhook');
const { TrelloWebhook } = require('../models/trello-webhook');
const { TrelloUser } = require('../models/trello-user');
const { getRCWebhookId } = require('../lib/getRCWebhookId');
const { IFRAME_HOST_DOMAINS } = require('../lib/constants');
const { errorLogger } = require('../lib/logger');

async function newWebhook(req, res) {
  const rcWebhookUri = req.query.webhook;
  if (!rcWebhookUri || (
    rcWebhookUri.indexOf('https://') !== 0 &&
    rcWebhookUri.indexOf('http://') !== 0
  )) {
    res.status(404);
    res.send('Webhook uri is required.');
    return;
  }
  res.set('Content-Security-Policy', `frame-ancestors 'self' ${IFRAME_HOST_DOMAINS};`);
  res.render('new', {
    assetsPath: process.env.ASSETS_PATH,
    data: {
      rcWebhookUri,
      authorizationUri: `${process.env.APP_SERVER}/trello/authorize`,
      authorizationTokenUri: `${process.env.APP_SERVER}/trello/token`,
      authorizationRevokeUri: `${process.env.APP_SERVER}/trello/revoke`,
      webhookInfoUri: `${process.env.APP_SERVER}/webhooks/info`,
      webhookCreationUri: `${process.env.APP_SERVER}/webhooks`,
      mixpanelKey: process.env.MIXPANEL_KEY,
    },
  });
}

async function webhookInfo(req, res) {
  const jwtToken = req.headers['x-access-token'];
  const rcWebhookUri = req.query.rcWebhook;
  const rcWebhookId = getRCWebhookId(rcWebhookUri);
  if (!jwtToken || !rcWebhookId) {
    res.status(403);
    res.send('Error params');
    return;
  }
  const decodedToken = decodeToken(jwtToken);
  if (!decodedToken) {
    res.status(401);
    res.send('Token invalid.');
    return;
  }
  const userId = decodedToken.id;
  let trelloUser;
  try {
    trelloUser = await TrelloUser.findByPk(userId);
    if (!trelloUser || !trelloUser.token) {
      res.status(401);
      res.send('Unauthorized');
      return;
    }
    let config = {};
    const rcWebhookRecord = await RCWebhook.findByPk(rcWebhookId);
    if (rcWebhookRecord) {
      const trelloWebhook = await TrelloWebhook.findByPk(rcWebhookRecord.trello_webhook_id);
      if (trelloWebhook) {
        config = trelloWebhook.config || {};
      }
    }
    const trello = new Trello({
      appKey: process.env.TRELLO_APP_KEY,
      redirectUrl: `${process.env.APP_SERVER}/trello/oauth-callback`,
      token: trelloUser.token,
    });
    const boards = await trello.getBoards();
    const userInfo = await trello.getUserInfo();
    res.status(200);
    res.json({
      boards,
      userInfo: {
        fullName: userInfo && userInfo.fullName,
      },
      config,
    });
  } catch (e) {
    if (e.response && e.response.status === 401) {
      if (trelloUser) {
        trelloUser.token = '';
        trelloUser.username = '';
        trelloUser.fullName = '';
        await trelloUser.save();
      }
      res.status(401);
      res.send('Unauthorized.');
      return;
    }
    errorLogger(e);
    res.status(500);
    res.send('Internal error');
  }
}

async function createWebhook(req, res) {
  const jwtToken = req.body.token;
  const rcWebhookUri = req.body.rcWebhook;
  const rcWebhookId = getRCWebhookId(rcWebhookUri);
  const boardId = req.body.boardId;
  const filters = req.body.filters;

  if (!jwtToken || !rcWebhookId || !boardId || !filters) {
    res.status(403);
    res.send('Params invalid.');
    return;
  }

  const decodedToken = decodeToken(jwtToken);
  if (!decodedToken) {
    res.status(401);
    res.send('Token invalid');
    return;
  }
  const userId = decodedToken.id;
  let trelloUser;
  try {
    trelloUser = await TrelloUser.findByPk(userId);
    if (!trelloUser || !trelloUser.token) {
      res.status(401);
      res.send('Session expired');
      return
    }
  } catch (e) {
    res.status(500);
    res.send('Internal error');
    return;
  }

  let rcWebhookRecord;
  let trelloWebhook;
  try {
    const trello = new Trello({
      appKey: process.env.TRELLO_APP_KEY,
      token: trelloUser.token,
    });
    const labels = await trello.getLabels(boardId);
    rcWebhookRecord = await RCWebhook.findByPk(rcWebhookId);
    if (rcWebhookRecord) {
      trelloWebhook = await TrelloWebhook.findByPk(rcWebhookRecord.trello_webhook_id)
    } else {
      rcWebhookRecord = await RCWebhook.create({
        id: rcWebhookId,
      });
    }
    if (!trelloWebhook) {
      trelloWebhook = await TrelloWebhook.create({
        id: rcWebhookRecord.trello_webhook_id,
        rc_webhook_id: rcWebhookUri,
        trello_user_id: userId,
        config: {
          boardId,
          filters: String(filters),
          labels,
        },
      });
    } else {
      trelloWebhook.rc_webhook_id = rcWebhookUri;
      trelloWebhook.trello_user_id = userId;
      trelloWebhook.config = {
        boardId,
        filters: String(filters),
        labels,
      };
      await trelloWebhook.save();
    }
    if (trelloWebhook.trello_webhook_id) {
      await trello.deleteWebhook({ id: trelloWebhook.trello_webhook_id });
      trelloWebhook.trello_webhook_id = '';
    }
    await trelloWebhook.save();
    const webhook = await trello.createWebhook({
      description: 'RingCentral Notifications',
      callbackURL: `${process.env.APP_SERVER}/trello-notify/${trelloWebhook.id}`,
      idModel: boardId,
      active: true,
    });
    trelloWebhook.trello_webhook_id = webhook.id;
    await trelloWebhook.save();
    res.status(200);
    res.json({
      result: 'OK',
    });
  } catch (e) {
    if (e.response && e.response.status === 401) {
      trelloUser.token = '';
      trelloUser.username = '';
      trelloUser.fullName = '';
      await trelloUser.save();
      res.status(401);
      res.send('Unauthorized');
      return;
    }
    errorLogger(e);
    res.status(500);
    res.send('Internal server error');
    return;
  }
}

exports.newWebhook = newWebhook;
exports.webhookInfo = webhookInfo;
exports.createWebhook = createWebhook;
