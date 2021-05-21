const { Trello } = require('../lib/Trello');
const { decodeToken } = require('../lib/jwt');

const { RCWebhook } = require('../models/rc-webhook');
const { TrelloWebhook } = require('../models/trello-webhook');
const { TrelloUser } = require('../models/trello-user');

async function newWebhook(req, res) {
  const rcWebhookUri = req.query.webhook;
  if (!rcWebhookUri || rcWebhookUri.indexOf('https://') !==0) {
    res.send('Webhook uri is required.');
    res.status(404);
    return;
  }
  res.render('new', {
    assetsPath: process.env.ASSETS_PATH,
    data: {
      rcWebhookUri,
      authorizationUri: `${process.env.APP_SERVER}/trello/authorize`,
      authorizationTokenUri: `${process.env.APP_SERVER}/trello/token`,
      authorizationRevokeUri: `${process.env.APP_SERVER}/trello/revoke`,
      webhookInfoUri: `${process.env.APP_SERVER}/webhooks/info`,
      webhookCreationUri: `${process.env.APP_SERVER}/webhooks`,
    },
  });
}

async function webhookInfo(req, res) {
  const jwtToken = req.query.token;
  const rcWebhookUri = req.query.rcWebhook;
  if (!jwtToken || !rcWebhookUri) {
    res.send('Error params');
    res.status(403);
    return;
  }
  const decodedToken = decodeToken(jwtToken);
  if (!decodedToken) {
    res.send('Token invalid.');
    res.status(401);
    return;
  }
  const userId = decodedToken.id;
  let trelloUser;
  try {
    trelloUser = await TrelloUser.findByPk(userId);
    if (!trelloUser || !trelloUser.token) {
      res.send('Unauthorized');
      res.status(401);
      return;
    }
    let config = {};
    const rcWebhookRecord = await RCWebhook.findByPk(rcWebhookUri);
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
    res.json({
      boards,
      userInfo: {
        fullName: userInfo && userInfo.fullName,
      },
      config,
    });
    res.status(200);
  } catch (e) {
    if (e.response && e.response.status === 401) {
      if (trelloUser) {
        trelloUser.token = '';
        await trelloUser.save();
      }
      res.send('Unauthorized.');
      res.status(401);
      return;
    }
  }
}

async function createWebhook(req, res) {
  const jwtToken = req.body.token;
  const rcWebhookUri = req.body.rcWebhook;
  const boardId = req.body.boardId;
  const filters = req.body.filters;

  if (!jwtToken || !rcWebhookUri || !boardId || !filters) {
    res.send('Params invalid.');
    res.status(403);
    return;
  }

  const decodedToken = decodeToken(jwtToken);
  if (!decodedToken) {
    res.send('Token invalid');
    res.status(401);
    return;
  }
  const userId = decodedToken.id;
  let trelloUser;
  try {
    trelloUser = await TrelloUser.findByPk(userId);
    if (!trelloUser || !trelloUser.token) {
      res.send('Session expired');
      res.status(401);
      return
    }
  } catch (e) {
    res.send('Internal error');
    res.status(500);
    return;
  }

  let rcWebhookRecord;
  let trelloWebhook;
  try {
    rcWebhookRecord = await RCWebhook.findByPk(rcWebhookUri);
    if (rcWebhookRecord) {
      trelloWebhook = await TrelloWebhook.findByPk(rcWebhookRecord.trello_webhook_id)
    } else {
      rcWebhookRecord = await RCWebhook.create({
        id: rcWebhookUri,
      });
    }
    if (!trelloWebhook) {
      trelloWebhook = await await TrelloWebhook.create({
        id: rcWebhookRecord.trello_webhook_id,
        rc_webhook_id: rcWebhookUri,
        trello_user_id: userId,
        config: {
          boardId,
          filters: String(filters),
        },
      });
    } else {
      trelloWebhook.rc_webhook_id = rcWebhookUri;
      trelloWebhook.trello_user_id = userId;
      trelloWebhook.config = {
        boardId,
        filters: String(filters),
      };
      await trelloWebhook.save();
    }
    const trello = new Trello({
      appKey: process.env.TRELLO_APP_KEY,
      token: trelloUser.token,
    });
    if (trelloWebhook.trello_webhook_id) {
      await trello.deleteWebhook({ id: trelloWebhook.trello_webhook_id });
      trelloWebhook.trello_webhook_id = '';
    }
    await trelloWebhook.save();
    const webhook = await trello.createWebhook({
      id: trelloWebhook.trello_webhook_id,
      description: 'RingCentral Notifications',
      callbackURL: `${process.env.APP_SERVER}/trello-notify/${trelloWebhook.id}`,
      idModel: boardId,
      active: true,
    });
    trelloWebhook.trello_webhook_id = webhook.id;
    await trelloWebhook.save();
    res.json({
      result: 'OK',
    });
    res.status(200);
  } catch (e) {
    if (e.response && e.response.status === 401) {
      trelloUser.token = '';
      await trelloUser.save();
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
