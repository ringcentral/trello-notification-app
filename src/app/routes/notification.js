const crypto = require('crypto');
const Bot = require('ringcentral-chatbot-core/dist/models/Bot').default;

const { TrelloWebhook } = require('../models/trello-webhook');
const { TrelloUser } = require('../models/trello-user');
const { getFilterId } = require('../lib/filter');
const { Trello } = require('../lib/Trello');
const {
  getAdaptiveCardFromTrelloMessage,
  CARD_TYPES,
} = require('../lib/formatAdaptiveCardMessage');

const {
  notificationInteractiveMessagesHandler,
  botInteractiveMessagesHandler,
} = require('../handlers/interactiveMessages');

const {
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
    const isBotNotification = !!trelloWebhook.bot_id;
    const trello = new Trello({
      appKey: process.env.TRELLO_APP_KEY,
      redirectUrl: `${process.env.APP_SERVER}/trello/oauth-callback`,
    });
    let trelloUser
    if (shouldUpdateBoardLabels(req.body.action.type)) {
      trelloUser = await TrelloUser.findByPk(trelloWebhook.trello_user_id);
      if (isBotNotification) {
        trello.setToken(trelloUser.writeable_token);
      } else {
        trello.setToken(trelloUser.token);
      }
      await updateBoardLabels(trello, trelloWebhook);
    }
    const filterId = getFilterId(req.body, trelloWebhook.config.filters);
    if (filterId) {
      let card = {};
      if (shouldFetchCard(req.body.action.type)) {
        if (!trelloUser) {
          trelloUser = await TrelloUser.findByPk(trelloWebhook.trello_user_id);
        }
        if (isBotNotification) {
          trello.setToken(trelloUser.writeable_token);
        } else {
          trello.setToken(trelloUser.token);
        }
        card = await trello.getCard(req.body.action.data.card.id);
        if (!trelloWebhook.config.labels) {
          await updateBoardLabels(trello, trelloWebhook);
        }
      }
      const adaptiveCard = getAdaptiveCardFromTrelloMessage({
        trelloMessage: req.body,
        webhookId: trelloWebhookId,
        botId: trelloWebhook.bot_id,
        trelloCard: card,
        boardLabels: trelloWebhook.config.labels || [],
      });
      if (isBotNotification) {
        const bot = await Bot.findByPk(trelloWebhook.bot_id);
        if (!bot) {
          res.status(404);
          res.send('Not found');
          return;
        }
        await bot.sendAdaptiveCard(trelloWebhook.conversation_id, adaptiveCard);
      } else {
        await sendAdaptiveCardMessage(trelloWebhook.rc_webhook_id, adaptiveCard);
      }
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
  const body = req.body;
  let SHARED_SECRET = process.env.INTERACTIVE_MESSAGES_SHARED_SECRET;
  const isForBot = body && body.data && body.data.messageType && body.data.messageType === 'Bot';
  if (isForBot) {
    SHARED_SECRET = process.env.RINGCENTRAL_CHATBOT_INTERACTIVE_MESSAGES_SHARED_SECRET;
  }
  if (SHARED_SECRET) {
    const signature = req.get('X-Glip-Signature', 'sha1=');
    const encryptedBody =
      crypto.createHmac('sha1', SHARED_SECRET).update(JSON.stringify(req.body)).digest('hex');
    if (encryptedBody !== signature) {
      res.status(401).send();
      return;
    }
  }
  // console.log(JSON.stringify(body, null, 2));
  if (!body.data || !body.user) {
    res.status(400);
    res.send('Params error');
    return;
  }
  if (isForBot) {
    if (!body.card || !body.conversation) {
      res.status(400);
      res.send('Params error');
      return;
    }
    return botInteractiveMessagesHandler(req, res);
  }
  return notificationInteractiveMessagesHandler(req, res);
};

exports.notification = notification;
exports.notificationHead = head;
exports.interactiveMessage = interactiveMessage;