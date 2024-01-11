import 'whatwg-fetch';
import React from 'react';
import ReactDOM from 'react-dom';
import { RingCentralNotificationIntegrationHelper } from 'ringcentral-notification-integration-helper'

import { NotificationSetup } from './pages/NotificationSetup';
import { Client } from './lib/client';
import { Analytics } from './lib/analytics';

const integrationHelper = new RingCentralNotificationIntegrationHelper()
const client = new Client(window.trelloNotifications);
const analytics = new Analytics({
  mixpanelKey: window.trelloNotifications.mixpanelKey,
});
window.client = client;

ReactDOM.render(
  <NotificationSetup integrationHelper={integrationHelper} client={client} analytics={analytics} />,
  document.querySelector('div#viewport'),
);
