import React, { useState } from 'react';
import { RcThemeProvider } from '@ringcentral/juno';

import { Authorization } from './AuthorizationPanel';
import { Configuration } from './ConfigurationPanel';

export function App({ integrationHelper }) {
  const [authorized, setAuthorized] =
    useState(window.trelloNotifications.trelloAuthorized);

  return (
    <RcThemeProvider>
      {
        authorized ? (
          <Configuration
            setAuthorized={setAuthorized}
            onLogout={() => {
              return fetch(window.trelloNotifications.authorizationRevokeUri);
            }}
            fetchTrelloInfo={() => {
              return fetch(window.trelloNotifications.trelloWebhookInfoUri);
            }}
          />
        ) : (
          <Authorization
            setAuthorized={setAuthorized}
            integrationHelper={integrationHelper}
          />
        )
      }
    </RcThemeProvider>
  );
}
