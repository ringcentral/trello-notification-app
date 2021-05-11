import React, { Fragment } from 'react';
import {
  RcGrid,
  RcCheckbox,
  RcAccordion,
  RcAccordionSummary,
  RcAccordionDetails,
  RcBadge,
} from '@ringcentral/juno';

import { filtersGroupByCategory } from '../../app/lib/filterOptions';

function getSelectedCountInCategory(category, selectedFilters) {
  let count = 0;
  const allItemsMap = {};
  category.items.forEach((item) => {
    allItemsMap[item.id] = true;
  });
  selectedFilters.forEach((selected) => {
    if (allItemsMap[selected]) {
      count += 1;
    }
  });
  return count;
}

export function FilterCheckList({ selectedFilters, setSelectedFilters }) {
  return (
    <Fragment>
      {
        filtersGroupByCategory.map((category) => (
          <RcAccordion variant="elevation" key={category.id} defaultExpanded>
            <RcAccordionSummary expandIcon>
              {category.name} &nbsp;
              <RcBadge
                color="grey.600"
                badgeContent={getSelectedCountInCategory(category, selectedFilters)}
                overlap="none"
              />
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
