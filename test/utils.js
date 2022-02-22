async function getRequestBody(scope) {
  return new Promise((resolve, reject) => {
    scope.once('request', ({ headers: requestHeaders }, interceptor, reqBody) => {
      const requestBody = JSON.parse(reqBody);
      resolve(requestBody);
    });
  });
}

exports.getRequestBody = getRequestBody;
