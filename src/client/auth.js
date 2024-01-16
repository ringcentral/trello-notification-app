import 'whatwg-fetch';
import React from 'react';
import ReactDOM from 'react-dom';

import { AuthSetup } from './pages/AuthSetup';
import { Client } from './lib/botClient';
import { Analytics } from './lib/analytics';

const client = new Client(window.trelloNotifications);
const analytics = new Analytics({
  mixpanelKey: window.trelloNotifications.mixpanelKey,
  appName: 'Trello Bot',
  botId: window.trelloNotifications.trackBotId,
  userId: window.trelloNotifications.trackUserId,
  accountId: window.trelloNotifications.trackAccountId,
});
window.client = client;

ReactDOM.render(
  <AuthSetup client={client} analytics={analytics} />,
  document.querySelector('div#viewport'),
);
