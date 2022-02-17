const { getAdaptiveCardFromTemplate } = require('../lib/formatAdaptiveCardMessage');
const { findItemInAdaptiveCard } = require('../lib/findItemInAdaptiveCard');
const {
  getListFiltersFromFilters,
  getCardFiltersFromFilters,
  getChecklistFiltersFromFilters,
} = require('../lib/filter');

const helpTemplate = require('../adaptiveCards/help.json');
const messageTemplate = require('../adaptiveCards/message.json');
const authTemplate = require('../adaptiveCards/authInCard.json');
const setupTemplate = require('../adaptiveCards/setup.json');
const subscriptionsTemplate = require('../adaptiveCards/subscriptions.json');
const subscriptionRemovedTemplate = require('../adaptiveCards/subscriptionRemoved.json');

const { Trello } = require('../lib/Trello');
const { generateToken } = require('../lib/jwt');

const { TrelloUser } = require('../models/trello-user');
const { RcUser } = require('../models/rc-user');

async function sendHelpCard(bot, group) {
  const joinWelcomeCard = getAdaptiveCardFromTemplate(helpTemplate, {
    botId: bot.id,
    conversationName: group.name || '',
  });
  await bot.sendAdaptiveCard(groupId, joinWelcomeCard);
}

async function sendMessageCard(bot, groupId, message) {
  const messageCard = getAdaptiveCardFromTemplate(messageTemplate, {
    botId: bot.id,
    message,
  });
  await bot.sendAdaptiveCard(groupId, messageCard);
}

async function createDirectGroup(bot, user) {
  const directGroupRep = await bot.rc.post('/restapi/v1.0/glip/conversations', {
    members: [{ id: user.id }, { id: bot.id }],
  });
  return directGroupRep.data;
}

async function getTrelloData(trello, rcUser) {
  if (!rcUser) {
    return null;
  }
  const trelloUser = await TrelloUser.findByPk(rcUser.trello_user_id);
  if (!trelloUser && !trelloUser.writeable_token) {
    return null;
  };
  trello.setToken(trelloUser.writeable_token);
  try {
    const boards = await trello.getBoards();
    return {
      boards,
    };
  } catch (e) {
    if (e.response && e.response.status === 401) {
      trelloUser.writeable_token = '';
      await trelloUser.save();
      return null;
    }
  }
}

async function getSetupGroup(bot, group) {
  if (group.members) {
    return group;
  }
  const rcGroup = await bot.getGroup(group.id);
  return rcGroup;
}

async function sendAuthCard({
  bot,
  user,
  directGroup,
  conversationId,
  existingCardId,
  title,
  trello,
}) {
  let cardId = existingCardId;
  if (!cardId) {
    const authCard = getAdaptiveCardFromTemplate(authTemplate, {
      title,
      authorizeUrl: '',
    });
    const rcCard = await bot.sendAdaptiveCard(directGroup.id, authCard);
    cardId = rcCard.id;
  }
  const botToken = generateToken({
    uId: user.id,
    bId: bot.id,
    cId: cardId,
    gId: conversationId,
  });
  trello.setRedirectUrl(`${process.env.RINGCENTRAL_CHATBOT_SERVER}/trello/bot-oauth-callback/${botToken}`);
  const newAuthCard = getAdaptiveCardFromTemplate(authTemplate, {
    title,
    authorizeUrl: trello.authorizationUrl({ scope: 'read,write' }),
  });
  const authButtonGeneratingItem = findItemInAdaptiveCard(newAuthCard, 'authButtonGenerating');
  authButtonGeneratingItem.isVisible = false;
  const authActionSetItem = findItemInAdaptiveCard(newAuthCard, 'authActionSet');
  delete authActionSetItem.isVisible;
  await bot.updateAdaptiveCard(cardId, newAuthCard);
}

async function sendSubscribeCard({
  bot,
  conversation,
  trelloData,
  directGroup,
  existingCardId,
  subscription,
}) {
  const boards = trelloData.boards;
  const config = subscription && subscription.config;
  const setupCard = getAdaptiveCardFromTemplate(setupTemplate, {
    botId: bot.id,
    title: `Trello setup for "${conversation.name || 'this conversation'}"`,
    conversationId: conversation.id,
    conversationName: conversation.name,
    subscriptionId: (subscription && subscription.id) || '',
    boardId: config && config.boardId || (boards[0] && boards[0].id) || '',
    boards: boards.map(board => ({ name: board.name, id: board.id })),
    listFilters: getListFiltersFromFilters(config && config.filters),
    cardFilters: getCardFiltersFromFilters(config && config.filters),
    checklistFilters: getChecklistFiltersFromFilters(config && config.filters),
  });
  if (existingCardId) {
    await bot.updateAdaptiveCard(existingCardId, setupCard);
    return;
  }
  await bot.sendAdaptiveCard(directGroup.id, setupCard);
};

