# Deploying the Slack Certification App to AWS

This guide covers hosting the app on AWS with DynamoDB for persistent storage.

## Architecture

- **Compute**: EC2 or Lightsail (long-running Node.js process; Slack Socket Mode needs a persistent WebSocket)
- **Database**: DynamoDB (serverless, no DB server to manage)
- **Secrets**: Store Slack tokens in environment variables or AWS Secrets Manager

## Prerequisites

- AWS account
- AWS CLI installed and configured (`aws configure`)
- Slack app tokens (Bot Token + App Token for Socket Mode)

---

## Step 1: Create DynamoDB Tables

```bash
chmod +x scripts/create-dynamodb-tables.sh
./scripts/create-dynamodb-tables.sh
```

Or create manually in the AWS Console:

1. **cert-sessions**
   - Partition key: `session_id` (String)
   - Billing: On-demand (pay per request)

2. **cert-reviews**
   - Partition key: `session_id` (String)
   - Sort key: `reviewer_id` (String)
   - Billing: On-demand

---

## Step 2: Create an IAM User/Role for the App

Create an IAM user or role with a policy like:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "dynamodb:GetItem",
        "dynamodb:PutItem",
        "dynamodb:UpdateItem",
        "dynamodb:Query"
      ],
      "Resource": [
        "arn:aws:dynamodb:us-east-1:YOUR_ACCOUNT_ID:table/cert-sessions",
        "arn:aws:dynamodb:us-east-1:YOUR_ACCOUNT_ID:table/cert-reviews"
      ]
    }
  ]
}
```

Replace `YOUR_ACCOUNT_ID` and `us-east-1` with your values.

---

## Step 3: Launch an EC2 or Lightsail Instance

### Option A: Lightsail (simpler, ~$5/month)

1. Go to [AWS Lightsail](https://lightsail.aws.amazon.com)
2. Create instance → Ubuntu 22.04
3. Choose a plan (e.g. $5/month)
4. Add SSH key and launch

### Option B: EC2

1. Launch Ubuntu 22.04 AMI
2. Use t3.micro (free tier) or t3.small
3. Security group: no inbound ports needed (Socket Mode uses outbound only)
4. Attach IAM role with DynamoDB access
5. (Optional) Use Elastic IP for a fixed address

---

## Step 4: Install Node.js and Deploy the App

SSH into your instance:

```bash
# Install Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Clone your repo
git clone https://github.com/eitan-oss/cert.git
cd cert

# Install dependencies
npm install

# Create .env (use your actual tokens)
cat > .env << 'EOF'
SLACK_BOT_TOKEN=xoxb-your-bot-token
SLACK_APP_TOKEN=xapp-your-app-token
USE_DYNAMODB=1
AWS_REGION=us-east-1
EOF

# For EC2 with IAM role: no credentials needed
# For Lightsail: create IAM user, run `aws configure` with access keys
```

---

## Step 5: Run as a Service (stays running after reboot)

Using systemd:

```bash
sudo nano /etc/systemd/system/slack-cert.service
```

```ini
[Unit]
Description=Slack Certification App
After=network.target

[Service]
Type=simple
User=ubuntu
WorkingDirectory=/home/ubuntu/cert
EnvironmentFile=/home/ubuntu/cert/.env
ExecStart=/usr/bin/node index.js
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable slack-cert
sudo systemctl start slack-cert
sudo systemctl status slack-cert
```

---

## Environment Variables Summary

| Variable         | Required | Description                                      |
|------------------|----------|--------------------------------------------------|
| SLACK_BOT_TOKEN  | Yes      | Bot token (xoxb-...)                            |
| SLACK_APP_TOKEN  | Yes      | App-level token for Socket Mode (xapp-...)      |
| USE_DYNAMODB     | Yes (prod) | Set to `1` to use DynamoDB                    |
| AWS_REGION       | No       | Default: us-east-1                             |
| SESSIONS_TABLE   | No       | Default: cert-sessions                          |
| REVIEWS_TABLE    | No       | Default: cert-reviews                           |

---

## Local Development (no DynamoDB)

Run locally without AWS:

```bash
# .env - no USE_DYNAMODB
SLACK_BOT_TOKEN=xoxb-...
SLACK_APP_TOKEN=xapp-...

npm start
```

Data is stored in memory and lost when the process stops.

---

## Alternative: Elastic Beanstalk

For a managed deployment pipeline:

1. Add `Procfile`: `web: node index.js`
2. Create Elastic Beanstalk Node.js environment
3. Configure environment variables in the console
4. Attach IAM instance profile with DynamoDB access
5. Deploy via `eb deploy` or connect to GitHub

---

## Troubleshooting

- **"Missing credentials"**: Ensure EC2 has an IAM role, or run `aws configure` with access keys
- **"Cannot find module @aws-sdk/..."**: Run `npm install` in the project directory
- **Socket Mode issues**: Ensure your Slack app has Socket Mode enabled and the correct app token
