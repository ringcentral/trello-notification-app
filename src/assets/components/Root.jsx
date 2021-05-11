import React, { useState, useEffect } from 'react';
import {
  RcThemeProvider,
  RcStepper,
  RcStep,
  RcStepLabel,
  RcLoading,
  RcStepButton,
} from '@ringcentral/juno';
import { styled } from '@ringcentral/juno/foundation';

import { AuthorizationPanel } from './AuthorizationPanel';
import { BoardSelectionPanel } from './BoardSelectionPanel';
import { FilterCheckList } from './FilterCheckList';

const Container = styled.div`
  display: flex;
  flex-direction: column;
  padding: 0 20px;
`;

function StepContent({
  activeStep,
  setActiveStep,
  setLoading,
  userInfo,
  boards,
  boardId,
  setBoardId,
  authorized,
  setAuthorized,
  selectedFilters,
  setSelectedFilters,
  integrationHelper,
}) {
  if (activeStep === 1) {
    return (
      <BoardSelectionPanel
        boards={boards}
        value={boardId}
        onChange={(id) => {
          setBoardId(id);
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
      />
    );
  }
  return (
    <AuthorizationPanel
      setLoading={setLoading}
      authorized={authorized}
      userInfo={userInfo}
      setAuthorized={setAuthorized}
      integrationHelper={integrationHelper}
      onLogout={() => {
        return fetch(window.trelloNotifications.authorizationRevokeUri);
      }}
      gotoNextStep={() => setActiveStep(1)}
    />
  );
}

export function App({ integrationHelper }) {
  const [loading, setLoading] = useState(false);
  const [activeStep, setActiveStep] = useState(0);
  const [completed, setCompleted] = useState({});
  const [authorized, setAuthorized] =
    useState(window.trelloNotifications.trelloAuthorized);
  const [boards, setBoards] = useState([]);
  const [userInfo, setUserInfo] = useState({});
  const [boardId, setBoardId] = useState(null);
  const [selectedFilters, setSelectedFilters] = useState([]);

  const markAsComplete = (step) => {
    const newComplete = { ...completed };
    newComplete[step] = true;
    setCompleted(newComplete);
  }

  const markAsUnComplete = (step) => {
    const newComplete = { ...completed };
    delete(newComplete[step]);
    setCompleted(newComplete);
  }

  // Listen authorized state to load trello webhook data:
  useEffect(() => {
    if (!authorized) {
      markAsUnComplete(0);
      return;
    }
    console.log('authorized');
    markAsComplete(0);
    async function getTrelloWebhookData() {
      setLoading(true);
      try {
        const response = await fetch(window.trelloNotifications.trelloWebhookInfoUri);
        const data = await response.json();
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
      }
      setLoading(false);
    }
    getTrelloWebhookData();
  }, [authorized]);

  // Listen selectedFilters to enable submit button
  useEffect(() => {
    if (selectedFilters.length > 0) {
      markAsComplete(2);
      integrationHelper.send({ canSubmit: true });
    } else {
      markAsUnComplete(2);
      integrationHelper.send({ canSubmit: false });
    }
  }, [selectedFilters]);

  // Listen selectedFilters to enable submit button
  useEffect(() => {
    if (boardId) {
      markAsComplete(1);
    } else {
      markAsUnComplete(1);
    }
  }, [boardId]);

  useEffect(() => {
    // Listen RingCentral app submit event to submit data to server
    integrationHelper.on('submit', async (e) => {
      await fetch(window.trelloNotifications.webhookCreationUri, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          boardId,
          filters: selectedFilters.join(','),
          rcWebhook: window.trelloNotifications.rcWebhookUri,
        }),
      });
      return {
        status: true
      }
    });
    return () => {
      integrationHelper.dispose();
    };
  }, [boardId, selectedFilters]);

  return (
    <RcThemeProvider>
      <RcLoading loading={loading}>
        <RcStepper activeStep={activeStep}>
          <RcStep completed={completed[0]}>
            {
              completed[0] ? (
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
          <RcStep completed={completed[1]}>
            {
              completed[1] ? (
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
          <RcStep completed={completed[2]}>
          {
              completed[2] ? (
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
            integrationHelper={integrationHelper}
          />
        </Container>
      </RcLoading>
    </RcThemeProvider>
  );
}
