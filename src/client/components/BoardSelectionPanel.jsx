import React from 'react';
import { RcButton } from '@ringcentral/juno';
import { styled } from '@ringcentral/juno/foundation';
import { BoardSelection } from './BoardSelection';

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
  return (
    <div>
      <SelectionWrapper>
        <BoardSelection
          boards={boards}
          value={value}
          onChange={onChange}
        />
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
