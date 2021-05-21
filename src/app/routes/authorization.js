const { Trello } = require('../lib/Trello');
const { decodeToken, generateToken } = require('../lib/jwt');

const { TrelloUser } = require('../models/trello-user');

async function authorize(req, res) {
  const trello = new Trello({
    appKey: process.env.TRELLO_APP_KEY,
    redirectUrl: `${process.env.APP_SERVER}/trello/oauth-callback`,
  });
  res.redirect(trello.authorizationUrl());
};

function oauthCallback (req, res) {
  res.render('oauth-callback');
};

async function saveToken(req, res) {
  const token = req.body.token;
  if (!token) {
    res.send('Params error');
    res.status(403);
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
      res.send('Token invalid.');
      res.status(403);
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
    res.json({
      authorize: true,
      token: jwtToken,
    });
    res.status(200);
  } catch (e) {
    console.error(e);
    res.send('Internal error.');
    res.status(500);
  }
}

async function revokeToken(req, res) {
  const jwtToken = req.body.token;
  if (!jwtToken) {
    res.send('Error params');
    res.status(403);
    return;
  }
  const decodedToken = decodeToken(jwtToken);
  if (!decodedToken) {
    res.send('Token invalid.');
    res.status(401);
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
    res.json({
      result: 'ok',
      authorized: false,
    });
    res.status(200);
  } catch (e) {
    console.error(e);
    res.send('internal error');
    res.status(500);
  }
}

exports.authorize = authorize;
exports.revokeToken = revokeToken;
exports.oauthCallback = oauthCallback;
exports.saveToken = saveToken;
