const { generate } = require('shortid');
const Bot = require('ringcentral-chatbot-core/dist/models/Bot').default;

const { TrelloWebhook } = require('../models/trello-webhook');
const { TrelloUser } = require('../models/trello-user');
const { RcUser } = require('../models/rc-user');
const { Trello } = require('../lib/Trello');

const botActions = require('../bot/actions');

const {
  sendTextMessage,
  sendAuthorizeRequestCard,
} = require('../lib/messageHelper');

async function notificationInteractiveMessagesHandler(req, res) {
  const body = req.body;
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

function getFiltersFromSubmitData(data) {
  const filters = [];
  if (data.listFilters) {
    filters.push(data.listFilters);
  }
  if (data.cardFilters) {
    filters.push(data.cardFilters);
  }
  if (data.checklistFilters) {
    filters.push(data.checklistFilters);
  }
  return filters.join(',');
}

async function saveBotSubscriptionsAtRcUser(rcUser, trelloWebhook) {
  const existingSubscriptions = rcUser.bot_subscriptions || [];
  const subscriptions = existingSubscriptions.filter(sub => sub.id !== trelloWebhook.id);
  subscriptions.push({
    id: trelloWebhook.id,
    conversation_id: trelloWebhook.conversation_id,
    boardId: trelloWebhook.config.boardId,
  });
  rcUser.bot_subscriptions = subscriptions;
  await rcUser.save();
}

async function removeBotSubscriptionsAtRcUser(rcUser, trelloWebhook) {
  const existingSubscriptions = rcUser.bot_subscriptions || [];
  const subscriptions = existingSubscriptions.filter(sub => sub.id !== trelloWebhook.id);
  rcUser.bot_subscriptions = subscriptions;
  await rcUser.save();
}

const SETUP_ACTIONS = ['setup', 'addSubscription', 'editSubscription', 'removeSubscription', 'subscribe'];

async function botInteractiveMessagesHandler(req, res) {
  const body = req.body;
  const botId = body.data.botId;
  const cardId = req.body.card.id;
  console.log(body);
  try {
    const bot = await Bot.findByPk(botId);
    if (!bot) {
      res.status(404);
      res.send('Params error');
      return;
    }
    const action = body.data.action;
    if (action === 'setup') {
      res.status(200);
      res.send('ok');
      await botActions.sendSetupCard({
        bot,
        group: body.conversation,
        user: {
          id: body.user.extId,
          name: `${body.user.firstName} ${body.user.lastName}`,
        },
      });
      return;
    }
    const rcUser = await RcUser.findByPk(`rcext-${body.user.extId}`);
    let trelloUser;
    if (rcUser) {
      trelloUser = await TrelloUser.findByPk(rcUser.trello_user_id);
    }
    const trello = new Trello({
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
        await trello.setToken(trelloUser.writeable_token);
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
      return;
    }
    if (!rcUser || !trelloUser || !trelloUser.writeable_token) {
      if (SETUP_ACTIONS.indexOf(action) > -1) {
        await botActions.sendAuthCard({
          bot,
          user: { id: body.user.extId },
          conversationId: body.data.conversationId,
          existingCardId: cardId,
          title: `Trello notification setup for "${body.data.conversationName || 'this conversation'}"`,
          nextAction: 'subscribe',
          trello,
        });
        res.status(200);
        res.send('ok');
      } else {
        res.status(200);
        res.send('ok');
        await botActions.sendAuthCardIntoDirectGroup({
          bot,
          user: { id: body.user.extId },
          conversation: body.conversation,
          trello,
        });
      }
      return;
    }
    trello.setToken(trelloUser.writeable_token);
    if (action === 'addSubscription') {
      const boards = await trello.getBoards();
      await botActions.sendSubscribeCard({
        bot,
        conversation: {
          id: body.data.conversationId,
          name: body.data.conversationName,
        },
        trelloData: {
          boards,
        },
        existingCardId: cardId,
      });
      res.status(200);
      res.send('ok');
      return;
    }
    if (action === 'editSubscription') {
      const trelloWebhook = await TrelloWebhook.findByPk(body.data.subscriptionId);
      if (!trelloWebhook) {
        res.status(404);
        res.send('Not found');
        return;
      }
      const boards = await trello.getBoards();
      await botActions.sendSubscribeCard({
        bot,
        conversation: {
          id: trelloWebhook.conversation_id,
          name: body.data.conversationName,
        },
        trelloData: {
          boards,
        },
        existingCardId: cardId,
        subscription: trelloWebhook,
      });
      res.status(200);
      res.send('ok');
      return;
    }
    if (action === 'removeSubscription') {
      const trelloWebhook = await TrelloWebhook.findByPk(body.data.subscriptionId);
      if (!trelloWebhook) {
        res.status(404);
        res.send('Not found');
        return;
      }
      if (trelloWebhook.trello_webhook_id) {
        await trello.deleteWebhook({ id: trelloWebhook.trello_webhook_id });
      }
      await removeBotSubscriptionsAtRcUser(rcUser, trelloWebhook);
      await trelloWebhook.destroy();
      await botActions.sendSubscribeRemovedCard({
        bot,
        boardName: body.data.boardName,
        existingCardId: cardId,
        conversationName: body.data.conversationName,
      });
      res.status(200);
      res.send('ok');
      return;
    }
    if (action === 'subscribe') {
      const subscriptionId = body.data.subscriptionId;
      let trelloWebhook;
      const labels = await trello.getLabels(body.data.boardId);
      if (subscriptionId) {
        trelloWebhook = await TrelloWebhook.findByPk(subscriptionId);
        if (!trelloWebhook) {
          res.status(404);
          res.send('Not found');
          return;
        }
        trelloWebhook.config = {
          boardId: body.data.boardId,
          filters: getFiltersFromSubmitData(body.data),
          labels,
        };
        trelloWebhook.bot_id = bot.id;
        await trelloWebhook.save();
      } else {
        trelloWebhook = await TrelloWebhook.create({
          id: generate(),
          bot_id: bot.id,
          trello_user_id: trelloUser.id,
          conversation_id: body.data.conversationId,
          config: {
            boardId: body.data.boardId,
            filters: getFiltersFromSubmitData(body.data),
            labels,
          },
        });
      }
      res.status(200);
      res.send('ok');
      if (trelloWebhook.trello_webhook_id) {
        await trello.deleteWebhook({ id: trelloWebhook.trello_webhook_id });
        trelloWebhook.trello_webhook_id = '';
        await trelloWebhook.save();
      }
      const webhook = await trello.createWebhook({
        description: 'RingCentral Bot Notifications',
        callbackURL: `${process.env.APP_SERVER}/trello-notify/${trelloWebhook.id}`,
        idModel: body.data.boardId,
        active: true,
      });
      trelloWebhook.trello_webhook_id = webhook.id;
      await trelloWebhook.save();
      await saveBotSubscriptionsAtRcUser(rcUser, trelloWebhook);
      const boards = await trello.getBoards();
      await botActions.sendSubscriptionsCard({
        bot,
        botSubscriptions: rcUser.bot_subscriptions.filter(sub => sub.conversation_id === body.data.conversationId),
        boards,
        conversation: {
          id: body.data.conversationId,
          name: body.data.conversationName,
        },
        existingCardId: cardId,
      });
      return;
    }
    if (action === 'joinCard') {
      const members = await trello.getCardMembers(body.data.cardId);
      if (members.find(member => member.id === trelloUser.id)) {
        await bot.sendMessage(body.conversation.id, {
          text: `Hi ![:Person](${body.user.extId}), you had joined the card.`,
        });
        res.status(200);
        res.send('ok');
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
    res.status(200);
    res.send('ok');
    await botActions.addOperationLogIntoCard({
      bot,
      cardId,
      data: body.data,
      user: body.user,
    });
  } catch (e) {
    console.error(e);
    res.status(500);
    res.send('Internal error');
  }
}

exports.notificationInteractiveMessagesHandler = notificationInteractiveMessagesHandler;
exports.botInteractiveMessagesHandler = botInteractiveMessagesHandler;
