const { Template } = require('adaptivecards-templating');
const { findItemInAdaptiveCard } = require('./findItemInAdaptiveCard');

const boardTemplate = require('../adaptiveCards/board.json');
const boardTemplateString = JSON.stringify(boardTemplate, null, 2);
const listTemplate = require('../adaptiveCards/list.json');
const listTemplateString = JSON.stringify(listTemplate, null, 2);
const cardTemplate = require('../adaptiveCards/card.json');
const cardTemplateString = JSON.stringify(cardTemplate, null, 2);
const checklistTemplate = require('../adaptiveCards/checklist.json');
const checklistTemplateString = JSON.stringify(checklistTemplate, null, 2);
const authTemplate = require('../adaptiveCards/auth.json');
const authTemplateString = JSON.stringify(authTemplate, null, 2);

const ICON_URL = 'https://raw.githubusercontent.com/ringcentral/trello-notification-app/main/icons/trello.png';


function getAdaptiveCardFromTemplate(cardTemplate, params) {
  const template = new Template(cardTemplate);
  const card = template.expand({
    $root: params
  });
  return JSON.parse(card);
}

const BOARD_TYPES = ['addMemberToBoard', 'moveListFromBoard', 'updateBoard'];
function getBoardMessageSubject(action) {
  if (action.type === 'addMemberToBoard') {
    return `**Added** [${action.member.fullName}](https://trello.com/${action.member.username}) to [${action.data.board.name}](https://trello.com/b/${action.data.board.shortLink})`;
  }
  if (action.type === 'moveListFromBoard') {
    return `List ${action.data.list.name} moved from [${action.data.board.name}](https://trello.com/b/${action.data.board.shortLink})`;
  }
  if (action.type === 'updateBoard') {
    if (action.display.translationKey === 'action_update_board_name') {
      return `Renamed **${action.data.old.name}** to [${action.data.board.name}](https://trello.com/b/${action.data.board.shortLink})`;
    }
  }
}

const LIST_TYPES = ['createList', 'updateList'];
function getListMessageSubject(action) {
  if (action.type === 'createList') {
    return `Created [${action.data.list.name}](https://trello.com/b/${action.data.board.shortLink})`;
  }
  if (action.type === 'updateList') {
    if (action.display.translationKey === 'action_renamed_list') {
      return `Renamed **${action.data.old.name}** to [${action.data.list.name}](https://trello.com/b/${action.data.board.shortLink})`;
    }
    if (action.display.translationKey === 'action_archived_list') {
      return `Archived [${action.data.list.name}](https://trello.com/b/${action.data.board.shortLink})`;
    }
    if (action.display.translationKey === 'action_sent_list_to_board') {
      return `Unarchived [${action.data.list.name}](https://trello.com/b/${action.data.board.shortLink})`;
    }
  }
}

