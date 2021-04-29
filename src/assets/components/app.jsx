import React, { useState } from 'react';
import { RcThemeProvider } from '@ringcentral/juno';

import { Authorization } from './authorization';
import { Configuration } from './configuration';

export function App({ integrationHelper }) {
  const [authorized, setAuthorized] =
    useState(window.trelloNotifications.trelloAuthorized);

  return (
    <RcThemeProvider>
      {
        authorized ? (
          <Configuration />
        ) : (
          <Authorization setAuthorized={setAuthorized} integrationHelper={integrationHelper} />
        )
      }
    </RcThemeProvider>
  );
}
