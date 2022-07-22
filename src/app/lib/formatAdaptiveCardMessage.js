const { Template } = require('adaptivecards-templating');
const { findItemInAdaptiveCard } = require('./findItemInAdaptiveCard');

const boardTemplate = require('../adaptiveCards/board.json');
const listTemplate = require('../adaptiveCards/list.json');
const cardTemplate = require('../adaptiveCards/card.json');
const checklistTemplate = require('../adaptiveCards/checklist.json');
const authTemplate = require('../adaptiveCards/auth.json');

const { ICON_URL, COLOR_IMAGE_URL_BASE } = require('./constants');

function getAdaptiveCardFromTemplate(adaptiveCardTemplate, params) {
  const template = new Template(adaptiveCardTemplate);
  const card = template.expand({
    $root: params
  });
  return card;
}

function formatDateTime(date) {
  const dateTime = new Date(date);
  return `${dateTime.toISOString().split('.')[0]}Z`;
}

function formatLabels(labels) {
  if (!labels) {
    return [];
  }
  return labels.map((label) => {
    let name = label.name;
    if (!name) {
      name = label.color || 'No color';
    }
    const colorImage = label.color ? `${COLOR_IMAGE_URL_BASE}${label.color}.png` : `${COLOR_IMAGE_URL_BASE}nocolor.png`;
    return {
      id: label.id,
      name,
      color: label.color,
      colorImage,
    }
  });
}

function getUnselectedLabels(boardLabels, selectedLabels) {
  if (!boardLabels) {
    return [];
  }
  if (!selectedLabels) {
    return boardLabels;
  }
  return boardLabels.filter((label) => !selectedLabels.find((selectedLabel) => selectedLabel.id === label.id));
}

function getLabelText(label) {
  return label.name || label.color;
}

const BOARD_TYPES = ['addMemberToBoard', 'moveListFromBoard', 'updateBoard'];
function getBoardMessageSubject(action) {
  if (action.type === 'addMemberToBoard') {
    return `**added** [${action.member.fullName}](https://trello.com/${action.member.username}) to [${action.data.board.name}](https://trello.com/b/${action.data.board.shortLink})`;
  }
  if (action.type === 'moveListFromBoard') {
    return `transferred list ${action.data.list.name} from [${action.data.board.name}](https://trello.com/b/${action.data.board.shortLink}) to another board`;
  }
  if (action.type === 'updateBoard') {
    if (action.display.translationKey === 'action_update_board_name') {
      return `renamed **${action.data.old.name}** to [${action.data.board.name}](https://trello.com/b/${action.data.board.shortLink})`;
    }
  }
}

const LIST_TYPES = ['createList', 'updateList'];
function getListMessageSubject(action) {
  if (action.type === 'createList') {
    return `created [${action.data.list.name}](https://trello.com/b/${action.data.board.shortLink})`;
  }
  if (action.type === 'updateList') {
    if (action.display.translationKey === 'action_renamed_list') {
      return `renamed **${action.data.old.name}** to [${action.data.list.name}](https://trello.com/b/${action.data.board.shortLink})`;
    }
    if (action.display.translationKey === 'action_archived_list') {
      return `archived [${action.data.list.name}](https://trello.com/b/${action.data.board.shortLink})`;
    }
    if (action.display.translationKey === 'action_sent_list_to_board') {
      return `send [${action.data.list.name}](https://trello.com/b/${action.data.board.shortLink}) to the board`;
    }
  }
}