const CARD_TYPES = ['createCard', 'commentCard', 'addMemberToCard', 'removeMemberFromCard', 'addAttachmentToCard', 'addLabelToCard', 'removeLabelFromCard', 'updateCard'];
function getCardMessageSubject(action) {
  if (action.type === 'createCard') {
    return `New card created: [${action.data.card.name}](https://trello.com/c/${action.data.card.shortLink})`;
  }
  if (action.type === 'commentCard') {
    return `Added a comment to [${action.data.card.name}](https://trello.com/c/${action.data.card.shortLink})`;
  }
  if (action.type === 'addMemberToCard') {
    return `Added [${action.member.fullName}](https://trello.com/${action.member.username}) into [${action.data.card.name}](https://trello.com/c/${action.data.card.shortLink})`;
  }
  if (action.type === 'removeMemberFromCard') {
    return `Removed [${action.member.fullName}](https://trello.com/${action.member.username}) from [${action.data.card.name}](https://trello.com/c/${action.data.card.shortLink})`;
  }
  if (action.type === 'addAttachmentToCard') {
    return `Added attachment into [${action.data.card.name}](https://trello.com/c/${action.data.card.shortLink}). \\n**Attachment**: [${action.data.attachment.name}](${action.data.attachment.url})`;
  }
  if (action.type === 'addLabelToCard') {
    return `Added label **${action.data.label.name}** into [${action.data.card.name}](https://trello.com/c/${action.data.card.shortLink})`;
  }
  if (action.type === 'removeLabelFromCard') {
    return `Removed label **${action.data.label.name}** from [${action.data.card.name}](https://trello.com/c/${action.data.card.shortLink})`;
  }
  if (action.type === 'updateCard') {
    if (action.display.translationKey === 'action_archived_card') {
      return `Archived [${action.data.card.name}](https://trello.com/c/${action.data.card.shortLink})`;
    }
    if (action.display.translationKey === 'action_changed_description_of_card') {
      return `Updated description of [${action.data.card.name}](https://trello.com/c/${action.data.card.shortLink}) `;
    }
    if (action.display.translationKey === 'action_added_a_due_date') {
      return `Added due date into [${action.data.card.name}](https://trello.com/c/${action.data.card.shortLink}) \\n**Due date:** ${action.data.card.due}`;
    }
    if (action.display.translationKey === 'action_changed_a_due_date') {
      return `Changed due date of [${action.data.card.name}](https://trello.com/c/${action.data.card.shortLink}) \\n**Due date:** ${action.data.card.due}`;
    }
    if (action.display.translationKey === 'action_move_card_from_list_to_list') {
      return `Moved [${action.data.card.name}](https://trello.com/c/${action.data.card.shortLink}) from ${action.data.listBefore.name} to [${action.data.listAfter.name}](https://trello.com/b/${action.data.board.shortLink})`;
    }
    if (action.display.translationKey === 'action_renamed_card') {
      return `Renamed **${action.data.old.name}** into [${action.data.card.name}](https://trello.com/c/${action.data.card.shortLink})`;
    }
    if (action.display.translationKey === 'action_sent_card_to_board') {
      return `Unarchived [${action.data.card.name}](https://trello.com/c/${action.data.card.shortLink})`;
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
      return `${action.memberCreator.fullName}  unarchived ${action.data.list.name}`;
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
      return `${action.memberCreator.fullName} unarchived ${action.data.card.name}`;
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

function escapeNewLine(str) {
  if (!str) {
    return '';
  }
  return str.replace(/\n/g, "\\n");
}

function getCardFromTrelloMessage(trelloMessage, webhookId) {
  const action = trelloMessage.action;
  let card;
  let summary = getFallbackText(action);
  if (BOARD_TYPES.indexOf(action.type) > -1) {
    const subject = escapeNewLine(getBoardMessageSubject(action));
    card = getAdaptiveCardFromTemplate(boardTemplateString, {
      summary,
      avatarUrl: getAvatarUrl(action),
      subject,
      username: action.memberCreator.fullName,
      userLink: `https://trello.com/${action.memberCreator.username}`,
      boardName: trelloMessage.model.name,
      boardLink: trelloMessage.model.shortUrl,
    });
  } else if (LIST_TYPES.indexOf(action.type) > -1) {
    const subject = escapeNewLine(getListMessageSubject(action));
    card = getAdaptiveCardFromTemplate(listTemplateString, {
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
    const subject = escapeNewLine(getCardMessageSubject(action));
    card = getAdaptiveCardFromTemplate(cardTemplateString, {
      summary,
      avatarUrl: getAvatarUrl(action),
      subject,
      username: action.memberCreator.fullName,
      userLink: `https://trello.com/${action.memberCreator.username}`,
      boardName: trelloMessage.model.name,
      boardLink: trelloMessage.model.shortUrl,
      listName: trelloMessage.action.data.list ? trelloMessage.action.data.list.name : trelloMessage.action.data.card.name,
      comment: escapeNewLine(trelloMessage.action.data.text),
      description: escapeNewLine(trelloMessage.action.data.card.desc),
      webhookId,
      cardId: trelloMessage.action.data.card.id,
    });
    if (action.type === 'commentCard') {
      const commentArea = findItemInAdaptiveCard(card, 'commentArea');
      delete commentArea.isVisible;
    }
    if (action.display.translationKey === 'action_changed_description_of_card') {
      const descriptionArea = findItemInAdaptiveCard(card, 'descriptionArea');
      delete descriptionArea.isVisible;
    }
    if (!trelloMessage.action.data.list) {
      const listLabel = findItemInAdaptiveCard(card, 'listLabel');
      if (listLabel) {
        listLabel.text = 'Card';
      }
    }
  } else if (CHECKLIST_TYPES.indexOf(action.type) > -1) {
    const subject = escapeNewLine(getChecklistMessageSubject(action));
    card = getAdaptiveCardFromTemplate(checklistTemplateString, {
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

function formatAdaptiveCardMessage(trelloMessage, webhookId) {
  const card = getCardFromTrelloMessage(trelloMessage, webhookId);
  const message = {
    icon: ICON_URL,
  };
  if (card) {
    message.attachments = [card];
  } else {
    message.title = 'New event';
    message.activity = 'Trello';
  }
  return message;
}

function createAuthTokenRequestCard({ webhookId, authorizeUrl }) {
  const card = getAdaptiveCardFromTemplate(authTemplateString, {
    webhookId,
    authorizeUrl,
  });
  return {
    attachments: [card],
    icon: ICON_URL,
  };
}

function createMessageCard({ message }) {
  return {
    icon: ICON_URL,
    title: message,
    activity: 'Trello',
  }
}

exports.formatAdaptiveCardMessage = formatAdaptiveCardMessage;
exports.createAuthTokenRequestCard = createAuthTokenRequestCard;
exports.createMessageCard = createMessageCard;
