import React, {
  useEffect,
  useState,
} from 'react';

import {
  RcSnackbar,
  RcSnackbarAction,
  RcIconButton,
  RcLoading,
  RcStep,
  RcStepButton,
  RcStepLabel,
  RcStepper,
  RcThemeProvider,
  RcButton,
} from '@ringcentral/juno';
import { styled } from '@ringcentral/juno/foundation';
import { Feedback, Close } from '@ringcentral/juno/icon';

import { AuthorizationPanel } from '../components/AuthorizationPanel';
import { Subscriptions } from '../components/Subscriptions';
import { FilterCheckList } from '../components/FilterCheckList';

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

const FilterSection = styled.div`
  display: flex;
  flex-direction: column;
  align-items: flex-end;
`;

const StyledSnackbar = styled(RcSnackbar)`
  max-width: 400px;
  margin-left: auto;
  margin-right: auto;
`;

const StyledStepper = styled(RcStepper)`
  margin-top: 20px;
`;

function StepContent({
  activeStep,
  userInfo,
  boards,
  boardId,
  setBoardId,
  subscriptions,
  authorized,
  selectedFilters,
  setSelectedFilters,
  onLogin,
  onLogout,
  analytics,
  onSaveSubscription,
  gotoSubscriptions,
  onEditSubscription,
  onNewSubscription,
  onDeleteSubscription,
}) {
  if (activeStep === 1) {
    return (
      <Subscriptions
        boards={boards}
        subscriptions={subscriptions}
        onEditSubscription={onEditSubscription}
        onDeleteSubscription={onDeleteSubscription}
        boardId={boardId}
        onSelectBoard={(id) => {
          setBoardId(id);
        }}
        onNewSubscription={onNewSubscription}
      />
    );
  }
  if (activeStep === 2) {
    return (
      <FilterSection>
        <FilterCheckList
          selectedFilters={selectedFilters}
          setSelectedFilters={setSelectedFilters}
          analytics={analytics}
        />
        <br />
        <br />
        <RcButton
          disabled={selectedFilters.length === 0}
          onClick={onSaveSubscription}
        >
          Save
        </RcButton>
      </FilterSection>
    );
  }
  return (
    <AuthorizationPanel
      authorized={authorized}
      userInfo={userInfo}
      gotoNextStep={gotoSubscriptions}
      onLogin={onLogin}
      onLogout={onLogout}
    />
  );
}

