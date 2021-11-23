const axios = require('axios');

const { TrelloWebhook } = require('../models/trello-webhook');
const { TrelloUser } = require('../models/trello-user');
const { getFilterId } = require('../lib/filter');
const { Trello } = require('../lib/Trello');
// const { formatGlipWebhookCardMessage } = require('../lib/formatMessage');
const { formatAdaptiveCardMessage } = require('../lib/formatAdaptiveCardMessage');

// async function notify(req, res) {
//   const trelloWebhookId = req.params.id;
//   // console.log(JSON.stringify(req.body, null, 2));
//   try {
//     const trelloWebhook = await TrelloWebhook.findByPk(trelloWebhookId);
//     if (!trelloWebhook) {
//       throw new Error('trello webhook id not found!');
//     }
//     const filterId = getFilterId(req.body, trelloWebhook.config.filters);
//     if (filterId) {
//       const glipMessage = formatGlipWebhookCardMessage(req.body);
//       await axios.post(trelloWebhook.rc_webhook_id, glipMessage, {
//         headers: {
//           Accept: 'application/json',
//           'Content-Type': 'application/json'
//         }
//       });
//     }
//   } catch (e) {
//     console.error(e)
//   }
//   res.status(200);
//   res.json({
//     result: 'OK',
//   });
// }

async function notifyV2(req, res) {
  const trelloWebhookId = req.params.id;
  // console.log(JSON.stringify(req.body, null, 2));
  try {
    const trelloWebhook = await TrelloWebhook.findByPk(trelloWebhookId);
    if (!trelloWebhook) {
      res.status(404);
      res.send('Not found');
      return;
    }
    const filterId = getFilterId(req.body, trelloWebhook.config.filters);
    if (filterId) {
      let card = {};
      if (req.body.action.type.indexOf('Card') > -1) {
        const trelloUser = await TrelloUser.findByPk(trelloWebhook.trello_user_id);
        const trello = new Trello({
          appKey: process.env.TRELLO_APP_KEY,
          redirectUrl: `${process.env.APP_SERVER}/trello/oauth-callback`,
        });
        trello.setToken(trelloUser.token);
        card = await trello.getCard(req.body.action.data.card.id);
        console.log(card);
      }
      const glipMessage = formatAdaptiveCardMessage(
        req.body,
        trelloWebhookId,
        {
          trelloCard: card,
          boardLabels: trelloWebhook.config.labels || [],
        }
      );
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
  res.status(200);
  res.json({
    result: 'OK',
  });
}

function head(req, res) {
  res.status(200);
  res.json({
    result: 'OK',
  });
}

exports.notify = notifyV2;
exports.head = head

