require("dotenv").config();
const { App } = require("@slack/bolt");

const SLACK_BOT_TOKEN = process.env.SLACK_BOT_TOKEN;
const isVercel = process.env.VERCEL === "1";

if (!SLACK_BOT_TOKEN || SLACK_BOT_TOKEN.trim() === "") {
  console.error("FATAL: SLACK_BOT_TOKEN is missing or empty. Set it in .env and try again.");
  process.exit(1);
}
if (!isVercel && (!process.env.SLACK_APP_TOKEN || process.env.SLACK_APP_TOKEN.trim() === "")) {
  console.error("FATAL: SLACK_APP_TOKEN is missing or empty. Set it in .env and try again.");
  process.exit(1);
}
if (isVercel && (!process.env.SLACK_SIGNING_SECRET || process.env.SLACK_SIGNING_SECRET.trim() === "")) {
  console.error("FATAL: SLACK_SIGNING_SECRET is missing. Required for Vercel deployment.");
  process.exit(1);
}

let app;
let receiver;
if (isVercel) {
  const { VercelReceiver } = require("@vercel/slack-bolt");
  receiver = new VercelReceiver({
    signingSecret: process.env.SLACK_SIGNING_SECRET,
  });
  app = new App({
    token: SLACK_BOT_TOKEN,
    receiver,
    deferInitialization: true,
  });
} else {
  app = new App({
    token: SLACK_BOT_TOKEN,
    appToken: process.env.SLACK_APP_TOKEN,
    socketMode: true,
  });
}

// ---------- Data layer (DynamoDB or in-memory) ----------
const db = require("./db");
const { getRubric } = require("./rubrics");

// ---------- Modal builders ----------
function buildManagerModalView() {
  return {
    type: "modal",
    callback_id: "manager_certify_modal",
    title: { type: "plain_text", text: "Launch certification" },
    submit: { type: "plain_text", text: "Launch" },
    blocks: [
      {
        type: "input",
        block_id: "ae_block",
        element: {
          type: "users_select",
          action_id: "ae_select",
          placeholder: { type: "plain_text", text: "Select AE" },
        },
        label: { type: "plain_text", text: "AE being certified" },
      },
      {
        type: "input",
        block_id: "week_block",
        element: {
          type: "static_select",
          action_id: "week_select",
          placeholder: { type: "plain_text", text: "Select week" },
          options: [
            { text: { type: "plain_text", text: "Week 1" }, value: "Week 1" },
            { text: { type: "plain_text", text: "Week 2" }, value: "Week 2" },
            { text: { type: "plain_text", text: "Week 3" }, value: "Week 3" },
            { text: { type: "plain_text", text: "Week 4" }, value: "Week 4" },
          ],
        },
        label: { type: "plain_text", text: "Certification week" },
      },
      {
        type: "input",
        block_id: "reviewers_block",
        element: {
          type: "multi_users_select",
          action_id: "reviewers_select",
          placeholder: { type: "plain_text", text: "Select reviewers" },
        },
        label: { type: "plain_text", text: "Reviewers" },
      },
      {
        type: "input",
        block_id: "notes_block",
        optional: true,
        element: {
          type: "plain_text_input",
          action_id: "notes_input",
          multiline: true,
          placeholder: { type: "plain_text", text: "Optional context or notes" },
        },
        label: { type: "plain_text", text: "Context / notes" },
      },
    ],
  };
}

function buildReviewerModalView(sessionId, week) {
  const rubric = getRubric(week);

  if (week === "Week 1" && rubric) {
    return buildWeek1RubricModal(sessionId, rubric);
  }
  if ((week === "Week 2" || week === "Week 3" || week === "Week 4") && rubric?.sections) {
    return buildScaledRubricModal(sessionId, rubric);
  }

  return buildLegacyRatingModal(sessionId);
}

