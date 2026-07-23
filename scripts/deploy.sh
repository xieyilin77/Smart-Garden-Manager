#!/bin/bash
# ============================================
# DEPLOYMENT SCRIPT für Smart Garden Manager
# ============================================

set -e  # Bei Fehlern abbrechen

echo "🌱 Smart Garden Manager - Deployment"
echo "====================================="
echo ""

# ============================================
# 1. ACCOUNT-ID ABRUFEN
# ============================================
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
REGION=$(aws configure get region)

echo "📋 Account-ID: $ACCOUNT_ID"
echo "📋 Region: $REGION"
echo ""

# ============================================
# 2. PARAMETER SETZEN
# ============================================
STACK_NAME="smart-garden"
ENVIRONMENT_NAME="smart-garden"
S3_DATA_BUCKET="smart-garden-data-${ACCOUNT_ID}"
S3_WEBSITE_BUCKET="smart-garden-dashboard-${ACCOUNT_ID}"
EMAIL="your-email@example.com"  # HIER ÄNDERN!

echo "📋 Stack Name: $STACK_NAME"
echo "📋 Data Bucket: $S3_DATA_BUCKET"
echo "📋 Website Bucket: $S3_WEBSITE_BUCKET"
echo "📋 Email: $EMAIL"
echo ""

# ============================================
# 3. PRÜFEN OB BUCKETS BEREITS EXISTIEREN
# ============================================
echo "🔍 Prüfe S3 Buckets..."

if aws s3 ls "s3://$S3_DATA_BUCKET" 2>/dev/null; then
    echo "⚠️  Data Bucket existiert bereits: $S3_DATA_BUCKET"
else
    echo "✅ Data Bucket wird erstellt..."
    aws s3 mb "s3://$S3_DATA_BUCKET" --region $REGION
fi

if aws s3 ls "s3://$S3_WEBSITE_BUCKET" 2>/dev/null; then
    echo "⚠️  Website Bucket existiert bereits: $S3_WEBSITE_BUCKET"
else
    echo "✅ Website Bucket wird erstellt..."
    aws s3 mb "s3://$S3_WEBSITE_BUCKET" --region $REGION
fi

echo ""

# ============================================
# 4. CLOUDFORMATION STACK DEPLOYEN
# ============================================
echo "🚀 Deploye CloudFormation Stack..."

aws cloudformation deploy \
    --stack-name $STACK_NAME \
    --template-file ../templates/smart-garden.yaml \
    --parameter-overrides \
        EnvironmentName=$ENVIRONMENT_NAME \
        S3DataBucketName=$S3_DATA_BUCKET \
        S3WebsiteBucketName=$S3_WEBSITE_BUCKET \
        EmailAddress=$EMAIL \
    --capabilities CAPABILITY_IAM \
    --region $REGION

echo ""
echo "✅ Stack Deployment abgeschlossen!"

# ============================================
# 5. OUTPUTS ABRUFEN
# ============================================
echo ""
echo "📊 Stack Outputs:"
aws cloudformation describe-stacks \
    --stack-name $STACK_NAME \
    --query "Stacks[0].Outputs[*].[OutputKey, OutputValue]" \
    --output table \
    --region $REGION

# ============================================
# 6. API GATEWAY URL ABRUFEN
# ============================================
API_URL=$(aws cloudformation describe-stacks \
    --stack-name $STACK_NAME \
    --query "Stacks[0].Outputs[?OutputKey=='APIGatewayURL'].OutputValue" \
    --output text \
    --region $REGION)

WEBSITE_URL=$(aws cloudformation describe-stacks \
    --stack-name $STACK_NAME \
    --query "Stacks[0].Outputs[?OutputKey=='WebsiteURL'].OutputValue" \
    --output text \
    --region $REGION)

echo ""
echo "🌐 API Gateway URL: $API_URL"
echo "🌐 Website URL: $WEBSITE_URL"
echo ""

# ============================================
# 7. DASHBOARD HOCHLADEN
# ============================================
echo "📤 Lade Dashboard hoch..."

cd ../src/dashboard

# API URL in dashboard.js ersetzen
sed -i "s|const API_URL = 'YOUR_API_GATEWAY_URL';|const API_URL = '$API_URL';|g" dashboard.js

# Dateien hochladen
aws s3 sync . "s3://$S3_WEBSITE_BUCKET/" \
    --exclude ".DS_Store" \
    --exclude "*.swp" \
    --region $REGION

cd ../..

echo "✅ Dashboard hochgeladen!"

# ============================================
# 8. CLOUDFRONT INVALIDIEREN
# ============================================
echo "🔄 CloudFront Cache invalidieren..."

DISTRIBUTION_ID=$(aws cloudfront list-distributions \
    --query "DistributionList.Items[?Origins.Items[0].DomainName=='${S3_WEBSITE_BUCKET}.s3.${REGION}.amazonaws.com'].Id" \
    --output text \
    --region $REGION)

if [ -n "$DISTRIBUTION_ID" ] && [ "$DISTRIBUTION_ID" != "None" ]; then
    aws cloudfront create-invalidation \
        --distribution-id $DISTRIBUTION_ID \
        --paths "/*" \
        --region $REGION
    echo "✅ CloudFront Invalidierung gestartet"
else
    echo "⚠️  Keine CloudFront Distribution gefunden"
fi

# ============================================
# 9. FERTIG
# ============================================
echo ""
echo "====================================="
echo "✅ DEPLOYMENT ABGESCHLOSSEN!"
echo "====================================="
echo ""
echo "📋 Nächste Schritte:"
echo "1. Öffnen Sie das Dashboard: $WEBSITE_URL"
echo "2. Starten Sie die Sensor-Simulation:"
echo "   cd src/simulator"
echo "   python sensor_simulator.py"
echo ""
echo "🔔 SNS-Benachrichtigungen werden an $EMAIL gesendet"
echo "====================================="