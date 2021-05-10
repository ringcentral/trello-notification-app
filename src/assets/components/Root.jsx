import React, { useState } from 'react';
import { RcThemeProvider } from '@ringcentral/juno';

import { AuthorizationPanel } from './AuthorizationPanel';
import { ConfigurationPanel } from './ConfigurationPanel';

export function App({ integrationHelper }) {
  const [authorized, setAuthorized] =
    useState(window.trelloNotifications.trelloAuthorized);

  return (
    <RcThemeProvider>
      {
        authorized ? (
          <ConfigurationPanel
            setAuthorized={setAuthorized}
            onLogout={() => {
              return fetch(window.trelloNotifications.authorizationRevokeUri);
            }}
            fetchTrelloInfo={() => {
              return fetch(window.trelloNotifications.trelloWebhookInfoUri);
            }}
            integrationHelper={integrationHelper}
            createWebhook={({ boardId, filters }) => {
              return fetch(window.trelloNotifications.webhookCreationUri, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  boardId,
                  filters,
                  rcWebhook: window.trelloNotifications.rcWebhookUri,
                }),
              });
            }}
          />
        ) : (
          <AuthorizationPanel
            setAuthorized={setAuthorized}
            integrationHelper={integrationHelper}
          />
        )
      }
    </RcThemeProvider>
  );
}
