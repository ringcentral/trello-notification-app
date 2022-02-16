const botActions = require('./actions');

async function subscribeHandler(bot, group, userId) {
  await botActions.sendSetupCardSentMessage(bot, group.id, null, userId);
}

async function botHandler({
  type, // could be 'BotAdded', 'BotRemoved', 'Message4Bot', 'BotGroupLeft', 'BotJoinGroup', 'Maintain', 'SetupDatabase'
  bot, // the bot instance, check src/models/Bot.ts for instance methods
  text, // the text message user posted in chatgroup
  group, // the group object, can get chat group id from group.id
  userId, // message creator's id
  message // message object, check ringcentral api document for detail
}) {
  console.log(JSON.stringify(group, null, 2));
  if (type === 'BotJoinGroup') {
    await botActions.sendHelpCard(bot, group.id);
    return;
  }
  if (type === 'Message4Bot') {

    if (text === 'subscribe') {
      await subscribeHandler(bot, group, userId);
      return;
    }
    // if (text === 'authorize') {
    //   await botActions.sendAuthCard(bot, group.id);
    //   return;
    // }
    // if (text === 'unauthorize') {
    //   await botActions.sendUnauthorizedCard(bot, group.id);
    //   return;
    // }
    // await bot.setupWebHook();
    // await bot.ensureWebHook();
    // await bot.getUser(userId);
    // await bot.sendMessage(group.id, { text: 'Hi!' });
    await botActions.sendHelpCard(bot, group.id);
  }
}

exports.botHandler = botHandler;
