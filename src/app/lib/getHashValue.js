const crypto = require('crypto');

function getHashValue(string, secretKey) {
  return crypto.createHash('sha256').update(
    `${string}:${secretKey}`
  ).digest('hex');
}

exports.getHashValue = getHashValue;
