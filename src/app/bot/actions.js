const { getAdaptiveCardFromTemplate } = require('../lib/formatAdaptiveCardMessage');

const helpTemplate = require('../adaptiveCards/help.json');

async function sendHelpCard(bot, groupId) {
  const joinWelcomeCard = getAdaptiveCardFromTemplate(helpTemplate, {
    botId: bot.id,
  });
  await bot.sendAdaptiveCard(groupId, joinWelcomeCard);
}

exports.sendHelpCard = sendHelpCard;

