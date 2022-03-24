import React, {
  useEffect,
  useState,
  useCallback,
} from 'react';

import {
  RcAlert,
  RcIconButton,
  RcLoading,
  RcStep,
  RcStepButton,
  RcStepLabel,
  RcStepper,
  RcThemeProvider,
} from '@ringcentral/juno';
import { styled } from '@ringcentral/juno/foundation';
import { Feedback } from '@ringcentral/juno/icon';

import { AuthorizationPanel } from './AuthorizationPanel';
import { BoardSelectionPanel } from './BoardSelectionPanel';
import { FilterCheckList } from './FilterCheckList';

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
  padding: 0 20px;
  justify-content: center;
  align-items: center;
`;

const FloatingLink = styled.a`
  position: fixed;
  right: 10px;
  bottom: 20px;
`;

function StepContent({
  activeStep,
  setActiveStep,
  userInfo,
  boards,
  boardId,
  setBoardId,
  authorized,
  selectedFilters,
  setSelectedFilters,
  onLogin,
  onLogout,
  analytics
}) {
  if (activeStep === 1) {
    return (
      <BoardSelectionPanel
        boards={boards}
        value={boardId}
        onChange={(id) => {
          setBoardId(id);
          analytics.track('Select Board');
        }}
        gotoUpperStep={() => setActiveStep(0)}
        gotoNextStep={() => {
          setActiveStep(2);
        }}
      />
    );
  }
  if (activeStep === 2) {
    return (
      <FilterCheckList
        selectedFilters={selectedFilters}
        setSelectedFilters={setSelectedFilters}
        analytics={analytics}
      />
    );
  }
  return (
    <AuthorizationPanel
      authorized={authorized}
      userInfo={userInfo}
      gotoNextStep={() => setActiveStep(1)}
      onLogin={onLogin}
      onLogout={onLogout}
    />
  );
}

export function App({ integrationHelper, client, analytics }) {
  const [loading, setLoading] = useState(false);
  const [activeStep, setActiveStep] = useState(
    client.trelloAuthorized ? 1 : 0
  );
  const [error, setError] = useState('');
  const [authorizationCompleted, setAuthorizationCompleted] = useState(false);
  const [boardSelectionCompleted, setBoardSelectionCompleted] = useState(false);
  const [filterSettingCompleted, setFilterSettingCompleted] = useState(false);

  const [authorized, setAuthorized] = useState(client.trelloAuthorized);
  const [boards, setBoards] = useState([]);
  const [userInfo, setUserInfo] = useState({});
  const [boardId, setBoardId] = useState(null);
  const [selectedFilters, setSelectedFilters] = useState([]);
  
  // Listen authorized state to load trello webhook data:
  useEffect(() => {
    if (!authorized) {
      setActiveStep(0);
      setAuthorizationCompleted(false);
      setBoardSelectionCompleted(false);
      setFilterSettingCompleted(false);
      setBoards([]);
      setUserInfo({});
      setBoardId(null);
      setSelectedFilters([]);
      return;
    }
    setAuthorizationCompleted(true);
    async function getTrelloWebhookData() {
      setLoading(true);
      try {
        const data = await client.getInfo();
        if (data.boards) {
          setBoards(data.boards);
        }
        if (data.userInfo) {
          setUserInfo(data.userInfo);
        }
        if (data.config) {
          setBoardId(data.config.boardId || (data.boards[0] && data.boards[0].id));
          if (data.config.filters && data.config.filters.length > 0) {
            setSelectedFilters(data.config.filters.split(','));
          }
        }
      } catch (e) {
        console.error(e);
        if (e.message === 'Unauthorized') {
          setError('Authorization required.');
          setAuthorized(false);
        } else {
          setError('Fetch data error please retry later');
        }
      }
      setLoading(false);
    }
    getTrelloWebhookData();
  }, [authorized]);

  // Listen selectedFilters to enable submit button
  useEffect(() => {
    if (selectedFilters.length > 0) {
      setFilterSettingCompleted(true);
      integrationHelper.send({ canSubmit: true });
    } else {
      setFilterSettingCompleted(false);
      integrationHelper.send({ canSubmit: false });
    }
  }, [selectedFilters]);

  // Listen selectedFilters to enable submit button
  useEffect(() => {
    if (boardId && boardId.length > 0) {
      setBoardSelectionCompleted(true);
    } else {
      setBoardSelectionCompleted(false);
    }
  }, [boardId]);

  useEffect(() => {
    // Listen RingCentral app submit event to submit data to server
    integrationHelper.on('submit', async (e) => {
      setLoading(true);
      analytics.track('Subscribe webhook');
      try {
        await client.createWebhook({
          boardId,
          filters: selectedFilters.join(','),
        });
        setLoading(false);
        return {
          status: true,
        }
      } catch (e) {
        setLoading(false);
        console.error(e);
        if (e.message === 'Unauthorized') {
          setError('Authorization required.');
          setAuthorized(false);
        } else {
          setError('Submit data error please retry later');
        }
        return {
          status: false
        }
      }
    });
    return () => {
      integrationHelper.dispose();
    };
  }, [boardId, selectedFilters]);
  const onAuthCallback = useCallback(async (e) => {
    if (e.data && e.data.authCallback) {
      window.removeEventListener('message', onAuthCallback);
      if (e.data.authCallback.indexOf('error') > -1) {
        setError('Authorization error')
        setLoading(false);
        analytics.track('Authorize Trello error');
        return;
      }
      setLoading(true);
      try {
        await client.saveToken(e.data.authCallback);
        setAuthorized(true);
        setError('');
        analytics.track('Authorize Trello success');
      } catch (e) {
        console.error(e);
        setError('Authorization error please retry later.')
      }
      setLoading(false);
    }
  }, []);
  return (
    <RcThemeProvider theme={theme}>
      <RcLoading loading={loading}>
        {
          (error && error.length > 0) ? (
            <RcAlert severity="warning" onClose={() => setError('')}>
              {error}
            </RcAlert>
          ) : null
        }
        <RcStepper activeStep={activeStep}>
          <RcStep completed={authorizationCompleted}>
            {
              authorizationCompleted ? (
                <RcStepButton onClick={() => setActiveStep(0)}>
                  Authorization
                </RcStepButton>
              ) : (
                <RcStepLabel>
                  Authorization
                </RcStepLabel>
              )
            }
          </RcStep>
          <RcStep completed={boardSelectionCompleted}>
            {
              boardSelectionCompleted ? (
                <RcStepButton onClick={() => setActiveStep(1)}>
                  Select Board
                </RcStepButton>
              ) : (
                <RcStepLabel>
                  Select Board
                </RcStepLabel>
              )
            }
          </RcStep>
          <RcStep completed={filterSettingCompleted}>
            {
              filterSettingCompleted ? (
                <RcStepButton onClick={() => setActiveStep(2)}>
                  Set filters
                </RcStepButton>
              ) : (
                <RcStepLabel>
                  Set filters
                </RcStepLabel>
              )
            }
          </RcStep>
        </RcStepper>
        <Container>
          <StepContent
            activeStep={activeStep}
            setActiveStep={setActiveStep}
            setLoading={setLoading}
            userInfo={userInfo}
            boards={boards}
            boardId={boardId}
            setBoardId={setBoardId}
            authorized={authorized}
            setAuthorized={setAuthorized}
            selectedFilters={selectedFilters}
            setSelectedFilters={setSelectedFilters}
            setError={setError}
            integrationHelper={integrationHelper}
            onLogin={() => {
              setLoading(true);
              integrationHelper.openWindow(client.authorizationUri);
              analytics.track('Authorize Trello');
              window.removeEventListener('message', onAuthCallback);
              window.addEventListener('message', onAuthCallback);
              setTimeout(() => {
                setLoading(false);
              }, 2000);
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
                setError('Logout error please retry later.');
              }
              analytics.track('Unauthorize Trello');
            }}
            analytics={analytics}
          />
        </Container>
        <FloatingLink
          href="https://github.com/ringcentral/trello-notification-app/issues/new"
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
    </RcThemeProvider>
  );
}
