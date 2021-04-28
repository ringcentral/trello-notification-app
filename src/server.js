const { createApp } = require('glip-integration-js');

const appConf = require('./app/index.js');

exports.server = createApp(appConf);
