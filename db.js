/**
 * Data layer: DynamoDB (when AWS configured) or in-memory fallback for local dev.
 * Set USE_DYNAMODB=1 and AWS credentials/region to use DynamoDB.
 */

const crypto = require("crypto");

const USE_DYNAMODB = process.env.USE_DYNAMODB === "1";

let dynamoClient = null;
let docClient = null;

if (USE_DYNAMODB) {
  const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
  const { DynamoDBDocumentClient } = require("@aws-sdk/lib-dynamodb");
  const region = process.env.AWS_REGION || "us-east-1";
  dynamoClient = new DynamoDBClient({ region });
  docClient = DynamoDBDocumentClient.from(dynamoClient);
}

const SESSIONS_TABLE = process.env.SESSIONS_TABLE || "cert-sessions";
const REVIEWS_TABLE = process.env.REVIEWS_TABLE || "cert-reviews";

// In-memory fallback
const sessions = new Map();
const reviews = new Map();

function generateSessionId() {
  return "cert-" + crypto.randomBytes(6).toString("hex");
}

// ---------- DynamoDB helpers ----------
async function dynamoPut(table, item) {
  const { PutCommand } = require("@aws-sdk/lib-dynamodb");
  await docClient.send(new PutCommand({ TableName: table, Item: item }));
}

async function dynamoGet(table, key) {
  const { GetCommand } = require("@aws-sdk/lib-dynamodb");
  const res = await docClient.send(new GetCommand({ TableName: table, Key: key }));
  return res.Item || null;
}

async function dynamoQuery(table, keyCondition, attrs = {}) {
  const { QueryCommand } = require("@aws-sdk/lib-dynamodb");
  const res = await docClient.send(
    new QueryCommand({
      TableName: table,
      KeyConditionExpression: keyCondition.expr,
      ExpressionAttributeNames: keyCondition.names || {},
      ExpressionAttributeValues: keyCondition.values || {},
      ...attrs,
    })
  );
  return res.Items || [];
}

// ---------- Session operations ----------
async function createSession(aeId, week, reviewerIds, managerId, notes) {
  const sessionId = generateSessionId();
  const allReviewers = [...new Set([managerId, ...reviewerIds])];
  const session = {
    session_id: sessionId,
    ae_id: aeId,
    week,
    reviewer_ids: allReviewers,
    manager_id: managerId,
    status: "pending",
    shared_with_ae: false,
    optional_notes: notes || null,
    created_at: Date.now(),
  };

  if (USE_DYNAMODB) {
    await dynamoPut(SESSIONS_TABLE, session);
  } else {
    sessions.set(sessionId, session);
  }
  return session;
}

async function getSession(sessionId) {
  if (USE_DYNAMODB) {
    return dynamoGet(SESSIONS_TABLE, { session_id: sessionId });
  }
  return sessions.get(sessionId) || null;
}

async function updateSession(sessionId, updates) {
  const session = await getSession(sessionId);
  if (!session) return null;
  const updated = { ...session, ...updates };
  if (USE_DYNAMODB) {
    await dynamoPut(SESSIONS_TABLE, updated);
  } else {
    sessions.set(sessionId, updated);
  }
  return updated;
}

async function getPendingSessionsForReviewer(userId) {
  const pending = [];
  try {
    if (USE_DYNAMODB) {
      const { ScanCommand } = require("@aws-sdk/lib-dynamodb");
      const res = await docClient.send(
        new ScanCommand({
          TableName: SESSIONS_TABLE,
          FilterExpression: "#s = :status",
          ExpressionAttributeNames: { "#s": "status" },
          ExpressionAttributeValues: { ":status": "pending" },
        })
      );
      const items = res.Items || [];
      for (const session of items) {
        const reviewerIds = session.reviewer_ids || [];
        if (!Array.isArray(reviewerIds) || !reviewerIds.includes(userId)) continue;
        const sessionReviews = await getReviewsForSession(session.session_id);
        const hasSubmitted = sessionReviews.some((r) => r.reviewer_id === userId);
        if (!hasSubmitted) pending.push(session);
      }
    } else {
      for (const [, session] of sessions) {
        if (session.status !== "pending") continue;
        if (!session.reviewer_ids?.includes(userId)) continue;
        const key = `${session.session_id}|${userId}`;
        if (reviews.has(key)) continue;
        pending.push(session);
      }
    }
  } catch (err) {
    console.error("getPendingSessionsForReviewer error:", err.message);
  }
  return pending;
}

async function getSubmittedSessionsForReviewer(userId) {
  const submitted = [];
  try {
    if (USE_DYNAMODB) {
      const { ScanCommand } = require("@aws-sdk/lib-dynamodb");
      const res = await docClient.send(
        new ScanCommand({
          TableName: SESSIONS_TABLE,
          FilterExpression: "#s = :status",
          ExpressionAttributeNames: { "#s": "status" },
          ExpressionAttributeValues: { ":status": "pending" },
        })
      );
      const items = res.Items || [];
      for (const session of items) {
        if (!(session.reviewer_ids || []).includes(userId)) continue;
        const sessionReviews = await getReviewsForSession(session.session_id);
        const hasSubmitted = sessionReviews.some((r) => r.reviewer_id === userId);
        if (hasSubmitted) submitted.push(session);
      }
    } else {
      for (const [, session] of sessions) {
        if (session.status !== "pending") continue;
        if (!session.reviewer_ids?.includes(userId)) continue;
        const key = `${session.session_id}|${userId}`;
        if (!reviews.has(key)) continue;
        submitted.push(session);
      }
    }
  } catch (err) {
    console.error("getSubmittedSessionsForReviewer error:", err.message);
  }
  return submitted;
}