const CARD_TYPES = ['createCard', 'commentCard', 'addMemberToCard', 'removeMemberFromCard', 'addAttachmentToCard', 'addLabelToCard', 'removeLabelFromCard', 'updateCard'];
function getCardMessageSubject(action) {
  if (action.type === 'createCard') {
    return `added [${action.data.card.name}](https://trello.com/c/${action.data.card.shortLink})`;
  }
  if (action.type === 'commentCard') {
    return `commented on [${action.data.card.name}](https://trello.com/c/${action.data.card.shortLink})`;
  }
  if (action.type === 'addMemberToCard') {
    return `added [${action.member.fullName}](https://trello.com/${action.member.username}) into [${action.data.card.name}](https://trello.com/c/${action.data.card.shortLink})`;
  }
  if (action.type === 'removeMemberFromCard') {
    return `removed [${action.member.fullName}](https://trello.com/${action.member.username}) from [${action.data.card.name}](https://trello.com/c/${action.data.card.shortLink})`;
  }
  if (action.type === 'addAttachmentToCard') {
    return `added attachment into [${action.data.card.name}](https://trello.com/c/${action.data.card.shortLink})`;
  }
  if (action.type === 'addLabelToCard') {
    return `added label **${getLabelText(action.data.label)}** into [${action.data.card.name}](https://trello.com/c/${action.data.card.shortLink})`;
  }
  if (action.type === 'removeLabelFromCard') {
    return `removed label **${getLabelText(action.data.label)}** from [${action.data.card.name}](https://trello.com/c/${action.data.card.shortLink})`;
  }
  if (action.type === 'updateCard') {
    if (action.display.translationKey === 'action_archived_card') {
      return `archived [${action.data.card.name}](https://trello.com/c/${action.data.card.shortLink})`;
    }
    if (action.display.translationKey === 'action_changed_description_of_card') {
      return `updated description of [${action.data.card.name}](https://trello.com/c/${action.data.card.shortLink})`;
    }
    if (action.display.translationKey === 'action_added_a_due_date') {
      return `added due date into [${action.data.card.name}](https://trello.com/c/${action.data.card.shortLink})`;
    }
    if (action.display.translationKey === 'action_changed_a_due_date') {
      return `changed due date of [${action.data.card.name}](https://trello.com/c/${action.data.card.shortLink})`;
    }
    if (action.display.translationKey === 'action_move_card_from_list_to_list') {
      return `moved [${action.data.card.name}](https://trello.com/c/${action.data.card.shortLink}) from ${action.data.listBefore.name} to [${action.data.listAfter.name}](https://trello.com/b/${action.data.board.shortLink})`;
    }
    if (action.display.translationKey === 'action_renamed_card') {
      return `renamed **${action.data.old.name}** into [${action.data.card.name}](https://trello.com/c/${action.data.card.shortLink})`;
    }
    if (action.display.translationKey === 'action_sent_card_to_board') {
      return `send [${action.data.card.name}](https://trello.com/c/${action.data.card.shortLink}) to the board`;
    }
  }
}

const CHECKLIST_TYPES = ['addChecklistToCard', 'createCheckItem', 'updateCheckItemStateOnCard'];
function getChecklistMessageSubject(action) {
  if (action.type === 'addChecklistToCard') {
    return `Added [${action.data.checklist.name}](https://trello.com/c/${action.data.card.shortLink}).`;
  }
  if (action.type === 'createCheckItem') {
    return `Created check item [${action.data.checkItem.name}](https://trello.com/c/${action.data.card.shortLink}) in ${action.data.checklist.name}.`;
  }
  if (action.type === 'updateCheckItemStateOnCard') {
    if (action.display.translationKey === 'action_completed_checkitem') {
      return `Marked ~~[${action.data.checkItem.name}](https://trello.com/c/${action.data.card.shortLink})~~ completed.`;
    }
    if (action.display.translationKey === 'action_marked_checkitem_incomplete') {
      return `Marked [${action.data.checkItem.name}](https://trello.com/c/${action.data.card.shortLink}) incomplete.`;
    }
  }
}