function buildWeek1RubricModal(sessionId, rubric) {
  const blocks = [
    {
      type: "section",
      text: { type: "mrkdwn", text: "*Sales Process Skills (60%)* _Rep needs 5/5 to pass. Check each item the AE demonstrated:_" },
    },
    ...rubric.sales_process.items.map((label, i) => ({
      type: "input",
      block_id: `sales_${i + 1}`,
      optional: false,
      element: {
        type: "checkboxes",
        action_id: `sales_${i + 1}_check`,
        options: [{ text: { type: "plain_text", text: label }, value: "pass" }],
      },
      label: { type: "plain_text", text: "\u200b" },
    })),
    {
      type: "section",
      text: { type: "mrkdwn", text: "*Product/Domain Knowledge (40%)* _Check each item (min 3/5 to pass):_" },
    },
    ...rubric.product_domain.items.map((label, i) => ({
      type: "input",
      block_id: `product_${i + 1}`,
      optional: false,
      element: {
        type: "checkboxes",
        action_id: `product_${i + 1}_check`,
        options: [{ text: { type: "plain_text", text: label }, value: "pass" }],
      },
      label: { type: "plain_text", text: "\u200b" },
    })),
    {
      type: "input",
      block_id: "comments_block",
      element: {
        type: "plain_text_input",
        action_id: "comments_input",
        multiline: true,
        placeholder: { type: "plain_text", text: "Comments (required)" },
        min_length: 1,
      },
      label: { type: "plain_text", text: "Comments" },
    },
  ];

  return {
    type: "modal",
    callback_id: "reviewer_review_modal",
    private_metadata: sessionId,
    title: { type: "plain_text", text: `Submit review — ${rubric.week}` },
    submit: { type: "plain_text", text: "Submit" },
    blocks,
  };
}

function buildScaledRubricModal(sessionId, rubric) {
  const blocks = [];
  const scaleOptions = [1, 2, 3, 4, 5].map((n) => ({
    text: { type: "plain_text", text: String(n) },
    value: String(n),
  }));

  for (const section of rubric.sections) {
    let sectionText = `*${section.title}*`;
    if (section.gradingCriteria?.length) {
      sectionText += "\n_Grade based on:_\n" + section.gradingCriteria.map((c) => `• ${c}`).join("\n");
    } else if (section.criteria) {
      sectionText += ` — _${section.criteria}_`;
    }
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: sectionText,
      },
    });
    blocks.push({
      type: "input",
      block_id: section.id,
      optional: false,
      element: {
        type: "radio_buttons",
        action_id: `${section.id}_rating`,
        options: scaleOptions,
      },
      label: { type: "plain_text", text: `Rate 1–5` },
    });
  }

  blocks.push({
    type: "section",
    text: {
      type: "mrkdwn",
      text: rubric.passRequirements || "*Pass requirements:* _Total ≥75% · Min 3/5 on key sections_",
    },
  });

  blocks.push({
    type: "input",
    block_id: "comments_block",
    optional: true,
    element: {
      type: "plain_text_input",
      action_id: "comments_input",
      multiline: true,
      placeholder: { type: "plain_text", text: "Comments (optional)" },
    },
    label: { type: "plain_text", text: "Comments" },
  });

  return {
    type: "modal",
    callback_id: "reviewer_review_modal",
    private_metadata: sessionId,
    title: { type: "plain_text", text: rubric.modalTitle || "Certification Score" },
    submit: { type: "plain_text", text: "Submit" },
    blocks,
  };
}

function buildLegacyRatingModal(sessionId) {
  return {
    type: "modal",
    callback_id: "reviewer_review_modal",
    private_metadata: sessionId,
    title: { type: "plain_text", text: "Submit review" },
    submit: { type: "plain_text", text: "Submit" },
    blocks: [
      {
        type: "input",
        block_id: "rating_block",
        element: {
          type: "static_select",
          action_id: "rating_select",
          placeholder: { type: "plain_text", text: "Select rating" },
          options: [1, 2, 3, 4, 5].map((n) => ({
            text: { type: "plain_text", text: String(n) },
            value: String(n),
          })),
        },
        label: { type: "plain_text", text: "Rating (1–5)" },
      },
      {
        type: "input",
        block_id: "comments_block",
        element: {
          type: "plain_text_input",
          action_id: "comments_input",
          multiline: true,
          placeholder: { type: "plain_text", text: "Comments (required)" },
          min_length: 1,
        },
        label: { type: "plain_text", text: "Comments" },
      },
    ],
  };
}

