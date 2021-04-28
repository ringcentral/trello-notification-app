class Trello {
  constructor({
    appKey,
    authorizeUrl = 'https://trello.com/1/authorize',
    redirectUrl,
  }) {
    this._appKey = appKey;
    this._authorizeUrl = authorizeUrl;
    this._name = 'RingCentral Notifications';
    this._token = '';
    this._redirectUrl = redirectUrl;
  }

  authorizationUrl() {
    return `${this._authorizeUrl}?expiration=never&name=${this._name}&scope=read&response_type=token&key=${this._appKey}&return_url=${this._redirectUrl}&callback_method=fragment`
  }

  setToken(token) {
    this._token = token;
  }
}

exports.Trello = Trello;
