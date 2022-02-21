const botActions = require('./actions');

async function botHandler({
  type, // could be 'BotAdded', 'BotRemoved', 'Message4Bot', 'BotGroupLeft', 'BotJoinGroup', 'Maintain', 'SetupDatabase'
  bot, // the bot instance, check src/models/Bot.ts for instance methods
  text, // the text message user posted in chatgroup
  group, // the group object, can get chat group id from group.id
  userId, // message creator's id
  message // message object, check ringcentral api document for detail
}) {
  try {
    if (type === 'BotJoinGroup') {
      await botActions.sendHelpCard(bot, group);
      return;
    }
    if (type === 'Message4Bot') {
      if (text === 'setup') {
        await botActions.sendSetupCard({ bot, group, user: { id: userId }});
        return;
      }
      if (text === 'unauthorize') {
        await botActions.handleUnauthorize({ bot, group, user: { id: userId }});
        return;
      }
      if (text === 'authorize') {
        await botActions.handleAuthorize({ bot, group, user: { id: userId }});
        return;
      }
      // await bot.setupWebHook();
      // await bot.ensureWebHook();
      // await bot.getUser(userId);
      // await bot.sendMessage(group.id, { text: 'Hi!' });
      await botActions.sendHelpCard(bot, group);
    }
  } catch (e) {
    console.error(e);
  }
}

exports.botHandler = botHandler;
