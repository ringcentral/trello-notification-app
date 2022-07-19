const { nanoid } = require('nanoid');
const Bot = require('ringcentral-chatbot-core/dist/models/Bot').default;
const { RcUser } = require('../models/rc-user');
const { TrelloUser } = require('../models/trello-user');
const { TrelloWebhook } = require('../models/trello-webhook');
const { decodeToken } = require('../lib/jwt');
const { Trello } = require('../lib/Trello');

async function botSetup(req, res) {
  const token = req.query.token;
  const trello = new Trello({
    appKey: process.env.TRELLO_APP_KEY,
    redirectUrl: `${process.env.RINGCENTRAL_CHATBOT_SERVER}/trello/bot-oauth-callback/${token}`,
    name: 'RingCentral Bot',
  });
  res.render('bot-setup', {
    assetsPath: process.env.ASSETS_PATH,
    data: {
      token,
      infoUri: `${process.env.APP_SERVER}/bot-info`,
      authorizationUri: trello.authorizationUrl({ scope: 'read,write' }),
      authorizationRevokeUri: `${process.env.APP_SERVER}/trello/bot-revoke`,
      subscriptionUri: `${process.env.APP_SERVER}/bot-subscription`,
      segmentKey: process.env.SEGMENT_KEY,
    },
  });
}

async function info(req, res) {
  const jwtToken = req.query.token;
  if (!jwtToken) {
    res.status(403);
    res.send('Error params');
    return;
  }
  const decodedToken = decodeToken(jwtToken);
  if (!decodedToken) {
    res.status(401);
    res.send('Token invalid.');
    return;
  }
  const rcUserId = decodedToken.uId;
  const conversationId = decodedToken.gId;
  let rcUser;
  let trelloUser;
  const botInfo = {
    trelloAuthorized: false,
    trelloUser: {},
    subscriptions: [],
    boards: [],
  };
  try {
    rcUser = await RcUser.findByPk(`rcext-${rcUserId}`);
    if (!rcUser) {
      res.status(200);
      res.json(botInfo);
      return;
    }
    const allSubscriptions = rcUser.bot_subscriptions || [];
    botInfo.subscriptions = allSubscriptions.filter(
      sub => sub.conversation_id === conversationId
    );
    if (rcUser.trello_user_id) {
      trelloUser = await TrelloUser.findByPk(rcUser.trello_user_id);
      if (trelloUser) {
        botInfo.trelloAuthorized = !!trelloUser.writeable_token;
        botInfo.trelloUser = {
          fullName: trelloUser.fullName,
        };
        if (trelloUser.writeable_token) {
          const trello = new Trello({
            appKey: process.env.TRELLO_APP_KEY,
            redirectUrl: '',
            token: trelloUser.writeable_token,
          });
          botInfo.boards = await trello.getBoards();
        }
      }
    }
    res.status(200);
    res.json(botInfo);
  } catch (e) {
    if (
      e.response &&
      e.response.status === 401 &&
      trelloUser
    ) {
      trelloUser.writeable_token = '';
      await trelloUser.save();
      botInfo.trelloAuthorized = false;
      res.status(200);
      res.json(botInfo);
      return;
    }
    console.log(e);
    res.status(500);
    res.send('Internal server');
  }
}

async function saveBotSubscriptionsAtRcUser(rcUser, trelloWebhook) {
  const existingSubscriptions = rcUser.bot_subscriptions || [];
  const subscriptions = existingSubscriptions.filter(sub => sub.id !== trelloWebhook.id);
  subscriptions.push({
    id: trelloWebhook.id,
    conversation_id: trelloWebhook.conversation_id,
    boardId: trelloWebhook.config.boardId,
  });
  rcUser.bot_subscriptions = subscriptions;
  await rcUser.save();
}

async function saveSubscription(req, res) {
  const jwtToken = req.body.token;
  const subscriptionId = req.body.subscriptionId;
  const boardId = req.body.boardId;
  const filters = req.body.filters;
  if (!jwtToken || !filters || (!subscriptionId && !boardId)) {
    res.status(403);
    res.send('Error params');
    return;
  }
  const decodedToken = decodeToken(jwtToken);
  if (!decodedToken) {
    res.status(401);
    res.send('Token invalid.');
    return;
  }
  const rcUserId = decodedToken.uId;
  const conversationId = decodedToken.gId;
  const botId = decodedToken.bId;
  let trelloUser;
  let bot;
  try {
    bot = await Bot.findByPk(botId);
    if (!bot) {
      res.status(403);
      res.send('Bot not found');
      return;
    }
    const rcUser = await RcUser.findByPk(`rcext-${rcUserId}`);
    if (!rcUser || !rcUser.trello_user_id) {
      res.status(401);
      res.send('Authorization required');
      return;
    }
    trelloUser = await TrelloUser.findByPk(rcUser.trello_user_id);
    if (!trelloUser || !trelloUser.writeable_token) {
      res.status(401);
      res.send('Trello authorization required');
      return;
    }
    const trello = new Trello({
      appKey: process.env.TRELLO_APP_KEY,
      redirectUrl: '',
      token: trelloUser.writeable_token,
    });
    let trelloWebhook;
    if (subscriptionId) {
      trelloWebhook = await TrelloWebhook.findByPk(subscriptionId);
      if (!trelloWebhook || trelloWebhook.trello_user_id !== rcUser.trello_user_id) {
        res.status(404);
        res.send('Not found');
        return;
      }
      const labels = await trello.getLabels(trelloWebhook.config.boardId);
      trelloWebhook.config = {
        boardId: trelloWebhook.config.boardId,
        filters: String(filters),
        labels,
      };
      trelloWebhook.bot_id = bot.id;
      await trelloWebhook.save();
    } else {
      const labels = await trello.getLabels(boardId);
      trelloWebhook = await TrelloWebhook.create({
        id: nanoid(15),
        bot_id: bot.id,
        trello_user_id: trelloUser.id,
        conversation_id: conversationId,
        config: {
          boardId,
          filters: String(filters),
          labels,
        },
      });
    }
    if (trelloWebhook.trello_webhook_id) {
      await trello.deleteWebhook({ id: trelloWebhook.trello_webhook_id });
      trelloWebhook.trello_webhook_id = '';
      await trelloWebhook.save();
    }
    const webhook = await trello.createWebhook({
      description: 'RingCentral Bot Notifications',
      callbackURL: `${process.env.APP_SERVER}/trello-notify/${trelloWebhook.id}`,
      idModel: trelloWebhook.config.boardId,
      active: true,
    });
    trelloWebhook.trello_webhook_id = webhook.id;
    await trelloWebhook.save();
    await saveBotSubscriptionsAtRcUser(rcUser, trelloWebhook);
    if (!subscriptionId) {
      await bot.sendMessage(conversationId, {
        text: `Trello subscription of ${req.body.boardName} is created successfully.`,
      });
    }
    res.status(200);
    res.json({ result: 'ok' });
  } catch (e) {
    if (
      e.response &&
      e.response.status === 401 &&
      trelloUser
    ) {
      trelloUser.writeable_token = '';
      await trelloUser.save();
      res.status(401);
      res.send('Trello authorization required');
      return;
    }
    console.error(e);
    res.status(500);
    res.json('Internal server error');
  }
}

