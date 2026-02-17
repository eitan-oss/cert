#!/usr/bin/env node
/**
 * Verify database connection and show what's stored.
 * Run: node scripts/verify-db.js
 * Uses .env.local or .env for credentials.
 */
const path = require("path");
require("dotenv").config();
require("dotenv").config({ path: path.resolve(process.cwd(), ".env.local") });

const db = require("../db");

async function main() {
  console.log("Database mode:", db.USE_VERCEL_KV ? "Vercel KV (Redis)" : db.USE_DYNAMODB ? "DynamoDB" : "in-memory");

  const sessions = await db.getAllSessions();
  console.log("\nSessions:", sessions.length);

  for (const s of sessions) {
    const reviews = await db.getReviewsForSession(s.session_id);
    console.log(`  - ${s.session_id}: AE=${s.ae_id} Week=${s.week} (${reviews.length} reviews)`);
    for (const r of reviews) {
      const score = r.rubric_type === "week1"
        ? `Sales ${r.sales_count}/5, Product ${r.product_count}/5`
        : r.total != null ? `Total ${r.total}` : `Rating ${r.rating}`;
      console.log(`      Reviewer ${r.reviewer_id}: ${r.passed ? "PASS" : "FAIL"} (${score})`);
    }
  }

  if (sessions.length === 0) {
    console.log("\nNo sessions found. If you expected data, check:");
    console.log("  - USE_VERCEL_KV=1 and KV credentials in .env.local");
    console.log("  - Same database as your Vercel deployment");
  }
}

main().catch((err) => {
  console.error("Error:", err.message);
  process.exit(1);
});
