#!/usr/bin/env node
/**
 * Export certification history from the database to CSV.
 * Run: npm run export-history
 *
 * Names are stored in the DB when certs are created/reviewed (no Slack API needed).
 * Loads .env and .env.local for DB credentials.
 */
const path = require("path");
require("dotenv").config();
require("dotenv").config({ path: path.resolve(process.cwd(), ".env.local") });
const db = require("../db");

async function main() {
  const sessions = await db.getAllSessions();
  const rows = [];

  for (const session of sessions) {
    const reviews = await db.getReviewsForSession(session.session_id);
    const aeName = session.ae_name || session.ae_id;

    for (const r of reviews) {
      const reviewerName = r.reviewer_name || r.reviewer_id;
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
