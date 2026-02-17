/**
 * Vercel serverless endpoint for Slack Events API.
 * Slack sends all events, commands, and interactions here.
 *
 * We handle url_verification immediately (Slack's URL challenge) before
 * loading the Bolt app, since Slack requires a fast response.
 */
const handler = async (request) => {
  const method = request.method || "GET";
  const text = method === "POST" ? await request.text() : "";

  if (method === "POST" && text) {
    try {
      const body = JSON.parse(text);
      if (body.type === "url_verification" && body.challenge) {
        return new Response(JSON.stringify({ challenge: body.challenge }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
    } catch {
      /* fall through to bolt handler */
    }
  }

  const { createHandler } = require("@vercel/slack-bolt");
  const { app, receiver } = require("../index.js");
  const boltHandler = createHandler(app, receiver);
  const rebuiltRequest = new Request(request.url, {
    method: request.method,
    headers: request.headers,
    body: text || undefined,
  });
  return boltHandler(rebuiltRequest);
};

module.exports = {
  fetch: handler,
};
