import React, { useState, useEffect, Fragment } from 'react';
import { RcButton, RcLoading, RcSelect, RcListItem, RcGrid, RcCheckbox } from '@ringcentral/juno';
import { styled } from '@ringcentral/juno/foundation';

import { filtersGroupByCategory } from '../../app/lib/filterOptions';

import { BoardSelection } from './BoardSelection';

const Container = styled.div`
  display: flex;
  flex-direction: column;
`;

const Line = styled.div`
  font-size: 15px;
  line-height: 20px;
  color: #666;
  margin: 10px 0;
`;

const TitleLine = styled.div`
  font-size: 15px;
  line-height: 20px;
  color: #666;
  margin: 10px 0;
  font-weight: bold;
`;

export function ConfigurationPanel({
  setAuthorized,
  fetchTrelloInfo,
  onLogout,
  integrationHelper,
  createWebhook,
}) {
  const [loading, setLoading] = useState(true);
  const [boards, setBoards] = useState([]);
  const [userInfo, setUserInfo] = useState({});
  const [boardId, setBoardId] = useState(null);
  const [selectedFilters, setSelectedFilters] = useState([]);
  useEffect(() => {
    async function getBoardsData() {
      setLoading(true);
      try {
        const response = await fetchTrelloInfo();
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
    getBoardsData();
  }, []);
  useEffect(() => {
    integrationHelper.on('submit', async (e) => {
      await createWebhook({ boardId, filters: selectedFilters.join(',') });
      return {
        status: true
      }
    });
    return () => {
      integrationHelper.dispose();
    };
  }, [boardId, selectedFilters]);

  // Listen selectedFilters to enable submit button
  useEffect(() => {
    if (selectedFilters.length > 0) {
      integrationHelper.send({ canSubmit: true });
    } else {
      integrationHelper.send({ canSubmit: false });
    }
  }, [selectedFilters])

  return (
    <Container>
      <RcLoading loading={loading}>
        <RcGrid container>
          <RcGrid item xs={8}>
            <Line>
              Authenticated as <strong>{userInfo.fullName}</strong>
            </Line>
          </RcGrid>
          <RcGrid item xs={4}>
            <RcButton
              onClick={async () => {
                setLoading(true);
                await onLogout();
                setLoading(false);
                setAuthorized(false);
              }}
            >
              Logout
            </RcButton>
          </RcGrid>
        </RcGrid>
        <Line>
        Use the form below to configure which events on Trello will create a new post in RingCentral.
        </Line>
        <RcGrid container>
          <RcGrid item xs={2}>
            <Line>
              Boards:
            </Line>
          </RcGrid>
          <RcGrid item xs={10}>
            <BoardSelection boards={boards} value={boardId} onChange={(id) => {
              setBoardId(id);
            }} />
          </RcGrid>
        </RcGrid>
        {
          filtersGroupByCategory.map((category) => (
            <Fragment key={category.id}>
              <TitleLine>
                {category.name}
              </TitleLine>
              <RcGrid container>
                {
                  category.items.map((item) => (
                    <RcGrid item xs={6} key={item.id}>
                      <RcCheckbox
                        formControlLabelProps={{
                          labelPlacement: 'end',
                        }}
                        label={item.name}
                        checked={selectedFilters.indexOf(item.id) > -1}
                        onChange={(event) => {
                          if (event.target.checked) {
                            setSelectedFilters(selectedFilters.filter(f => f !== item.id).concat([item.id]));
                          } else {
                            setSelectedFilters(selectedFilters.filter(f => f !== item.id));
                          }
                        }}
                      />
                    </RcGrid>
                  ))
                }
              </RcGrid>
            </Fragment>
          ))
        }
      </RcLoading>
    </Container>
  );
}
