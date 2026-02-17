# Deploying to Vercel

This guide walks you through deploying the Slack Certification app to Vercel (instead of AWS).

## Important: Socket Mode vs HTTP

- **Local dev** uses Socket Mode (WebSocket) — no public URL needed.
- **Vercel** uses HTTP/Events API — Slack sends requests to your public URL. You must configure your Slack app with this URL.

---

## Step 1: Deploy to Vercel

### Option A: Deploy from GitHub

1. Push your code to GitHub (if not already).
2. Go to [vercel.com](https://vercel.com) → **Add New** → **Project**.
3. Import your GitHub repository.
4. Add environment variables (Step 2 below).
5. Click **Deploy**.

### Option B: Deploy with Vercel CLI

```bash
npm i -g vercel
vercel
```

Follow the prompts, then add environment variables in the Vercel dashboard.

---

## Step 2: Environment Variables

In **Vercel** → Your Project → **Settings** → **Environment Variables**, add:

| Variable | Value | Required |
|----------|-------|----------|
| `SLACK_BOT_TOKEN` | `xoxb-...` (Bot User OAuth Token) | Yes |
| `SLACK_SIGNING_SECRET` | From Slack app → Basic Information | Yes |
| `USE_DYNAMODB` | `1` if using DynamoDB | No (default: in-memory) |
| `AWS_REGION` | e.g. `us-east-1` | If using DynamoDB |
| `AWS_ACCESS_KEY_ID` | Your AWS key | If using DynamoDB |
| `AWS_SECRET_ACCESS_KEY` | Your AWS secret | If using DynamoDB |
| `SESSIONS_TABLE` | e.g. `cert-sessions` | Optional override |
| `REVIEWS_TABLE` | e.g. `cert-reviews` | Optional override |

**Note:** You do **not** need `SLACK_APP_TOKEN` on Vercel. That’s only for Socket Mode (local dev).

---

## Step 3: Slack App Configuration

After deploying, you’ll have a URL like `https://your-app-xxx.vercel.app`.

### Events API Request URL

1. Go to [api.slack.com/apps](https://api.slack.com/apps) → your app.
2. **Event Subscriptions** → Enable **Events**.
3. Set **Request URL** to:
   ```
   https://your-app-xxx.vercel.app/api/slack
   ```
4. Slack will send a verification request. If it fails, check that the app is deployed and the URL is correct.
5. Under **Subscribe to bot events**, add:
   - `app_home_opened`
   - `message.im` (if you use message events)

### Slash Commands

1. **Slash Commands** → **Create New Command**.
2. Command: `/certify`
3. Request URL:
   ```
   https://your-app-xxx.vercel.app/api/slack
   ```
4. Short Description: e.g. `Launch a certification`

### Interactivity & Shortcuts

1. **Interactivity & Shortcuts** → Enable **Interactivity**.
2. Request URL:
   ```
   https://your-app-xxx.vercel.app/api/slack
   ```

### OAuth & Permissions

Ensure your app has these **Bot Token Scopes**:

- `app_mentions:read`
- `channels:history`
- `chat:write`
- `commands`
- `im:history`
- `im:read`
- `im:write`
- `users:read`
- `users:read.email`

---

## Step 4: Reinstall the App

After changing Event Subscriptions or Interactivity URLs:

1. Go to **Install App** in your Slack app settings.
2. Click **Reinstall to Workspace** (if prompted).
3. Approve the permissions.

---

## Step 5: Verify

1. Run `/certify` in Slack — the modal should open.
2. Open the app’s Home tab — it should load.
3. Launch a cert and confirm DMs and flows work.

---

## Data Storage on Vercel

Serverless functions are stateless. Data does **not** persist between invocations unless you use a database.

**Options:**

1. **In-memory** (default) — Data resets on each cold start. Fine for demos.
2. **DynamoDB** — Set `USE_DYNAMODB=1` and AWS credentials. Data persists.
3. **Vercel KV / Postgres** — You would need to add an adapter in `db.js` (not included by default).

---

## Troubleshooting

| Issue | Check |
|-------|-------|
| URL verification fails | 1) Ensure `SLACK_SIGNING_SECRET` is set in Vercel env vars. 2) Redeploy after adding it. 3) URL must be exactly `https://...vercel.app/api/slack` |
| 404 on /api/slack | Ensure `api/slack.js` exists and is in the repo |
| Modal doesn’t open | Check Interactivity URL and that `SLACK_SIGNING_SECRET` is set |
| Events not received | Check Events API Request URL and subscribed events |
| Timeout errors | Vercel free tier has a 10s limit; Pro allows 60s. Consider optimizing slow handlers. |

---

## Local vs Vercel

| | Local | Vercel |
|---|-------|--------|
| Run | `npm start` | Auto-deployed on git push |
| Slack connection | Socket Mode (app token) | HTTP (signing secret) |
| .env | `SLACK_BOT_TOKEN`, `SLACK_APP_TOKEN` | `SLACK_BOT_TOKEN`, `SLACK_SIGNING_SECRET` |

Keep using `npm start` locally with Socket Mode. Deploy to Vercel for production with HTTP mode.
