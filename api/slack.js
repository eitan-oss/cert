/**
 * Vercel endpoint for Slack — Events, slash commands, interactivity.
 * Request URL: https://YOUR-APP.vercel.app/api/slack
 */
const { createHandler } = require("@vercel/slack-bolt");
const { app, receiver } = require("../index.js");

const slackHandler = createHandler(app, receiver);

async function fetch(request) {
  if (request.method === "GET") {
    return new Response("Slack endpoint OK — use POST for events", {
      status: 200,
      headers: { "Content-Type": "text/plain" },
    });
  }
  try {
    return await slackHandler(request);
  } catch (err) {
    console.error("[api/slack] Error:", err);
    return new Response(
      JSON.stringify({ error: "Handler error", message: err.message }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
}

module.exports = { fetch };
