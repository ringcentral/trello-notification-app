export class Client {
  constructor(config) {
    this._config = config;
    this._token = config.token;
    this._info = {};
  }

  async getInfo() {
    const response = await fetch(`${this._config.infoUri}?token=${this._token}&random=${Date.now()}`);
    if (response.status === 401) {
      throw new Error('Session expired! Please reopen the dialog');
    }
    if (response.status !== 200) {
      throw new Error('Fetch data error please retry later')
    }
    const data = await response.json();
    this._info = data;
    return data;
  }

  async unauthorize() {
    const resp = await fetch(this._config.authorizationRevokeUri, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        token: this._token,
      }),
    });
    if (resp.status !== 200) {
      throw new Error('unauthorize error');
    }
  }

  async saveSubscription({ boardId, filters, subscriptionId }) {
    const params = {
      token: this._token,
      filters,
    };
    if (boardId) {
      params.boardId = boardId;
    }
    if (subscriptionId) {
      params.subscriptionId = subscriptionId;
    }
    const response = await fetch(this._config.subscriptionUri, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(params),
    });
    if (response.status === 401) {
      this.cleanToken();
      throw new Error('Unauthorized');
    }
    if (response.status !== 200) {
      throw new Error('Save subscription error please retry later')
    }
  }

  async getSubscription(id) {
    const response = await fetch(`${this._config.subscriptionUri}?token=${this._token}&id=${id}&random=${Date.now()}`);
    if (response.status === 401) {
      throw new Error('Session expired! Please reopen the dialog');
    }
    if (response.status !== 200) {
      throw new Error('Fetch data error please retry later or reopen the dialog')
    }
    const data = await response.json();
    return data;
  }

  async removeSubscription(id) {
    const params = {
      token: this._token,
      id,
    };
    const response = await fetch(this._config.subscriptionUri, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(params),
    });
    if (response.status === 401) {
      this.cleanToken();
      throw new Error('Unauthorized');
    }
    if (response.status !== 200) {
      throw new Error('Remove subscription error please retry later')
    }
  }

  get trelloAuthorized() {
    return !!this._info.trelloAuthorized;
  }

  get authorizationUri() {
    return this._config.authorizationUri;
  }
}
