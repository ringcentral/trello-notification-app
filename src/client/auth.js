import 'whatwg-fetch';
import React from 'react';
import ReactDOM from 'react-dom';

import { AuthSetup } from './pages/AuthSetup';
import { Client } from './lib/botClient';
import { Analytics } from './lib/analytics';

const client = new Client(window.trelloNotifications);
const analytics = new Analytics({
  segmentKey: window.trelloNotifications.segmentKey,
  appName: 'Trello Bot',
});
window.client = client;

ReactDOM.render(
  <AuthSetup client={client} analytics={analytics} />,
  document.querySelector('div#viewport'),
);
