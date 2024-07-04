const Bot = require('ringcentral-chatbot-core/dist/models/Bot').default;

const { Trello } = require('../lib/Trello');
const { decodeToken, generateToken } = require('../lib/jwt');
const { getHashValue } = require('../lib/getHashValue');
const botActions = require('../bot/actions');

const { TrelloUser } = require('../models/trello-user');
const { RcUser } = require('../models/rc-user');
const { TrelloWebhook } = require('../models/trello-webhook');
const { IFRAME_HOST_DOMAINS } = require('../lib/constants');
const { errorLogger } = require('../lib/logger');

// authorize Trello with only read permission
async function authorize(req, res) {
  const trello = new Trello({
    appKey: process.env.TRELLO_APP_KEY,
    redirectUrl: `${process.env.APP_SERVER}/trello/oauth-callback`,
  });
  res.redirect(trello.authorizationUrl());
};

// authorize Trello with read and write permission
async function fullAuthorize(req, res) {
  const trello = new Trello({
    name: 'RingCentral Notification Actions',
    appKey: process.env.TRELLO_APP_KEY,
    redirectUrl: `${process.env.APP_SERVER}/trello/oauth-callback`,
  });
  res.redirect(trello.authorizationUrl({ scope: 'read,write' }));
}

function oauthCallback(req, res) {
  res.render('oauth-callback');
};

function botOauthCallback(req, res) {
  res.render('bot-oauth-callback', {
    authPath: `${process.env.RINGCENTRAL_CHATBOT_SERVER}/trello/bot-oauth-callback`,
    botToken: encodeURIComponent(req.params.botToken),
  });
}

async function botAuthSetup(req, res) {
  const code = req.query.code;
  const decodedCode = decodeToken(code);
  if (!decodedCode) {
    res.status(401);
    res.send('Token invalid, please reopen.');
    return;
  }
  const token = generateToken({
    uId: decodedCode._uId,
    bId: decodedCode.bId,
    gId: decodedCode.gId,
  }, '24h');
  const trello = new Trello({
    appKey: process.env.TRELLO_APP_KEY,
    redirectUrl: `${process.env.RINGCENTRAL_CHATBOT_SERVER}/trello/bot-oauth-callback/${token}`,
    name: 'RingCentral Bot',
  });
  let trackAccountId = undefined;
  if (req.query.trackAccountId) {
    // escape the value to prevent XSS
    trackAccountId = encodeURIComponent(req.query.trackAccountId);
  }
  res.set('Content-Security-Policy', `frame-ancestors 'self' ${IFRAME_HOST_DOMAINS};`);
  res.render('auth-setup', {
    assetsPath: process.env.ASSETS_PATH,
    data: {
      token,
      infoUri: `${process.env.APP_SERVER}/bot-info`,
      authorizationUri: trello.authorizationUrl({ scope: 'read,write' }),
      authorizationRevokeUri: `${process.env.APP_SERVER}/trello/bot-revoke`,
      mixpanelKey: process.env.MIXPANEL_KEY,
      trackUserId: getHashValue(decodedCode._uId, process.env.ANALYTICS_SECRET_KEY),
      trackAccountId,
      trackBotId: getHashValue(decodedCode.bId, process.env.ANALYTICS_SECRET_KEY),
    },
  });
}

async function botSaveToken(req, res) {
  const botToken = req.body.botToken;
  if (!botToken) {
    res.status(403);
    res.send('Params error');
    return;
  }
  const decodedToken = decodeToken(botToken);
  if (!decodedToken) {
    res.status(401);
    res.send('User token invalid.');
    return;
  }
  const rcUserId = decodedToken.uId;
  const botId = decodedToken.bId;
  const cardId = decodedToken.cId;
  const conversationId = decodedToken.gId;
  const nextAction = decodedToken.next;
  const trelloToken = req.body.trelloToken;
  if (!trelloToken) {
    res.status(401);
    res.send('Trello token invalid.');
    return;
  }
  const trello = new Trello({
    appKey: process.env.TRELLO_APP_KEY,
    redirectUrl: '',
  });
  try {
    trello.setToken(trelloToken);
    const trelloUserInfo = await trello.getUserInfo();
    if (!trelloUserInfo || !trelloUserInfo.id) {
      res.status(403);
      res.send('Fetch Trello data error.');
      return;
    }
    const bot = await Bot.findByPk(botId);
    if (!bot) {
      res.status(404);
      res.send('Bot not found.');
      return;
    }
    let trelloUser = await TrelloUser.findByPk(trelloUserInfo.id);
    if (trelloUser) {
      trelloUser.writeable_token = trelloToken;
      await trelloUser.save();
    } else {
      trelloUser = await TrelloUser.create({
        id: trelloUserInfo.id,
        username: trelloUserInfo.username,
        fullName: trelloUserInfo.fullName,
        writeable_token: trelloToken,
      });
    }
    const rcUser = await RcUser.findByPk(`rcext-${rcUserId}`);
    if (rcUser) {
      rcUser.trello_user_id = trelloUser.id;
      await rcUser.save();
    } else {
      await RcUser.create({
        id: `rcext-${rcUserId}`,
        trello_user_id: trelloUser.id,
      });
    }
    if (nextAction === 'subscribe') {
      const group = await bot.getGroup(conversationId);
      await botActions.sendSetupCard({
        bot,
        conversation: {
          id: conversationId,
          name: group.name || '',
        },
        existingCardId: cardId,
      });
    } else if (cardId) {
      await botActions.sendAuthSuccessCard({
        bot,
        authCardId: cardId,
        trelloUserName: trelloUserInfo.fullName,
      });
    }
  } catch (e) {
    if (
      e.response &&
      e.response.status === 401 &&
      e.response.config.url.indexOf('api.trello.com') > -1
    ) {
      res.status(401);
      res.send('Token invalid.');
      return;
    }
    errorLogger(e);
    res.status(500);
    res.send('Internal error');
    return;
  }
  res.status(200);
  res.send('ok');
}

