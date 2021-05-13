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
  onLogin,
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
      <RcButton onClick={onLogin}>
        Connect to Trello
      </RcButton>
    </Fragment>
  )
}

function UserCenter({
  userInfo,
  onLogout,
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
          onClick={onLogout}
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
  onLogin,
  userInfo,
  onLogout,
  gotoNextStep,
}) {
  if (authorized) {
    return (
      <UserCenter
        userInfo={userInfo}
        onLogout={onLogout}
        gotoNextStep={gotoNextStep}
      />
    );
  }

  return (
    <LoginPanel
      onLogin={onLogin}
    />
  );
}