// ---------- Share results with AE (manager action) — was auto-DM, now explicit ----------
async function shareResultsWithAE(client, sessionId) {
  const session = await db.getSession(sessionId);
  if (!session) return false;

  const allReviews = await db.getReviewsForSession(sessionId);
  if (allReviews.length !== session.reviewer_ids.length) return false;

  const rubric = getRubric(session.week);
  let messageBody;
  if (session.week === "Week 2" && rubric) {
    messageBody = formatScaledResults(allReviews, 30);
  } else if (session.week === "Week 3" && rubric) {
    messageBody = formatScaledResults(allReviews, 20);
  } else if (session.week === "Week 4" && rubric) {
    messageBody = formatScaledResults(allReviews, 15);
  } else if (session.week === "Week 1" && rubric) {
    messageBody = formatWeek1Results(allReviews);
  } else {
    messageBody = formatLegacyResults(allReviews);
  }

  let dmChannel;
  try {
    const open = await client.conversations.open({ users: session.ae_id });
    dmChannel = open.channel.id;
  } catch (err) {
    console.error("Could not open DM with AE:", session.ae_id, err.message);
    return false;
  }

  const isUpdate = session.shared_with_ae;
  await client.chat.postMessage({
    channel: dmChannel,
    text: isUpdate
      ? `Updated certification results (${session.week}):\n\n${messageBody}`
      : `Your certification results (${session.week}):\n\n${messageBody}`,
  });

  await db.updateSession(sessionId, { shared_with_ae: true });
  await db.setSessionComplete(sessionId);
  console.log("[ share ] session", sessionId, "→ DM sent to AE", session.ae_id);
  return true;
}

