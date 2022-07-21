import React, { Fragment, useState } from 'react';
import { RcButton, RcText, RcTypography, RcDialog, RcDialogContent, RcDialogActions } from '@ringcentral/juno';
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
  description = 'To begin, please connect your Trello account.',
}) {
  return (
    <Fragment>
      <RcTypography
        color="textPrimary"
        variant="subheading1"
        paragraph
        display="block"
      >
        {description}
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
  const [confirmModalOpened, setConfirmModalOpened] = useState(false);
  return (
    <Fragment>
      <LoginInfo>
        <RcText variant="subheading1" color="textPrimary">
          Trello connected as &nbsp;
        </RcText>
        <RcText variant="subheading2">
          {userInfo.fullName}
        </RcText>
      </LoginInfo>  
      <ButtonGroup>
        <RcButton
          variant="outlined"
          onClick={() => setConfirmModalOpened(true)}
        >
          Logout
        </RcButton>
        &nbsp;
        &nbsp;
        {
          gotoNextStep && (
            <RcButton onClick={() => gotoNextStep()}>
              Next Step
            </RcButton>
          )
        }
      </ButtonGroup>
      <RcDialog
        open={confirmModalOpened}
        onClose={() => setConfirmModalOpened(false)}
      >
        <RcDialogContent>
          <RcTypography>Are you sure to unauthorize? All trello subscriptions that you created will be stopped after unauthorized.</RcTypography>
        </RcDialogContent>
        <RcDialogActions>
          <RcButton variant="outlined" onClick={() => setConfirmModalOpened(false)}>
            Cancel
          </RcButton>
          <RcButton onClick={() => {
            setConfirmModalOpened(false);
            onLogout();
          }}>Confirm</RcButton>
        </RcDialogActions>
      </RcDialog>
    </Fragment>
  );
}

export function AuthorizationPanel({
  authorized,
  onLogin,
  userInfo,
  onLogout,
  gotoNextStep,
  authDescription,
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
      description={authDescription}
    />
  );
}
