const axios = require('axios');

const { TrelloWebhook } = require('../models/trello-webhook');
const { getFilterId } = require('../lib/filter');
const { formatGlipWebhookCardMessage } = require('../lib/formatMessage');

async function notify(req, res) {
  const trelloWebhookId = req.params.id;
  // console.log(JSON.stringify(req.body, null, 2));
  try {
    const trelloWebhook = await TrelloWebhook.findByPk(trelloWebhookId);
    if (!trelloWebhook) {
      throw new Error('trello webhook id not found!');
    }
    const filterId = getFilterId(req.body, trelloWebhook.config.filters);
    if (filterId) {
      const glipMessage = formatGlipWebhookCardMessage(req.body);
      await axios.post(trelloWebhook.rc_webhook_id, glipMessage, {
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json'
        }
      });
    }
  } catch (e) {
    console.error(e)
  }
  res.json({
    result: 'OK',
  });
  res.status(200);
}

function head(req, res) {
  res.json({
    result: 'OK',
  });
  res.status(200);
}

exports.notify = notify;
exports.head = head