// ---------- Build and publish Home tab (reusable for app_home_opened and proactive updates) ----------
async function buildHomeBlocks(client, userId) {
  const [pending, submitted, managerSessions, aeSessions, aePendingSessions] = await Promise.all([
    db.getPendingSessionsForReviewer(userId),
    db.getSubmittedSessionsForReviewer(userId),
    db.getSessionsForManager(userId),
    db.getSessionsForAE(userId),
    db.getSessionsWhereIAmAEPending(userId),
  ]);

  const blocks = [
    { type: "header", text: { type: "plain_text", text: "Certification Review", emoji: true } },
  ];

  // Reviewer: Pending (exclude my managed certs — those appear only in MY CERTIFICATIONS)
  const pendingAsReviewer = pending.filter((s) => s.manager_id !== userId);
  if (pendingAsReviewer.length > 0) {
    blocks.push({ type: "section", text: { type: "mrkdwn", text: "*PENDING* — Submit your review" } });
    for (const session of pendingAsReviewer) {
      let aeName = session.ae_id;
      try {
        const u = await client.users.info({ user: session.ae_id });
        aeName = u.user?.real_name || u.user?.name || session.ae_id;
      } catch (_) {}
      blocks.push({
        type: "section",
        text: { type: "mrkdwn", text: `${aeName} — ${session.week}` },
        accessory: {
          type: "button",
          text: { type: "plain_text", text: "Submit review", emoji: true },
          action_id: "home_submit_review_btn",
          value: session.session_id,
          style: "primary",
        },
      });
    }
  }

  // Reviewer: Submitted (exclude my managed certs)
  const submittedAsReviewer = submitted.filter((s) => s.manager_id !== userId);
  if (submittedAsReviewer.length > 0) {
    blocks.push({ type: "section", text: { type: "mrkdwn", text: "*SUBMITTED* — Edit if needed" } });
    for (const session of submittedAsReviewer) {
      let aeName = session.ae_id;
      try {
        const u = await client.users.info({ user: session.ae_id });
        aeName = u.user?.real_name || u.user?.name || session.ae_id;
      } catch (_) {}
      blocks.push({
        type: "section",
        text: { type: "mrkdwn", text: `${aeName} — ${session.week}` },
        accessory: {
          type: "button",
          text: { type: "plain_text", text: "Edit review", emoji: true },
          action_id: "home_edit_review_btn",
          value: session.session_id,
        },
      });
    }
  }

  // Manager: My certifications
  const myCerts = managerSessions.filter((s) => !s.shared_with_ae);
  const sharedCerts = managerSessions.filter((s) => s.shared_with_ae);
  if (myCerts.length > 0 || sharedCerts.length > 0) {
    blocks.push({ type: "section", text: { type: "mrkdwn", text: "*MY CERTIFICATIONS*" } });
    for (const session of myCerts) {
      const allReviews = await db.getReviewsForSession(session.session_id);
      const submittedCount = allReviews.length;
      const totalCount = session.reviewer_ids?.length || 0;
      const allIn = submittedCount >= totalCount;
      const managerHasSubmitted = allReviews.some((r) => r.reviewer_id === userId);
      let aeName = session.ae_id;
      try {
        const u = await client.users.info({ user: session.ae_id });
        aeName = u.user?.real_name || u.user?.name || session.ae_id;
      } catch (_) {}
      // When manager hasn't submitted, prioritize Submit; otherwise View details or Share
      const accessory = allIn
        ? {
            type: "button",
            text: { type: "plain_text", text: "Share with rep", emoji: true },
            action_id: "home_share_with_rep_btn",
            value: session.session_id,
            style: "primary",
          }
        : !managerHasSubmitted
          ? {
              type: "button",
              text: { type: "plain_text", text: "Submit review", emoji: true },
              action_id: "home_submit_review_btn",
              value: session.session_id,
              style: "primary",
            }
          : {
              type: "button",
              text: { type: "plain_text", text: "View details", emoji: true },
              action_id: "home_manager_view_details_btn",
              value: session.session_id,
            };
      blocks.push({
        type: "section",
        text: { type: "mrkdwn", text: `${aeName} — ${session.week}\n${submittedCount}/${totalCount} reviewers submitted` },
        accessory,
      });
    }
    for (const session of sharedCerts) {
      let aeName = session.ae_id;
      try {
        const u = await client.users.info({ user: session.ae_id });
        aeName = u.user?.real_name || u.user?.name || session.ae_id;
      } catch (_) {}
      blocks.push({
        type: "section",
        text: { type: "mrkdwn", text: `${aeName} — ${session.week} — _Shared ✓_` },
      });
    }
  }

  // AE: Certifications in progress (waiting for manager to share)
  if (aePendingSessions.length > 0) {
    blocks.push({ type: "section", text: { type: "mrkdwn", text: "*IN PROGRESS* — Results will appear here when your manager shares" } });
    for (const session of aePendingSessions) {
      const allReviews = await db.getReviewsForSession(session.session_id);
      const totalCount = session.reviewer_ids?.length || 0;
      blocks.push({
        type: "section",
        text: { type: "mrkdwn", text: `${session.week} — _${allReviews.length}/${totalCount} reviews submitted_` },
      });
    }
  }

  // AE: My results (shared)
  if (aeSessions.length > 0) {
    blocks.push({ type: "section", text: { type: "mrkdwn", text: "*MY RESULTS*" } });
    for (const session of aeSessions) {
      const allReviews = await db.getReviewsForSession(session.session_id);
      const rubric = getRubric(session.week);
      let resultText = "";
      if (session.week === "Week 1" && rubric) {
        const passCount = allReviews.filter((r) => r.passed).length;
        resultText = passCount === allReviews.length ? "PASS" : "FAIL";
      } else if (["Week 2", "Week 3", "Week 4"].includes(session.week) && rubric) {
        const passCount = allReviews.filter((r) => r.passed).length;
        resultText = passCount === allReviews.length ? "PASS" : "FAIL";
      } else {
        const avg = allReviews.reduce((s, r) => s + (r.rating || 0), 0) / allReviews.length;
        resultText = avg >= 4 ? "PASS" : "FAIL";
      }
      blocks.push({
        type: "section",
        text: { type: "mrkdwn", text: `*${session.week} certification* — ${resultText}` },
      });
    }
  }

  const hasAny = pendingAsReviewer.length > 0 || submittedAsReviewer.length > 0 || myCerts.length > 0 || sharedCerts.length > 0 || aeSessions.length > 0 || aePendingSessions.length > 0;
  if (!hasAny) {
    blocks.push({
      type: "section",
      text: { type: "mrkdwn", text: "Nothing here yet. Use `/certify` to launch a certification, or check back for results." },
    });
  }

  blocks.push({
    type: "context",
    elements: [{ type: "mrkdwn", text: "To launch a certification: `/certify`" }],
  });
  return blocks;
}

async function publishHomeForUser(client, userId) {
  try {
    const blocks = await buildHomeBlocks(client, userId);
    await client.views.publish({ user_id: userId, view: { type: "home", blocks } });
  } catch (err) {
    console.error("publishHomeForUser error:", err.message);
  }
}

