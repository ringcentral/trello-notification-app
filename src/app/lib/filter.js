const { allFilters, filtersGroupByCategory } = require('./filterOptions');

function getFilterId(message, filterIdsString) {
  if (!filterIdsString || !message) {
    return null;
  }
  if (!message.action) {
    return null;
  }
  const filterIds = filterIdsString.split(',');
  const filters = [];
  filterIds.forEach((filterId) => {
    if (allFilters[filterId]) {
      filters.push(allFilters[filterId]);
    }
  });
  let found = false;
  let filterId = null;
  filters.forEach((filter) => {
    if (filter.actionType !== message.action.type) {
      return;
    }
    if (!filter.actionList) {
      filterId = filter.id;
      found = true;
      return;
    }
    if (!message.action.display) {
      return;
    }
    if (filter.actionList.indexOf(message.action.display.translationKey) > -1) {
      filterId = filter.id;
      found = true;
    }
  });
  if (!found) {
    return null;
  }
  return filterId;
}

exports.getFilterId = getFilterId;
