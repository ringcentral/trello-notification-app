import React from 'react';
import { RcSelect, RcListItem } from '@ringcentral/juno';

export function BoardSelection() {
  return (
    <RcSelect
      value={1}
      onChange={(e) => {
        console.log('change', e);
      }}
      onOpen={(e) => {
        console.log('open', e);
      }}
      onClose={(e) => {
        console.log(e);
      }}
    >
      <RcListItem value={1}>
        Juno Roadmap
      </RcListItem>
    </RcSelect>
  );
}
