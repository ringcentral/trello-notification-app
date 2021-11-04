const path = require('path');

const authorizationRoute = require('./routes/authorization');
const webhooksRoute = require('./routes/webhooks');
const trelloNotifyRoute = require('./routes/trello-notify');
const interactiveMessageRoute = require('./routes/interactive-messages');

// extends or override express app as you need
exports.appExtend = (app) => {
  app.set('views', path.resolve(__dirname, './views'));
  app.set('view engine', 'pug');

  // RingCentral notification app main page
  app.get('/webhooks/new', webhooksRoute.newWebhook);
  app.get('/webhooks/info', webhooksRoute.webhookInfo);
  // Create or Update Trello webhook
  app.post('/webhooks', webhooksRoute.createWebhook);

  // authorize trello
  app.get('/trello/authorize', authorizationRoute.authorize);
  app.get('/trello/oauth-callback', authorizationRoute.oauthCallback);
  app.post('/trello/token', authorizationRoute.saveToken);
  app.post('/trello/revoke', authorizationRoute.revokeToken);

  // trello incoming webhook
  app.post('/trello-notify/:id', trelloNotifyRoute.notify);
  app.head('/trello-notify/:id', trelloNotifyRoute.head);

  app.post('/interactive-messages', interactiveMessageRoute.interactiveMessage);
}
