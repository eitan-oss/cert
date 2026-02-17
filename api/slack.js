/**
 * Vercel serverless endpoint for Slack Events API.
 * Uses @slack/bolt ExpressReceiver (no @vercel/slack-bolt dependency).
 */
const getRawBody = (req) =>
  new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });

module.exports = async function handler(req, res) {
  if (req.method === "GET") {
    return res.status(200).send("Slack endpoint OK — use POST for events");
  }
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const rawBody = await getRawBody(req);
  req.rawBody = rawBody;

  let body;
  try {
    body = JSON.parse(rawBody.toString());
  } catch {
    body = {};
  }

  if (body.type === "url_verification" && body.challenge) {
    return res.status(200).json({ challenge: body.challenge });
  }

  req.url = req.url?.replace(/^\/api\/slack.*/, "/") || "/";
  const { app, receiver } = require("../index.js");
  await app.init();
  return new Promise((resolve, reject) => {
    res.on("finish", resolve);
    res.on("error", reject);
    receiver.app(req, res);
  });
};
