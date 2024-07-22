const { TrelloUser } = require('../models/trello-user');
const { errorLogger } = require('../lib/logger');

async function removeUserName(req, res) {
  if (!process.env.MAINTAIN_TOKEN) {
    res.status(404);
    res.send('Not found');
    return;
  }
  if (req.query.maintain_token !== process.env.MAINTAIN_TOKEN) {
    res.status(403);
    res.send('Forbidden');
    return;
  }
  let lastKey = req.query.last_key;
  try {
    const trelloUsers = await TrelloUser.findAll({
      limit: 50,
      lastKey: lastKey ? { id: lastKey } : undefined,
    });
    if (trelloUsers.lastKey) {
      lastKey = trelloUsers.lastKey.id;
    } else {
      lastKey = '';
    }
    for (const trelloUser of trelloUsers) {
      if (!!trelloUser.username || !!trelloUser.fullName) {
        await TrelloUser.update({
          username: '',
          fullName: '',
        }, { where: { id: trelloUser.id } });
      }
    }
    res.status(200);
    res.json({
      lastKey,
    });
  } catch (e) {
    errorLogger(e);
    res.status(500);
    res.send('Internal error');
  }
}

exports.removeUserName = removeUserName;