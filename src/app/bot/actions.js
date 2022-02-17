const { getAdaptiveCardFromTemplate } = require('../lib/formatAdaptiveCardMessage');
const { findItemInAdaptiveCard } = require('../lib/findItemInAdaptiveCard');

const helpTemplate = require('../adaptiveCards/help.json');
const messageTemplate = require('../adaptiveCards/message.json');
const authTemplate = require('../adaptiveCards/authInCard.json');
const setupTemplate = require('../adaptiveCards/setup.json');
const subscriptionsTemplate = require('../adaptiveCards/subscriptions.json');

const { Trello } = require('../lib/Trello');
const { generateToken } = require('../lib/jwt');

const { TrelloUser } = require('../models/trello-user');
const { RcUser } = require('../models/rc-user');

async function sendHelpCard(bot, groupId) {
  const joinWelcomeCard = getAdaptiveCardFromTemplate(helpTemplate, {
    botId: bot.id,
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
  conversation,
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
    gId: conversation.id,
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

async function sendNewSubscriptionCard({
  bot,
  title,
  conversationId,
  trelloData,
  directGroup,
  existingCardId,
}) {
  const setupCard = getAdaptiveCardFromTemplate(setupTemplate, {
    botId: bot.id,
    title,
    conversationId,
    trelloWebhookId: '',
  });
  const boards = trelloData.boards;
  const boardIdItem = findItemInAdaptiveCard(setupCard, 'boardId');
  boardIdItem.choices = boards.map(board => ({ title: board.name, value: board.id }));
  boardIdItem.value = boards[0] && boards[0].id;
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
  const cardTitle = `Trello setup for "${setupGroup.name || 'this conversation'}"`;
  if (!trelloData) {
    await sendAuthCard({
      bot,
      user,
      directGroup,
      conversation: {
        id: group.id,
      },
      trello,
      title: cardTitle,
    });
    await bot.sendMessage(group.id, {
      text: `Hi ![:Person](${user.id}), I just sent you a **Private** message, please follow that to connect Trello with this conversation.`,
    });
    return;
  }
  await sendNewSubscriptionCard({
    bot,
    title: cardTitle,
    conversationId: group.id,
    trelloData,
    directGroup,
  });
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
  trello,
  title,
  conversationId,
  directGroup,
  existingCardId,
}) {
  const boards = await trello.getBoards();
  const subscriptions = botSubscriptions.map((botSubscription) => {
    const board = boards.find(board => board.id === botSubscription.boardId);
    return {
      id: botSubscription.id,
      boardName: board && board.name,
      botId: bot.id,
    };
  });
  const subscriptionsCard = getAdaptiveCardFromTemplate(subscriptionsTemplate, {
    title,
    subscriptions,
    botId: bot.id,
    conversationId,
  });
  if (existingCardId) {
    await bot.updateAdaptiveCard(existingCardId, subscriptionsCard);
    return;
  }
  await bot.sendAdaptiveCard(directGroup.id, subscriptionsCard);
}

exports.sendHelpCard = sendHelpCard;
exports.sendMessageCard = sendMessageCard;
exports.sendSetupCard = sendSetupCard;
exports.getAdaptiveCard = getAdaptiveCard;
exports.sendAuthCard = sendAuthCard;
exports.sendSubscriptionsCard = sendSubscriptionsCard;
exports.sendNewSubscriptionCard = sendNewSubscriptionCard;
