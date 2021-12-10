import Segment from './segment';

export class Analytics {
  _ready = false;

  constructor({ segmentKey } = {}) {
    this._analytics = Segment();
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
      appName: 'Trello Notifications',
      ...properties,
    }
    analytics.track(event, trackProps, {
      integrations: {
        All: true,
        Mixpanel: true,
      },
    });
  }
}