export function BotSetup({ client, analytics }) {
  const [loading, setLoading] = useState(false);
  const [activeStep, setActiveStep] = useState(
    client.trelloAuthorized ? 1 : 0
  );
  const [message, setMessage] = useState({});
  const [authorizationCompleted, setAuthorizationCompleted] = useState(false);
  const [boardSelectionCompleted, setBoardSelectionCompleted] = useState(false);
  const [filterSettingCompleted, setFilterSettingCompleted] = useState(false);

  const [authorized, setAuthorized] = useState(false);
  const [boards, setBoards] = useState([]);
  const [subscriptions, setSubscriptions] = useState([]);
  const [userInfo, setUserInfo] = useState({});
  const [boardId, setBoardId] = useState(null);
  const [subscriptionId, setSubscriptionId] = useState(null);
  const [selectedFilters, setSelectedFilters] = useState([]);
  const [boardStepName, setBoardStepName] = useState('Select board');

  useEffect(() => {
    async function syncInfo() {
      try {
        setLoading(true);
        const info = await client.getInfo();
        setAuthorized(info.trelloAuthorized);
        setUserInfo(info.trelloUser);
        setBoards(info.boards);
        setSubscriptions(info.subscriptions);
        if (info.trelloAuthorized) {
          setActiveStep(1);
        }
        setLoading(false);
      } catch (e) {
        console.error(e);
        setMessage({ message: e.message, type: 'error' });
        setAuthorized(false);
        setLoading(false);
      }
    }
    syncInfo();
  }, [])

  useEffect(() => {
    if (authorized) {
      setAuthorizationCompleted(true);
    } else {
      setAuthorizationCompleted(false);
    }
  }, [authorized]);

  useEffect(() => {
    if (!subscriptionId) {
      setSelectedFilters([]);
      return;
    }
    async function fetchSubscription() {
      try {
        setLoading(true);
        const subscription = await client.getSubscription(subscriptionId);
        setSelectedFilters(subscription.config.filters.split(','));
        setLoading(false);
      } catch (e) {
        console.error(e);
        setMessage({ message: e.message, type: 'error' });
        setLoading(false);
      }
    }
    fetchSubscription();
  }, [subscriptionId])

  useEffect(() => {
    if (selectedFilters.length > 0) {
      setFilterSettingCompleted(true);
    } else {
      setFilterSettingCompleted(false);
    }
  }, [selectedFilters]);

  useEffect(() => {
    if (boardId || subscriptionId) {
      setBoardSelectionCompleted(true);
    } else {
      setBoardSelectionCompleted(false);
    }
  }, [boardId, subscriptionId]);

  useEffect(() => {
    if (activeStep !== 2 || (!boardId && !subscriptionId)) {
      setBoardStepName('Select board');
      return;
    }
    let id;
    if (subscriptionId) {
      const subscription = subscriptions.find(s => s.id === subscriptionId);
      id = subscription.boardId;
    } else {
      id = boardId;
    }
    const board = boards.find((b) => b.id === id);
    if (board) {
      setBoardStepName(board.name);
    }
  }, [activeStep, boardId, subscriptionId, boards, subscriptions]);

  const checkAuthorization = async () => {
    setLoading(true);
    let authorized = false;
    try {
      const info = await client.getInfo();
      authorized = info.trelloAuthorized
      setAuthorized(info.trelloAuthorized);
      setUserInfo(info.trelloUser);
      setBoards(info.boards);
      setSubscriptions(info.subscriptions);
    } catch (e) {
      console.error(e);
      setMessage({ message: e.message, type: 'error' });
    }
    if (authorized) {
      setLoading(false);
      setAuthorizationCompleted(true);
      return;
    }
    setTimeout(() => {
      checkAuthorization();
    }, 3000);
  }

  return (
    <RcThemeProvider theme={theme}>
      <RcLoading loading={loading}>
        <StyledStepper activeStep={activeStep}>
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
                <RcStepButton onClick={() => {
                  setActiveStep(1);
                  setSubscriptionId(null);
                }}>
                  {boardStepName}
                </RcStepButton>
              ) : (
                <RcStepLabel>
                  {boardStepName}
                </RcStepLabel>
              )
            }
          </RcStep>
          <RcStep completed={filterSettingCompleted}>
            <RcStepLabel>
              Set filters
            </RcStepLabel>
          </RcStep>
        </StyledStepper>
        <Container>
          <StepContent
            activeStep={activeStep}
            userInfo={userInfo}
            boards={boards}
            boardId={boardId}
            setBoardId={setBoardId}
            authorized={authorized}
            subscriptions={subscriptions}
            gotoSubscriptions={() => setActiveStep(1)}
            onEditSubscription={(id) => {
              setSubscriptionId(id);
              setActiveStep(2);
            }}
            onNewSubscription={() => {
              setSubscriptionId(null);
              setActiveStep(2);
            }}
            onSaveSubscription={async () => {
              setLoading(true);
              let boardName = '';
              if (!subscriptionId) {
                const board = boards.find(b => b.id === boardId);
                boardName = board && board.name;
              }
              try {
                await client.saveSubscription({
                  subscriptionId,
                  filters: selectedFilters,
                  boardId,
                  boardName,
                });
                if (boardId) {
                  const info = await client.getInfo();
                  setBoards(info.boards);
                  setSubscriptions(info.subscriptions);
                }
                setLoading(false);
                let messageText = 'Subscription saved successfully.';
                if (boardId) {
                  messageText = 'Subscription created successfully.';
                }
                setMessage({ message: messageText, type: 'success' });
                setBoardId(null);
                setSubscriptionId(null);
                setActiveStep(1);
              } catch (e) {
                console.error(e);
                setLoading(false);
                setMessage({ message: e.message, type: 'error' });
              }
              analytics.track('Save Trello subscription');
            }}
            onDeleteSubscription={async (id, name) => {
              try {
                setLoading(true);
                await client.removeSubscription(id, name);
                setSubscriptionId(null);
                const info = await client.getInfo();
                setBoards(info.boards);
                setSubscriptions(info.subscriptions);
                setLoading(false);
                setMessage({ message: 'Subscription is removed successfully', type: 'success' });
              } catch (e) {
                console.error(e);
                setLoading(false);
                setMessage({ message: e.message, type: 'error' });
              }
            }}
            selectedFilters={selectedFilters}
            setSelectedFilters={setSelectedFilters}
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
                setMessage({ message: 'Logout error please retry later.', type: 'error' });
              }
              analytics.track('Unauthorize Trello');
            }}
            analytics={analytics}
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
