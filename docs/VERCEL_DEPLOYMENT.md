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
| `USE_VERCEL_KV` | `1` if using Vercel KV (Redis) | No |
| `USE_DYNAMODB` | `1` if using DynamoDB | No |
| `AWS_REGION` | e.g. `us-east-1` | If using DynamoDB |
| `AWS_ACCESS_KEY_ID` | Your AWS key | If using DynamoDB |
| `AWS_SECRET_ACCESS_KEY` | Your AWS secret | If using DynamoDB |

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
2. **Vercel KV (Redis)** — Add Redis from Vercel Marketplace. No AWS needed. **Recommended.**
3. **DynamoDB** — Set `USE_DYNAMODB=1` and AWS credentials.

### Option A: Vercel KV (recommended — no AWS)

1. Go to [Vercel Dashboard](https://vercel.com) → your project → **Storage** tab (or **Integrations**).
2. Click **Create Database** / **Add Integration**.
3. Choose **Upstash Redis** (or **Redis** from the [Marketplace](https://vercel.com/marketplace?category=storage&search=redis)).
4. Follow the prompts to create the database. Vercel will inject `KV_REST_API_URL` and `KV_REST_API_TOKEN` (or `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN`) into your project.
5. Add one environment variable in **Settings** → **Environment Variables**:
   | Variable | Value |
   |----------|-------|
   | `USE_VERCEL_KV` | `1` |
6. **Redeploy** so the new env var takes effect.

Data will now persist. No AWS account or tables to create.

### Option B: DynamoDB (requires AWS)

The app already supports DynamoDB. To enable it:

#### 1. Create DynamoDB tables in AWS

Using AWS CLI (ensure you have `aws configure` set up):

```bash
./scripts/create-dynamodb-tables.sh
```

Or create manually in [AWS Console → DynamoDB](https://console.aws.amazon.com/dynamodb):

| Table          | Partition key      | Sort key        | Billing         |
|----------------|--------------------|-----------------|-----------------|
| `cert-sessions`| `session_id` (S)   | —               | On-demand       |
| `cert-reviews` | `session_id` (S)   | `reviewer_id` (S)| On-demand     |

#### 2. Create IAM credentials for Vercel

1. Go to [AWS IAM Console](https://console.aws.amazon.com/iam) → **Users** → **Create user** (e.g. `cert-vercel`)
2. Attach a policy (or create inline) with these permissions:

```json
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Action": [
      "dynamodb:GetItem",
      "dynamodb:PutItem",
      "dynamodb:UpdateItem",
      "dynamodb:Query",
      "dynamodb:Scan"
    ],
    "Resource": [
      "arn:aws:dynamodb:us-east-1:YOUR_ACCOUNT_ID:table/cert-sessions",
      "arn:aws:dynamodb:us-east-1:YOUR_ACCOUNT_ID:table/cert-reviews"
    ]
  }]
}
```

Replace `YOUR_ACCOUNT_ID` and `us-east-1` with your AWS account ID and region.

3. Create an **Access key** for the user and copy the Access Key ID and Secret Access Key.

#### 3. Add environment variables in Vercel

In **Vercel** → Your Project → **Settings** → **Environment Variables**:

| Variable | Value |
|----------|-------|
| `USE_DYNAMODB` | `1` |
| `AWS_REGION` | `us-east-1` (or your region) |
| `AWS_ACCESS_KEY_ID` | From step 2 |
| `AWS_SECRET_ACCESS_KEY` | From step 2 |

#### 4. Redeploy

Redeploy your app so the new env vars take effect. Data will now persist.

---

## Troubleshooting

**Before retrying URL verification:**

1. Visit `https://your-app.vercel.app/api/slack` in a browser — you should see `Slack endpoint OK — use POST for events`. If you get 404, the function isn’t deployed.
2. Confirm `SLACK_BOT_TOKEN` and `SLACK_SIGNING_SECRET` are set in Vercel → Settings → Environment Variables.
3. Redeploy after changing env vars (they only apply to new deployments).
4. Use exactly `https://your-app.vercel.app/api/slack` (no trailing slash) in Slack Event Subscriptions.

| Issue | Check |
|-------|-------|
| URL verification fails | Use exactly `https://your-app.vercel.app/api/slack` (no trailing slash). Visit in browser first — should show "Slack endpoint OK". Redeploy after adding env vars. |
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
