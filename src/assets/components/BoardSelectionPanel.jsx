import React from 'react';
import { RcSelect, RcListItem, RcButton, RcGrid } from '@ringcentral/juno';
import { styled } from '@ringcentral/juno/foundation';

const ButtonGroup = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  flex-direction: row;
`;

const SelectionWrapper = styled.div`
  padding: 20px 0;
  display: flex;
  justify-content: center;
  align-items: center;
  flex-direction: row;
`;

export function BoardSelectionPanel({
  boards,
  value,
  onChange,
  gotoUpperStep,
  gotoNextStep,
}) {
  const items = boards.map((board) => {
    return (
      <RcListItem value={board.id} key={board.id}>
        {board.name}
      </RcListItem>
    )
  });
  return (
    <div>
      <SelectionWrapper>
        <RcSelect
          value={value}
          onChange={(event) => {
            const { value } = event.target;
            onChange(value);
          }}
        >
          {items}
        </RcSelect>
      </SelectionWrapper>
      <ButtonGroup>
        <RcButton
          variant="outlined"
          onClick={() => gotoUpperStep()}
        >
          Last Step
        </RcButton>
        &nbsp;
        &nbsp;
        <RcButton onClick={() => gotoNextStep()}>
          Next Step
        </RcButton>
      </ButtonGroup>
    </div>
  );
}
