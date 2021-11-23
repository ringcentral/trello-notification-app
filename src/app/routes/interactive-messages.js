const axios = require('axios');
const crypto = require('crypto');
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

async function sendAuthorizeRequestCard(webhookUri, webhookId) {
  await axios.post(webhookUri,
    createAuthTokenRequestCard({
      webhookId,
      authorizeUrl: `${process.env.APP_SERVER}/trello/full-authorize`,
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
    let trelloUserInfo;
    try {
      trelloUserInfo = await trello.getUserInfo();
    } catch (e) {
      if (e.response && e.response.status === 401) {
        await sendMessageCard(
          trelloWebhook.rc_webhook_id,
          `Hi ${body.user.firstName} ${body.user.lastName}, the token is invalid.`,
        );
        res.status(200);
        res.send('ok');
        return;
      }
    }
    if (!trelloUserInfo || !trelloUserInfo.id) {
      res.status(403);
      res.send('Fetch Trello data error.');
      return;
    }
    if (!trelloUser || trelloUserInfo.id !== trelloUser.id) {
      trelloUser = await TrelloUser.findByPk(trelloUserInfo.id);
    }
    if (trelloUser) {
      trelloUser.writeable_token = body.data.token;
      trelloUser.username = trelloUserInfo.username;
      trelloUser.fullName = trelloUserInfo.fullName;
      await trelloUser.save();
    } else {
      trelloUser = await TrelloUser.create({
        id: trelloUserInfo.id,
        username: trelloUserInfo.username,
        fullName: trelloUserInfo.fullName,
        writeable_token: token,
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
  if (!trelloUser || !trelloUser.writeable_token) {
    await sendAuthorizeRequestCard(trelloWebhook.rc_webhook_id, webhookId);
    res.status(200);
    res.send('ok');
    return;
  }
  trello.setToken(trelloUser.writeable_token);
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
    } else if (action === 'commentCard') {
      await trello.addCardComment(body.data.cardId, body.data.comment);
    } else if (action === 'setCardDueDate') {
      await trello.setCardDueDate(body.data.cardId, body.data.dueDate);
    } else if (action === 'addLabel') {
      await trello.setCardLabel(body.data.cardId, body.data.addLabel);
    } else if (action === 'removeLabel') {
      await trello.removeCardLabel(body.data.cardId, body.data.removeLabel);
    }
  } catch (e) {
    if (e.response) {
      if (e.response.status === 401) {
        trelloUser.writeable_token = '';
        await trelloUser.save();
        await sendAuthorizeRequestCard(trelloWebhook.rc_webhook_id, webhookId);
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