const Bot = require('ringcentral-chatbot-core/dist/models/Bot').default;

const { TrelloWebhook } = require('../models/trello-webhook');
const { TrelloUser } = require('../models/trello-user');
const { RcUser } = require('../models/rc-user');
const { Trello } = require('../lib/Trello');
const { getHashValue } = require('../lib/getHashValue');
const { generateToken } = require('../lib/jwt');
const { DIALOG_ICON_URL } = require('../lib/constants');
const { Analytics } = require('../lib/analytics');

const botActions = require('../bot/actions');

const {
  sendTextMessage,
  sendAuthorizeRequestCard,
} = require('../lib/messageHelper');

async function notificationInteractiveMessagesHandler(req, res) {
  const body = req.body;
  const webhookId = body.data.webhookId;
  if (!webhookId) {
    res.status(400);
    res.send('Params found');
    return;
  }
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
    res.status(200);
    res.send('ok');
  } catch (e) {
    if (e.response) {
      if (e.response.status === 401) {
        trelloUser.writeable_token = '';
        await trelloUser.save();
        await sendAuthorizeRequestCard(trelloWebhook.rc_webhook_id, webhookId);
        res.status(200);
        res.send('ok');
        return;
      } else if (e.response.status === 403) {
        await sendTextMessage(
          trelloWebhook.rc_webhook_id,
          `Hi ${body.user.firstName}, your Trello account doesn't have permission to perform this action.`,
        );
        res.status(200);
        res.send('ok');
        return;
      }
    }
    console.error(e);
    res.status(500);
    res.send('Internal error');
    return;
  }
};

function getSetupDialog(botId, body) {
  const botToken = generateToken({
    uId: body.user.extId,
    bId: botId,
    gId: body.data.conversationId || body.conversation.id,
  }, '24h');
  const trackAccountId = getHashValue(body.user.accountId, process.env.ANALYTICS_SECRET_KEY);
  return {
    type: 'dialog',
    dialog: {
      title: `Trello setup for ${body.data.conversationName || 'this conversation'}`,
      size: 'medium',
      iconURL: DIALOG_ICON_URL,
      iframeURL: `${process.env.APP_SERVER}/bot-setup?token=${botToken}&trackAccountId=${trackAccountId}`,
    }
  };
}

function getAuthDialog(botId, body) {
  const botToken = generateToken({
    uId: body.user.extId,
    bId: botId,
    gId: body.conversation.id,
  }, '24h');
  const trackAccountId = getHashValue(body.user.accountId, process.env.ANALYTICS_SECRET_KEY);
  return {
    type: 'dialog',
    dialog: {
      title: `Trello authorization`,
      size: 'small',
      iconURL: DIALOG_ICON_URL,
      iframeURL: `${process.env.APP_SERVER}/bot-auth-setup?token=${botToken}&trackAccountId=${trackAccountId}`,
    }
  };
}

