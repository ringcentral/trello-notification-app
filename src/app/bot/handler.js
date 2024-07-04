const Bot = require('ringcentral-chatbot-core/dist/models/Bot').default;
const botActions = require('./actions');
const { Analytics } = require('../lib/analytics');
const { errorLogger } = require('../lib/logger');

async function botHandler({
  type, // could be 'BotAdded', 'BotRemoved', 'Message4Bot', 'BotGroupLeft', 'BotJoinGroup', 'Maintain', 'SetupDatabase'
  bot, // the bot instance, check src/models/Bot.ts for instance methods
  text, // the text message user posted in chatgroup
  group, // the group object, can get chat group id from group.id
  userId, // message creator's id
  message, // message object, check ringcentral api document for detail
}) {
  // console.log('botHandler', type, bot, text, group, userId, message);
  try {
    const analytics = new Analytics({
      mixpanelKey: process.env.MIXPANEL_KEY,
      secretKey: process.env.ANALYTICS_SECRET_KEY,
      userId: bot ? bot.id : message.ownerId,
      accountId: bot && bot.token && bot.token.creator_account_id,
    });
    if (type === 'GroupJoined') {
      if (message.body.type === 'Team') {
        const botId = message.ownerId;
        const joinGroupBot = await Bot.findByPk(botId);
        const joinedGroup = {
          id: message.body.id,
          type: message.body.type,
          name: message.body.name,
        };
        await botActions.sendHelpCard(joinGroupBot, joinedGroup);
        await analytics.trackUserAction('botAddedToTeam', null, {
          chatId: message.body.id,
          chatMemberCount: message.body.members.length - 1, // exclude bot itself
        });
      }
      return;
    }
    if (type === 'GroupLeft') {
      await analytics.trackUserAction('botRemovedFromTeam', null, {
        chatId: message.body.id,
        chatMemberCount: message.body.members.length,
      });
      return;
    }
    if (type === 'Message4Bot') {
      if (text === 'setup') {
        if (group.type === 'Group') {
          await bot.sendMessage(group.id, {
            text: `Hi ![:Person](${userId}), we only support to connect Trello for **Team** conversation now.`,
          });
          await analytics.trackBotAction('receivedMessage', {
            action: 'setup',
            result: 'Not supported in group chat',
            chatId: group.id,
            chatMemberCount: group.members.length - 1,
          });
          return;
        }
        await botActions.sendSetupCard({
          bot,
          groupId: group.id,
          conversation: group,
        });
        await analytics.trackBotAction('receivedMessage', {
          action: 'setupRequest',
          result: 'success',
          chatId: group.id,
          chatMemberCount: group.members.length - 1,
        });
        return;
      }
      if (text === 'unauthorize') {
        await botActions.handleUnauthorize({ bot, group, user: { id: userId }});
        await analytics.trackBotAction('receivedMessage', {
          action: 'unauthorizeRequest',
          result: 'success',
          chatId: group.id,
          chatMemberCount: group.members.length - 1,
        });
        return;
      }
      if (text === 'authorize') {
        await botActions.handleAuthorize({ bot, group, user: { id: userId }});
        await analytics.trackBotAction('receivedMessage', {
          action: 'authorizeRequest',
          result: 'success',
          chatId: group.id,
          chatMemberCount: group.members.length - 1,
        });
        return;
      }
      if (group.type === 'Group') {
        await bot.sendMessage(group.id, {
          text: `Hi ![:Person](${userId}), we only support to connect Trello for **Team** conversation now.`,
        });
      } else {
        await botActions.sendHelpCard(bot, group);
      }
      await analytics.trackBotAction('receivedMessage', {
        action: 'otherOrHelpRequest',
        result: 'success',
        chatId: group.id,
        chatMemberCount: group.members.length - 1,
      });
      return;
    }
    if (type === 'Create') {
      const newBot = await Bot.findByPk(message.body.extensionId);
      await botActions.sendWelcomeCard(newBot);
      return;
    }
    if (type === 'BotAdded') {
      await analytics.trackUserAction(
        'botInstalled',
        bot.token.creator_extension_id,
      );
      await analytics.identify();
      return;
    }
    if (type === 'BotRemoved') {
      await analytics.trackUserAction(
        'botUninstalled',
        // bot.token.creator_extension_id,
      );
    }
  } catch (e) {
    errorLogger(e);
  }
}

exports.botHandler = botHandler;
