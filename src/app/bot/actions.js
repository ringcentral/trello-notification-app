const { getAdaptiveCardFromTemplate, showTrelloSettingAtSetupCard } = require('../lib/formatAdaptiveCardMessage');
const { findItemInAdaptiveCard } = require('../lib/findItemInAdaptiveCard');

const helpTemplate = require('../adaptiveCards/help.json');
const messageTemplate = require('../adaptiveCards/message.json');
const setupTemplate = require('../adaptiveCards/setup.json');

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
  const boards = await trello.getBoards();
  return {
    boards,
  };
}

async function getSetupGroup(bot, group) {
  if (group.members) {
    return group;
  }
  const rcGroup = await bot.getGroup(group.id);
  return rcGroup;
}

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
  const setupCard = getAdaptiveCardFromTemplate(setupTemplate, {
    botId: bot.id,
    conversationName: setupGroup.name || 'this conversation', // TODO: group chat doesn't have name
    authorizeUrl: '',
    conversationId: group.id,
    trelloWebhookId: '',
  });
  const rcUser = await RcUser.findByPk(`rcext-${user.id}`);
  const trelloData = await getTrelloData(trello, rcUser);
  if (!trelloData) {
    showAuthorizationAtSetupCard(setupCard);
  } else {
    showTrelloSettingAtSetupCard(setupCard, trelloData);
  }
  const rcCard = await bot.sendAdaptiveCard(directGroup.id, setupCard);
  if (!trelloData) {
    await sendSetupCardWithAuthorizationStep({
      bot,
      cardId: rcCard.id,
      user,
      trello,
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

function showAuthorizationAtSetupCard(setupCard) {
  const authorizeContainerItem = findItemInAdaptiveCard(setupCard, 'authorize');
  delete authorizeContainerItem.isVisible;
  const boardsSelectionItem = findItemInAdaptiveCard(setupCard, 'boardsSelection');
  boardsSelectionItem.isVisible = false;
}

async function sendSetupCardWithAuthorizationStep({ bot, setupCard, cardId, user, trello }) {
  showAuthorizationAtSetupCard(setupCard);
  const authButtonGeneratingItem = findItemInAdaptiveCard(setupCard, 'authButtonGenerating');
  authButtonGeneratingItem.isVisible = false;
  const authActionSetItem = findItemInAdaptiveCard(setupCard, 'authActionSet');
  delete authActionSetItem.isVisible;
  const botToken = generateToken({
    userId: user.id,
    botId: bot.id,
    cardId,
  });
  trello.setRedirectUrl(`${process.env.RINGCENTRAL_CHATBOT_SERVER}/trello/bot-oauth-callback/${botToken}`);
  authActionSetItem.actions[0].url = trello.authorizationUrl({ scope: 'read,write' });
  await bot.updateAdaptiveCard(cardId, setupCard);
}

async function sendSubscribeSuccessIntoSetupCard({ bot, cardId, trelloWebhookId }) {
  const rcCard = await getAdaptiveCard(bot, cardId);
  const submitActionSetItem = findItemInAdaptiveCard(rcCard, 'submitActionSet');
  submitActionSetItem.actions[0].data.trelloWebhookId = trelloWebhookId;
  submitActionSetItem.actions[0].title = 'Update';
  const operationLogItem = findItemInAdaptiveCard(rcCard, 'operationLog');
  const currentTime = new Date();
  const operationTime = `${currentTime.toISOString().split('.')[0]}Z`;
  operationLogItem.items = [{
    type: 'TextBlock',
    wrap: true,
    text: `Subscribed successfully at {{DATE(${operationTime})}} {{TIME(${operationTime})}}`,
  }];
  delete operationLogItem.isVisible;
  const editBoardItem = findItemInAdaptiveCard(rcCard, 'editBoard');
  delete editBoardItem.isVisible;
  const selectBoardFormItem = findItemInAdaptiveCard(rcCard, 'selectBoardForm');
  selectBoardFormItem.isVisible = false;
  const filterSettingsItem = findItemInAdaptiveCard(rcCard, 'filterSettings');
  delete filterSettingsItem.isVisible;
  await bot.updateAdaptiveCard(cardId, rcCard);
}

exports.sendHelpCard = sendHelpCard;
exports.sendMessageCard = sendMessageCard;
exports.sendSetupCard = sendSetupCard;
exports.getAdaptiveCard = getAdaptiveCard;
exports.sendSetupCardWithAuthorizationStep = sendSetupCardWithAuthorizationStep;
exports.sendSubscribeSuccessIntoSetupCard = sendSubscribeSuccessIntoSetupCard;
