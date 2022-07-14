import React, { useState } from 'react';
import {
  RcList,
  RcListItem,
  RcListItemText,
  RcListItemSecondaryAction,
  RcIconButton,
  RcButton,
  RcTypography,
  RcDialog,
  RcDialogContent,
  RcDialogActions,
} from '@ringcentral/juno';
import { styled } from '@ringcentral/juno/foundation';
import { Edit, Delete } from '@ringcentral/juno/icon';
import { BoardSelection } from './BoardSelection';

const Wrapper = styled.div`
  display: flex;
  flex-direction: column;
  width: 100%;
  max-width: 400px;
  margin-left: auto;
  margin-right: auto;
  margin-top: 20px;
`;

const NewSubscriptionSection = styled.div`
  display: flex;
  flex-direction: row;
`;

const Header = styled(RcTypography)`
  margin-bottom: 10px;
  margin-top: 10px;
`;

const StyledBoardSelector = styled(BoardSelection)`
  flex: 1;
  margin-right: 20px;
`;

function SubscriptionItem({
  subscription,
  boards,
  onEdit,
  onDelete
}) {
  const [deleteModalOpened, setDeleteModalOpened] = useState(false);
  const board = boards.find(b => b.id === subscription.boardId);
  const name = board && board.name;
  return (
    <RcListItem>
      <RcListItemText primary={name} />
      <RcListItemSecondaryAction>
        <RcIconButton
          aria-label="Delete"
          size="small"
          symbol={Delete}
          onClick={() => setDeleteModalOpened(true)}
          title="Remove subscription"
          useRcTooltip
        />
        <RcIconButton
          aria-label="Edit"
          size="small"
          symbol={Edit}
          title="Edit subscription"
          useRcTooltip
          onClick={() => onEdit(subscription.id)}
        />
      </RcListItemSecondaryAction>
      <RcDialog
        open={deleteModalOpened}
        onClose={() => setDeleteModalOpened(false)}
      >
        <RcDialogContent>
          <RcTypography>Are you sure remove subscription for {name}? </RcTypography>
        </RcDialogContent>
        <RcDialogActions>
          <RcButton variant="outlined" onClick={() => setDeleteModalOpened(false)}>
            Cancel
          </RcButton>
          <RcButton onClick={() => {
            setDeleteModalOpened(false);
            onDelete(subscription.id);
          }}>Confirm</RcButton>
        </RcDialogActions>
      </RcDialog>
    </RcListItem>
  );
}

function SubscriptionList({
  subscriptions,
  boards,
  onDelete,
  onEdit,
}) {
  return (
    <RcList>
      {subscriptions.map((subscription) => {
        return (
          <SubscriptionItem
            key={subscription.id}
            subscription={subscription}
            boards={boards}
            onDelete={onDelete}
            onEdit={onEdit}
          />
        );
      })}
    </RcList>
  );
}

export function Subscriptions({
  subscriptions,
  boards,
  onNewSubscription,
  onDeleteSubscription,
  onEditSubscription,
  onSelectBoard,
  boardId,
}) {
  const otherBoards = boards.filter((board) => {
    return !subscriptions.find(s => s.boardId === board.id);
  });
  return (
    <Wrapper>
      {
        subscriptions.length > 0 && (
          <>
            <Header variant="body2">
                Subscriptions:
              </Header>
              <SubscriptionList
                subscriptions={subscriptions}
                boards={boards}
                onEdit={onEditSubscription}
                onDelete={onDeleteSubscription}
              />
          </>
        )
      }
      {
        otherBoards.length > 0 && (
          <>
            <Header variant="body2">
              New Subscription:
            </Header>
            <NewSubscriptionSection>
              <StyledBoardSelector
                boards={otherBoards}
                value={boardId}
                onChange={onSelectBoard}
              />
              <RcButton
                onClick={onNewSubscription}
                disabled={!boardId}
              >
                Add
              </RcButton>
            </NewSubscriptionSection>
          </>
        )
      }
    </Wrapper>
  );
}
