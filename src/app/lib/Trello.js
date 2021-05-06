const axios = require('axios');

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
    return `${this._authorizeUrl}?expiration=never&name=${this._name}&scope=read&response_type=token&key=${this._appKey}&return_url=${this._redirectUrl}&callback_method=fragment`
  }

  setToken(token) {
    this._token = token;
  }

  async getBoards() {
    const uri = `${this._appServer}/1/members/me/boards?fields=name,url&key=${this._appKey}&token=${this._token}`;
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
}

exports.Trello = Trello;
