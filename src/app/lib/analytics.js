const Mixpanel = require('mixpanel');
const { getHashValue } = require('./getHashValue');

class Analytics {
  constructor({
    mixpanelKey,
    secretKey,
    userId = undefined,
    accountId = undefined,
    appName = 'Trello Bot',
    clientId = process.env.RINGCENTRAL_CHATBOT_CLIENT_ID,
  }) {
    if (mixpanelKey) {
      this._mixpanel = Mixpanel.init(mixpanelKey);
    }
    this._secretKey = secretKey;
    this._appName = appName;
    this._clientId = clientId;
    if (userId) {
      this._hashUserId = getHashValue(userId, secretKey);
    }
    if (accountId) {
      this._hashAccountId = getHashValue(accountId, secretKey);
    }
  }

  setAccountId(accountId) {
    this._hashAccountId = getHashValue(accountId, this._secretKey);
  }

  track(event, properties = {}) {
    if (!this._mixpanel) {
      return Promise.resolve();
    }
    return new Promise((resolve, reject) => {
      this._mixpanel.track(event, {
        ...this.presetProperties,
        ...properties,
      }, (err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }

  trackBotAction(action, properties = {}) {
    return this.track(action, {
      botEventType: 'bot',
      ...properties,
    });
  }

  trackUserAction(action, userId = null, props = {}) {
    const properties = {
      botEventType: 'user',
      ...props,
    };
    if (userId) {
      properties.userId = getHashValue(userId, this._secretKey);
    }
    return this.track(action, properties);
  }

  batchTrack(events) {
    if (!this._mixpanel) {
      return Promise.resolve();
    }
    return new Promise((resolve, reject) => {
      const batch = events.map(event => ({
        event: event.event,
        properties: {
          ...this.presetProperties,
          ...event.properties,
        },
      }));
      this._mixpanel.track_batch(batch, (err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }

  identify() {
    if (!this._mixpanel || !this._hashAccountId) {
      return Promise.resolve();
    }
    return new Promise((resolve, reject) => {
      this._mixpanel.people.set(this._hashUserId, {
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

  get presetProperties() {
    const properties = {
      appName: this._appName,
      distinct_id: this._hashUserId,
      botClientId: this._clientId,
    };
    if (this._hashAccountId) {
      properties.rcAccountId = this._hashAccountId;
    }
    return properties;
  }
}

exports.Analytics = Analytics;
