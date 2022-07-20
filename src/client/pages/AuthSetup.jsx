import React, {
  useEffect,
  useState,
} from 'react';

import {
  RcSnackbar,
  RcSnackbarAction,
  RcIconButton,
  RcLoading,
  RcThemeProvider,
} from '@ringcentral/juno';
import { styled } from '@ringcentral/juno/foundation';
import { Feedback, Close } from '@ringcentral/juno/icon';

import { AuthorizationPanel } from '../components/AuthorizationPanel';

const theme = {
  palette: {
    action: {
      primary: '#2559E4',
    },
    primary: {
      main: '#2559E4',
    },
    informative: { b01: '#F5F6FB', f01: '#E3EAFC', f02: '#2559E4' },
    interactive: { b01: '#F5F6FB', b02: '#2559E4', f01: '#2559E4' },
  }
};

const Container = styled.div`
  display: flex;
  flex-direction: column;
  padding: 0;
  justify-content: center;
  align-items: center;
  margin-top: 50px;
`;

const FloatingLink = styled.a`
  position: fixed;
  right: 10px;
  bottom: 20px;
`;

const StyledSnackbar = styled(RcSnackbar)`
  max-width: 400px;
  margin-left: auto;
  margin-right: auto;
`;

export function AuthSetup({ client, analytics }) {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({});

  const [authorized, setAuthorized] = useState(false);
  const [userInfo, setUserInfo] = useState({});

  useEffect(() => {
    async function syncInfo() {
      try {
        setLoading(true);
        const info = await client.getInfo();
        setAuthorized(info.trelloAuthorized);
        setUserInfo(info.trelloUser);
        setLoading(false);
      } catch (e) {
        console.error(e);
        setMessage({ message: e.message, type: 'error' });
        setAuthorized(false);
        setLoading(false);
      }
    }
    syncInfo();
  }, []);

  const checkAuthorization = async () => {
    setLoading(true);
    let authorized = false;
    try {
      const info = await client.getInfo();
      authorized = info.trelloAuthorized
      setAuthorized(info.trelloAuthorized);
      setUserInfo(info.trelloUser);
    } catch (e) {
      console.error(e);
      setMessage({ message: e.message, type: 'error' });
    }
    if (authorized) {
      setLoading(false);
      return;
    }
    setTimeout(() => {
      checkAuthorization();
    }, 3000);
  }

  return (
    <RcThemeProvider theme={theme}>
      <RcLoading loading={loading}>
        <Container>
          <AuthorizationPanel
            authDescription="Connect Trello account for interactive buttons."
            authorized={authorized}
            userInfo={userInfo}
            onLogin={() => {
              setLoading(true);
              window.open(client.authorizationUri, '_blank');
              analytics.track('Authorize Trello');
              setTimeout(() => {
                checkAuthorization();
              }, 5000);
            }}
            onLogout={async () => {
              setLoading(true);
              try {
                await client.unauthorize();
                setLoading(false);
                setAuthorized(false);
              } catch (e) {
                console.error(e);
                setLoading(false);
                setMessage({ message: e.message, type: 'error' });
              }
              analytics.track('Unauthorize Trello');
            }}
          />
        </Container>
        <FloatingLink
          href="https://forms.gle/NavQjjv8SF2uyydc8"
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => {
            analytics.track('Click feedback button');
          }}
        >
          <RcIconButton
            symbol={Feedback}
            variant="contained"
            color="action.primary"
            title="Feedback (Any suggestions, or issues about the Trello notification app?)"
          />
        </FloatingLink>
      </RcLoading>
      <StyledSnackbar
        action={
          <RcSnackbarAction
            aria-label="close"
            onClick={() => {
              setMessage({
                ...message,
                message: null,
              });
            }}
            symbol={Close}
            variant="icon"
          />
        }
        autoHideDuration={10000}
        message={message.message}
        open={!!message.message}
        type={message.type}
        onClose={(_, reason) => {
          if (reason === 'clickaway') {
            return;
          }
          setMessage({
            ...message,
            message: null,
          });
        }}
      />
    </RcThemeProvider>
  );
}
