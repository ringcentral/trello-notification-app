import React, {Fragment } from 'react';
import { RcButton, RcText, RcTypography } from '@ringcentral/juno';
import { styled } from '@ringcentral/juno/foundation';

const ButtonGroup = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  flex-direction: row;
`;

const LoginInfo = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  flex-direction: row;
  padding: 20px 0;
`;

function LoginPanel({
  authorizationUri,
  authorizationCallbackUri,
  setLoading,
  setAuthorized,
  integrationHelper,
}) {
  return (
    <Fragment>
      <RcTypography
        color="textPrimary"
        variant="subheading1"
        paragraph
        display="block"
      >
        To begin, please connect your Trello account.
      </RcTypography>
      <br />
      <RcButton onClick={() => {
        setLoading(true);
        integrationHelper.openWindow(authorizationUri);
        function onAuthCallback (e) {
          if (e.data && e.data.authCallback) {
            window.removeEventListener('message', onAuthCallback);
            if (e.data.authCallback.indexOf('error') > -1) {
              setLoading(false);
              return;
            }
            const tokenQuery = e.data.authCallback.split('#')[1];
            const uri = `${authorizationCallbackUri}?${tokenQuery}`
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
        setTimeout(() => {
          setLoading(false);
        }, 2000);
      }}>
        Connect to Trello
      </RcButton>
    </Fragment>
  )
}

function UserCenter({
  userInfo,
  setLoading,
  onLogout,
  setAuthorized,
  gotoNextStep,
}) {
  return (
    <Fragment>
      <LoginInfo>
        <RcText variant="subheading1" color="textPrimary">
          Authenticated as &nbsp;
        </RcText>
        <RcText variant="subheading2">
          {userInfo.fullName}
        </RcText>
      </LoginInfo>  
      <ButtonGroup>
        <RcButton
          variant="outlined"
          onClick={async () => {
            setLoading(true);
            await onLogout();
            setLoading(false);
            setAuthorized(false);
          }}
        >
          Logout
        </RcButton>
        &nbsp;
        &nbsp;
        <RcButton onClick={() => gotoNextStep()}>
          Next Step
        </RcButton>
      </ButtonGroup>
    </Fragment>
  );
}

export function AuthorizationPanel({
  authorized,
  setAuthorized,
  integrationHelper,
  setLoading,
  userInfo,
  onLogout,
  gotoNextStep,
}) {
  if (authorized) {
    return (
      <UserCenter
        userInfo={userInfo}
        onLogout={onLogout}
        setLoading={setLoading}
        setAuthorized={setAuthorized}
        gotoNextStep={gotoNextStep}
      />
    );
  }

  return (
    <LoginPanel
      integrationHelper={integrationHelper}
      setAuthorized={setAuthorized}
      setLoading={setLoading}
      authorizationUri={window.trelloNotifications.authorizationUri}
      authorizationCallbackUri={window.trelloNotifications.authorizationCallbackUri}
    />
  );
}
