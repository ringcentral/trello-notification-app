const axios = require('axios');
const { Trello } = require('../lib/Trello');

const { TrelloWebhook } = require('../models/trello-webhook');
const { RcUser } = require('../models/rc-user');
const { TrelloUser } = require('../models/trello-user');
const {
  createAuthTokenRequestCard, 
  createMessageCard,
} = require('../lib/formatAdaptiveCardMessage');

async function sendMessageCard(webhookUri, message) {
  await axios.post(webhookUri, createMessageCard({
    message,
  }), {
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json'
    }
  });
}

async function sendAuthorizeRequestCard(webhookUri) {
  await axios.post(webhookUri,
    createAuthTokenRequestCard({
      webhookId,
      authorizeUrl: `${process.env.APP_SERVER}/trello/authorize`,
    }),
    {
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json'
      }
    }
  );
}

async function interactiveMessage(req, res) {
  const SHARED_SECRET = process.env.INTERACTIVE_MESSAGES_SHARED_SECRET;
  if (SHARED_SECRET) {
    const signature = req.get('X-Glip-Signature', 'sha1=');
    const encryptedBody =
      crypto.createHmac('sha1', SHARED_SECRET).update(JSON.stringify(req.body)).digest('hex');
    if (encryptedBody !== signature) {
      res.status(401).send();
      return;
    }
  }
  const body = req.body;
  // console.log(JSON.stringify(body, null, 2));
  if (!body.data || !body.user) {
    res.status(400);
    res.send('Params error');
    return;
  }
  const webhookId = body.data.webhookId;
  const trelloWebhook = await TrelloWebhook.findByPk(webhookId);
  if (!trelloWebhook) {
    res.status(404);
    res.send('Not found');
    return;
  }
  const rcUserId = `${body.user.id}`;
  let rcUser = await RcUser.findByPk(rcUserId);
  let trelloUser;
  if (rcUser) {
    trelloUser = await TrelloUser.findByPk(rcUser.trello_user_id);
  }
  const action = body.data.action;
  const trello = new Trello({
    appKey: process.env.TRELLO_APP_KEY,
    redirectUrl: `${process.env.APP_SERVER}/trello/oauth-callback`,
  });
  if (action === 'authorize') {
    const token = body.data.token;
    trello.setToken(token);
    const trelloUserInfo = await trello.getUserInfo();
    if (!trelloUserInfo || !trelloUserInfo.id) {
      res.status(403);
      res.send('Trello token invalid.');
      return;
    }
    if (!trelloUser || trelloUserInfo.id !== trelloUser.id) {
      trelloUser = await TrelloUser.findByPk(trelloUserInfo.id);
    }
    if (trelloUser) {
      trelloUser.token = body.data.token;
      trelloUser.username = trelloUserInfo.username;
      trelloUser.username = trelloUserInfo.username;
      await trelloUser.save();
    } else {
      trelloUser = await TrelloUser.create({
        id: trelloUserInfo.id,
        username: trelloUserInfo.username,
        fullName: trelloUserInfo.fullName,
        token,
      });
    }
    if (rcUser) {
      rcUser.trello_user_id = trelloUser.id;
      await rcUser.save();
    } else {
      rcUser = await RcUser.create({
        id: rcUserId,
        trello_user_id: trelloUser.id
      });
    }
    await sendMessageCard(
      trelloWebhook.rc_webhook_id,
      `Hi ${body.user.firstName} ${body.user.lastName}, you have authorized Trello successfully. Please click previous action button again to execute that action.`,
    );
    res.status(200);
    res.send('ok');
    return;
  }
  if (!trelloUser || !trelloUser.token) {
    await sendAuthorizeRequestCard(trelloWebhook.rc_webhook_id);
    res.status(200);
    res.send('ok');
    return;
  }
  trello.setToken(trelloUser.token);
  try {
    if (action === 'joinCard') {
      const members = await trello.getCardMembers(body.data.cardId);
      if (members.find(member => member.id === trelloUser.id)) {
        await sendMessageCard(
          trelloWebhook.rc_webhook_id,
          `Hi ${body.user.firstName}, you had joined the card.`,
        );
      } else {
        await trello.joinCard(body.data.cardId, trelloUser.id);
      }
    }
  } catch (e) {
    if (e.response) {
      console.error(e.response);
      if (e.response.status === 401) {
        trelloUser.token = '';
        await trelloUser.save();
        await sendAuthorizeRequestCard(trelloWebhook.rc_webhook_id);
      } else if (e.response.status === 403) {
        await sendMessageCard(
          trelloWebhook.rc_webhook_id,
          `Hi ${body.user.firstName}, your Trello account doesn't have permission to perform this action.`,
        );
      }
    } else {
      console.error(e);
    }
  }
  res.status(200);
  res.send('ok');
};

exports.interactiveMessage = interactiveMessage