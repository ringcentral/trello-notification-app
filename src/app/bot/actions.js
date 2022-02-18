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
const authSuccessTemplate = require('../adaptiveCards/authSuccess.json');
const unauthorizeTemplate = require('../adaptiveCards/unauthorize.json');
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
  await bot.sendAdaptiveCard(group.id, joinWelcomeCard);
}

async function setMessageCard(bot, cardId, message) {
  const messageCard = getAdaptiveCardFromTemplate(messageTemplate, {
    botId: bot.id,
    message,
  });
  await bot.updateAdaptiveCard(cardId, messageCard);
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
  conversationId = '',
  existingCardId,
  title,
  trello,
  nextAction = '',
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
    next: nextAction,
  });
  trello.setName('RingCentral Bot');
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

async function sendAuthCardIntoDirectGroup({ bot, user, trello, conversation }) {
  const directGroup = await createDirectGroup(bot, user);
  await sendAuthCard({
    bot,
    user,
    directGroup,
    title: 'Connect with Trello',
    trello,
  });
  if (conversation.id !== directGroup.id) {
    await bot.sendMessage(conversation.id, {
      text: `Hi ![:Person](${user.id}), I just sent you a **Private** message, please follow that to connect your Trello account. After authorized, you can enable interactive button features.`,
    });
  }
}

async function sendAuthSuccessCard({
  bot,
  authCardId,
  trelloUserName,
}) {
  const card = getAdaptiveCardFromTemplate(authSuccessTemplate, {
    trelloUserName,
  });
  await bot.updateAdaptiveCard(authCardId, card);
}

async function handleAuthorize({ bot, group, user }) {
  const rcUser = await RcUser.findByPk(`rcext-${user.id}`);
  let trelloUser;
  if (rcUser) {
    trelloUser = await TrelloUser.findByPk(rcUser.trello_user_id);
  }
  if (trelloUser && trelloUser.writeable_token) {
    await bot.sendMessage(group.id, {
      text: `Hi ![:Person](${user.id}), you have authorized Trello.`,
    });
    return;
  }
  const trello = new Trello({
    appKey: process.env.TRELLO_APP_KEY,
    redirectUrl: '',
  });
  await sendAuthCardIntoDirectGroup({
    bot,
    conversation: group,
    user,
    trello,
  });
}

async function handleUnauthorize({
  bot,
  group,
  user,
}) {
  const rcUser = await RcUser.findByPk(`rcext-${user.id}`);
  let trelloUser;
  if (rcUser) {
    trelloUser = await TrelloUser.findByPk(rcUser.trello_user_id);
  }
  if (!trelloUser || !trelloUser.writeable_token) {
    await bot.sendMessage(group.id, {
      text: `Hi ![:Person](${user.id}), you have not authorized Trello yet.`,
    });
    return;
  }
  if (rcUser && rcUser.bot_subscriptions && rcUser.bot_subscriptions.length > 0) {
    const card = getAdaptiveCardFromTemplate(unauthorizeTemplate, {
      botId: bot.id,
    });
    await bot.sendAdaptiveCard(group.id, card);
    return;
  }
  const trello = new Trello({
    appKey: process.env.TRELLO_APP_KEY,
    redirectUrl: '',
    token: trelloUser.writeable_token,
  });
  await trello.revokeToken();
  trelloUser.writeable_token = '';
  await trelloUser.save();
  await bot.sendMessage(group.id, {
    text: `Hi ![:Person](${user.id}), you have unauthorized Trello successfully.`,
  });
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
    title: `Trello setup for **${conversation.name || 'this conversation'}**`,
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
      title: `Trello setup for **${setupGroup.name || 'current conversation'}**`,
      nextAction: 'subscribe',
    });
    if (group.id !== directGroup.id) {
      await bot.sendMessage(group.id, {
        text: `Hi ![:Person](${user.id}), I just sent you a **Private** message, please follow that to connect Trello with this conversation.`,
      });
    }
    return;
  }
  const existingSubscriptions =
    rcUser.bot_subscriptions &&
    rcUser.bot_subscriptions.filter(sub => sub.conversation_id === group.id);
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
      title: `Trello setup for **${setupGroup.name || 'current conversation'}**`,
      conversation: {
        id: setupGroup.id,
        name: setupGroup.name,
      },
      trelloData,
      directGroup,
    });
  }
  if (group.id !== directGroup.id) {
    await bot.sendMessage(group.id, {
      text: `Hi ![:Person](${user.id}), I just sent you a **Private** message, please follow that to connect Trello with this conversation.`,
    });
  }
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
    title: `Trello setup for **${conversation.name || 'current conversation'}**`,
    subscriptions,
    botId: bot.id,
    conversationId: conversation.id,
    conversationName: conversation.name || '',
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
    title: `Trello setup for **${conversationName || 'current conversation'}**`,
  });
  await bot.updateAdaptiveCard(existingCardId, card);
}

