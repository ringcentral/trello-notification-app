const { getAdaptiveCardFromTemplate } = require('../lib/formatAdaptiveCardMessage');
const { findItemInAdaptiveCard } = require('../lib/findItemInAdaptiveCard');

const helpTemplate = require('../adaptiveCards/help.json');
const welcomeTemplate = require('../adaptiveCards/welcome.json');
const messageTemplate = require('../adaptiveCards/message.json');
const authTemplate = require('../adaptiveCards/authInCard.json');
const authSuccessTemplate = require('../adaptiveCards/authSuccess.json');
const unauthorizeTemplate = require('../adaptiveCards/unauthorize.json');
const setupTemplate = require('../adaptiveCards/setup.json');

const { Trello } = require('../lib/Trello');

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

async function sendWelcomeCard(bot) {
  const group = await createDirectGroup(bot, { id: bot.token.creator_extension_id });
  await bot.sendAdaptiveCard(group.id, welcomeTemplate);
}

async function sendAuthCard({
  bot,
  group,
}) {
  const authCard = getAdaptiveCardFromTemplate(authTemplate, {
    title: 'Connect with Trello',
    botId: bot.id,
  });
  await bot.sendAdaptiveCard(group.id, authCard);
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
  if (trelloUser && trelloUser.getWriteableToken()) {
    await bot.sendMessage(group.id, {
      text: `Hi ![:Person](${user.id}), you have authorized Trello.`,
    });
    return;
  }
  await sendAuthCard({ bot, group });
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
  if (!trelloUser || !trelloUser.getWriteableToken()) {
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
    token: trelloUser.getWriteableToken(),
  });
  await trello.revokeToken();
  trelloUser.removeWriteableToken();
  trelloUser.username = '';
  trelloUser.fullName = '';
  await trelloUser.save();
  await bot.sendMessage(group.id, {
    text: `Hi ![:Person](${user.id}), you have unauthorized Trello successfully.`,
  });
}

async function sendSetupCard({
  bot,
  conversation,
  groupId,
  existingCardId,
}) {
  const setupCard = getAdaptiveCardFromTemplate(setupTemplate, {
    botId: bot.id,
    title: `Trello setup for **${conversation.name || 'this conversation'}**`,
    conversationId: conversation.id,
    conversationName: conversation.name || '',
  });
  if (existingCardId) {
    await bot.updateAdaptiveCard(existingCardId, setupCard);
    return;
  }
  await bot.sendAdaptiveCard(groupId, setupCard);
};

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
    let unselectedLabels = addLabelInputItem.choices.filter(item => item.id !== 'placeholder');
    let selectedLabels = removeLabelInputItem.choices.filter(item => item.id !== 'placeholder');
    if (action === 'addLabel') {
      const label = unselectedLabels.find(label => label.value === data.addLabel);
      description = `${name} added the label **${label.title}**`;
      unselectedLabels = unselectedLabels.filter(label => label.value !== data.addLabel);
      selectedLabels.push(label);
      if (unselectedLabels.length === 0) {
        const addLabelFormItem = findItemInAdaptiveCard(card, 'addLabelForm');
        addLabelFormItem.isVisible = false;
        unselectedLabels.push({ title: 'no item', id: 'placeholder' });
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
        selectedLabels.push({ title: 'no item', id: 'placeholder' });
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
exports.sendAuthSuccessCard = sendAuthSuccessCard;
exports.addOperationLogIntoCard = addOperationLogIntoCard;
exports.handleUnauthorize = handleUnauthorize;
exports.handleAuthorize = handleAuthorize;
exports.sendWelcomeCard = sendWelcomeCard;
