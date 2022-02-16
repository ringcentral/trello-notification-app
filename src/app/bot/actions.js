const { getAdaptiveCardFromTemplate } = require('../lib/formatAdaptiveCardMessage');

const helpTemplate = require('../adaptiveCards/help.json');
const messageTemplate = require('../adaptiveCards/message.json');

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

async function sendSetupCardSentMessage(bot, groupId, name = null, userId = null) {
  let username = name;
  if (!name) {
    const user = await bot.getUser(userId);
    username = `${user.glip.firstName} ${user.glip.lastName}`;
  }
  await sendMessageCard(
    bot,
    groupId,
    `Hi **${username}**, I just sent you a **Private** message, please follow that to connect Trello with this conversation.`
  );
}

exports.sendHelpCard = sendHelpCard;
exports.sendMessageCard = sendMessageCard;
exports.sendSetupCardSentMessage = sendSetupCardSentMessage;
