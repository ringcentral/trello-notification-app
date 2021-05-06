import React, { useState, useEffect } from 'react';
import { RcButton, RcLoading, RcSelect, RcListItem, RcGrid, RcCheckbox } from '@ringcentral/juno';
import { styled } from '@ringcentral/juno/foundation';
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

export function Configuration({ setAuthorized, fetchTrelloInfo, onLogout}) {
  const [loading, setLoading] = useState(true);
  const [boards, setBoards] = useState([]);
  const [userInfo, setUserInfo] = useState({});
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
      } catch (e) {
        console.error(e);
      }
      setLoading(false);
    }
    getBoardsData();
  }, []); 

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
            <BoardSelection />
          </RcGrid>
        </RcGrid>
        <TitleLine>
          Boards & Lists
        </TitleLine>
        <RcGrid container>
          <RcGrid item xs={6}>
            <RcCheckbox
              formControlLabelProps={{
                labelPlacement: 'end',
              }}
              label="List Created"
            />
          </RcGrid>
          <RcGrid item xs={6}>
            <RcCheckbox
              formControlLabelProps={{
                labelPlacement: 'end',
              }}
              label="List Archived/Unarchived"
            />
          </RcGrid>
          <RcGrid item xs={6}>
            <RcCheckbox
              formControlLabelProps={{
                labelPlacement: 'end',
              }}
              label="List Renamed"
            />
          </RcGrid>
          <RcGrid item xs={6}>
            <RcCheckbox
              formControlLabelProps={{
                labelPlacement: 'end',
              }}
              label="Board Renamed"
            />
          </RcGrid>
          <RcGrid item xs={6}>
            <RcCheckbox
              formControlLabelProps={{
                labelPlacement: 'end',
              }}
              label="List Moved to Another Board"
            />
          </RcGrid>
          <RcGrid item xs={6}>
            <RcCheckbox
              formControlLabelProps={{
                labelPlacement: 'end',
              }}
              label="Member Added to Board"
            />
          </RcGrid>
        </RcGrid>
        <TitleLine>
          Cards
        </TitleLine>
        <RcGrid container>
          <RcGrid item xs={6}>
            <RcCheckbox
              formControlLabelProps={{
                labelPlacement: 'end',
              }}
              label="Card Created"
            />
          </RcGrid>
          <RcGrid item xs={6}>
            <RcCheckbox
              formControlLabelProps={{
                labelPlacement: 'end',
              }}
              label="Description Changed"
            />
          </RcGrid>
          <RcGrid item xs={6}>
            <RcCheckbox
              formControlLabelProps={{
                labelPlacement: 'end',
              }}
              label="Card Moved"
            />
          </RcGrid>
          <RcGrid item xs={6}>
            <RcCheckbox
              formControlLabelProps={{
                labelPlacement: 'end',
              }}
              label="Due Date Changed"
            />
          </RcGrid>
          <RcGrid item xs={6}>
            <RcCheckbox
              formControlLabelProps={{
                labelPlacement: 'end',
              }}
              label="Card Renamed"
            />
          </RcGrid>
          <RcGrid item xs={6}>
            <RcCheckbox
              formControlLabelProps={{
                labelPlacement: 'end',
              }}
              label="Member Added to Card"
            />
          </RcGrid>
          <RcGrid item xs={6}>
            <RcCheckbox
              formControlLabelProps={{
                labelPlacement: 'end',
              }}
              label="Comment Added to Card"
            />
          </RcGrid>
          <RcGrid item xs={6}>
            <RcCheckbox
              formControlLabelProps={{
                labelPlacement: 'end',
              }}
              label="Card Archived/Unarchived"
            />
          </RcGrid>
          <RcGrid item xs={6}>
            <RcCheckbox
              formControlLabelProps={{
                labelPlacement: 'end',
              }}
              label="Attachment Added to Card"
            />
          </RcGrid>
        </RcGrid>
        <TitleLine>
          Checklists
        </TitleLine>
        <RcGrid container>
          <RcGrid item xs={6}>
            <RcCheckbox
              formControlLabelProps={{
                labelPlacement: 'end',
              }}
              label="Checklist Added to Card"
            />
          </RcGrid>
          <RcGrid item xs={6}>
            <RcCheckbox
              formControlLabelProps={{
                labelPlacement: 'end',
              }}
              label="Checklist Item Marked Complete/Incomplete"
            />
          </RcGrid>
          <RcGrid item xs={6}>
            <RcCheckbox
              formControlLabelProps={{
                labelPlacement: 'end',
              }}
              label="Checklist Item Created"
            />
          </RcGrid>
        </RcGrid>
      </RcLoading>
    </Container>
  );
}
