# OpenShift Deployment Guide - Task Time Tracker

## 🎯 Goal
Deploy the Task Time Tracker web app to your OpenShift cluster and access it via a permanent HTTPS route.

---

## 📋 Prerequisites

1. **OpenShift CLI installed**
   ```bash
   oc version
   ```

2. **Logged into your OpenShift cluster**
   ```bash
   oc login --server=https://your-cluster-url:6443
   ```

3. **Create or select a project**
   ```bash
   # Create new project
   oc new-project timetracker
   
   # Or use existing project
   oc project your-project-name
   ```

---

## 🚀 Deployment Steps

### Step 1: Build the Docker Image

```bash
# Navigate to project directory
cd /Users/akshaymallireddy/TaskTimeTracker

# Build the Docker image
docker build -f Dockerfile.web -t timetracker-web:latest .
```

### Step 2: Tag and Push to OpenShift Registry

**Option A: Using OpenShift Internal Registry**

```bash
# Login to OpenShift registry
docker login -u $(oc whoami) -p $(oc whoami -t) default-route-openshift-image-registry.apps.your-cluster.com

# Tag image
docker tag timetracker-web:latest default-route-openshift-image-registry.apps.your-cluster.com/$(oc project -q)/timetracker-web:latest

# Push image
docker push default-route-openshift-image-registry.apps.your-cluster.com/$(oc project -q)/timetracker-web:latest
```

**Option B: Using External Registry (Docker Hub, Quay.io, etc.)**

```bash
# Tag for external registry
docker tag timetracker-web:latest your-registry.com/your-username/timetracker-web:latest

# Push to registry
docker push your-registry.com/your-username/timetracker-web:latest
```

### Step 3: Update Deployment YAML

Edit `openshift/web-deployment.yaml` and update the image reference:

```yaml
# Change this line:
image: timetracker-web:latest

# To your actual image location:
# For OpenShift internal registry:
image: image-registry.openshift-image-registry.svc:5000/YOUR_PROJECT/timetracker-web:latest

# Or for external registry:
image: your-registry.com/your-username/timetracker-web:latest
```

### Step 4: Deploy to OpenShift

```bash
# Create persistent volume claims
oc apply -f openshift/pvc.yaml

# Create config map
oc apply -f openshift/configmap.yaml

# Deploy the application
oc apply -f openshift/web-deployment.yaml

# Create service
oc apply -f openshift/web-service.yaml

# Create route (HTTPS endpoint)
oc apply -f openshift/web-route.yaml
```

### Step 5: Get Your Route URL

```bash
# Get the route URL
oc get route timetracker-web

# Example output:
# NAME              HOST/PORT                                          PATH   SERVICES          PORT   TERMINATION   WILDCARD
# timetracker-web   timetracker-web-yourproject.apps.cluster.com             timetracker-web   http   edge          None
```

### Step 6: Access Your Application

Open your browser to the route URL:
```
https://timetracker-web-yourproject.apps.cluster.com
```

---

## 🔍 Verify Deployment

```bash
# Check pod status
oc get pods

# View pod logs
oc logs -f deployment/timetracker-web

# Check service
oc get svc timetracker-web

# Check route
oc get route timetracker-web

# Describe deployment
oc describe deployment timetracker-web
```

---

## 🛠️ Quick Deploy Script

I've created a script to automate the entire process:

```bash
#!/bin/bash
# deploy-to-openshift.sh

set -e

echo "🚀 Deploying Task Time Tracker to OpenShift..."

# Variables
PROJECT_NAME=${1:-timetracker}
IMAGE_TAG=${2:-latest}

# Login check
if ! oc whoami &> /dev/null; then
    echo "❌ Not logged into OpenShift. Please run: oc login"
    exit 1
fi

# Select/create project
echo "📦 Setting up project: $PROJECT_NAME"
oc project $PROJECT_NAME 2>/dev/null || oc new-project $PROJECT_NAME

# Build image
echo "🔨 Building Docker image..."
docker build -f Dockerfile.web -t timetracker-web:$IMAGE_TAG .

# Get registry URL
REGISTRY=$(oc get route default-route -n openshift-image-registry -o jsonpath='{.spec.host}' 2>/dev/null)
if [ -z "$REGISTRY" ]; then
    echo "⚠️  Internal registry not exposed. Using image-registry service..."
    REGISTRY="image-registry.openshift-image-registry.svc:5000"
fi

# Tag and push
echo "📤 Pushing image to OpenShift registry..."
IMAGE_URL="$REGISTRY/$PROJECT_NAME/timetracker-web:$IMAGE_TAG"

if [[ $REGISTRY == *"apps"* ]]; then
    # External route - need to login
    docker login -u $(oc whoami) -p $(oc whoami -t) $REGISTRY
    docker tag timetracker-web:$IMAGE_TAG $IMAGE_URL
    docker push $IMAGE_URL
else
    # Internal service - update deployment to use internal reference
    IMAGE_URL="image-registry.openshift-image-registry.svc:5000/$PROJECT_NAME/timetracker-web:$IMAGE_TAG"
fi

# Update deployment YAML with correct image
echo "📝 Updating deployment configuration..."
sed "s|image: timetracker-web:latest|image: $IMAGE_URL|g" openshift/web-deployment.yaml > /tmp/web-deployment.yaml

# Deploy
echo "🚢 Deploying to OpenShift..."
oc apply -f openshift/pvc.yaml
oc apply -f openshift/configmap.yaml
oc apply -f /tmp/web-deployment.yaml
oc apply -f openshift/web-service.yaml
oc apply -f openshift/web-route.yaml

# Wait for deployment
echo "⏳ Waiting for deployment to complete..."
oc rollout status deployment/timetracker-web

# Get route
ROUTE=$(oc get route timetracker-web -o jsonpath='{.spec.host}')

echo ""
echo "✅ Deployment complete!"
echo ""
echo "🌐 Your application is available at:"
echo "   https://$ROUTE"
echo ""
echo "📊 Check status:"
echo "   oc get pods"
echo "   oc logs -f deployment/timetracker-web"
echo ""
```