function formatWeek1Results(reviews) {
  const passCount = reviews.filter((r) => r.passed).length;
  const overallPass = passCount === reviews.length;
  const header = overallPass
    ? `*Overall: PASS* — All ${reviews.length} reviewer(s) recommend pass.\n\n`
    : `*Overall: FAIL* — ${passCount}/${reviews.length} reviewer(s) recommend pass.\n\n`;

  const lines = reviews.map((r) => {
    const result = r.passed ? "Pass" : "Fail";
    const detail = `(${r.sales_count}/5 Sales Process, ${r.product_count}/5 Product)`;
    return `• Reviewer: ${result} ${detail}`;
  });
  const summary = `Overall: ${passCount}/${reviews.length} reviewers recommend pass.`;
  const feedbackLines = reviews.map((r) => `  — ${r.feedback}`).join("\n");
  return header + [...lines, summary, "\nComments (anonymous):\n" + feedbackLines].join("\n");
}

function formatScaledResults(reviews, totalMax) {
  const passCount = reviews.filter((r) => r.passed).length;
  const overallPass = passCount === reviews.length;
  const header = overallPass
    ? `*Overall: PASS* — All ${reviews.length} reviewer(s) recommend pass.\n\n`
    : `*Overall: FAIL* — ${passCount}/${reviews.length} reviewer(s) recommend pass.\n\n`;

  const lines = reviews.map((r) => {
    const result = r.passed ? "Pass" : "Fail";
    const pct = Math.round((r.total / totalMax) * 100);
    const detail = `(${r.total}/${totalMax}, ${pct}%)`;
    const gateStr = r.gates
      ? ` [Score: ${r.gates.score ? "✓" : "✗"} | All sec ≥3: ${r.gates.sectionMinimums ? "✓" : "✗"}]`
      : "";
    return `• Reviewer: ${result} ${detail}${gateStr}`;
  });
  const summary = `Overall: ${passCount}/${reviews.length} reviewers recommend pass.`;
  const notesLines = reviews.map((r) => (r.feedback ? `  — ${r.feedback}` : "")).filter(Boolean).join("\n");
  return header + [...lines, summary, notesLines ? "\nComments:\n" + notesLines : ""].join("\n");
}

function formatLegacyResults(reviews) {
  const avg = reviews.reduce((s, r) => s + (r.rating || 0), 0) / reviews.length;
  const avgRounded = Math.round(avg * 10) / 10;
  const header = avgRounded >= 4
    ? `*Overall: PASS* — Average ${avgRounded}/5 from ${reviews.length} reviewer(s).\n\n`
    : `*Overall: FAIL* — Average ${avgRounded}/5 from ${reviews.length} reviewer(s).\n\n`;
  const feedbackLines = reviews.map((r) => `• ${r.feedback}`).join("\n");
  return header + `Average score: ${avgRounded}/5 (${reviews.length} reviewers).\n\nComments (anonymous):\n${feedbackLines}`;
}

// ---------- Handlers ----------

// App Home: show role-based sections (pending, submitted, manager certs, AE results)
app.event("app_home_opened", async ({ event, client }) => {
  const userId = event.user;
  try {
    const blocks = await buildHomeBlocks(client, userId);
    await client.views.publish({ user_id: userId, view: { type: "home", blocks } });
  } catch (err) {
    console.error("App Home error:", err.message, err.stack);
    try {
      await client.views.publish({
        user_id: userId,
        view: {
          type: "home",
          blocks: [
            { type: "header", text: { type: "plain_text", text: "Certification Review", emoji: true } },
            { type: "section", text: { type: "mrkdwn", text: "Something went wrong loading your reviews. Try again later." } },
            { type: "context", elements: [{ type: "mrkdwn", text: "To launch a certification: `/certify`" }] },
          ],
        },
      });
    } catch (e) {
      console.error("App Home fallback publish failed:", e.message);
    }
  }
});

// Submit review from Home
app.action("home_submit_review_btn", async ({ ack, body, client }) => {
  await ack();
  const sessionId = body.actions?.[0]?.value;
  if (!sessionId) return;
  try {
    const session = await db.getSession(sessionId);
    if (!session) return;
    await client.views.open({
      trigger_id: body.trigger_id,
      view: buildReviewerModalView(sessionId, session.week),
    });
  } catch (err) {
    console.error("Failed to open review modal from Home:", err.message);
  }
});

