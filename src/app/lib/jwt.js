const { sign, verify } = require('jsonwebtoken');

function generateToken(data, expiresIn = '120y') {
  return sign(data, process.env.APP_SERVER_SECRET_KEY, { expiresIn: expiresIn })
}

function decodeToken(token) {
  try {
    return verify(token, process.env.APP_SERVER_SECRET_KEY);
  } catch (e) {
    return null;
  }
}

exports.generateToken = generateToken;
exports.decodeToken = decodeToken;
