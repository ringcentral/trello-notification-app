import React, { Fragment } from 'react';
import {
  RcGrid,
  RcCheckbox,
  RcAccordion,
  RcAccordionSummary,
  RcAccordionDetails,
  RcBadge,
} from '@ringcentral/juno';
import { styled } from '@ringcentral/juno/foundation';

import { filtersGroupByCategory } from '../../app/lib/filterOptions';

const SectionNameContainer = styled.div`
  display: flex;
  width: 100%;
  flex-direction: row;
  line-height: 40px;
`;

const SectionName = styled.div`
  flex: 1;
`;

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
        filtersGroupByCategory.map((category) => {
          const selectedCount = getSelectedCountInCategory(category, selectedFilters);
          return (
            <RcAccordion variant="elevation" key={category.id} defaultExpanded={false}>
              <RcAccordionSummary expandIcon>
                <SectionNameContainer>
                  <SectionName>
                    {category.name} &nbsp;
                    <RcBadge
                      color="grey.600"
                      badgeContent={selectedCount}
                      overlap="none"
                    />
                  </SectionName>
                  <RcCheckbox
                    title="Select All"
                    checked={selectedCount === category.items.length}
                    onClick={(e) => {
                      e.stopPropagation();
                    }}
                    onChange={(event) => {
                      const otherCategoryFilters = selectedFilters.filter(filter => {
                        return !category.items.find(item => item.id === filter);
                      });
                      if (event.target.checked) {
                        setSelectedFilters(otherCategoryFilters.concat(category.items.map(item => item.id)));
                      } else {
                        setSelectedFilters(otherCategoryFilters);
                      }
                    }}
                  />
                </SectionNameContainer>
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
          );
        })
      }
    </Fragment>
  );
}
