import React, { Fragment } from 'react';
import {
  RcGrid,
  RcCheckbox,
  RcAccordion,
  RcAccordionSummary,
  RcAccordionDetails
} from '@ringcentral/juno';

import { filtersGroupByCategory } from '../../app/lib/filterOptions';

export function FilterCheckList({ selectedFilters, setSelectedFilters }) {
  return (
    <Fragment>
      {
        filtersGroupByCategory.map((category) => (
          <RcAccordion variant="elevation" key={category.id} defaultExpanded>
            <RcAccordionSummary expandIcon>
              {category.name}
            </RcAccordionSummary>
            <RcAccordionDetails>
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
            </RcAccordionDetails>
          </RcAccordion>
        ))
      }
    </Fragment>
  );
}