async function saveToken(req, res) {
  const token = req.body.token;
  if (!token) {
    res.status(403);
    res.send('Params error');
    return;
  }
  try {
    const trello = new Trello({
      appKey: process.env.TRELLO_APP_KEY,
      redirectUrl: `${process.env.APP_SERVER}/trello/oauth-callback`,
      token,
    });
    const userInfo = await trello.getUserInfo();
    if (!userInfo || !userInfo.id) {
      res.status(403);
      res.send('Token invalid.');
      return;
    }
    let trelloUser = await TrelloUser.findByPk(userInfo.id);
    if (trelloUser) {
      trelloUser.token = token;
      await trelloUser.save();
    } else {
      trelloUser = await TrelloUser.create({
        id: userInfo.id,
        username: userInfo.username,
        fullName: userInfo.fullName,
        token,
      });
    }
    const jwtToken = generateToken({ id: userInfo.id });
    res.status(200);
    res.json({
      authorize: true,
      token: jwtToken,
    });
  } catch (e) {
    if (e.response && e.response.status === 401) {
      res.status(403);
      res.send('Token invalid.');
      return;
    }
    errorLogger(e);
    res.status(500);
    res.send('Internal error.');
  }
}

async function revokeToken(req, res) {
  const jwtToken = req.body.token;
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
  const userId = decodedToken.id;
  try {
    const trelloUser = await TrelloUser.findByPk(userId);
    if (trelloUser && trelloUser.token) {
      const trello = new Trello({
        appKey: process.env.TRELLO_APP_KEY,
        redirectUrl: `${process.env.APP_SERVER}/trello/oauth-callback`,
        token: trelloUser.token,
      });
      await trello.revokeToken();
      trelloUser.token = '';
      await trelloUser.save();
    }
    res.status(200);
    res.json({
      result: 'ok',
      authorized: false,
    });
  } catch (e) {
    errorLogger(e);
    res.status(500);
    res.send('internal error');
  }
}

async function botRevokeToken(req, res) {
  const jwtToken = req.body.token;
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
  let rcUser;
  let trelloUser;
  try {
    rcUser = await RcUser.findByPk(`rcext-${rcUserId}`);
    if (!rcUser || !rcUser.trello_user_id) {
      res.status(200);
      res.json({ result: 'ok' });
      return;
    }
    trelloUser = await TrelloUser.findByPk(rcUser.trello_user_id);
    if (!trelloUser || !trelloUser.writeable_token) {
      res.status(200);
      res.json({ result: 'ok' });
      return;
    }
    const trello = new Trello({
      appKey: process.env.TRELLO_APP_KEY,
      redirectUrl: '',
    });
    trello.setToken(trelloUser.writeable_token);
    await trello.revokeToken();
    trelloUser.writeable_token = '';
    await trelloUser.save();
    if (rcUser.bot_subscriptions && rcUser.bot_subscriptions.length > 0) {
      await TrelloWebhook.destroy({
        where: {
          id: rcUser.bot_subscriptions.map(sub => sub.id),
        }
      });
      rcUser.bot_subscriptions = null;
      await rcUser.save();
    }
    res.status(200);
    res.json({ result: 'ok' });
  } catch (e) {
    errorLogger(e);
    res.status(500);
    res.send('internal error');
  }
}

exports.authorize = authorize;
exports.fullAuthorize = fullAuthorize;
exports.revokeToken = revokeToken;
exports.oauthCallback = oauthCallback;
exports.saveToken = saveToken;
exports.botOauthCallback = botOauthCallback;
exports.botSaveToken = botSaveToken;
exports.botRevokeToken = botRevokeToken;
exports.botAuthSetup = botAuthSetup;
