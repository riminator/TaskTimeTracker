# OpenShift Deployment Guide

This guide explains how to deploy the Teams Time Tracker MCP server to an OpenShift cluster.

## Prerequisites

- OpenShift cluster access
- `oc` CLI tool installed
- Docker or Podman for building images
- Access to an image registry (OpenShift internal registry or external like Docker Hub)

## Architecture in OpenShift

```
┌─────────────────────────────────────────┐
│         OpenShift Cluster               │
│                                         │
│  ┌───────────────────────────────────┐ │
│  │  Route (HTTPS)                    │ │
│  │  teams-timetracker.apps.cluster   │ │
│  └─────────────┬─────────────────────┘ │
│                │                         │
│  ┌─────────────▼─────────────────────┐ │
│  │  Service                          │ │
│  │  teams-timetracker:3000           │ │
│  └─────────────┬─────────────────────┘ │
│                │                         │
│  ┌─────────────▼─────────────────────┐ │
│  │  Deployment                       │ │
│  │  - Pod: teams-timetracker         │ │
│  │    - Container: timetracker       │ │
│  │    - Volumes:                     │ │
│  │      - data-pvc (1Gi)            │ │
│  │      - logs-pvc (500Mi)          │ │
│  │      - config (ConfigMap)        │ │
│  └───────────────────────────────────┘ │
│                                         │
│  ┌───────────────────────────────────┐ │
│  │  ConfigMaps                       │ │
│  │  - timetracker-config             │ │
│  │  - timetracker-rules              │ │
│  └───────────────────────────────────┘ │
│                                         │
│  ┌───────────────────────────────────┐ │
│  │  Secret                           │ │
│  │  - timetracker-secrets            │ │
│  │    (Azure AD credentials)         │ │
│  └───────────────────────────────────┘ │
└─────────────────────────────────────────┘
```

## Step 1: Build and Push Docker Image

### Option A: Using OpenShift Internal Registry

```bash
# Login to OpenShift
oc login https://your-cluster-url

# Create a new project
oc new-project teams-timetracker

# Get the internal registry URL
REGISTRY=$(oc get route default-route -n openshift-image-registry --template='{{ .spec.host }}')

# Login to the registry
docker login -u $(oc whoami) -p $(oc whoami -t) $REGISTRY

# Build the image
docker build -t teams-timetracker:latest .

# Tag for the registry
docker tag teams-timetracker:latest $REGISTRY/teams-timetracker/teams-timetracker:latest

# Push to registry
docker push $REGISTRY/teams-timetracker/teams-timetracker:latest
```

### Option B: Using External Registry (Docker Hub)

```bash
# Build the image
docker build -t your-dockerhub-username/teams-timetracker:latest .

# Push to Docker Hub
docker push your-dockerhub-username/teams-timetracker:latest

# Update deployment.yaml to use your image
# Change: image: teams-timetracker:latest
# To: image: your-dockerhub-username/teams-timetracker:latest
```

### Option C: Using OpenShift BuildConfig

```bash
# Create a BuildConfig from Dockerfile
oc new-build --name=teams-timetracker \
  --binary \
  --strategy=docker

# Start the build
oc start-build teams-timetracker --from-dir=. --follow

# The image will be available as:
# image-registry.openshift-image-registry.svc:5000/teams-timetracker/teams-timetracker:latest
```

## Step 2: Configure Secrets (Optional)

If using Azure AD integration:

```bash
# Create secret with your Azure AD credentials
oc create secret generic timetracker-secrets \
  --from-literal=tenant-id='your-tenant-id' \
  --from-literal=client-id='your-client-id' \
  --from-literal=client-secret='your-client-secret'
```

If NOT using Azure AD (manual/hybrid mode):

```bash
# Create empty secret (deployment expects it to exist)
oc apply -f openshift/secret.yaml
```

## Step 3: Configure Settings

Edit `openshift/configmap.yaml` to customize:

```yaml
data:
  default-user-email: "your-email@company.com"  # Change this
  default-project-code: "GENERAL"
  rounding-minutes: "15"
```

Then apply:

