import 'whatwg-fetch';
import React from 'react';
import ReactDOM from 'react-dom';
import { RingCentralNotificationIntegrationHelper } from 'ringcentral-notification-integration-helper'

import { App } from './components/app';

const integrationHelper = new RingCentralNotificationIntegrationHelper()

ReactDOM.render(
  <App integrationHelper={integrationHelper} />,
  document.querySelector('div#viewport'),
);