async function getSessionsForManager(managerId) {
  const list = [];
  try {
    if (USE_DYNAMODB) {
      const { ScanCommand } = require("@aws-sdk/lib-dynamodb");
      const res = await docClient.send(
        new ScanCommand({
          TableName: SESSIONS_TABLE,
          FilterExpression: "manager_id = :mid",
          ExpressionAttributeValues: { ":mid": managerId },
        })
      );
      list.push(...(res.Items || []));
    } else {
      for (const [, session] of sessions) {
        if (session.manager_id === managerId) list.push(session);
      }
    }
  } catch (err) {
    console.error("getSessionsForManager error:", err.message);
  }
  return list;
}

async function getSessionsForAE(aeId) {
  const list = [];
  try {
    if (USE_DYNAMODB) {
      const { ScanCommand } = require("@aws-sdk/lib-dynamodb");
      const res = await docClient.send(
        new ScanCommand({
          TableName: SESSIONS_TABLE,
          FilterExpression: "ae_id = :ae AND shared_with_ae = :sw",
          ExpressionAttributeValues: { ":ae": aeId, ":sw": true },
        })
      );
      list.push(...(res.Items || []));
    } else {
      for (const [, session] of sessions) {
        if (session.ae_id === aeId && session.shared_with_ae) list.push(session);
      }
    }
  } catch (err) {
    console.error("getSessionsForAE error:", err.message);
  }
  return list;
}

async function getSessionsWhereIAmAEPending(aeId) {
  const list = [];
  try {
    if (USE_DYNAMODB) {
      const { ScanCommand } = require("@aws-sdk/lib-dynamodb");
      const res = await docClient.send(
        new ScanCommand({
          TableName: SESSIONS_TABLE,
          FilterExpression: "ae_id = :ae",
          ExpressionAttributeValues: { ":ae": aeId },
        })
      );
      for (const s of res.Items || []) {
        if (!s.shared_with_ae) list.push(s);
      }
    } else {
      for (const [, session] of sessions) {
        if (session.ae_id === aeId && !session.shared_with_ae) list.push(session);
      }
    }
  } catch (err) {
    console.error("getSessionsWhereIAmAEPending error:", err.message);
  }
  return list;
}

async function setSessionComplete(sessionId) {
  if (USE_DYNAMODB) {
    const { UpdateCommand } = require("@aws-sdk/lib-dynamodb");
    await docClient.send(
      new UpdateCommand({
        TableName: SESSIONS_TABLE,
        Key: { session_id: sessionId },
        UpdateExpression: "SET #s = :s",
        ExpressionAttributeNames: { "#s": "status" },
        ExpressionAttributeValues: { ":s": "complete" },
      })
    );
  } else {
    const s = sessions.get(sessionId);
    if (s) s.status = "complete";
  }
}

// ---------- Review operations ----------
async function getReviewsForSession(sessionId) {
  if (USE_DYNAMODB) {
    return dynamoQuery(REVIEWS_TABLE, {
      expr: "session_id = :sid",
      values: { ":sid": sessionId },
    });
  }
  const list = [];
  for (const [, r] of reviews) {
    if (r.session_id === sessionId) list.push(r);
  }
  return list;
}

async function saveReview(sessionId, reviewerId, data) {
  const item = {
    session_id: sessionId,
    reviewer_id: reviewerId,
    feedback: String(data.feedback || "").trim(),
    submitted_at: Date.now(),
  };

  if (data.rubric_type === "week1") {
    item.rubric_type = "week1";
    item.sales_count = data.sales_count;
    item.product_count = data.product_count;
    item.passed = data.passed;
  } else if (["week2", "week3", "week4"].includes(data.rubric_type)) {
    item.rubric_type = data.rubric_type;
    item.total = data.total;
    item.sectionScores = data.sectionScores;
    item.passed = data.passed;
    item.gates = data.gates;
    item.payload = data.payload;
  } else {
    item.rubric_type = "legacy";
    item.rating = Number(data.rating);
  }

  if (USE_DYNAMODB) {
    await dynamoPut(REVIEWS_TABLE, item);
  } else {
    const key = `${sessionId}|${reviewerId}`;
    reviews.set(key, item);
  }
}

module.exports = {
  createSession,
  getSession,
  updateSession,
  getReviewsForSession,
  getPendingSessionsForReviewer,
  getSubmittedSessionsForReviewer,
  getSessionsForManager,
  getSessionsForAE,
  getSessionsWhereIAmAEPending,
  saveReview,
  setSessionComplete,
  USE_DYNAMODB,
};
