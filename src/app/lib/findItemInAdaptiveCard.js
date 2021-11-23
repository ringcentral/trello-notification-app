function findItemInAdaptiveCard(card, id) {
  if (!card) {
    return null;
  }
  if (card.id === id) {
    return card;
  }
  let found = null;
  let list = []
  if (card.body) {
    list = card.body;
  }
  if (card.items) {
    list = card.items;
  }
  if (card.columns) {
    list = card.columns;
  }
  if (card.actions) {
    list = [...list].concat(card.actions);
  }
  if (card.card) {
    list = [...list].concat([card.card]);
  }
  for (const item of list) {
    found = findItemInAdaptiveCard(item, id);
    if (found) {
      return found;
    }
  }
  return null;
}

exports.findItemInAdaptiveCard = findItemInAdaptiveCard;
