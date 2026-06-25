#!/bin/bash
# Task Time Tracker - OpenShift Deployment Script
# Automates the entire deployment process to OpenShift

set -e

echo "🚀 Deploying Task Time Tracker to OpenShift..."
echo ""

# Variables
PROJECT_NAME=${1:-timetracker}
IMAGE_TAG=${2:-latest}

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

# Build Docker image
echo "🔨 Building Docker image..."
docker build -f Dockerfile.web -t timetracker-web:$IMAGE_TAG .
echo "   ✅ Image built successfully"
echo ""

# Determine registry approach
echo "📤 Preparing to push image..."

# Try to get external registry route
REGISTRY_ROUTE=$(oc get route default-route -n openshift-image-registry -o jsonpath='{.spec.host}' 2>/dev/null || echo "")

if [ -n "$REGISTRY_ROUTE" ]; then
    # External registry route exists
    echo "   Using external registry: $REGISTRY_ROUTE"
    REGISTRY=$REGISTRY_ROUTE
    IMAGE_URL="$REGISTRY/$PROJECT_NAME/timetracker-web:$IMAGE_TAG"
    
    # Login to registry
    echo "   Logging into registry..."
    docker login -u $(oc whoami) -p $(oc whoami -t) $REGISTRY
    
    # Tag and push
    docker tag timetracker-web:$IMAGE_TAG $IMAGE_URL
    echo "   Pushing image..."
    docker push $IMAGE_URL
    
    DEPLOYMENT_IMAGE=$IMAGE_URL
else
    # Use internal registry
    echo "   Using internal registry (image-registry.openshift-image-registry.svc:5000)"
    echo "   Note: Image must be pushed via 'oc import-image' or build in cluster"
    
    # Create image stream
    echo "   Creating image stream..."
    oc create imagestream timetracker-web 2>/dev/null || echo "   Image stream already exists"
    
    # Import local image
    echo "   Importing local image to OpenShift..."
    # Save image to tar
    docker save timetracker-web:$IMAGE_TAG > /tmp/timetracker-web.tar
    
    # Create a temporary pod to load the image
    cat <<EOF | oc apply -f -
apiVersion: v1
kind: Pod
metadata:
  name: image-loader
spec:
  containers:
  - name: loader
    image: quay.io/podman/stable
    command: ["sleep", "3600"]
    securityContext:
      privileged: true
  restartPolicy: Never
EOF
    
    # Wait for pod
    echo "   Waiting for loader pod..."
    oc wait --for=condition=Ready pod/image-loader --timeout=60s
    
    # Copy tar to pod and load
    echo "   Loading image into cluster..."
    oc cp /tmp/timetracker-web.tar image-loader:/tmp/
    oc exec image-loader -- podman load -i /tmp/timetracker-web.tar
    oc exec image-loader -- podman tag timetracker-web:$IMAGE_TAG image-registry.openshift-image-registry.svc:5000/$PROJECT_NAME/timetracker-web:$IMAGE_TAG
    oc exec image-loader -- podman push image-registry.openshift-image-registry.svc:5000/$PROJECT_NAME/timetracker-web:$IMAGE_TAG
    
    # Cleanup
    oc delete pod image-loader
    rm /tmp/timetracker-web.tar
    
    DEPLOYMENT_IMAGE="image-registry.openshift-image-registry.svc:5000/$PROJECT_NAME/timetracker-web:$IMAGE_TAG"
fi

echo "   ✅ Image ready: $DEPLOYMENT_IMAGE"
echo ""

# Update deployment YAML with correct image
echo "📝 Updating deployment configuration..."
sed "s|image: timetracker-web:latest|image: $DEPLOYMENT_IMAGE|g" openshift/web-deployment.yaml > /tmp/web-deployment.yaml
echo "   ✅ Configuration updated"
echo ""

# Deploy resources
echo "🚢 Deploying to OpenShift..."

echo "   Creating persistent volume claims..."
oc apply -f openshift/pvc.yaml

echo "   Creating config map..."
oc apply -f openshift/configmap.yaml

echo "   Deploying application..."
oc apply -f /tmp/web-deployment.yaml

echo "   Creating service..."
oc apply -f openshift/web-service.yaml

echo "   Creating route..."
oc apply -f openshift/web-route.yaml

echo "   ✅ Resources deployed"
echo ""

# Wait for deployment
echo "⏳ Waiting for deployment to complete..."
oc rollout status deployment/timetracker-web --timeout=5m

# Get route
ROUTE=$(oc get route timetracker-web -o jsonpath='{.spec.host}')

echo ""
echo "════════════════════════════════════════════════════════════"
echo "✅ Deployment Complete!"
echo "════════════════════════════════════════════════════════════"
echo ""
echo "🌐 Your application is available at:"
echo "   https://$ROUTE"
echo ""
echo "📊 Useful commands:"
echo "   oc get pods                          # Check pod status"
echo "   oc logs -f deployment/timetracker-web # View logs"
echo "   oc describe deployment timetracker-web # Deployment details"
echo "   oc get route timetracker-web         # Get route info"
echo ""
echo "🔄 To update the deployment:"
echo "   ./deploy-to-openshift.sh $PROJECT_NAME v2"
echo ""
echo "🗑️  To delete the deployment:"
echo "   oc delete all -l app=timetracker-web"
echo "   oc delete pvc -l app=timetracker-web"
echo ""
echo "════════════════════════════════════════════════════════════"

# Made with Bob
