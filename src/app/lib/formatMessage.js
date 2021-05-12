const ICON_URL = 'https://raw.githubusercontent.com/ringcentral/trello-notification-app/main/icons/trello.png';

function getTitleFromAction(action) {
  if (action.type === 'createList') {
    return `Created [${action.data.list.name}](https://trello.com/b/${action.data.board.shortLink})`;
  }
  if (action.type === 'updateList') {
    if (action.display.translationKey === 'action_renamed_list') {
      return `Renamed **${action.data.old.name}** to [${action.data.list.name}](https://trello.com/b/${action.data.board.shortLink})`;
    }
  }
  return 'New event';
}

function getCardFromAction(action, title) {
  return {
    text: title,
    type: 'Card',
    color: '#4e89e5',
    author_name: action.memberCreator.fullName,
    author_link: `https://trello.com/${action.memberCreator.username}`,
    author_icon: `${action.memberCreator.avatarUrl}/50.png`,
  };
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