async function addOperationLogIntoCard({ bot, cardId, data, user }) {
  const card = await getAdaptiveCard(bot, cardId);
  const operationLogItem = findItemInAdaptiveCard(card, 'operationLog');
  if (!operationLogItem) {
    return null;
  }
  const name = `${user.firstName} ${user.lastName}`;
  const currentTime = new Date();
  const operationTime = `${currentTime.toISOString().split('.')[0]}Z`;
  let description;
  const action = data.action;
  if (action === 'joinCard') {
    description = `**${name}** joined the card at {{DATE(${operationTime})}} {{TIME(${operationTime})}}`;
  } else if (action === 'commentCard') {
    description = `**${name}** commented at {{DATE(${operationTime})}} {{TIME(${operationTime})}}:\n${data.comment}`;
  } else if (action === 'setCardDueDate') {
    description = `${name} set the due date to ${data.dueDate}`;
  } else if (action === 'addLabel' || action === 'removeLabel') {
    const removeLabelInputItem = findItemInAdaptiveCard(card, 'removeLabel');
    const addLabelInputItem = findItemInAdaptiveCard(card, 'addLabel');
    let unselectedLabels = addLabelInputItem.choices;
    let selectedLabels = removeLabelInputItem.choices;
    if (action === 'addLabel') {
      const label = unselectedLabels.find(label => label.value === data.addLabel);
      description = `${name} added the label **${label.title}**`;
      unselectedLabels = unselectedLabels.filter(label => label.value !== data.addLabel);
      selectedLabels.push(label);
      if (unselectedLabels.length === 0) {
        const addLabelFormItem = findItemInAdaptiveCard(card, 'addLabelForm');
        addLabelFormItem.isVisible = false;
      }
      const removeLabelFormItem = findItemInAdaptiveCard(card, 'removeLabelForm');
      delete removeLabelFormItem.isVisible;
    } else {
      const label = selectedLabels.find(label => label.value === data.removeLabel);
      description = `${name} removed the label **${label.title}**`;
      selectedLabels = selectedLabels.filter(label => label.value !== data.removeLabel);
      unselectedLabels.push(label);
      if (selectedLabels.length === 0) {
        const removeLabelFormItem = findItemInAdaptiveCard(card, 'removeLabelForm');
        removeLabelFormItem.isVisible = false;
      }
      const addLabelFormItem = findItemInAdaptiveCard(card, 'addLabelForm');
      delete addLabelFormItem.isVisible;
    }
    removeLabelInputItem.choices = selectedLabels;
    addLabelInputItem.choices = unselectedLabels;
  }
  if (description) {
    operationLogItem.items = [{
      type: 'TextBlock',
      text: description,
      wrap: true,
    }];
    delete operationLogItem.isVisible;
    await bot.updateAdaptiveCard(cardId, card);
  }
}

exports.sendHelpCard = sendHelpCard;
exports.setMessageCard = setMessageCard;
exports.sendSetupCard = sendSetupCard;
exports.getAdaptiveCard = getAdaptiveCard;
exports.sendAuthCard = sendAuthCard;
exports.sendSubscriptionsCard = sendSubscriptionsCard;
exports.sendSubscribeCard = sendSubscribeCard;
exports.sendSubscribeRemovedCard = sendSubscribeRemovedCard;
exports.sendAuthSuccessCard = sendAuthSuccessCard;
exports.sendAuthCardIntoDirectGroup = sendAuthCardIntoDirectGroup;
exports.addOperationLogIntoCard = addOperationLogIntoCard;
exports.handleUnauthorize = handleUnauthorize;
exports.handleAuthorize = handleAuthorize;