Save this as `deploy-to-openshift.sh` and run:

```bash
chmod +x deploy-to-openshift.sh
./deploy-to-openshift.sh
```

---

## 🔄 Update Deployment

When you make changes to the code:

```bash
# 1. Rebuild image
docker build -f Dockerfile.web -t timetracker-web:v2 .

# 2. Push new version
docker tag timetracker-web:v2 your-registry/timetracker-web:v2
docker push your-registry/timetracker-web:v2

# 3. Update deployment
oc set image deployment/timetracker-web web=your-registry/timetracker-web:v2

# 4. Watch rollout
oc rollout status deployment/timetracker-web
```

Or use the script:
```bash
./deploy-to-openshift.sh timetracker v2
```

---

## 📊 Monitoring

```bash
# View logs
oc logs -f deployment/timetracker-web

# Check resource usage
oc adm top pods

# View events
oc get events --sort-by='.lastTimestamp'

# Access pod shell
oc rsh deployment/timetracker-web

# Port forward for debugging
oc port-forward deployment/timetracker-web 3000:3000
# Then access at http://localhost:3000
```

---

## 🔐 Security Considerations

### 1. Add Authentication (Optional)

If you want to add basic auth to your route:

```bash
# Create htpasswd file
htpasswd -c auth myuser

# Create secret
oc create secret generic timetracker-auth --from-file=auth

# Update route to use auth
oc annotate route timetracker-web \
  haproxy.router.openshift.io/auth-type=basic \
  haproxy.router.openshift.io/auth-secret=timetracker-auth
```

### 2. Network Policies

Create a network policy to restrict access:

```yaml
# network-policy.yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: timetracker-web-policy
spec:
  podSelector:
    matchLabels:
      app: timetracker-web
  policyTypes:
  - Ingress
  ingress:
  - from:
    - namespaceSelector:
        matchLabels:
          name: openshift-ingress
    ports:
    - protocol: TCP
      port: 3000
```

Apply:
```bash
oc apply -f network-policy.yaml
```

---

## 🗄️ Data Persistence

Your time entries are stored in a persistent volume:

```bash
# Check PVC status
oc get pvc

# View PVC details
oc describe pvc timetracker-data-pvc

# Backup data
oc rsync deployment/timetracker-web:/app/data ./backup/

# Restore data
oc rsync ./backup/ deployment/timetracker-web:/app/data
```

---

## 🐛 Troubleshooting

### Pod not starting

```bash
# Check pod status
oc get pods

# View pod events
oc describe pod <pod-name>

# Check logs
oc logs <pod-name>

# Check image pull
oc get events | grep -i pull
```

### Route not accessible

```bash
# Check route
oc get route timetracker-web

# Test from inside cluster
oc run test --image=curlimages/curl -it --rm -- curl http://timetracker-web:3000/health

# Check service endpoints
oc get endpoints timetracker-web
```

### Storage issues

```bash
# Check PVC binding
oc get pvc

# Check storage class
oc get sc

# View PV details
oc get pv
```

---

## 🔄 Scaling

```bash
# Scale to 3 replicas
oc scale deployment/timetracker-web --replicas=3

# Auto-scale based on CPU
oc autoscale deployment/timetracker-web --min=2 --max=5 --cpu-percent=80

# Check HPA status
oc get hpa
```

---

## 🗑️ Cleanup

To remove the deployment:

```bash
# Delete all resources
oc delete -f openshift/web-route.yaml
oc delete -f openshift/web-service.yaml
oc delete -f openshift/web-deployment.yaml
oc delete -f openshift/configmap.yaml
oc delete -f openshift/pvc.yaml

# Or delete entire project
oc delete project timetracker
```

---

## 📝 Summary

**Your deployment will provide:**
- ✅ Permanent HTTPS URL (e.g., `https://timetracker-web-yourproject.apps.cluster.com`)
- ✅ Auto-restart on failure
- ✅ Persistent data storage
- ✅ Scalable (can run multiple replicas)
- ✅ Accessible from anywhere
- ✅ No need to keep your Mac running

**Access your app at the route URL and start tracking time!** 🎉