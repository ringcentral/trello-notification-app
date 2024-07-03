const path = require('path');
const express = require('express');
const morgan = require('morgan');
const bodyParser = require('body-parser');
const { extendApp: extendBotApp } = require('ringcentral-chatbot-core');

const authorizationRoute = require('./routes/authorization');
const webhooksRoute = require('./routes/webhooks');
const notificationRoute = require('./routes/notification');
const botSetupRoute = require('./routes/bot-setup');

const { botHandler } = require('./bot/handler');
const { botConfig } = require('./bot/config');
const { refererChecker } = require('./lib/refererChecker');

const app = express();
app.use(morgan(function (tokens, req, res) {
  let url = tokens.url(req, res);
  if (
    url.indexOf('/bot-auth-setup') === 0 ||
    url.indexOf('/bot-setup') === 0
  ) {
    const code = req.query.code;
    if (code) {
      const maskCode = `[MASK]-${code.slice(-5)}`;
      url = url.replace(code, maskCode);
    }
  }
  if (url.indexOf('/trello/bot-oauth-callback/') === 0) {
    url = `/trello/bot-oauth-callback/[MASK]-${url.slice(-5)}`;
  }
  return [
    tokens.method(req, res),
    url,
    tokens.status(req, res),
    tokens.res(req, res, 'content-length'), '-',
    tokens['response-time'](req, res), 'ms'
  ].join(' ');
}));

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

app.set('views', path.resolve(__dirname, './views'));
app.set('view engine', 'pug');

// RingCentral notification app setup page
app.get('/webhooks/new', webhooksRoute.newWebhook);
app.get('/webhooks/info', refererChecker, webhooksRoute.webhookInfo);
// Create or Update Trello webhook
app.post('/webhooks', refererChecker, webhooksRoute.createWebhook);

// authorize trello with only read permission
app.get('/trello/authorize', authorizationRoute.authorize);
// authorize trello with read and write permission
app.get('/trello/full-authorize', authorizationRoute.fullAuthorize);
app.get('/trello/oauth-callback', authorizationRoute.oauthCallback);
app.post('/trello/token', refererChecker, authorizationRoute.saveToken);
app.post('/trello/revoke', refererChecker, authorizationRoute.revokeToken);

// trello incoming webhook
app.post('/trello-notify/:id', notificationRoute.notification);
app.head('/trello-notify/:id', notificationRoute.notificationHead);

// interactive messages from adaptive card in RingCentral app
app.post('/interactive-messages', notificationRoute.interactiveMessage);

// bots:
app.get('/bot-setup', botSetupRoute.setup);
app.get('/bot-info', refererChecker, botSetupRoute.info);
app.get('/bot-subscription', refererChecker, botSetupRoute.getSubscription);
app.post('/bot-subscription', refererChecker, botSetupRoute.saveSubscription);
app.delete('/bot-subscription', refererChecker, botSetupRoute.removeSubscription);
app.get('/bot-auth-setup', authorizationRoute.botAuthSetup);
app.post('/trello/bot-revoke', refererChecker, authorizationRoute.botRevokeToken);
extendBotApp(app, [], botHandler, botConfig);
app.get('/trello/bot-oauth-callback/:botToken', authorizationRoute.botOauthCallback);
app.post('/trello/bot-oauth-callback', refererChecker, authorizationRoute.botSaveToken);

app.use(function (err, req, res, next) {
  console.error(err && err.message);
  if (res.headersSent) {
    return next(err);
  }
  res.status(500);
  res.json({ result: 'error', message: 'Internal server error' });
});

exports.app = app;
