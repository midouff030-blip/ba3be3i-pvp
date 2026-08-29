// Small adapter so our handlers — written as async (event) => ({
// statusCode, headers, body }), the same shape used on Netlify — work
// unchanged as Vercel serverless functions (Node.js req/res style).

function adapt(handler) {
  return async function (req, res) {
    const event = {
      httpMethod: req.method,
      headers: req.headers,
      queryStringParameters: req.query || {},
      body: req.body == null ? null : typeof req.body === "string" ? req.body : JSON.stringify(req.body),
    };

    const result = await handler(event);

    if (result.headers) {
      Object.keys(result.headers).forEach(function (k) {
        res.setHeader(k, result.headers[k]);
      });
    }
    res.status(result.statusCode).send(result.body);
  };
}

module.exports = { adapt };
