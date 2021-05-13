const { Trello } = require('../lib/Trello');
const { RCWebhook } = require('../models/rc-webhook');
const { TrelloWebhook } = require('../models/trello-webhook');

async function authorize(req, res) {
  const trello = new Trello({
    appKey: process.env.TRELLO_APP_KEY,
    redirectUrl: `${process.env.APP_SERVER}/trello/oauth-callback`,
  });
  res.redirect(trello.authorizationUrl());
};

function oauthCallback (req, res) {
  res.render('oauth-callback');
};

async function saveToken(req, res) {
  const token = req.body.token;
  const rcWebhookUri = req.body.rcWebhook;
  if (!token || !rcWebhookUri) {
    res.send('Params error');
    res.status(403);
    return;
  }
  try {
    const trello = new Trello({
      appKey: process.env.TRELLO_APP_KEY,
      token,
    });
    const userInfo = await trello.getUserInfo();
    if (!userInfo || !userInfo.id) {
      res.send('Token invalid.');
      res.status(403);
      return;
    }
    let trelloWebhook;
    const rcWebhookRecord = await RCWebhook.findByPk(rcWebhookUri);
    if (rcWebhookRecord) {
      trelloWebhook = await TrelloWebhook.findByPk(rcWebhookRecord.trello_webhook_id)
    } else {
      rcWebhookRecord = await RCWebhook.create({
        id: rcWebhookUri,
      });
    }
    if (trelloWebhook) {
      trelloWebhook.trello_user_id = userInfo.id;
      trelloWebhook.token = token;
      trelloWebhook.rc_webhook_id = rcWebhookUri;
      trelloWebhook.trello_webhook_id = '';
      await trelloWebhook.save();
    } else {
      trelloWebhook = await TrelloWebhook.create({
        id: rcWebhookRecord.trello_webhook_id,
        token,
        rc_webhook_id: rcWebhookUri,
        trello_user_id: userInfo.id,
      });
    }
    res.send('ok');
  } catch (e) {
    console.error(e);
    res.send('Internal error.');
    res.status(500);
  }
}

async function revokeToken(req, res) {
  const rcWebhookUri = req.body.rcWebhook;
  try {
    const rcWebhookRecord = await RCWebhook.findByPk(rcWebhookUri);
    if (!rcWebhookRecord) {
      res.send('Not found');
      res.status(404);
      return;
    }
    const trelloWebhook = await TrelloWebhook.findByPk(rcWebhookRecord.trello_webhook_id);
    if (trelloWebhook && trelloWebhook.token) {
      const trello = new Trello({
        appKey: process.env.TRELLO_APP_KEY,
        token: trelloWebhook.token,
      });
      await trello.revokeToken();
      trelloWebhook.token = '';
      trelloWebhook.trello_webhook_id = '';
      await trelloWebhook.save();
    }
    res.send('ok');
    res.status(200);
  } catch (e) {
    console.error(e);
    res.send('internal error');
    res.status(500);
  }
}

exports.authorize = authorize;
exports.revokeToken = revokeToken;
exports.oauthCallback = oauthCallback;
exports.saveToken = saveToken;
