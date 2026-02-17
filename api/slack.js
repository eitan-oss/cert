/**
 * Vercel endpoint for Slack — Events, slash commands, interactivity.
 * Request URL: https://YOUR-APP.vercel.app/api/slack
 */
const { createHandler } = require("@vercel/slack-bolt");
const { app, receiver } = require("../index.js");

const slackHandler = createHandler(app, receiver);

async function fetch(request) {
  if (request.method === "GET") {
    // Slack may redirect here after OAuth install; show a friendly page
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Certify</title></head><body style="font-family:system-ui,sans-serif;max-width:480px;margin:60px auto;padding:24px;text-align:center"><h1 style="color:#333">Certify</h1><p style="color:#666">App installed successfully. You can close this window and return to Slack.</p><p style="color:#999;font-size:14px">Use <strong>/certify</strong> to launch a certification.</p></body></html>`;
    return new Response(html, {
      status: 200,
      headers: { "Content-Type": "text/html; charset=utf-8" },
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
