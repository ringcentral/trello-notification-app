import React from 'react';
import { RcSelect, RcListItem } from '@ringcentral/juno';

export function BoardSelection({ boards, value, onChange }) {
  
  const items = boards.map((board) => {
    return (
      <RcListItem value={board.id} key={board.id}>
        {board.name}
      </RcListItem>
    )
  });
  return (
    <RcSelect
      value={value}
      onChange={(event) => {
        const { value } = event.target;
        onChange(value);
      }}
    >
      {items}
    </RcSelect>
  );
}
