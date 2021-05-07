import React, { useState } from 'react';
import { RcButton, RcTypography, RcLoading } from '@ringcentral/juno';
import { styled } from '@ringcentral/juno/foundation';

const Container = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  flex-direction: column;
  padding-top: 30px;
`;

export function AuthorizationPanel({
  setAuthorized,
  integrationHelper,
}) {
  const [loading, setLoading] = useState(false);
  return (
    <Container>
      <RcLoading loading={loading}>
        <RcTypography
          color="textPrimary"
          variant="subheading2"
          paragraph
          display="block"
        >
          To begin, please connect your Trello account.
        </RcTypography>
        <br />
        <RcButton onClick={() => {
          setLoading(true);
          integrationHelper.openWindow(window.trelloNotifications.authorizationUri);
          function onAuthCallback (e) {
            if (e.data && e.data.authCallback) {
              window.removeEventListener('message', onAuthCallback);
              if (e.data.authCallback.indexOf('error') > -1) {
                setLoading(false);
                return;
              }
              const tokenQuery = e.data.authCallback.split('#')[1];
              const uri = `${window.trelloNotifications.authorizationCallbackUri}?${tokenQuery}`
              fetch(uri, {
                method: 'POST',
              }).then(() => {
                setLoading(false);
                setAuthorized(true);
              }).catch(() => {
                setLoading(false);
              });
            }
          }
          window.addEventListener('message', onAuthCallback);
        }}>
          Connect to Trello
        </RcButton>
      </RcLoading>
    </Container>
  );
}
