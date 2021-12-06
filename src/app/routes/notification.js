const crypto = require('crypto');

const { TrelloWebhook } = require('../models/trello-webhook');
const { TrelloUser } = require('../models/trello-user');
const { RcUser } = require('../models/rc-user');
const { getFilterId } = require('../lib/filter');
const { Trello } = require('../lib/Trello');
const {
  getAdaptiveCardFromTrelloMessage,
  CARD_TYPES,
} = require('../lib/formatAdaptiveCardMessage');

const {
  sendTextMessage,
  sendAuthorizeRequestCard,
  sendAdaptiveCardMessage,
} = require('../lib/messageHelper');

async function updateBoardLabels(trello, trelloWebhook) {
  const labels = await trello.getLabels(trelloWebhook.config.boardId);
  trelloWebhook.config = {
    ...trelloWebhook.config,
    labels,
  };
  await trelloWebhook.save();
}

function shouldUpdateBoardLabels(actionType) {
  return ['createLabel', 'updateLabel', 'deleteLabel'].indexOf(actionType) > -1;
}

function shouldFetchCard(actionType) {
  return CARD_TYPES.indexOf(actionType) > -1;
}

async function notification(req, res) {
  const trelloWebhookId = req.params.id;
  // console.log(JSON.stringify(req.body, null, 2));
  try {
    const trelloWebhook = await TrelloWebhook.findByPk(trelloWebhookId);
    if (!trelloWebhook) {
      res.status(404);
      res.send('Not found');
      return;
    }
    const trello = new Trello({
      appKey: process.env.TRELLO_APP_KEY,
      redirectUrl: `${process.env.APP_SERVER}/trello/oauth-callback`,
    });
    let trelloUser
    if (shouldUpdateBoardLabels(req.body.action.type)) {
      trelloUser = await TrelloUser.findByPk(trelloWebhook.trello_user_id);
      trello.setToken(trelloUser.token);
      await updateBoardLabels(trello, trelloWebhook);
    }
    const filterId = getFilterId(req.body, trelloWebhook.config.filters);
    if (filterId) {
      let card = {};
      if (shouldFetchCard(req.body.action.type)) {
        if (!trelloUser) {
          trelloUser = await TrelloUser.findByPk(trelloWebhook.trello_user_id);
        }
        trello.setToken(trelloUser.token);
        card = await trello.getCard(req.body.action.data.card.id);
        if (!trelloWebhook.config.labels) {
          await updateBoardLabels(trello, trelloWebhook);
        }
      }
      const adaptiveCard = getAdaptiveCardFromTrelloMessage(
        req.body,
        trelloWebhookId,
        {
          trelloCard: card,
          boardLabels: trelloWebhook.config.labels || [],
        }
      );
      await sendAdaptiveCardMessage(trelloWebhook.rc_webhook_id, adaptiveCard);
    }
  } catch (e) {
    console.error(e)
  }
  res.status(200);
  res.json({
    result: 'OK',
  });
}

function head(req, res) {
  res.status(200);
  res.json({
    result: 'OK',
  });
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
        await sendTextMessage(
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
    await sendTextMessage(
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
        await sendTextMessage(
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
        await sendTextMessage(
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

exports.notification = notification;
exports.notificationHead = head;
exports.interactiveMessage = interactiveMessage;
