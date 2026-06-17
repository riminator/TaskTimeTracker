#!/bin/bash
# Simple OpenShift Deployment - Uses OpenShift BuildConfig instead of local Docker push
# This avoids SSL certificate issues with the internal registry

set -e

echo "🚀 Simple OpenShift Deployment for Task Time Tracker"
echo ""

# Variables
PROJECT_NAME=${1:-timetracker}
APP_NAME="timetracker-web"

# Check if logged into OpenShift
if ! oc whoami &> /dev/null; then
    echo "❌ Not logged into OpenShift. Please run:"
    echo "   oc login --server=https://your-cluster-url:6443"
    exit 1
fi

echo "✅ Logged in as: $(oc whoami)"
echo "🌐 Cluster: $(oc whoami --show-server)"
echo ""

# Select or create project
echo "📦 Setting up project: $PROJECT_NAME"
if oc project $PROJECT_NAME &> /dev/null; then
    echo "   Using existing project: $PROJECT_NAME"
else
    echo "   Creating new project: $PROJECT_NAME"
    oc new-project $PROJECT_NAME
fi
echo ""

# Create persistent volume claims
echo "💾 Creating persistent storage..."
oc apply -f openshift/pvc.yaml 2>/dev/null || echo "   PVC already exists"

# Create config map
echo "⚙️  Creating configuration..."
oc apply -f openshift/configmap.yaml 2>/dev/null || echo "   ConfigMap already exists"

# Check if BuildConfig exists, if not create it
if ! oc get bc/$APP_NAME &> /dev/null; then
    echo "🔨 Creating BuildConfig for source-to-image build..."
    cat <<EOF | oc apply -f -
apiVersion: build.openshift.io/v1
kind: BuildConfig
metadata:
  name: $APP_NAME
  labels:
    app: $APP_NAME
spec:
  output:
    to:
      kind: ImageStreamTag
      name: $APP_NAME:latest
  source:
    type: Binary
    binary: {}
  strategy:
    type: Docker
    dockerStrategy:
      dockerfilePath: Dockerfile.web
  triggers: []
EOF
    echo "   ✅ BuildConfig created"
else
    echo "   BuildConfig already exists"
fi

# Check if ImageStream exists, if not create it
if ! oc get is/$APP_NAME &> /dev/null; then
    echo "📦 Creating ImageStream..."
    oc create imagestream $APP_NAME
    echo "   ✅ ImageStream created"
else
    echo "   ImageStream already exists"
fi

echo ""
echo "🔨 Starting build from local source..."
echo "   This will upload your code and build the image in OpenShift"
echo ""

# Start build from current directory
oc start-build $APP_NAME --from-dir=. --follow --wait

echo ""
echo "✅ Build complete!"
echo ""

# Deploy the application
echo "🚢 Deploying application..."

# Update deployment to use the built image
cat openshift/web-deployment.yaml | \
  sed "s|image: timetracker-web:latest|image: image-registry.openshift-image-registry.svc:5000/$PROJECT_NAME/$APP_NAME:latest|g" | \
  oc apply -f -

# Create service
echo "   Creating service..."
oc apply -f openshift/web-service.yaml

# Create route
echo "   Creating route..."
oc apply -f openshift/web-route.yaml

echo "   ✅ Application deployed"
echo ""

# Wait for deployment
echo "⏳ Waiting for deployment to complete..."
oc rollout status deployment/$APP_NAME --timeout=5m

# Get route
ROUTE=$(oc get route $APP_NAME -o jsonpath='{.spec.host}')

echo ""
echo "════════════════════════════════════════════════════════════"
echo "✅ Deployment Complete!"
echo "════════════════════════════════════════════════════════════"
echo ""
echo "🌐 Your application is available at:"
echo "   https://$ROUTE"
echo ""
echo "📊 Useful commands:"
echo "   oc get pods                        # Check pod status"
echo "   oc logs -f deployment/$APP_NAME    # View logs"
echo "   oc describe deployment $APP_NAME   # Deployment details"
echo ""
echo "🔄 To update the application:"
echo "   ./scripts/simple-deploy.sh $PROJECT_NAME"
echo ""
echo "🗑️  To delete the deployment:"
echo "   oc delete all,pvc,configmap -l app=$APP_NAME"
echo ""
echo "════════════════════════════════════════════════════════════"

# Made with Bob