```bash
oc apply -f openshift/configmap.yaml
```

## Step 4: Create Persistent Storage

```bash
# Create PVCs for data and logs
oc apply -f openshift/pvc.yaml

# Verify PVCs are created
oc get pvc
```

Expected output:
```
NAME                    STATUS   VOLUME    CAPACITY   ACCESS MODES
timetracker-data-pvc    Bound    pv-xxx    1Gi        RWO
timetracker-logs-pvc    Bound    pv-yyy    500Mi      RWO
```

## Step 5: Deploy the Application

```bash
# Deploy all resources
oc apply -f openshift/deployment.yaml
oc apply -f openshift/service.yaml
oc apply -f openshift/route.yaml

# Check deployment status
oc get pods
oc get deployment
oc get service
oc get route
```

## Step 6: Verify Deployment

### Check Pod Status

```bash
# Get pod name
POD=$(oc get pods -l app=teams-timetracker -o jsonpath='{.items[0].metadata.name}')

# Check pod logs
oc logs $POD

# Expected output should include:
# "Teams Time Tracker MCP Server initialized"
# "Server is ready to accept requests"
```

### Check Pod Health

```bash
# Describe the pod
oc describe pod $POD

# Check events
oc get events --sort-by='.lastTimestamp'
```

### Access the Application

```bash
# Get the route URL
oc get route teams-timetracker -o jsonpath='{.spec.host}'

# The MCP server runs on stdio, so HTTP access is for health checks only
```

## Step 7: Configure MCP Client

Since the MCP server uses stdio transport, you'll need to access it via `oc exec`:

### Option A: Direct Execution

```bash
# Execute MCP server commands
oc exec -it $POD -- node src/server.js
```

### Option B: Port Forward (if adding HTTP API)

```bash
# Forward port to local machine
oc port-forward $POD 3000:3000

# Access at localhost:3000
```

## Scaling

### Scale Up/Down

```bash
# Scale to 2 replicas
oc scale deployment teams-timetracker --replicas=2

# Scale down to 0 (pause)
oc scale deployment teams-timetracker --replicas=0

# Scale back to 1
oc scale deployment teams-timetracker --replicas=1
```

**Note**: Since data is stored in PVC, scaling to multiple replicas requires ReadWriteMany (RWX) storage or a shared database.

## Resource Management

### View Resource Usage

```bash
# Check resource usage
oc adm top pods

# Check resource limits
oc describe deployment teams-timetracker
```

### Adjust Resources

Edit `openshift/deployment.yaml`:

```yaml
resources:
  requests:
    memory: "512Mi"  # Increase if needed
    cpu: "200m"
  limits:
    memory: "1Gi"
    cpu: "1000m"
```

Then apply:

```bash
oc apply -f openshift/deployment.yaml
```

## Monitoring and Logs

### View Logs

```bash
# Real-time logs
oc logs -f $POD

# Last 100 lines
oc logs --tail=100 $POD

# Logs from previous pod (if crashed)
oc logs --previous $POD
```

### Access Log Files

```bash
# Access the pod
oc exec -it $POD -- /bin/sh

# View log files
cd /app/logs
ls -la
cat combined.log
cat error.log
cat audit.log
```

### View Data Files

```bash
# Access the pod
oc exec -it $POD -- /bin/sh

# View time entries
cd /app/data
cat time-entries.json
```

## Backup and Restore

### Backup Data

```bash
# Copy data from pod to local
oc cp $POD:/app/data/time-entries.json ./backup-$(date +%Y%m%d).json

# Backup logs
oc cp $POD:/app/logs ./logs-backup-$(date +%Y%m%d)/
```

### Restore Data

```bash
# Copy data to pod
oc cp ./backup-20260616.json $POD:/app/data/time-entries.json

# Restart pod to reload
oc delete pod $POD
```

## Updating the Application

### Update Image

```bash
# Build new image
docker build -t teams-timetracker:v2 .
docker push $REGISTRY/teams-timetracker/teams-timetracker:v2

# Update deployment
oc set image deployment/teams-timetracker \
  timetracker=$REGISTRY/teams-timetracker/teams-timetracker:v2

# Check rollout status
oc rollout status deployment/teams-timetracker
```

