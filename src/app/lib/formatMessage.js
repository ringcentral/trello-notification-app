const ICON_URL = 'https://raw.githubusercontent.com/ringcentral/trello-notification-app/main/icons/trello.png';

function getTitleFromAction(action) {
  // list:
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
  // board:
  if (action.type === 'addMemberToBoard') {
    return `Added [${action.member.fullName}](https://trello.com/${action.member.username}) to [${action.data.board.name}](https://trello.com/b/${action.data.board.shortLink})`;
  }
  if (action.type === 'moveListFromBoard') {
    return `List ${action.data.list.name} moved from [${action.data.board.name}](https://trello.com/b/${action.data.board.shortLink})`;
  }
  if (action.type === 'updateBoard') {
    if (action.display.translationKey === 'action_update_board_name') {
      return `Renamed **${action.data.old.name}** to [${action.data.board.name}](https://trello.com/b/${action.data.board.shortLink})`;
    }
  }
  // card:
  if (action.type === 'createCard') {
    return `New card created: [${action.data.card.name}](https://trello.com/c/${action.data.card.shortLink}) in list ${action.data.list.name} on [${action.data.board.name}](https://trello.com/b/${action.data.board.shortLink}).`;
  }
  if (action.type === 'commentCard') {
    return `Added a comment to [${action.data.card.name}](https://trello.com/c/${action.data.card.shortLink}) in list ${action.data.list.name} on [${action.data.board.name}](https://trello.com/b/${action.data.board.shortLink}). \n**Comment:** ${action.data.text}.`;
  }
  if (action.type === 'addMemberToCard') {
    return `Added [${action.member.fullName}](https://trello.com/${action.member.username}) into [${action.data.card.name}](https://trello.com/c/${action.data.card.shortLink}) on [${action.data.board.name}](https://trello.com/b/${action.data.board.shortLink}).`;
  }
  if (action.type === 'removeMemberFromCard') {
    return `Removed [${action.member.fullName}](https://trello.com/${action.member.username}) from [${action.data.card.name}](https://trello.com/c/${action.data.card.shortLink}) on [${action.data.board.name}](https://trello.com/b/${action.data.board.shortLink}).`;
  }
  if (action.type === 'addAttachmentToCard') {
    return `Added attachment into [${action.data.card.name}](https://trello.com/c/${action.data.card.shortLink}) on [${action.data.board.name}](https://trello.com/b/${action.data.board.shortLink}).\n**Attachment**: [${action.data.attachment.name}](${action.data.attachment.url})`;
  }
  if (action.type === 'addLabelToCard') {
    return `Added label **${action.data.label.name}** into [${action.data.card.name}](https://trello.com/c/${action.data.card.shortLink}) on [${action.data.board.name}](https://trello.com/b/${action.data.board.shortLink}).\n`;
  }
  if (action.type === 'removeLabelFromCard') {
    return `Removed label **${action.data.label.name}** from [${action.data.card.name}](https://trello.com/c/${action.data.card.shortLink}) on [${action.data.board.name}](https://trello.com/b/${action.data.board.shortLink}).\n`;
  }
  if (action.type === 'updateCard') {
    if (action.display.translationKey === 'action_archived_card') {
      return `Archived [${action.data.card.name}](https://trello.com/c/${action.data.card.shortLink}) on [${action.data.board.name}](https://trello.com/b/${action.data.board.shortLink}).`;
    }
    if (action.display.translationKey === 'action_changed_description_of_card') {
      return `Update description of [${action.data.card.name}](https://trello.com/c/${action.data.card.shortLink}) in list ${action.data.list.name} on [${action.data.board.name}](https://trello.com/b/${action.data.board.shortLink}). \n**Description:** ${action.data.card.desc}.`;
    }
    if (action.display.translationKey === 'action_added_a_due_date') {
      return `Add due date into [${action.data.card.name}](https://trello.com/c/${action.data.card.shortLink}) in list ${action.data.list.name} on [${action.data.board.name}](https://trello.com/b/${action.data.board.shortLink}). \n**Due date:** ${action.data.card.due}.`;
    }
    if (action.display.translationKey === 'action_changed_a_due_date') {
      return `Change due date of [${action.data.card.name}](https://trello.com/c/${action.data.card.shortLink}) in list ${action.data.list.name} on [${action.data.board.name}](https://trello.com/b/${action.data.board.shortLink}). \n**Due date:** ${action.data.card.due}.`;
    }
    if (action.display.translationKey === 'action_move_card_from_list_to_list') {
      return `Moved [${action.data.card.name}](https://trello.com/c/${action.data.card.shortLink}) from ${action.data.listBefore.name} to [${action.data.listAfter.name}](https://trello.com/b/${action.data.board.shortLink}).`;
    }
    if (action.display.translationKey === 'action_renamed_card') {
      return `Rename **${action.data.old.name}** into [${action.data.card.name}](https://trello.com/c/${action.data.card.shortLink}) on [${action.data.board.name}](https://trello.com/b/${action.data.board.shortLink}).`;
    }
    if (action.display.translationKey === 'action_sent_card_to_board') {
      return `Unarchived [${action.data.card.name}](https://trello.com/c/${action.data.card.shortLink}) on [${action.data.board.name}](https://trello.com/b/${action.data.board.shortLink}).`;
    }
  }
  // checklist:
  if (action.type === 'addChecklistToCard') {
    return `Added [${action.data.checklist.name}](https://trello.com/c/${action.data.card.shortLink}).`;
  }
  if (action.type === 'createCheckItem') {
    return `Create check item [${action.data.checkItem.name}](https://trello.com/c/${action.data.card.shortLink}).`;
  }
  if (action.type === 'updateCheckItemStateOnCard') {
    if (action.display.translationKey === 'action_completed_checkitem') {
      return `Marked [${action.data.checkItem.name}](https://trello.com/c/${action.data.card.shortLink}) complete.`;
    }
    if (action.display.translationKey === 'action_marked_checkitem_incomplete') {
      return `Marked [${action.data.checkItem.name}](https://trello.com/c/${action.data.card.shortLink}) incomplete.`;
    }
  }
  return 'New event';
}

function getCardFromAction(action, title) {
  const card = {
    text: title,
    type: 'Card',
    color: '#4e89e5',
    author_name: action.memberCreator.fullName,
    author_link: `https://trello.com/${action.memberCreator.username}`,
  };
  if (action.memberCreator.avatarUrl && action.memberCreator.avatarUrl.indexOf('http') === 0) {
    card['author_icon'] = `${action.memberCreator.avatarUrl}/50.png`;
  } else {
    card['author_icon'] = ICON_URL;
  }
  return card;
}

function formatGlipWebhookCardMessage(trelloMessage) {
  const title = getTitleFromAction(trelloMessage.action);
  const card = getCardFromAction(trelloMessage.action, title);
  return {
    title,
    icon: ICON_URL,
    attachments: [card],
  };
}

exports.formatGlipWebhookCardMessage = formatGlipWebhookCardMessage;
