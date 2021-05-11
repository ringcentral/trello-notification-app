import React, { useState, useEffect } from 'react';
import {
  RcThemeProvider,
  RcStepper,
  RcStep,
  RcStepLabel,
  RcLoading,
  RcStepButton,
  RcAlert,
} from '@ringcentral/juno';
import { styled } from '@ringcentral/juno/foundation';

import { AuthorizationPanel } from './AuthorizationPanel';
import { BoardSelectionPanel } from './BoardSelectionPanel';
import { FilterCheckList } from './FilterCheckList';

const Container = styled.div`
  display: flex;
  flex-direction: column;
  padding: 0 20px;
  justify-content: center;
  align-items: center;
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
  setError,
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
      onLogout={async () => {
        const resp = await fetch(window.trelloNotifications.authorizationRevokeUri);
        if (resp.status !== 200) {
          throw new Error('Logout error');
        }
      }}
      gotoNextStep={() => setActiveStep(1)}
      setError={setError}
    />
  );
}

export function App({ integrationHelper }) {
  const [loading, setLoading] = useState(false);
  const [activeStep, setActiveStep] = useState(
    window.trelloNotifications.trelloAuthorized ? 1 : 0
  );
  const [error, setError] = useState('');
  const [authorizationCompleted, setAuthorizationCompleted] = useState(false);
  const [boardSelectionCompleted, setBoardSelectionCompleted] = useState(false);
  const [filterSettingCompleted, setFilterSettingCompleted] = useState(false);

  const [authorized, setAuthorized] =
    useState(window.trelloNotifications.trelloAuthorized);
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
        const response = await fetch(window.trelloNotifications.trelloWebhookInfoUri);
        if (response.status !== 200) {
          throw new Error('Fetch data error please retry later')
        }
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
        setError('Fetch data error please retry later');
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
      try {
        const response = await fetch(window.trelloNotifications.webhookCreationUri, {
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
        setLoading(false);
        if (response.status !== 200) {
          throw new Error('Submit data error please retry later')
        }
        return {
          status: true,
        }
      } catch (e) {
        setLoading(false);
        console.error(e);
        setError('Submit data error please retry later');
        return {
          status: false
        }
      }
    });
    return () => {
      integrationHelper.dispose();
    };
  }, [boardId, selectedFilters]);

  return (
    <RcThemeProvider>
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
          />
        </Container>
      </RcLoading>
    </RcThemeProvider>
  );
}
