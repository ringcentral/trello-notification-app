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
      return `Update description of [${action.data.card.name}](https://trello.com/c/${action.data.card.shortLink}) `;
    }
    if (action.display.translationKey === 'action_added_a_due_date') {
      return `Add due date into [${action.data.card.name}](https://trello.com/c/${action.data.card.shortLink}) \\n**Due date:** ${action.data.card.due}`;
    }
    if (action.display.translationKey === 'action_changed_a_due_date') {
      return `Change due date of [${action.data.card.name}](https://trello.com/c/${action.data.card.shortLink}) \\n**Due date:** ${action.data.card.due}`;
    }
    if (action.display.translationKey === 'action_move_card_from_list_to_list') {
      return `Moved [${action.data.card.name}](https://trello.com/c/${action.data.card.shortLink}) from ${action.data.listBefore.name} to [${action.data.listAfter.name}](https://trello.com/b/${action.data.board.shortLink})`;
    }
    if (action.display.translationKey === 'action_renamed_card') {
      return `Rename **${action.data.old.name}** into [${action.data.card.name}](https://trello.com/c/${action.data.card.shortLink})`;
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
    return `Create check item [${action.data.checkItem.name}](https://trello.com/c/${action.data.card.shortLink}) in ${action.data.checklist.name}.`;
  }
  if (action.type === 'updateCheckItemStateOnCard') {
    if (action.display.translationKey === 'action_completed_checkitem') {
      return `Marked ~~[${action.data.checkItem.name}](https://trello.com/c/${action.data.card.shortLink})~~ complete.`;
    }
    if (action.display.translationKey === 'action_marked_checkitem_incomplete') {
      return `Marked [${action.data.checkItem.name}](https://trello.com/c/${action.data.card.shortLink}) incomplete.`;
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

function getCardFromTrelloMessage(trelloMessage) {
  const action = trelloMessage.action;
  let card;
  if (BOARD_TYPES.indexOf(action.type) > -1) {
    card = getAdaptiveCardFromTemplate(boardTemplateString, {
      avatarUrl: getAvatarUrl(action),
      subject: getBoardMessageSubject(action),
      username: action.memberCreator.fullName,
      userLink: `https://trello.com/${action.memberCreator.username}`,
      boardName: trelloMessage.model.name,
      boardLink: trelloMessage.model.shortUrl,
    });
  } else if (LIST_TYPES.indexOf(action.type) > -1) {
    card = getAdaptiveCardFromTemplate(listTemplateString, {
      avatarUrl: getAvatarUrl(action),
      subject: getListMessageSubject(action),
      username: action.memberCreator.fullName,
      userLink: `https://trello.com/${action.memberCreator.username}`,
      boardName: trelloMessage.model.name,
      boardLink: trelloMessage.model.shortUrl,
      listName: trelloMessage.action.data.list.name,
    });
  } else if (CARD_TYPES.indexOf(action.type) > -1) {
    card = getAdaptiveCardFromTemplate(cardTemplateString, {
      avatarUrl: getAvatarUrl(action),
      subject: getCardMessageSubject(action),
      username: action.memberCreator.fullName,
      userLink: `https://trello.com/${action.memberCreator.username}`,
      boardName: trelloMessage.model.name,
      boardLink: trelloMessage.model.shortUrl,
      listName: trelloMessage.action.data.list ? trelloMessage.action.data.list.name : trelloMessage.action.data.card.name,
      comment: trelloMessage.action.data.text ? trelloMessage.action.data.text.replace(/\n/g, "\\n") : '',
      description: trelloMessage.action.data.card.desc ? trelloMessage.action.data.card.desc.replace(/\n/g, "\\n") : '',
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
      listLabel.text = 'Card';
    }
  } else if (CHECKLIST_TYPES.indexOf(action.type) > -1) {
    card = getAdaptiveCardFromTemplate(checklistTemplateString, {
      avatarUrl: getAvatarUrl(action),
      subject: getChecklistMessageSubject(action),
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

function formatAdaptiveCardMessage(trelloMessage) {
  const card = getCardFromTrelloMessage(trelloMessage);
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

exports.formatAdaptiveCardMessage = formatAdaptiveCardMessage;
