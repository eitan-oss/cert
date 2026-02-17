#!/bin/bash
# Create DynamoDB tables for cert-sessions and cert-reviews
# Run: ./scripts/create-dynamodb-tables.sh
# Requires: AWS CLI configured (aws configure)

set -e
REGION="${AWS_REGION:-us-east-1}"

echo "Creating DynamoDB tables in region: $REGION"

# cert-sessions: session_id (PK)
aws dynamodb create-table \
  --table-name cert-sessions \
  --attribute-definitions AttributeName=session_id,AttributeType=S \
  --key-schema AttributeName=session_id,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST \
  --region "$REGION" \
  2>/dev/null && echo "✓ cert-sessions created" || echo "cert-sessions may already exist"

# cert-reviews: session_id (PK), reviewer_id (SK)
aws dynamodb create-table \
  --table-name cert-reviews \
  --attribute-definitions \
    AttributeName=session_id,AttributeType=S \
    AttributeName=reviewer_id,AttributeType=S \
  --key-schema \
    AttributeName=session_id,KeyType=HASH \
    AttributeName=reviewer_id,KeyType=RANGE \
  --billing-mode PAY_PER_REQUEST \
  --region "$REGION" \
  2>/dev/null && echo "✓ cert-reviews created" || echo "cert-reviews may already exist"

echo ""
echo "Done. Set these env vars when running the app:"
echo "  USE_DYNAMODB=1"
echo "  AWS_REGION=$REGION"
echo "  (AWS credentials via IAM role or ~/.aws/credentials)"
