// Netlify Function: proxies the FiveM server-list API so the browser
// never has to deal with CORS. Deploy via the Netlify CLI or a
// Git-connected site for this to go live (see README.md).
//
// Usage from the front-end:
//   /.netlify/functions/server-status?code=YOUR_CFX_JOIN_CODE

exports.handler = async function (event) {
  const code = event.queryStringParameters && event.queryStringParameters.code;

  if (!code) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: "Missing ?code=<your Cfx.re join code>" }),
    };
  }

  try {
    const upstream = await fetch(
      `https://servers-frontend.fivem.net/api/servers/single/${encodeURIComponent(code)}`
    );

    if (!upstream.ok) {
      throw new Error(`Upstream responded ${upstream.status}`);
    }

    const data = await upstream.json();

    return {
      statusCode: 200,
      headers: {
        "content-type": "application/json",
        "cache-control": "public, max-age=15",
      },
      body: JSON.stringify(data),
    };
  } catch (err) {
    return {
      statusCode: 502,
      body: JSON.stringify({ error: "Server unreachable", detail: String(err) }),
    };
  }
};