async function getSubscription(req, res) {
  const jwtToken = req.query.token;
  const subscriptionId = req.query.id;
  if (!jwtToken || !subscriptionId) {
    res.status(403);
    res.send('Error params');
    return;
  }
  const decodedToken = decodeToken(jwtToken);
  if (!decodedToken) {
    res.status(401);
    res.send('Token invalid.');
    return;
  }
  const rcUserId = decodedToken.uId;
  try {
    const rcUser = await RcUser.findByPk(`rcext-${rcUserId}`);
    if (!rcUser) {
      res.status(401);
      res.send('Authorization required');
      return;
    }
    const trelloWebhook = await TrelloWebhook.findByPk(subscriptionId);
    if (!trelloWebhook || trelloWebhook.trello_user_id !== rcUser.trello_user_id) {
      res.status(404);
      res.send('Not found');
      return;
    }
    res.status(200);
    res.json({
      id: trelloWebhook.id,
      config: trelloWebhook.config || {},
    });
  } catch (e) {
    console.error(e);
    res.status(500);
    res.json('Internal server error');
  }
}

async function removeBotSubscriptionsAtRcUser(rcUser, trelloWebhook) {
  const existingSubscriptions = rcUser.bot_subscriptions || [];
  const subscriptions = existingSubscriptions.filter(sub => sub.id !== trelloWebhook.id);
  rcUser.bot_subscriptions = subscriptions;
  await rcUser.save();
}

async function removeSubscription(req, res) {
  const jwtToken = req.body.token;
  const subscriptionId = req.body.id;
  if (!jwtToken || !subscriptionId) {
    res.status(403);
    res.send('Error params');
    return;
  }
  const decodedToken = decodeToken(jwtToken);
  if (!decodedToken) {
    res.status(401);
    res.send('Token invalid.');
    return;
  }
  const rcUserId = decodedToken.uId;
  const conversationId = decodedToken.gId;
  const boardName = req.body.boardName;
  const botId = decodedToken.bId;
  let trelloUser;
  let trello;
  try {
    const rcUser = await RcUser.findByPk(`rcext-${rcUserId}`);
    if (!rcUser) {
      res.status(401);
      res.send('Authorization required');
      return;
    }
    trelloUser = await TrelloUser.findByPk(rcUser.trello_user_id);
    if (!trelloUser || !trelloUser.writeable_token) {
      res.status(401);
      res.send('Trello authorization required');
      return;
    }
    const trelloWebhook = await TrelloWebhook.findByPk(subscriptionId);
    if (!trelloWebhook || trelloWebhook.trello_user_id !== rcUser.trello_user_id) {
      res.status(404);
      res.send('Not found');
      return;
    }
    if (trelloWebhook.trello_webhook_id) {
      trello = new Trello({
        appKey: process.env.TRELLO_APP_KEY,
        redirectUrl: '',
        token: trelloUser.writeable_token,
      });
      await trello.deleteWebhook({ id: trelloWebhook.trello_webhook_id });
    }
    await removeBotSubscriptionsAtRcUser(rcUser, trelloWebhook);
    await TrelloWebhook.destroy({
      where: {
        id: trelloWebhook.id
      },
    });
    const bot = await Bot.findByPk(botId);
    if (bot) {
      await bot.sendMessage(conversationId, {
        text: `Trello subscription of ${boardName} is removed.`,
      });
    }
    res.status(200);
    res.json({ result: 'ok' });
  } catch (e) {
    if (
      e.response &&
      e.response.status === 401 &&
      trelloUser &&
      trello
    ) {
      trelloUser.writeable_token = '';
      await trelloUser.save();
      res.status(401);
      res.send('Trello authorization required');
      return;
    }
    console.error(e);
    res.status(500);
    res.json('Internal server error');
  }
}

exports.setup = botSetup;
exports.info = info;
exports.saveSubscription = saveSubscription;
exports.getSubscription = getSubscription;
exports.removeSubscription = removeSubscription;
