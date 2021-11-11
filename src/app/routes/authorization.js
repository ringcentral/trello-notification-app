const { Trello } = require('../lib/Trello');
const { decodeToken, generateToken } = require('../lib/jwt');

const { TrelloUser } = require('../models/trello-user');

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

function oauthCallback (req, res) {
  res.render('oauth-callback');
};

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
    console.error(e);
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
    console.error(e);
    res.status(500);
    res.send('internal error');
  }
}

exports.authorize = authorize;
exports.fullAuthorize = fullAuthorize;
exports.revokeToken = revokeToken;
exports.oauthCallback = oauthCallback;
exports.saveToken = saveToken;
