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
    name = '',
  }) {
    this._appKey = appKey;
    this._authorizeUrl = authorizeUrl;
    this._name = name || 'RingCentral Notifications';
    this._token = token;
    this._redirectUrl = redirectUrl;
    this._appServer = apiServer;
  }

  setToken(token) {
    this._token = token;
  }

  authorizationUrl({ scope = 'read' } = {}) {
    const query = obj2uri({
      expiration: 'never',
      name: this._name,
      scope,
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
    });
    const uri = `${this._appServer}/1/members/me/boards?${query}`;
    const response = await axios.get(uri);
    return response.data;
  }

  async getUserInfo() {
    const uri = `${this._appServer}/1/members/me?key=${this._appKey}&token=${this._token}`;
    const response = await axios.get(uri);
    return response.data;
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
    const response = await axios.post(uri);
    return response.data;
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
    const response = await axios.put(uri);
    return response.data;
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
      console.error(e && e.message);
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

  async joinCard(cardId, userId) {
    const query = obj2uri({
      value: userId,
      token: this._token,
      key: this._appKey,
    });
    const uri = `${this._appServer}/1/cards/${cardId}/idMembers?${query}`;
    const response = await axios.post(uri);
    return response.data;
  }

  async getCardMembers(cardId) {
    const query = obj2uri({
      fields: 'all',
      key: this._appKey,
      token: this._token,
    });
    const uri = `${this._appServer}/1/cards/${cardId}/members?${query}`;
    const response = await axios.get(uri);
    return response.data;
  }

  async addCardComment(cardId, comment) {
    const query = obj2uri({
      key: this._appKey,
      token: this._token,
      text: comment,
    });
    const uri = `${this._appServer}/1/cards/${cardId}/actions/comments?${query}`;
    const response = await axios.post(uri);
    return response.data;
  }

  async updateCard(cardId, data) {
    const query = obj2uri({
      key: this._appKey,
      token: this._token,
      ...data,
    });
    const uri = `${this._appServer}/1/cards/${cardId}?${query}`;
    const response = await axios.put(uri, data);
    return response.data;
  }

  async setCardDueDate(cardId, dueDate) {
    return this.updateCard(cardId, { due: dueDate });
  }
}

exports.Trello = Trello;
