function getRCWebhookId(rcWebhookUri) {
  if (
    !rcWebhookUri ||
    (
      rcWebhookUri.indexOf('https://') !== 0 &&
      rcWebhookUri.indexOf('http://') !== 0
    )) {
    return null;
  }
  const uriWithoutQuery = rcWebhookUri.split('?')[0];
  const uriWithoutHash = uriWithoutQuery.split('#')[0];
  const paths = uriWithoutHash.split('/');
  return paths[paths.length - 1];
}

exports.getRCWebhookId = getRCWebhookId;
