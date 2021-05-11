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
  setError,
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
              setError('Authorization error')
              setLoading(false);
              return;
            }
            const tokenQuery = e.data.authCallback.split('#')[1];
            const uri = `${authorizationCallbackUri}?${tokenQuery}`
            fetch(uri, {
              method: 'POST',
            }).then((res) => {
              if (res.status !== 200) {
                return Promise.reject('Authorization error');
              }
              setLoading(false);
              setAuthorized(true);
            }).catch(() => {
              setLoading(false);
              setError('Authorization error please retry later.')
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
  setError,
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
            try {
              await onLogout();
              setLoading(false);
              setAuthorized(false);
            } catch (e) {
              console.error(e);
              setLoading(false);
              setError('Logout error please retry later.');
            }
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
  setError,
}) {
  if (authorized) {
    return (
      <UserCenter
        userInfo={userInfo}
        onLogout={onLogout}
        setLoading={setLoading}
        setAuthorized={setAuthorized}
        gotoNextStep={gotoNextStep}
        setError={setError}
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
      setError={setError}
    />
  );
}
