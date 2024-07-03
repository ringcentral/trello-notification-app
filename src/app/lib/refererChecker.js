function getOrigin(uri) {
  if (!uri) {
    return null;
  }
  const url = new URL(uri);
  return url.origin;
}

const KNOWN_REFERER_HOSTS = [
  // 'https://*.ringcentral.com',
  // 'https://*.ringcentral.biz',
  // 'https://*.glip.com',
  // 'https://glip.com',
  // 'https://app.devtest.ringcentral.com',
  getOrigin(process.env.APP_SERVER),
  getOrigin(process.env.RINGCENTRAL_CHATBOT_SERVER),
];

function refererChecker(req, res, next) {
  const referrer = req.get('Referer');
  if (!referrer) {
    res.status(403).send('No Referer');
    return;
  }
  const referrerOrigin = getOrigin(referrer);
  if (
    KNOWN_REFERER_HOSTS.find(host => {
      if (!host) {
        return false;
      }
      // if (host.startsWith('https://*.')) {
      //   const domainSuffix = host.slice(9);
      //   return referrerOrigin.endsWith(domainSuffix);
      // }
      return host === referrerOrigin;
    })
  ) {
    next();
    return;
  }
  res.status(403).send('Invalid Referer');
};

exports.refererChecker = refererChecker;