### Update Configuration

```bash
# Edit ConfigMap
oc edit configmap timetracker-config

# Restart pods to pick up changes
oc rollout restart deployment/teams-timetracker
```

### Rollback

```bash
# View rollout history
oc rollout history deployment/teams-timetracker

# Rollback to previous version
oc rollout undo deployment/teams-timetracker

# Rollback to specific revision
oc rollout undo deployment/teams-timetracker --to-revision=2
```

## Troubleshooting

### Pod Won't Start

```bash
# Check pod status
oc describe pod $POD

# Common issues:
# 1. Image pull error - check image name and registry access
# 2. PVC not bound - check storage class and PV availability
# 3. ConfigMap missing - apply configmap.yaml
# 4. Secret missing - apply secret.yaml
```

### Out of Memory

```bash
# Check memory usage
oc adm top pod $POD

# Increase memory limits in deployment.yaml
# Then apply changes
```

### Storage Full

```bash
# Check PVC usage
oc exec -it $POD -- df -h

# Increase PVC size (if storage class supports it)
oc edit pvc timetracker-data-pvc
# Change: storage: 1Gi
# To: storage: 5Gi
```

### Can't Access Logs

```bash
# Check if logs directory is writable
oc exec -it $POD -- ls -la /app/logs

# Check pod user
oc exec -it $POD -- whoami

# Should be: nodejs (UID 1001)
```

## Security Best Practices

### 1. Use Secrets for Sensitive Data

```bash
# Never put credentials in ConfigMaps
# Always use Secrets
oc create secret generic timetracker-secrets \
  --from-literal=client-secret='your-secret'
```

### 2. Run as Non-Root

The Dockerfile already configures this:
```dockerfile
USER nodejs  # UID 1001
```

### 3. Limit Resource Usage

Set appropriate limits to prevent resource exhaustion:
```yaml
resources:
  limits:
    memory: "512Mi"
    cpu: "500m"
```

### 4. Use Network Policies

```bash
# Create network policy to restrict access
oc apply -f - <<EOF
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: timetracker-netpol
spec:
  podSelector:
    matchLabels:
      app: teams-timetracker
  policyTypes:
  - Ingress
  ingress:
  - from:
    - podSelector: {}
EOF
```

### 5. Regular Updates

```bash
# Keep base image updated
# Rebuild regularly with latest Node.js security patches
docker build --no-cache -t teams-timetracker:latest .
```

## Cost Optimization

### 1. Right-Size Resources

Start small and scale up if needed:
```yaml
resources:
  requests:
    memory: "128Mi"  # Start small
    cpu: "50m"
```

### 2. Use Appropriate Storage

```yaml
# Use standard storage class (cheaper)
storageClassName: standard

# Only use SSD if needed
# storageClassName: fast-ssd
```

### 3. Scale Down When Not in Use

```bash
# Scale to 0 during off-hours
oc scale deployment teams-timetracker --replicas=0

# Scale back up when needed
oc scale deployment teams-timetracker --replicas=1
```

## Production Checklist

- [ ] Image built and pushed to registry
- [ ] Secrets configured (if using Azure AD)
- [ ] ConfigMaps customized for your organization
- [ ] PVCs created and bound
- [ ] Deployment successful
- [ ] Pod running and healthy
- [ ] Logs accessible
- [ ] Data directory writable
- [ ] Backup strategy in place
- [ ] Monitoring configured
- [ ] Resource limits appropriate
- [ ] Security policies applied

## Next Steps

1. **Test the deployment**: Verify all tools work correctly
2. **Set up backups**: Schedule regular data backups
3. **Configure monitoring**: Set up alerts for pod failures
4. **Document access**: Create runbook for your team
5. **Plan updates**: Schedule regular image updates

## Support

For issues:
1. Check pod logs: `oc logs $POD`
2. Check events: `oc get events`
3. Review this guide's troubleshooting section
4. Check the main README.md for application-specific issues