# Setup Guide — Slack Certification App

Step-by-step instructions for getting the app running locally and on AWS. Save this and come back anytime.

---

## Part 1: Local Development (no AWS needed)

1. Clone the repo: `git clone https://github.com/eitan-oss/cert.git && cd cert`
2. Install: `npm install`
3. Create `.env` with your Slack tokens:
   ```
   SLACK_BOT_TOKEN=xoxb-your-bot-token
   SLACK_APP_TOKEN=xapp-your-app-token
   ```
4. Run: `npm start`
5. Test in Slack with `/certify`

Data is stored in memory and resets when you stop the app.

---

## Part 2: AWS Account (first time)

1. Go to [aws.amazon.com](https://aws.amazon.com) → **Create an AWS Account**
2. Sign up with email and choose a password
3. Add payment info (required; free tier keeps costs low)
4. Verify identity (phone, etc.)
5. Choose **Free** support plan

**Free tier basics:**
- DynamoDB: free tier for small usage
- EC2: `t3.micro` ~750 hours/month for 12 months
- Lightsail: $5/month (simple, not free)

---

## Part 3: AWS Setup (DynamoDB + Server)

1. **Install AWS CLI**: [Install AWS CLI](https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html)
2. **Configure**: `aws configure` (enter Access Key, Secret Key, region like `us-east-1`)
3. **Create DynamoDB tables**:
   ```bash
   chmod +x scripts/create-dynamodb-tables.sh
   ./scripts/create-dynamodb-tables.sh
   ```
4. **Launch a server** (EC2 or Lightsail) — see `docs/AWS_DEPLOYMENT.md` for details

---

## Part 4: GitHub → AWS Auto-Deploy

When you push to GitHub, the app can automatically deploy to AWS.

**Flow:**
```
Code locally → git commit & push → GitHub → AWS pulls update & restarts
```

**Options:**
- **GitHub Actions**: Workflow runs on push, SSHs to your server and deploys
- **AWS CodePipeline**: Connects AWS to GitHub, deploys on push

See `docs/AWS_DEPLOYMENT.md` for GitHub Actions setup.

---

## Part 5: Local vs AWS

| Where | When |
|-------|------|
| **Local** | Develop, test, debug — run `npm start` |
| **AWS** | Production — runs 24/7, uses DynamoDB |

**Workflow:**
1. Develop and test locally
2. Commit and push to GitHub
3. GitHub Actions deploys to AWS
4. Test the live version

---

## Part 6: App Home (Certification Hub)

The **Home tab** is the main place for all certification actions. Open the app in the Slack sidebar → **Home** tab.

- **Reviewers:** See pending reviews (Submit) and submitted reviews (Edit).
- **Managers:** See certifications you launched, with progress (e.g. 2/3 submitted). Use **View details** to see who’s submitted, and **Share with rep** when all reviews are in.
- **AEs:** See your results (PASS/FAIL) after your manager shares.

DMs are lightweight “check Home” reminders. All real actions happen on the Home tab.

**Enable it in your Slack app:**
1. Go to [api.slack.com/apps](https://api.slack.com/apps) → your app
2. **App Home** → enable "Home Tab"
3. **Event Subscriptions** → under "Subscribe to bot events", add `app_home_opened` (if not already listed)
4. Reinstall the app to your workspace if prompted

---

## Quick Reference

| Task | Command / Action |
|------|------------------|
| Run locally | `npm start` |
| See pending reviews | Open app → Home tab |
| Create DynamoDB tables | `./scripts/create-dynamodb-tables.sh` |
| Deploy to AWS | Push to `main` (if GitHub Actions is set up) |
| Full deployment guide | `docs/AWS_DEPLOYMENT.md` |

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| SLACK_BOT_TOKEN | Yes | Bot token (xoxb-...) |
| SLACK_APP_TOKEN | Yes | App token for Socket Mode (xapp-...) |
| USE_DYNAMODB | For AWS | Set to `1` on production |
| AWS_REGION | For AWS | e.g. `us-east-1` |
