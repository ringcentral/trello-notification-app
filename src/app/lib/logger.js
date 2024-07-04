
function logErrorResponse(response) {
  const status = response.status;
  const data = response.data;
  const headers = response.headers || {};
  const rcRequestId = headers['rcrequestid'];
  console.error(
    'Response error: ', status,
    ' RequestId: ', rcRequestId,
    ' Data: ',
    data
  );
}

function errorLogger(error) {
  if (!error) {
    return;
  }
  if (error.response) {
    // https://axios-http.com/docs/handling_errors
    // The request was made and the server responded with a status code
    logErrorResponse(error.response);
    return;
  }
  if (error.request) {
    // The request was made but no response was received
    console.error('Request error: ', error.code);
    return;
  }
  console.error('Error: ', error.message);
}

exports.errorLogger = errorLogger;