async function sendSetupCard({ bot, group, user }) {
  const setupGroup = await getSetupGroup(bot, group);
  if (setupGroup.type === 'Group' && setupGroup.members.length > 2) {
    await bot.sendMessage(group.id, {
      text: `Hi ![:Person](${user.id}), we only support to connect Trello for **Team** conversation now.`,
    });
    return;
  }
  const directGroup = await createDirectGroup(bot, user);
  const trello = new Trello({
    appKey: process.env.TRELLO_APP_KEY,
    redirectUrl: '',
  });
  const rcUser = await RcUser.findByPk(`rcext-${user.id}`);
  const trelloData = await getTrelloData(trello, rcUser);
  if (!trelloData) {
    await sendAuthCard({
      bot,
      user,
      directGroup,
      conversationId: group.id,
      trello,
      title: `Trello setup for "${setupGroup.name || 'this conversation'}"`,
    });
    await bot.sendMessage(group.id, {
      text: `Hi ![:Person](${user.id}), I just sent you a **Private** message, please follow that to connect Trello with this conversation.`,
    });
    return;
  }
  const existingSubscriptions = rcUser.bot_subscriptions && rcUser.bot_subscriptions.filter(sub => sub.conversation_id === group.id);
  if (existingSubscriptions && existingSubscriptions.length > 0) {
    await sendSubscriptionsCard({
      bot,
      botSubscriptions: existingSubscriptions,
      boards: trelloData.boards,
      conversation: {
        id: setupGroup.id,
        name: setupGroup.name,
      },
      directGroup,
    });
  } else {
    await sendSubscribeCard({
      bot,
      title: `Trello setup for "${setupGroup.name || 'this conversation'}"`,
      conversation: {
        id: setupGroup.id,
        name: setupGroup.name,
      },
      trelloData,
      directGroup,
    });
  }
  await bot.sendMessage(group.id, {
    text: `Hi ![:Person](${user.id}), I just sent you a **Private** message, please follow that to connect Trello with this conversation.`,
  });
}

async function getAdaptiveCard(bot, cardId) {
  const rcCardRes = await bot.rc.get(`/restapi/v1.0/glip/adaptive-cards/${cardId}`);
  const rcCard = rcCardRes.data;
  return {
    $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
    type: 'AdaptiveCard',
    version: '1.3',
    body: rcCard.body,
    actions: rcCard.actions,
    fallbackText: rcCard.fallbackText,
  };
}

async function sendSubscriptionsCard({
  bot,
  botSubscriptions,
  boards,
  conversation,
  directGroup,
  existingCardId,
}) {
  const subscriptions = botSubscriptions.map((botSubscription) => {
    const board = boards.find(board => board.id === botSubscription.boardId);
    return {
      id: botSubscription.id,
      boardName: board && board.name,
    };
  });
  const subscriptionsCard = getAdaptiveCardFromTemplate(subscriptionsTemplate, {
    title: `Trello setup for "${conversation.name || 'this conversation'}"`,
    subscriptions,
    botId: bot.id,
    conversationId: conversation.id,
    conversationName: conversation.name,
  });
  if (existingCardId) {
    await bot.updateAdaptiveCard(existingCardId, subscriptionsCard);
    return;
  }
  await bot.sendAdaptiveCard(directGroup.id, subscriptionsCard);
}

async function sendSubscribeRemovedCard({
  bot,
  existingCardId,
  boardName,
  conversationName,
}) {
  const card = getAdaptiveCardFromTemplate(subscriptionRemovedTemplate, {
    boardName,
    title: `Trello setup for "${conversationName || 'this conversation'}"`,
  });
  await bot.updateAdaptiveCard(existingCardId, card);
}

exports.sendHelpCard = sendHelpCard;
exports.sendMessageCard = sendMessageCard;
exports.sendSetupCard = sendSetupCard;
exports.getAdaptiveCard = getAdaptiveCard;
exports.sendAuthCard = sendAuthCard;
exports.sendSubscriptionsCard = sendSubscriptionsCard;
exports.sendSubscribeCard = sendSubscribeCard;
exports.sendSubscribeRemovedCard = sendSubscribeRemovedCard;
