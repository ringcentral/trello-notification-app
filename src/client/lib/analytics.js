import Segment from './segment';

export class Analytics {
  _ready = false;

  constructor({ segmentKey, appName = 'Trello Notifications' }) {
    this._analytics = Segment();
    this._appName = appName;
    if (segmentKey) {
      analytics.load(segmentKey, {
        integrations: {
          All: true,
          Mixpanel: true,
        },
      });
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
    analytics.track(event, trackProps, {
      integrations: {
        All: true,
        Mixpanel: true,
      },
    });
  }
}
