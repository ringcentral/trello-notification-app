const axios = require('axios');

function obj2uri(obj) {
  if (!obj) {
    return '';
  }
  const urlParams = [];
  Object.keys(obj).forEach((key) => {
    if (typeof obj[key] !== 'undefined') {
      urlParams.push(`${encodeURIComponent(key)}=${encodeURIComponent(obj[key])}`);
    }
  });
  return urlParams.join('&');
}

class Trello {
  constructor({
    appKey,
    authorizeUrl = 'https://trello.com/1/authorize',
    redirectUrl,
    apiServer = 'https://api.trello.com',
    token = '',
  }) {
    this._appKey = appKey;
    this._authorizeUrl = authorizeUrl;
    this._name = 'RingCentral Notifications';
    this._token = token;
    this._redirectUrl = redirectUrl;
    this._appServer = apiServer;
  }

  authorizationUrl() {
    const query = obj2uri({
      expiration: 'never',
      name: this._name,
      scope: 'read',
      response_type: 'token',
      key: this._appKey,
      return_url: this._redirectUrl,
      callback_method: 'fragment',
    });
    return `${this._authorizeUrl}?${query}`;
  }

  setToken(token) {
    this._token = token;
  }

  async getBoards() {
    const query = obj2uri({
      fields: 'name,url',
      key: this._appKey,
      token: this._token,
    })
    const uri = `${this._appServer}/1/members/me/boards?${query}`;
    try {
      const response = await axios.get(uri);
      return response.data;
    } catch (e) {
      console.error(e);
      return [];
    }
  }

  async getUserInfo() {
    const uri = `${this._appServer}/1/members/me?key=${this._appKey}&token=${this._token}`;
    try {
      const response = await axios.get(uri);
      return response.data;
    } catch (e) {
      console.error(e);
      return {};
    }
  }

  async createWebhook({
    description,
    callbackURL,
    idModel,
    active,
  }) {
    const query = obj2uri({
      key: this._appKey,
      token: this._token,
      callbackURL,
      idModel,
      description,
      active,
    })
    const uri = `${this._appServer}/1/webhooks?${query}`;
    try {
      const response = await axios.post(uri);
      return response.data;
    } catch (e) {
      console.error(e);
      throw e;
    }
  }

  async updateWebhook({
    id,
    description,
    callbackURL,
    idModel,
    active,
  }) {
    const query = obj2uri({
      key: this._appKey,
      token: this._token,
      callbackURL,
      idModel,
      description,
      active,
    })
    const uri = `${this._appServer}/1/webhooks/${id}?${query}`;
    try {
      const response = await axios.put(uri);
      return response.data;
    } catch (e) {
      console.error(e);
      throw e;
    }
  }

  async deleteWebhook({
    id,
  }) {
    const query = obj2uri({
      key: this._appKey,
      token: this._token,
    });
    const uri = `${this._appServer}/1/webhooks/${id}?${query}`;
    try {
      await axios.delete(uri);
    } catch (e) {
      console.error(e);
    }
  }

  // Revoke token, webhooks that created from this token will be deleted automatically
  async revokeToken() {
    const query = obj2uri({
      key: this._appKey,
      token: this._token,
    });
    const uri = `${this._appServer}/1/tokens/${this._token}?${query}`;
    try {
      await axios.delete(uri);
    } catch (e) {
      console.error(e);
    }
  }
}

exports.Trello = Trello;