// Edit review from Home
app.action("home_edit_review_btn", async ({ ack, body, client }) => {
  await ack();
  const sessionId = body.actions?.[0]?.value;
  if (!sessionId) return;
  try {
    const session = await db.getSession(sessionId);
    if (!session) return;
    await client.views.open({
      trigger_id: body.trigger_id,
      view: buildReviewerModalView(sessionId, session.week),
    });
  } catch (err) {
    console.error("Failed to open edit modal from Home:", err.message);
  }
});

// Manager: View details modal
app.action("home_manager_view_details_btn", async ({ ack, body, client }) => {
  await ack();
  const sessionId = body.actions?.[0]?.value;
  if (!sessionId) return;
  try {
    const session = await db.getSession(sessionId);
    if (!session) return;
    const allReviews = await db.getReviewsForSession(sessionId);
    const submittedIds = new Set(allReviews.map((r) => r.reviewer_id));
    const reviewerIds = session.reviewer_ids || [];
    const managerHasSubmitted = submittedIds.has(body.user.id);
    const lines = [];
    for (const rid of reviewerIds) {
      let name = rid;
      try {
        const u = await client.users.info({ user: rid });
        name = u.user?.real_name || u.user?.name || rid;
      } catch (_) {}
      lines.push(`• ${name}: ${submittedIds.has(rid) ? "✓ Submitted" : "○ Pending"}`);
    }
    let aeName = session.ae_id;
    try {
      const u = await client.users.info({ user: session.ae_id });
      aeName = u.user?.real_name || u.user?.name || session.ae_id;
    } catch (_) {}
    const blocks = [
      { type: "section", text: { type: "mrkdwn", text: `*${aeName}* — ${session.week}` } },
      { type: "section", text: { type: "mrkdwn", text: `*Reviewers* (${allReviews.length}/${reviewerIds.length} submitted):\n${lines.join("\n")}` } },
    ];
    if (!managerHasSubmitted && reviewerIds.includes(body.user.id)) {
      blocks.push({
        type: "actions",
        elements: [{ type: "button", text: { type: "plain_text", text: "Submit review", emoji: true }, action_id: "home_submit_review_btn", value: sessionId, style: "primary" }],
      });
    }
    blocks.push({ type: "context", elements: [{ type: "mrkdwn", text: "When all reviewers have submitted, use *Share with rep* on the Home tab." }] });
    await client.views.open({
      trigger_id: body.trigger_id,
      view: {
        type: "modal",
        title: { type: "plain_text", text: "Certification Details" },
        close: { type: "plain_text", text: "Close" },
        blocks,
      },
    });
  } catch (err) {
    console.error("Failed to open manager details modal:", err.message);
  }
});

// Manager: Share score with rep
app.action("home_share_with_rep_btn", async ({ ack, body, client }) => {
  await ack();
  const sessionId = body.actions?.[0]?.value;
  if (!sessionId) return;
  try {
    const ok = await shareResultsWithAE(client, sessionId);
    if (ok) {
      const session = await db.getSession(sessionId);
      await publishHomeForUser(client, body.user.id);
      if (session?.ae_id) await publishHomeForUser(client, session.ae_id);
      if (session?.manager_id) await publishHomeForUser(client, session.manager_id);
    }
  } catch (err) {
    console.error("Failed to share with rep:", err.message);
  }
});

// Slash command: open manager modal
app.command("/certify", async ({ ack, body, client }) => {
  await ack();
  const triggerId = body.trigger_id;
  if (!triggerId) {
    console.error("[ /certify ] missing trigger_id — cannot open modal");
    return;
  }
  try {
    await client.views.open({
      trigger_id: triggerId,
      view: buildManagerModalView(),
    });
    console.log("[ /certify ] modal opened for", body.user_name);
  } catch (err) {
    console.error("Failed to open manager modal:", err.message);
    if (err.data) console.error("Slack API response:", JSON.stringify(err.data));
  }
});

