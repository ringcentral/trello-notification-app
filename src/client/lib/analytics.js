import mixpanel from 'mixpanel-browser';

mixpanel._$$track = mixpanel.track;
mixpanel.track = (...params) => {
  const props = params[1] || {};
  props['$current_url'] = `${window.location.origin}${window.location.pathname}`; // remove sensitive data in url
  if (params.length === 1) {
    params.push(props);
  } else {
    params[1] = props;
  }
  return mixpanel._$$track(...params);
}

export class Analytics {
  _ready = false;

  constructor({
    mixpanelKey,
    appName = 'Trello Notifications',
    userId,
    botId,
    accountId,
  }) {
    this._appName = appName;
    this._accountId = accountId;
    if (mixpanelKey) {
      mixpanel.init(mixpanelKey);
      this._ready = true;
      if (botId) {
        mixpanel.identify(botId);
        if (accountId) {
          mixpanel.people.set({
            rcAccountId: accountId,
          });
        }
      }
    }
    this._userId = userId;
  }

  track(event, properties = {}) {
    if (!this._ready) {
      return;
    }
    const trackProps = {
      appName: this._appName,
      ...properties,
    };
    if (this._userId) {
      trackProps.userId = this._userId;
      trackProps.botEventType = 'user';
    }
    if (this._accountId) {
      trackProps.rcAccountId = this._accountId;
    }
    mixpanel.track(event, trackProps);
  }
}
