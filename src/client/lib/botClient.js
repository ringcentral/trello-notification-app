export class Client {
  constructor(config) {
    this._config = config;
    this._token = config.token;
    this._info = {};
  }

  async getInfo() {
    const response = await fetch(`${this._config.infoUri}?random=${Date.now()}`, {
      method: 'GET',
      headers: {
        'x-access-token': this._token,
        'Content-Type': 'application/json',
      },
    });
    if (response.status === 401) {
      throw new Error('Session expired! Please reopen the dialog.');
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
    if (resp.status === 401) {
      throw new Error('Session expired! Please reopen the dialog.');
    }
    if (resp.status !== 200) {
      throw new Error('Unauthorize error');
    }
  }

  async saveSubscription({ boardId, filters, subscriptionId, boardName, disableButtons }) {
    const params = {
      token: this._token,
      filters,
      disableButtons,
    };
    if (subscriptionId) {
      params.subscriptionId = subscriptionId;
    } else {
      params.boardId = boardId;
      params.boardName = boardName;
    }
    const response = await fetch(this._config.subscriptionUri, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(params),
    });
    if (response.status === 401) {
      throw new Error('Session expired! Please reopen the dialog.');
    }
    if (response.status !== 200) {
      throw new Error('Save subscription error please retry later')
    }
  }

  async getSubscription(id) {
    const response = await fetch(`${this._config.subscriptionUri}?id=${id}&random=${Date.now()}`, {
      method: 'GET',
      headers: {
        'x-access-token': this._token,
        'Content-Type': 'application/json',
      },
    });
    if (response.status === 401) {
      throw new Error('Session expired! Please reopen the dialog.');
    }
    if (response.status !== 200) {
      throw new Error('Fetch data error please retry later or reopen the dialog')
    }
    const data = await response.json();
    return data;
  }

  async removeSubscription(id, boardName) {
    const params = {
      token: this._token,
      id,
      boardName,
    };
    const response = await fetch(this._config.subscriptionUri, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(params),
    });
    if (response.status === 401) {
      throw new Error('Session expired! Please reopen the dialog.');
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
