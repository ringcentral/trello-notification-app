import qs from 'qs';
import url from 'url';

const TOKEN_STORAGE_KEY = 'jwt-token-storage-key';

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
      }),
    });
    if (response.status !== 200) {
      throw new Error('Authorization error')
    }
    const tokenData = await response.json();
    if (tokenData.token) {
      localStorage.setItem(TOKEN_STORAGE_KEY, tokenData.token);
    }
  }

  async unauthorize() {
    const resp = await fetch(this._config.authorizationRevokeUri, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        token: this.token,
      }),
    });
    if (resp.status !== 200) {
      throw new Error('unauthorize error');
    }
    this.cleanToken();
  }

  async createWebhook({ boardId, filters }) {
    const response = await fetch(this._config.webhookCreationUri, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        token: this.token,
        boardId,
        filters,
        rcWebhook: this._config.rcWebhookUri,
      }),
    });
    if (response.status === 401) {
      this.cleanToken();
      throw new Error('Unauthorized');
    }
    if (response.status !== 200) {
      throw new Error('Submit data error please retry later')
    }
  }

  async getInfo() {
    const response = await fetch(`${this._config.webhookInfoUri}?token=${this.token}&rcWebhook=${this._config.rcWebhookUri}&random=${Date.now()}`);
    if (response.status === 401) {
      this.cleanToken();
      throw new Error('Unauthorized');
    }
    if (response.status !== 200) {
      throw new Error('Fetch data error please retry later')
    }
    const data = await response.json();
    return data;
  }

  get trelloAuthorized() {
    return !!this.token;
  }

  get authorizationUri() {
    return this._config.authorizationUri;
  }

  cleanToken() {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
  }

  get token() {
    return localStorage.getItem(TOKEN_STORAGE_KEY);
  }

}