function getFallbackText(action) {
  // board
  if (action.type === 'addMemberToBoard') {
    return `${action.memberCreator.fullName} added ${action.member.fullName} to ${action.data.board.name}`;
  }
  if (action.type === 'moveListFromBoard') {
    return `List ${action.data.list.name} moved from ${action.data.board.name} by ${action.memberCreator.fullName}`;
  }
  if (action.type === 'updateBoard') {
    if (action.display.translationKey === 'action_update_board_name') {
      return `${action.memberCreator.fullName} renamed ${action.data.old.name} to ${action.data.board.name}`;
    }
  }
  // list
  if (action.type === 'createList') {
    return `${action.memberCreator.fullName} created ${action.data.list.name} at ${action.data.board.name}`;
  }
  if (action.type === 'updateList') {
    if (action.display.translationKey === 'action_renamed_list') {
      return `${action.memberCreator.fullName} renamed ${action.data.old.name} to ${action.data.list.name}`;
    }
    if (action.display.translationKey === 'action_archived_list') {
      return `${action.memberCreator.fullName} archived ${action.data.list.name}`;
    }
    if (action.display.translationKey === 'action_sent_list_to_board') {
      return `${action.memberCreator.fullName} send ${action.data.list.name} to the board`;
    }
  }
  // card
  if (action.type === 'createCard') {
    return `New card created ${action.data.card.name} at ${action.data.board.name}`;
  }
  if (action.type === 'commentCard') {
    return `${action.memberCreator.fullName} added a comment to ${action.data.card.name}`;
  }
  if (action.type === 'addMemberToCard') {
    return `${action.memberCreator.fullName} added ${action.member.fullName} into ${action.data.card.name}`;
  }
  if (action.type === 'removeMemberFromCard') {
    return `${action.memberCreator.fullName} removed ${action.member.fullName} from ${action.data.card.name}`;
  }
  if (action.type === 'addAttachmentToCard') {
    return `${action.memberCreator.fullName} added attachment into ${action.data.card.name}`;
  }
  if (action.type === 'addLabelToCard') {
    return `${action.memberCreator.fullName} added label ${action.data.label.name} into ${action.data.card.name}`;
  }
  if (action.type === 'removeLabelFromCard') {
    return `${action.memberCreator.fullName} removed label ${action.data.label.name} from ${action.data.card.name}`;
  }
  if (action.type === 'updateCard') {
    if (action.display.translationKey === 'action_archived_card') {
      return `${action.memberCreator.fullName} archived ${action.data.card.name}`;
    }
    if (action.display.translationKey === 'action_changed_description_of_card') {
      return `${action.memberCreator.fullName} updated description of ${action.data.card.name}`;
    }
    if (action.display.translationKey === 'action_added_a_due_date') {
      return `${action.memberCreator.fullName} added due date into ${action.data.card.name}`;
    }
    if (action.display.translationKey === 'action_changed_a_due_date') {
      return `${action.memberCreator.fullName} changed due date of ${action.data.card.name}`;
    }
    if (action.display.translationKey === 'action_move_card_from_list_to_list') {
      return `${action.memberCreator.fullName} moved ${action.data.card.name} from ${action.data.listBefore.name} to ${action.data.listAfter.name}`;
    }
    if (action.display.translationKey === 'action_renamed_card') {
      return `${action.memberCreator.fullName} renamed ${action.data.old.name} into ${action.data.card.name}`;
    }
    if (action.display.translationKey === 'action_sent_card_to_board') {
      return `${action.memberCreator.fullName} send ${action.data.card.name} to the board`;
    }
  }
  // checklist
  if (action.type === 'addChecklistToCard') {
    return `${action.memberCreator.fullName} added ${action.data.checklist.name} at ${action.data.card.name}`;
  }
  if (action.type === 'createCheckItem') {
    return `${action.memberCreator.fullName} created check item ${action.data.checkItem.name} in ${action.data.checklist.name}`;
  }
  if (action.type === 'updateCheckItemStateOnCard') {
    if (action.display.translationKey === 'action_completed_checkitem') {
      return `${action.memberCreator.fullName} marked ${action.data.checkItem.name} completed`;
    }
    if (action.display.translationKey === 'action_marked_checkitem_incomplete') {
      return `${action.memberCreator.fullName} marked ${action.data.checkItem.name} incomplete`;
    }
  }
}

function getAvatarUrl(action) {
  if (action.memberCreator.avatarUrl && action.memberCreator.avatarUrl.indexOf('http') === 0) {
    return `${action.memberCreator.avatarUrl}/50.png`;
  } else {
    return ICON_URL;
  }
}

function truncateText(text, length) {
  if (text.length > length) {
    return text.substring(0, length) + '...';
  }
  return text;
}

function getCardContentText(action) {
  if (action.type === 'commentCard') {
    return truncateText(action.data.text, 600);
  }else if (action.type === 'addAttachmentToCard') {
    return `**Attachment**: [${action.data.attachment.name}](${action.data.attachment.url})`;
  } else if (action.type === 'updateCard') {
    if (action.display.translationKey === 'action_changed_description_of_card') {
      return truncateText(trelloMessage.action.data.card.desc, 800);
    }
    if (
      action.display.translationKey === 'action_added_a_due_date' ||
      action.display.translationKey === 'action_changed_a_due_date'
    ) {
      return `**Due date:**  {{DATE(${formatDateTime(action.data.card.due)},SHORT)}}`;
    }
  }
  return '';
}