// Manager modal submit: create session, DM each reviewer with "Submit review" button
app.view("manager_certify_modal", async ({ ack, body, view, client }) => {
  const values = view.state.values;
  const aeId = values.ae_block?.ae_select?.selected_user;
  const weekOption = values.week_block?.week_select?.selected_option;
  const week = weekOption ? weekOption.value : null;
  const reviewersAction = values.reviewers_block?.reviewers_select;
  const reviewerIds = reviewersAction?.selected_users || [];
  const notesAction = values.notes_block?.notes_input;
  const notes = notesAction?.value?.trim() || null;
  const managerId = body.user.id;

  const errors = {};
  if (!aeId) errors.ae_block = "Select an AE";
  if (!week) errors.week_block = "Select a week";
  if (reviewerIds.length === 0) errors.reviewers_block = "Select at least one reviewer";
  if (Object.keys(errors).length > 0) {
    await ack({ response_action: "errors", errors });
    return;
  }

  const session = await db.createSession(aeId, week, reviewerIds, managerId, notes);
  const sessionId = session.session_id;

  let aeName = aeId;
  try {
    const u = await client.users.info({ user: aeId });
    aeName = u.user?.real_name || u.user?.name || aeId;
  } catch (_) {}

  // DM each reviewer (including manager) with Submit button — act right from the notification
  const reviewerDms = {};
  for (const reviewerId of session.reviewer_ids) {
    try {
      const open = await client.conversations.open({ users: reviewerId });
      const isManager = reviewerId === managerId;
      const intro = isManager
        ? `Certification launched for *${aeName}* — ${session.week}. You're also a reviewer — submit below or track progress on the *Home* tab.`
        : `You've been selected to review *${aeName}* — ${session.week}. Submit below or open the *Home* tab.`;
      const msg = await client.chat.postMessage({
        channel: open.channel.id,
        text: intro,
        blocks: [
          { type: "section", text: { type: "mrkdwn", text: intro } },
          {
            type: "actions",
            block_id: "review_actions",
            elements: [
              { type: "button", text: { type: "plain_text", text: "Submit review", emoji: true }, action_id: "submit_review_btn", value: sessionId, style: "primary" },
            ],
          },
        ],
      });
      reviewerDms[reviewerId] = { channel: msg.channel, ts: msg.ts };
    } catch (err) {
      console.error("Failed to DM reviewer", reviewerId, err.message);
    }
  }
  if (Object.keys(reviewerDms).length > 0) {
    await db.updateSession(sessionId, { reviewer_dms: reviewerDms });
  }

  // Proactive Home updates for all reviewers, manager, and AE
  for (const reviewerId of session.reviewer_ids) {
    await publishHomeForUser(client, reviewerId);
  }
  await publishHomeForUser(client, managerId);
  await publishHomeForUser(client, aeId);

  await ack();
  console.log("[ session ] created", sessionId, "reviewers:", session.reviewer_ids.length);
});

// "Submit review" button: open reviewer modal (week-specific)
app.action("submit_review_btn", async ({ ack, body, client }) => {
  await ack();
  const sessionId = body.actions?.[0]?.value;
  if (!sessionId) {
    console.error("Submit review button missing session_id");
    return;
  }
  try {
    const session = await db.getSession(sessionId);
    if (!session) {
      console.error("Session not found:", sessionId);
      return;
    }
    await client.views.open({
      trigger_id: body.trigger_id,
      view: buildReviewerModalView(sessionId, session.week),
    });
  } catch (err) {
    console.error("Failed to open reviewer modal:", err.message);
  }
});