async function botInteractiveMessagesHandler(req, res) {
  const body = req.body;
  const botId = body.data.botId;
  const cardId = req.body.card.id;
  let trelloUser;
  let bot;
  let trello;
  const analytics = new Analytics({
    mixpanelKey: process.env.MIXPANEL_KEY,
    secretKey: process.env.ANALYTICS_SECRET_KEY,
    userId: botId,
  });
  try {
    bot = await Bot.findByPk(botId);
    if (!bot) {
      res.status(404);
      res.send('Params error');
      return;
    }
    if (bot.token) {
      analytics.setAccountId(bot.token.creator_account_id)
    }
    const action = body.data.action;
    if (action === 'setup') {
      // show dialog for action from old card
      res.status(200);
      res.json(getSetupDialog(botId, body));
      await analytics.trackUserAction('cardSubmitted', body.user.extId, {
        action: 'openSetupDialog',
        chatId: body.conversation.id,
        result: 'success',
      });
      return;
    }
    if (
      action === 'subscribe' ||
      action === 'addSubscription' ||
      action === 'editSubscription' ||
      action === 'removeSubscription'
    ) {
      // update old setup card to new setup card
      await botActions.sendSetupCard({
        bot,
        conversation: {
          id: body.data.conversationId,
          name: body.data.conversationName,
        },
        existingCardId: cardId,
      });
      res.status(200);
      res.send('ok');
      await analytics.trackUserAction('cardSubmitted', body.user.extId, {
        action,
        chatId: body.conversation.id,
        result: 'success',
      });
      return;
    }
    if (action === 'authorize') {
      // show dialog for authorization
      res.status(200);
      res.json(getAuthDialog(botId, body));
      await analytics.trackUserAction('cardSubmitted', body.user.extId, {
        action: 'openAuthDialog',
        chatId: body.conversation.id,
        result: 'success',
      });
      return;
    }
    const rcUser = await RcUser.findByPk(`rcext-${body.user.extId}`);
    if (rcUser) {
      trelloUser = await TrelloUser.findByPk(rcUser.trello_user_id);
    }
    trello = new Trello({
      appKey: process.env.TRELLO_APP_KEY,
      redirectUrl: '',
    });
    if (action === 'unauthorize') {
      if (!trelloUser || !trelloUser.writeable_token) {
        botActions.setMessageCard(
          bot,
          cardId,
          `Hi **${body.user.firstName} ${body.user.lastName}**, You have not authorized Trello yet.`
        );
      } else {
        trello.setToken(trelloUser.writeable_token);
        await trello.revokeToken();
        trelloUser.writeable_token = '';
        await trelloUser.save();
        if (rcUser.bot_subscriptions) {
          await TrelloWebhook.destroy({
            where: {
              id: rcUser.bot_subscriptions.map(sub => sub.id),
            }
          });
          rcUser.bot_subscriptions = null;
          await rcUser.save();
        }
        botActions.setMessageCard(
          bot,
          cardId,
          `Hi **${body.user.firstName} ${body.user.lastName}**, You have unauthorized Trello successfully.`
        );
      }
      res.status(200);
      res.send('ok');
      await analytics.trackUserAction('cardSubmitted', body.user.extId, {
        action: 'unauthorize',
        chatId: body.conversation.id,
        result: 'success',
      });
      return;
    }
    if (!rcUser || !trelloUser || !trelloUser.writeable_token) {
      res.status(200);
      res.json(getAuthDialog(botId, body));
      await analytics.trackUserAction('cardSubmitted', body.user.extId, {
        action,
        result: 'authorizeRequired',
        chatId: body.conversation.id,
      });
      return;
    }
    trello.setToken(trelloUser.writeable_token);
    if (action === 'joinCard') {
      const members = await trello.getCardMembers(body.data.cardId);
      if (members.find(member => member.id === trelloUser.id)) {
        await bot.sendMessage(body.conversation.id, {
          text: `Hi ![:Person](${body.user.extId}), you had joined the card.`,
        });
        res.status(200);
        res.send('ok');
        await analytics.trackUserAction('cardSubmitted', body.user.extId, {
          action,
          result: 'alreadyJoined',
          chatId: body.conversation.id,
        });
        return;
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
    await botActions.addOperationLogIntoCard({
      bot,
      cardId,
      data: body.data,
      user: body.user,
    });
    res.status(200);
    res.send('ok');
    await analytics.trackUserAction('cardSubmitted', body.user.extId, {
      action,
      result: 'success',
      chatId: body.conversation.id,
    });
  } catch (e) {
    if (
      e.response &&
      e.response.status === 401 &&
      trelloUser &&
      trello &&
      e.response.config.url.indexOf('api.trello.com') > -1
    ) {
      trelloUser.writeable_token = '';
      await trelloUser.save();
      res.status(200);
      res.json(getAuthDialog(botId, body));
      analytics.trackUserAction('cardSubmitted', body.user.extId, {
        action: body.data.action,
        result: 'authorizeRequired',
        chatId: body.conversation.id,
      });
      return;
    }
    console.error(e);
    res.status(500);
    res.send('Internal error');
  }
}

exports.notificationInteractiveMessagesHandler = notificationInteractiveMessagesHandler;
exports.botInteractiveMessagesHandler = botInteractiveMessagesHandler;
