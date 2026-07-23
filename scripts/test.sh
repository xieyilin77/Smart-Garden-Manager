#!/bin/bash
# ============================================
# TEST SCRIPT für Smart Garden Manager
# ============================================

echo "🧪 Smart Garden Manager - Tests"
echo "================================"
echo ""

# ============================================
# 1. STACK STATUS PRÜFEN
# ============================================
echo "📊 Stack Status:"
aws cloudformation describe-stacks \
    --stack-name smart-garden \
    --query "Stacks[0].StackStatus" \
    --output text

echo ""

# ============================================
# 2. LAMBDA FUNKTIONEN TESTEN
# ============================================
echo "🧪 Teste Lambda Functions..."

# Test-Event für Data Processor
cat > test-event.json << EOF
{
    "sensor_id": "test-sensor",
    "temperature": 25.5,
    "humidity": 60.0,
    "soil_moisture": 35.0
}
EOF

# Process Data Lambda testen
echo "📤 Teste ProcessDataFunction..."
aws lambda invoke \
    --function-name smart-garden-process-data \
    --payload file://test-event.json \
    --cli-binary-format raw-in-base64-out \
    response.json

cat response.json
echo ""

# Query Lambda testen
echo "📥 Teste QueryDataFunction..."
aws lambda invoke \
    --function-name smart-garden-query-data \
    --payload '{"queryStringParameters": {"sensor_id": "sensor-001", "hours": "24"}}' \
    --cli-binary-format raw-in-base64-out \
    response.json

cat response.json
echo ""

rm test-event.json response.json

# ============================================
# 3. API GATEWAY TESTEN
# ============================================
echo ""
echo "🧪 Teste API Gateway..."

API_URL=$(aws cloudformation describe-stacks \
    --stack-name smart-garden \
    --query "Stacks[0].Outputs[?OutputKey=='APIGatewayURL'].OutputValue" \
    --output text)

echo "📡 API URL: $API_URL"
echo ""

# API Test
echo "📤 Sende GET Request..."
curl -s "$API_URL?sensor_id=sensor-001&hours=24" | jq '.' || echo "❌ API nicht erreichbar"

# ============================================
# 4. DYNAMODB PRÜFEN
# ============================================
echo ""
echo "🧪 Prüfe DynamoDB Tabellen..."

echo "📊 SensorLatestTable:"
aws dynamodb scan \
    --table-name smart-garden-sensor-latest \
    --limit 1 \
    --output table

echo ""
echo "📊 SensorDataTable:"
aws dynamodb scan \
    --table-name smart-garden-sensor-data \
    --limit 1 \
    --output table

# ============================================
# 5. S3 PRÜFEN
# ============================================
echo ""
echo "🧪 Prüfe S3 Buckets..."

ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
echo "📦 Data Bucket:"
aws s3 ls "s3://smart-garden-data-${ACCOUNT_ID}/" --recursive | head -5

echo ""
echo "📦 Website Bucket:"
aws s3 ls "s3://smart-garden-dashboard-${ACCOUNT_ID}/"

# ============================================
# 6. CLOUDWATCH LOGS
# ============================================
echo ""
echo "🧪 Prüfe CloudWatch Logs..."

echo "📋 Letzte Lambda Logs:"
aws logs describe-log-streams \
    --log-group-name "/aws/lambda/smart-garden-process-data" \
    --order-by LastEventTime \
    --descending \
    --limit 1 \
    --output table

echo ""
echo "✅ Tests abgeschlossen!"