// Reviewer modal submit: save review, then check completion
app.view("reviewer_review_modal", async ({ ack, body, view, client }) => {
  const sessionId = view.private_metadata;
  const values = view.state.values;
  const reviewerId = body.user.id;

  const session = await db.getSession(sessionId);
  if (!session) {
    await ack({ response_action: "errors", errors: { comments_block: "Session not found." } });
    return;
  }

  const rubric = getRubric(session.week);

  if (session.week === "Week 1" && rubric) {
    const commentsAction = values.comments_block?.comments_input;
    const feedback = commentsAction?.value?.trim() || null;
    if (!feedback) {
      await ack({ response_action: "errors", errors: { comments_block: "Comments are required" } });
      return;
    }
    const salesPassed = [1, 2, 3, 4, 5].filter((i) => {
      const block = values[`sales_${i}`];
      const actionId = `sales_${i}_check`;
      return block?.[actionId]?.selected_options?.some((o) => o.value === "pass");
    }).length;
    const productPassed = [1, 2, 3, 4, 5].filter((i) => {
      const block = values[`product_${i}`];
      const actionId = `product_${i}_check`;
      return block?.[actionId]?.selected_options?.some((o) => o.value === "pass");
    }).length;

    const evalResult = rubric.evaluate(
      Array(salesPassed).fill(true),
      Array(productPassed).fill(true)
    );

    await db.saveReview(sessionId, reviewerId, {
      rubric_type: "week1",
      sales_count: salesPassed,
      product_count: productPassed,
      passed: evalResult.passed,
      feedback,
    });
  } else if ((session.week === "Week 2" || session.week === "Week 3" || session.week === "Week 4") && rubric?.sections) {
    const commentsAction = values.comments_block?.comments_input;
    const notes = commentsAction?.value?.trim() || null;

    const payload = {};
    for (const section of rubric.sections) {
      const block = values[section.id];
      const actionId = `${section.id}_rating`;
      const selected = block?.[actionId]?.selected_option;
      payload[section.id] = selected ? parseInt(selected.value, 10) : 0;
    }

    const evalResult = rubric.evaluate(payload);

    await db.saveReview(sessionId, reviewerId, {
      rubric_type: `week${session.week.replace("Week ", "")}`,
      total: evalResult.total,
      sectionScores: evalResult.sectionScores,
      passed: evalResult.passed,
      gates: evalResult.gates,
      feedback: notes || "",
      payload,
    });
  } else {
    const commentsAction = values.comments_block?.comments_input;
    const feedback = commentsAction?.value?.trim() || null;
    if (!feedback) {
      await ack({ response_action: "errors", errors: { comments_block: "Comments are required" } });
      return;
    }
    const ratingOption = values.rating_block?.rating_select?.selected_option;
    const rating = ratingOption ? ratingOption.value : null;
    if (!rating) {
      await ack({ response_action: "errors", errors: { rating_block: "Select a rating" } });
      return;
    }
    await db.saveReview(sessionId, reviewerId, {
      rubric_type: "legacy",
      rating: Number(rating),
      feedback,
    });
  }

  await ack();

  // Update reviewer's DM: show "Submitted ✓" with Edit button
  const dm = session.reviewer_dms?.[reviewerId];
  if (dm) {
    try {
      let aeName = session.ae_id;
      try {
        const u = await client.users.info({ user: session.ae_id });
        aeName = u.user?.real_name || u.user?.name || session.ae_id;
      } catch (_) {}
      await client.chat.update({
        channel: dm.channel,
        ts: dm.ts,
        text: `Review submitted ✓ for ${aeName} — ${session.week}`,
        blocks: [
          { type: "section", text: { type: "mrkdwn", text: `Review submitted ✓ for *${aeName}* — *${session.week}*` } },
          {
            type: "actions",
            block_id: "review_actions",
            elements: [
              { type: "button", text: { type: "plain_text", text: "Edit review", emoji: true }, action_id: "edit_review_btn", value: sessionId },
            ],
          },
        ],
      });
    } catch (err) {
      console.error("Failed to update reviewer DM:", err.message);
    }
  }

  // Proactive Home updates for reviewer, manager, and AE (for IN PROGRESS count)
  await publishHomeForUser(client, reviewerId);
  if (session.manager_id) await publishHomeForUser(client, session.manager_id);
  if (session.ae_id) await publishHomeForUser(client, session.ae_id);

  console.log("[ review ] saved for session", sessionId, "reviewer", reviewerId);
});

// "Edit review" button: same as Submit — opens modal (overwrites existing review on submit)
app.action("edit_review_btn", async ({ ack, body, client }) => {
  await ack();
  const sessionId = body.actions?.[0]?.value;
  if (!sessionId) return;
  try {
    const session = await db.getSession(sessionId);
    if (!session) return;
    await client.views.open({
      trigger_id: body.trigger_id,
      view: buildReviewerModalView(sessionId, session.week),
    });
  } catch (err) {
    console.error("Failed to open edit modal:", err.message);
  }
});

app.error((err) => {
  console.error("Bolt error:", err);
});

if (isVercel) {
  module.exports = { app, receiver };
} else {
  (async () => {
    await app.start();
    console.log("⚡️ Slack app is running (Socket Mode). Listening for /certify...");
  })().catch((err) => {
    console.error("FATAL: Failed to start:", err.message);
    process.exit(1);
  });
}
