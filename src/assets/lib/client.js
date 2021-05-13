import qs from 'qs';
import url from 'url';

export class Client {
  constructor(config) {
    this._config = config;
  }

  async saveToken(callbackUri) {
    const { hash } = url.parse(callbackUri, true);
    const data = qs.parse(hash.replace(/^#/, ''));
    if (data.error) {
      throw new Error('Authorization error');
    }
    const response = await fetch(this._config.authorizationTokenUri, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        token: data.token,
        rcWebhook: this._config.rcWebhookUri,
      }),
    });
    if (response.status !== 200) {
      throw new Error('Authorization error')
    }
  }

  async unauthorize() {
    const resp = await fetch(this._config.authorizationRevokeUri, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        rcWebhook: this._config.rcWebhookUri,
      }),
    });
    if (resp.status !== 200) {
      throw new Error('unauthorize error');
    }
  }

  async createWebhook({ boardId, filters }) {
    const response = await fetch(this._config.webhookCreationUri, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        boardId,
        filters,
        rcWebhook: this._config.rcWebhookUri,
      }),
    });
    if (response.status !== 200) {
      throw new Error('Submit data error please retry later')
    }
  }

  async getInfo() {
    const response = await fetch(`${this._config.webhookInfoUri}?rcWebhook=${this._config.rcWebhookUri}`);
    if (response.status !== 200) {
      throw new Error('Fetch data error please retry later')
    }
    const data = await response.json();
    return data;
  }

  get trelloAuthorized() {
    return !!this._config.trelloAuthorized;
  }

  get authorizationUri() {
    return this._config.authorizationUri;
  }
}
