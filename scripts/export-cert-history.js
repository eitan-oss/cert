#!/usr/bin/env node
/**
 * Export certification history from the database.
 * Run: node scripts/export-cert-history.js
 *
 * Uses .env for credentials. For Vercel KV: set USE_VERCEL_KV=1, KV_REST_API_URL, KV_REST_API_TOKEN
 * (Or pull env from Vercel: vercel env pull)
 */
require("dotenv").config();
const db = require("../db");

async function resolveUserName(client, userId) {
  if (!client || !userId) return userId;
  try {
    const res = await client.users.info({ user: userId });
    return res.user?.real_name || res.user?.name || userId;
  } catch {
    return userId;
  }
}

async function main() {
  const useSlack = !!process.env.SLACK_BOT_TOKEN;
  let client = null;
  if (useSlack) {
    const { WebClient } = require("@slack/web-api");
    client = new WebClient(process.env.SLACK_BOT_TOKEN);
  }

  const sessions = await db.getAllSessions();
  const rows = [];

  for (const session of sessions) {
    const reviews = await db.getReviewsForSession(session.session_id);
    const aeName = useSlack ? await resolveUserName(client, session.ae_id) : session.ae_id;

    for (const r of reviews) {
      const reviewerName = useSlack ? await resolveUserName(client, r.reviewer_id) : r.reviewer_id;
      let scoreStr = "";
      if (r.rubric_type === "week1") {
        scoreStr = `Sales: ${r.sales_count}/5, Product: ${r.product_count}/5`;
      } else if (r.total !== undefined) {
        scoreStr = `Total: ${r.total}`;
      } else if (r.rating !== undefined) {
        scoreStr = `Rating: ${r.rating}/5`;
      }
      rows.push({
        session_id: session.session_id,
        ae: aeName,
        ae_id: session.ae_id,
        week: session.week,
        passed: r.passed ? "PASS" : "FAIL",
        score: scoreStr,
        reviewer: reviewerName,
        reviewer_id: r.reviewer_id,
        submitted_at: r.submitted_at ? new Date(r.submitted_at).toISOString() : "",
        feedback: (r.feedback || "").slice(0, 80),
      });
    }
  }

  // Sort by submitted_at descending
  rows.sort((a, b) => (b.submitted_at || "").localeCompare(a.submitted_at || ""));

  // Output as CSV
  const headers = ["AE", "Week", "Reviewer", "Result", "Score", "Submitted", "Feedback"];
  const csvRows = [headers.join(",")];

  for (const r of rows) {
    csvRows.push([
      `"${(r.ae || "").replace(/"/g, '""')}"`,
      r.week,
      `"${(r.reviewer || "").replace(/"/g, '""')}"`,
      r.passed,
      `"${(r.score || "").replace(/"/g, '""')}"`,
      r.submitted_at,
      `"${(r.feedback || "").replace(/"/g, '""')}"`,
    ].join(","));
  }

  console.log(csvRows.join("\n"));

  // Also print summary
  console.error("\n--- Summary ---");
  console.error(`Total sessions: ${sessions.length}`);
  console.error(`Total reviews: ${rows.length}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
