const axios = require('axios');
const { ICON_URL } = require('./constants');

const {
  createAuthTokenRequestCard,
} = require('../lib/formatAdaptiveCardMessage');

function sendMessageToRCWebhook(rcWebhook, message) {
  return axios.post(rcWebhook, message, {
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json'
    }
  });
}

async function sendTextMessage(webhookUri, message) {
  await sendMessageToRCWebhook(webhookUri, {
    icon: ICON_URL,
    title: message,
    activity: 'Trello',
  });
}

async function sendAdaptiveCardMessage(webhookUri, card) {
  const message = {
    icon: ICON_URL,
  };
  if (card) {
    message.attachments = [card];
  } else {
    message.title = 'New event';
    message.activity = 'Trello';
  }
  await sendMessageToRCWebhook(webhookUri, message);
}

async function sendAuthorizeRequestCard(webhookUri, webhookId) {
  const card = createAuthTokenRequestCard({
    webhookId,
    authorizeUrl: `${process.env.APP_SERVER}/trello/full-authorize`,
  });
  await sendAdaptiveCardMessage(webhookUri, card);
}

exports.sendTextMessage = sendTextMessage;
exports.sendAdaptiveCardMessage = sendAdaptiveCardMessage;
exports.sendAuthorizeRequestCard = sendAuthorizeRequestCard;
