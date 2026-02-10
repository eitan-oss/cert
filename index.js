require("dotenv").config();
const crypto = require("crypto");
const { App } = require("@slack/bolt");

const SLACK_BOT_TOKEN = process.env.SLACK_BOT_TOKEN;
const SLACK_APP_TOKEN = process.env.SLACK_APP_TOKEN;

if (!SLACK_BOT_TOKEN || SLACK_BOT_TOKEN.trim() === "") {
  console.error("FATAL: SLACK_BOT_TOKEN is missing or empty. Set it in .env and try again.");
  process.exit(1);
}
if (!SLACK_APP_TOKEN || SLACK_APP_TOKEN.trim() === "") {
  console.error("FATAL: SLACK_APP_TOKEN is missing or empty. Set it in .env and try again.");
  process.exit(1);
}

const app = new App({
  token: SLACK_BOT_TOKEN,
  appToken: SLACK_APP_TOKEN,
  socketMode: true,
});

// ---------- Data layer (in-memory) ----------
const sessions = new Map();
const reviews = new Map();

function generateSessionId() {
  return "cert-" + crypto.randomBytes(6).toString("hex");
}

function createSession(aeId, week, reviewerIds, managerId, notes) {
  const sessionId = generateSessionId();
  const allReviewers = [...new Set([managerId, ...reviewerIds])];
  const session = {
    session_id: sessionId,
    ae_id: aeId,
    week,
    reviewer_ids: allReviewers,
    manager_id: managerId,
    status: "pending",
    optional_notes: notes || null,
    created_at: Date.now(),
  };
  sessions.set(sessionId, session);
  return session;
}

function getSession(sessionId) {
  return sessions.get(sessionId);
}

function getReviewsForSession(sessionId) {
  const list = [];
  for (const [, r] of reviews) {
    if (r.session_id === sessionId) list.push(r);
  }
  return list;
}

function saveReview(sessionId, reviewerId, rating, feedback) {
  const key = `${sessionId}|${reviewerId}`;
  reviews.set(key, {
    session_id: sessionId,
    reviewer_id: reviewerId,
    rating: Number(rating),
    feedback: String(feedback).trim(),
    submitted_at: Date.now(),
  });
}

function setSessionComplete(sessionId) {
  const s = sessions.get(sessionId);
  if (s) s.status = "complete";
}

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

function buildReviewerModalView(sessionId) {
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
        block_id: "feedback_block",
        element: {
          type: "plain_text_input",
          action_id: "feedback_input",
          multiline: true,
          placeholder: { type: "plain_text", text: "Qualitative feedback" },
          min_length: 1,
        },
        label: { type: "plain_text", text: "Qualitative feedback" },
      },
    ],
  };
}

// ---------- Completion: when all reviewers done, DM AE and mark complete ----------
async function checkAndCompleteSession(client, sessionId) {
  const session = getSession(sessionId);
  if (!session || session.status === "complete") return;

  const allReviews = getReviewsForSession(sessionId);
  if (allReviews.length !== session.reviewer_ids.length) return;

  const avg = allReviews.reduce((s, r) => s + r.rating, 0) / allReviews.length;
  const avgRounded = Math.round(avg * 10) / 10;
  const feedbackLines = allReviews.map((r) => `• ${r.feedback}`).join("\n");

  let dmChannel;
  try {
    const open = await client.conversations.open({ users: session.ae_id });
    dmChannel = open.channel.id;
  } catch (err) {
    console.error("Could not open DM with AE:", session.ae_id, err.message);
    setSessionComplete(sessionId);
    return;
  }

  await client.chat.postMessage({
    channel: dmChannel,
    text: `Your certification results (${session.week}): Average score: ${avgRounded} (${allReviews.length} reviewers). Feedback (anonymous):\n${feedbackLines}`,
  });

  setSessionComplete(sessionId);
  console.log("[ complete ] session", sessionId, "→ DM sent to AE", session.ae_id);
}

// ---------- Handlers ----------

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

  const session = createSession(aeId, week, reviewerIds, managerId, notes);
  const sessionId = session.session_id;

  let aeName = aeId;
  try {
    const u = await client.users.info({ user: aeId });
    aeName = u.user?.real_name || u.user?.name || aeId;
  } catch (_) {}

  for (const reviewerId of session.reviewer_ids) {
    try {
      const open = await client.conversations.open({ users: reviewerId });
      await client.chat.postMessage({
        channel: open.channel.id,
        text: `You've been selected to review ${aeName} — ${session.week} certification`,
        blocks: [
          { type: "section", text: { type: "mrkdwn", text: `You've been selected to review *${aeName}* — *${session.week}* certification` } },
          {
            type: "actions",
            block_id: "review_actions",
            elements: [
              { type: "button", text: { type: "plain_text", text: "Submit review" }, action_id: "submit_review_btn", value: sessionId },
            ],
          },
        ],
      });
    } catch (err) {
      console.error("Failed to DM reviewer", reviewerId, err.message);
    }
  }

  await ack();
  console.log("[ session ] created", sessionId, "reviewers:", session.reviewer_ids.length);
});

// "Submit review" button: open reviewer modal
app.action("submit_review_btn", async ({ ack, body, client }) => {
  await ack();
  const sessionId = body.actions?.[0]?.value;
  if (!sessionId) {
    console.error("Submit review button missing session_id");
    return;
  }
  try {
    await client.views.open({
      trigger_id: body.trigger_id,
      view: buildReviewerModalView(sessionId),
    });
  } catch (err) {
    console.error("Failed to open reviewer modal:", err.message);
  }
});

// Reviewer modal submit: save review, then check completion
app.view("reviewer_review_modal", async ({ ack, body, view, client }) => {
  const sessionId = view.private_metadata;
  const values = view.state.values;
  const ratingOption = values.rating_block?.rating_select?.selected_option;
  const rating = ratingOption ? ratingOption.value : null;
  const feedbackAction = values.feedback_block?.feedback_input;
  const feedback = feedbackAction?.value?.trim() || null;
  const reviewerId = body.user.id;

  if (!rating) {
    await ack({ response_action: "errors", errors: { rating_block: "Select a rating" } });
    return;
  }
  if (!feedback) {
    await ack({ response_action: "errors", errors: { feedback_block: "Feedback is required" } });
    return;
  }

  saveReview(sessionId, reviewerId, rating, feedback);
  await ack();

  await checkAndCompleteSession(client, sessionId);
  console.log("[ review ] saved for session", sessionId, "reviewer", reviewerId);
});

app.error((err) => {
  console.error("Bolt error:", err);
});

(async () => {
  await app.start();
  console.log("⚡️ Slack app is running (Socket Mode). Listening for /certify...");
})().catch((err) => {
  console.error("FATAL: Failed to start:", err.message);
  process.exit(1);
});
