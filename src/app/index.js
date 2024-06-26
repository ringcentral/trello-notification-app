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

const app = express();
app.use(morgan('tiny'));
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

app.set('views', path.resolve(__dirname, './views'));
app.set('view engine', 'pug');

// RingCentral notification app setup page
app.get('/webhooks/new', webhooksRoute.newWebhook);
app.get('/webhooks/info', webhooksRoute.webhookInfo);
// Create or Update Trello webhook
app.post('/webhooks', webhooksRoute.createWebhook);

// authorize trello with only read permission
app.get('/trello/authorize', authorizationRoute.authorize);
// authorize trello with read and write permission
app.get('/trello/full-authorize', authorizationRoute.fullAuthorize);
app.get('/trello/oauth-callback', authorizationRoute.oauthCallback);
app.post('/trello/token', authorizationRoute.saveToken);
app.post('/trello/revoke', authorizationRoute.revokeToken);

// trello incoming webhook
app.post('/trello-notify/:id', notificationRoute.notification);
app.head('/trello-notify/:id', notificationRoute.notificationHead);

// interactive messages from adaptive card in RingCentral app
app.post('/interactive-messages', notificationRoute.interactiveMessage);

// bots:
app.get('/bot-setup', botSetupRoute.setup);
app.get('/bot-info', botSetupRoute.info);
app.get('/bot-subscription', botSetupRoute.getSubscription);
app.post('/bot-subscription', botSetupRoute.saveSubscription);
app.delete('/bot-subscription', botSetupRoute.removeSubscription);
app.get('/bot-auth-setup', authorizationRoute.botAuthSetup);
app.post('/trello/bot-revoke', authorizationRoute.botRevokeToken);
extendBotApp(app, [], botHandler, botConfig);
app.get('/trello/bot-oauth-callback/:botToken', authorizationRoute.botOauthCallback);
app.post('/trello/bot-oauth-callback', authorizationRoute.botSaveToken);

exports.app = app;
