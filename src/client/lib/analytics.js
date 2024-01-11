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

  constructor({ mixpanelKey, appName = 'Trello Notifications' }) {
    this._appName = appName;
    if (mixpanelKey) {
      mixpanel.init(mixpanelKey);
      this._ready = true;
    }
  }

  track(event, properties = {}) {
    if (!this._ready) {
      return;
    }
    const trackProps = {
      appName: this._appName,
      ...properties,
    };
    mixpanel.track(event, trackProps);
  }
}