function getAdaptiveCardFromTrelloMessage({
  trelloMessage,
  webhookId = '',
  boardLabels,
  trelloCard,
  botId = '',
  disableButtons = false,
}) {
  const action = trelloMessage.action;
  let card;
  let summary = getFallbackText(action);
  if (BOARD_TYPES.indexOf(action.type) > -1) {
    const subject = getBoardMessageSubject(action);
    card = getAdaptiveCardFromTemplate(boardTemplate, {
      summary,
      avatarUrl: getAvatarUrl(action),
      subject,
      username: action.memberCreator.fullName,
      userLink: `https://trello.com/${action.memberCreator.username}`,
      boardName: trelloMessage.model.name,
      boardLink: trelloMessage.model.shortUrl,
    });
  } else if (LIST_TYPES.indexOf(action.type) > -1) {
    const subject = getListMessageSubject(action);
    card = getAdaptiveCardFromTemplate(listTemplate, {
      summary,
      avatarUrl: getAvatarUrl(action),
      subject,
      username: action.memberCreator.fullName,
      userLink: `https://trello.com/${action.memberCreator.username}`,
      boardName: trelloMessage.model.name,
      boardLink: trelloMessage.model.shortUrl,
      listName: trelloMessage.action.data.list.name,
    });
  } else if (CARD_TYPES.indexOf(action.type) > -1) {
    const subject = getCardMessageSubject(action);
    const unselectedLabels = formatLabels(getUnselectedLabels(boardLabels, trelloCard.labels));
    const selectedLabels = formatLabels(trelloCard.labels);
    const isArchivedCard = action.display.translationKey === 'action_archived_card';
    const contentText = getCardContentText(action);
    const params = {
      summary,
      avatarUrl: getAvatarUrl(action),
      subject,
      username: action.memberCreator.fullName,
      userLink: `https://trello.com/${action.memberCreator.username}`,
      boardName: trelloMessage.model.name,
      boardLink: trelloMessage.model.shortUrl,
      listName: trelloMessage.action.data.list ? trelloMessage.action.data.list.name : trelloMessage.action.data.card.name,
      content: contentText,
      webhookId,
      botId,
      messageType: botId ? 'Bot' : 'Notification',
      cardId: trelloMessage.action.data.card.id,
      defaultAddLabelValue: unselectedLabels[0] && unselectedLabels[0].id || '',
      unselectedLabels: unselectedLabels.length > 0 ? unselectedLabels : [{ title: 'no item', id: 'placeholder' }],
      defaultRemoveLabelValue: trelloCard.labels[0] && trelloCard.labels[0].id || '',
      selectedLabels: selectedLabels.length > 0 ? selectedLabels : [{ title: 'no item', id: 'placeholder' }],
    };
    card = getAdaptiveCardFromTemplate(cardTemplate, params);
    if (unselectedLabels.length === 0) {
      const addLabelForm = findItemInAdaptiveCard(card, 'addLabelForm');
      addLabelForm.isVisible = false;
    }
    if (selectedLabels.length === 0) {
      const removeLabelForm = findItemInAdaptiveCard(card, 'removeLabelForm');
      removeLabelForm.isVisible = false;
      const selectedLabels = findItemInAdaptiveCard(card, 'selectedLabels');
      selectedLabels.isVisible = false;
    }
    if (contentText.length > 0) {
      const contentArea = findItemInAdaptiveCard(card, 'contentArea');
      delete contentArea.isVisible;
    }
    if (!trelloMessage.action.data.list) {
      const listLabel = findItemInAdaptiveCard(card, 'listLabel');
      if (listLabel) {
        listLabel.text = 'Card';
      }
    }
    if (disableButtons || isArchivedCard) {
      const actionContainer1 = findItemInAdaptiveCard(card, 'actionContainer1');
      actionContainer1.isVisible = false;
      const actionContainer2 = findItemInAdaptiveCard(card, 'actionContainer2');
      actionContainer2.isVisible = false;
    }
    if (!botId) {
      const migrationWarning = findItemInAdaptiveCard(card, 'migrationWarning');
      delete migrationWarning.isVisible;
    }
  } else if (CHECKLIST_TYPES.indexOf(action.type) > -1) {
    const subject = getChecklistMessageSubject(action);
    card = getAdaptiveCardFromTemplate(checklistTemplate, {
      summary,
      avatarUrl: getAvatarUrl(action),
      subject,
      username: action.memberCreator.fullName,
      userLink: `https://trello.com/${action.memberCreator.username}`,
      boardName: trelloMessage.model.name,
      boardLink: trelloMessage.model.shortUrl,
      cardName: trelloMessage.action.data.card.name,
      cardLink: `https://trello.com/c/${action.data.card.shortLink}`,
    });
  }
  return card;
}

function createAuthTokenRequestCard({ webhookId, authorizeUrl }) {
  return getAdaptiveCardFromTemplate(authTemplate, {
    webhookId,
    authorizeUrl,
  });
}

exports.getAdaptiveCardFromTemplate = getAdaptiveCardFromTemplate;
exports.getAdaptiveCardFromTrelloMessage = getAdaptiveCardFromTrelloMessage;
exports.createAuthTokenRequestCard = createAuthTokenRequestCard;
exports.CARD_TYPES = CARD_TYPES;
