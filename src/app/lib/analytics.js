const Mixpanel = require('mixpanel');
const crypto = require('crypto');

function getHashValue(string, secretKey) {
  return crypto.createHash('sha256').update(
    `${string}:${secretKey}`
  ).digest('hex');
}

class Analytics {
  constructor({
    mixpanelKey,
    secretKey,
    userId,
    accountId,
  }) {
    if (mixpanelKey) {
      this._mixpanel = Mixpanel.init(mixpanelKey);
    }
    this._hashUserId = getHashValue(userId, secretKey);
    this._hashAccountId = getHashValue(accountId, secretKey);
  }

  track(event, properties = {}) {
    if (!this._mixpanel) {
      return Promise.resolve();
    }
    return new Promise((resolve, reject) => {
      this._mixpanel.track(event, {
        ...properties,
        distinct_id: this._hashUserId,
        rcAccountId: this._hashAccountId,
      }, (err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }
}

exports.Analytics = Analytics;
