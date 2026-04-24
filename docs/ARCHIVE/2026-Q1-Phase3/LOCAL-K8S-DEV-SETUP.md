# Local Kubernetes Development Setup

**Date**: 2026-04-01  
**Platform**: Docker Desktop Kubernetes + Helm  
**Purpose**: Local development and testing before production deployment

---

## Prerequisites

### 1. Docker Desktop Installation

**Download**: https://www.docker.com/products/docker-desktop/

**Installation**:

```bash
# macOS
brew install --cask docker

# Windows (WSL2)
# Download installer from website

# Linux
# Follow Docker CE installation guide
```

**Configuration**:

1. Open Docker Desktop
2. Go to Settings → Kubernetes
3. ✅ Enable Kubernetes
4. Set resources:
   - CPUs: 4-6 cores
   - Memory: 8-12 GB
   - Disk: 50-100 GB
5. Click "Apply & Restart"

**Verify**:

```bash
kubectl version --client
kubectl cluster-info
kubectl get nodes
# Should show: docker-desktop Ready control-plane,master
```

### 2. Helm Installation

**macOS**:

```bash
brew install helm
```

**Windows**:

```bash
choco install kubernetes-helm
```

**Linux**:

```bash
curl https://raw.githubusercontent.com/helm/helm/main/scripts/get-helm-3 | bash
```

**Verify**:

```bash
helm version
# Should show: version.BuildInfo{Version:"v3.x.x", ...}
```

### 3. kubectl Configuration

```bash
# Check context
kubectl config current-context
# Should show: docker-desktop

# If not, switch to it
kubectl config use-context docker-desktop
```

---

## Helm Chart Structure

```
k8s/helm/agent-hub/
├── Chart.yaml                    # Chart metadata
├── values.yaml                   # Default values
├── values-dev.yaml              # Development overrides
├── values-staging.yaml          # Staging overrides
├── values-production.yaml       # Production overrides
├── templates/
│   ├── _helpers.tpl             # Template helpers
│   ├── namespace.yaml           # Namespace
│   ├── configmap.yaml           # ConfigMap
│   ├── secrets.yaml             # Secrets (template)
│   ├── backend-deployment.yaml  # Backend deployment
│   ├── backend-service.yaml     # Backend service
│   ├── frontend-deployment.yaml # Frontend deployment
│   ├── frontend-service.yaml    # Frontend service
│   ├── ingress.yaml             # Ingress
│   ├── pvc.yaml                 # PersistentVolumeClaim
│   ├── hpa.yaml                 # HorizontalPodAutoscaler
│   ├── networkpolicy.yaml       # NetworkPolicy
│   ├── servicemonitor.yaml      # Prometheus ServiceMonitor
│   └── prometheusrules.yaml     # Alerting rules
└── charts/                      # Subchart dependencies (empty)
```

---

## Quick Start

### 1. Clone and Navigate

```bash
cd /home/jlguo/agent-hub
```

### 2. Create Local Secrets

**File**: `k8s/helm/agent-hub/secrets.local.yaml`

```yaml
# DO NOT COMMIT THIS FILE
# Add to .gitignore

secrets:
  FEISHU_APP_ID: 'cli_xxx'
  FEISHU_APP_SECRET: 'xxx'
  FEISHU_CHAT_ID: 'oc_xxx'
  FEISHU_VERIFY_TOKEN: 'xxx'
  OPENCLAW_VERIFICATION_TOKEN: 'xxx'
  JWT_SECRET: 'local-dev-jwt-secret-min-32-characters-long'
  ENCRYPTION_KEY: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'
  API_KEY: 'local-api-key'
  SENTRY_DSN: '' # Optional for local dev
```

### 3. Install Helm Chart (Local Dev)

```bash
# Navigate to chart directory
cd k8s/helm/agent-hub

# Install with development values
helm install agent-hub-dev . \
  --namespace agent-hub-dev \
  --create-namespace \
  --values values-dev.yaml \
  --values secrets.local.yaml \
  --set image.backend.repository=agent-hub-backend \
  --set image.frontend.repository=agent-hub-frontend \
  --set image.tag=dev

# Check status
helm status agent-hub-dev -n agent-hub-dev

# View resources
kubectl get all -n agent-hub-dev
```

### 4. Build and Load Docker Images (Local)

```bash
# Build backend
docker build -t agent-hub-backend:dev -f Dockerfile .

# Build frontend
docker build -t agent-hub-frontend:dev -f client/Dockerfile client/

# Load images into Docker Desktop Kubernetes
# (Docker Desktop automatically sees Docker images)

# Update Helm release with local images
helm upgrade agent-hub-dev . \
  --namespace agent-hub-dev \
  --values values-dev.yaml \
  --values secrets.local.yaml \
  --set image.backend.repository=agent-hub-backend \
  --set image.frontend.repository=agent-hub-frontend \
  --set image.tag=dev
```

### 5. Access the Application

```bash
# Port forward backend
kubectl port-forward svc/backend -n agent-hub-dev 4000:4000

# In new terminal, port forward frontend
kubectl port-forward svc/frontend -n agent-hub-dev 3000:3000

# Access in browser
# Frontend: http://localhost:3000
# Backend API: http://localhost:4000
# Health check: http://localhost:4000/health
# Metrics: http://localhost:4000/metrics
```

### 6. Enable Ingress (Optional)

```bash
# Enable Ingress Controller in Docker Desktop
# Docker Desktop includes ingress-nginx by default

# Check ingress controller
kubectl get pods -n ingress-nginx

# Add to /etc/hosts (macOS/Linux)
echo "127.0.0.1 agent-hub.local" | sudo tee -a /etc/hosts
echo "127.0.0.1 api.agent-hub.local" | sudo tee -a /etc/hosts

# Access via:
# Frontend: http://agent-hub.local
# Backend API: http://api.agent-hub.local
```

---

## Development Workflow

### Hot Reload (Recommended)

Instead of rebuilding images for every change, use local volume mounts:

**File**: `values-dev.yaml`

```yaml
# Development-specific overrides
replicaCount: 1 # Single replica for dev

image:
  backend:
    pullPolicy: IfNotPresent
  frontend:
    pullPolicy: IfNotPresent

# Mount local source code as volumes
backend:
  volumeMounts:
    - name: source-code
      mountPath: /app/server
  extraArgs: ['npm', 'run', 'dev'] # Use tsx watch for hot reload

frontend:
  volumeMounts:
    - name: source-code
      mountPath: /app/client
  extraArgs: ['npm', 'run', 'dev'] # Next.js dev server

volumes:
  - name: source-code
    hostPath:
      path: /home/jlguo/agent-hub
      type: Directory
```

**Install with hot reload**:

```bash
helm upgrade agent-hub-dev . \
  --namespace agent-hub-dev \
  --values values-dev.yaml \
  --values secrets.local.yaml \
  --install
```

**Now**:

- Edit backend code → Auto-restarts (tsx watch)
- Edit frontend code → Auto-refreshes (Next.js Fast Refresh)
- No need to rebuild images!

### View Logs

```bash
# Backend logs
kubectl logs -n agent-hub-dev -l app=backend -f

# Frontend logs
kubectl logs -n agent-hub-dev -l app=frontend -f

# Specific pod
kubectl logs -n agent-hub-dev backend-xxxxx-xxxxx -f
```

### Execute Commands in Pods

```bash
# Backend shell
kubectl exec -n agent-hub-dev -l app=backend -- /bin/sh

# Frontend shell
kubectl exec -n agent-hub-dev -l app=frontend -- /bin/sh

# Run Prisma migration
kubectl exec -n agent-hub-dev -l app=backend -- npx prisma migrate deploy

# Check database
kubectl exec -n agent-hub-dev -l app=backend -- ls -lh /app/prisma
```

### Debugging

```bash
# Describe pod (see events, errors)
kubectl describe pod -n agent-hub-dev -l app=backend

# Get pod YAML
kubectl get pod -n agent-hub-dev -l app=backend -o yaml

# Check resource usage
kubectl top pods -n agent-hub-dev

# Debug network issues
kubectl exec -n agent-hub-dev -l app=backend -- curl http://frontend:3000
```

---

## Helm Commands Reference

### Install/Upgrade

```bash
# Install (first time)
helm install agent-hub-dev ./k8s/helm/agent-hub \
  --namespace agent-hub-dev \
  --create-namespace \
  --values k8s/helm/agent-hub/values-dev.yaml

# Upgrade (after changes)
helm upgrade agent-hub-dev ./k8s/helm/agent-hub \
  --namespace agent-hub-dev \
  --values k8s/helm/agent-hub/values-dev.yaml

# Install with hot reload
helm upgrade agent-hub-dev . \
  --namespace agent-hub-dev \
  --set-file values=values-dev.yaml \
  --install
```

### Status/Info

```bash
# List releases
helm list -n agent-hub-dev

# Show status
helm status agent-hub-dev -n agent-hub-dev

# Get values
helm get values agent-hub-dev -n agent-hub-dev

# Show manifest
helm get manifest agent-hub-dev -n agent-hub-dev
```

### Rollback

```bash
# List revision history
helm history agent-hub-dev -n agent-hub-dev

# Rollback to previous revision
helm rollback agent-hub-dev -n agent-hub-dev

# Rollback to specific revision
helm rollback agent-hub-dev 2 -n agent-hub-dev
```

### Uninstall

```bash
# Uninstall release
helm uninstall agent-hub-dev -n agent-hub-dev

# Uninstall and cleanup namespace
helm uninstall agent-hub-dev -n agent-hub-dev
kubectl delete namespace agent-hub-dev
```

### Template/Debug

```bash
# Render templates locally (no install)
helm template agent-hub-dev ./k8s/helm/agent-hub \
  --values k8s/helm/agent-hub/values-dev.yaml

# Debug install (dry-run)
helm install agent-hub-dev ./k8s/helm/agent-hub \
  --namespace agent-hub-dev \
  --values k8s/helm/agent-hub/values-dev.yaml \
  --dry-run --debug

# Lint chart
helm lint ./k8s/helm/agent-hub
```

---

## Monitoring Stack (Local)

### Install Prometheus Stack

```bash
# Add Prometheus community Helm repo
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm repo update

# Install kube-prometheus-stack (lightweight for local dev)
helm install monitoring prometheus-community/kube-prometheus-stack \
  --namespace monitoring \
  --create-namespace \
  --set prometheus.serviceMonitorSelectorNilUsesHelmValues=false \
  --set grafana.adminPassword=admin123 \
  --set alertmanager.enabled=false  # Disable for local dev
```

### Access Grafana

```bash
# Port forward Grafana
kubectl port-forward svc/monitoring-grafana -n monitoring 3001:80

# Access: http://localhost:3001
# Username: admin
# Password: admin123
```

### Access Prometheus

```bash
# Port forward Prometheus
kubectl port-forward svc/monitoring-kube-prometheus-prometheus -n monitoring 9090:9090

# Access: http://localhost:9090
```

### Import Dashboards

1. Open Grafana (http://localhost:3001)
2. Go to Dashboards → Import
3. Import dashboard IDs:
   - `10693` (Node Exporter Full)
   - `315` (Prometheus Stats)
   - Agent Hub custom dashboard (see `k8s/monitoring/grafana-dashboard.json`)

---

## Database Management

### Backup Local Database

```bash
# Copy database from pod
kubectl cp agent-hub-dev/backend-xxxxx-xxxxx:/app/prisma/prod.db ./backups/prod.db.$(date +%Y%m%d_%H%M%S)

# Or use kubectl exec
kubectl exec -n agent-hub-dev -l app=backend -- tar czf - /app/prisma/prod.db > ./backups/prod.db.$(date +%Y%m%d_%H%M%S).tar.gz
```

### Restore Database

```bash
# Copy database to pod
kubectl cp ./backups/prod.db.20260401_120000 agent-hub-dev/backend-xxxxx-xxxxx:/app/prisma/prod.db

# Restart pod to pick up changes
kubectl rollout restart deployment/backend -n agent-hub-dev
```

### Reset Database (Dev Only)

```bash
# Delete PVC (WARNING: Deletes all data!)
kubectl delete pvc -n agent-hub-dev agent-hub-db-pvc

# Delete pod (will recreate PVC)
kubectl delete pod -n agent-hub-dev -l app=backend

# Run migrations
kubectl exec -n agent-hub-dev -l app=backend -- npx prisma migrate deploy
```

---

## Troubleshooting

### Pod Not Starting

```bash
# Check pod status
kubectl get pods -n agent-hub-dev

# Describe pod (see events)
kubectl describe pod -n agent-hub-dev -l app=backend

# Check logs
kubectl logs -n agent-hub-dev -l app=backend --previous
```

### ImagePullBackOff

```bash
# For local dev, ensure images are built
docker images | grep agent-hub

# If using local images, set pullPolicy to IfNotPresent or Never
helm upgrade agent-hub-dev . \
  --namespace agent-hub-dev \
  --set image.backend.pullPolicy=IfNotPresent \
  --set image.frontend.pullPolicy=IfNotPresent
```

### CrashLoopBackOff

```bash
# Check logs
kubectl logs -n agent-hub-dev -l app=backend -f

# Check environment variables
kubectl exec -n agent-hub-dev -l app=backend -- env | grep -i error

# Verify secrets exist
kubectl get secrets -n agent-hub-dev
```

### Service Not Accessible

```bash
# Check service exists
kubectl get svc -n agent-hub-dev

# Check endpoints
kubectl get endpoints -n agent-hub-dev

# Test connectivity
kubectl exec -n agent-hub-dev -l app=frontend -- curl http://backend:4000/health
```

### Ingress Not Working

```bash
# Check ingress controller
kubectl get pods -n ingress-nginx

# Check ingress resource
kubectl get ingress -n agent-hub-dev

# Describe ingress
kubectl describe ingress agent-hub-ingress -n agent-hub-dev

# Check /etc/hosts
cat /etc/hosts | grep agent-hub
```

---

## Performance Tuning (Local)

### Increase Docker Desktop Resources

1. Open Docker Desktop
2. Settings → Resources
3. Increase:
   - CPUs: 6 cores
   - Memory: 12 GB
   - Disk: 100 GB

### Limit Resource Usage

**File**: `values-dev.yaml`

```yaml
backend:
  resources:
    requests:
      cpu: '50m'
      memory: '128Mi'
    limits:
      cpu: '200m'
      memory: '256Mi'

frontend:
  resources:
    requests:
      cpu: '25m'
      memory: '64Mi'
    limits:
      cpu: '100m'
      memory: '128Mi'
```

### Use Lightweight Images

```dockerfile
# Use Alpine base images
FROM node:18-alpine AS production
```

---

## Cleanup

### Uninstall Everything

```bash
# Uninstall Agent Hub
helm uninstall agent-hub-dev -n agent-hub-dev

# Uninstall monitoring
helm uninstall monitoring -n monitoring

# Delete namespaces
kubectl delete namespace agent-hub-dev
kubectl delete namespace monitoring

# Remove PVCs
kubectl delete pvc -n agent-hub-dev --all

# Clean up Docker images
docker rmi agent-hub-backend:dev
docker rmi agent-hub-frontend:dev
```

### Reset Docker Desktop Kubernetes

```bash
# In Docker Desktop
# Settings → Kubernetes → Reset Kubernetes cluster
```

---

## Next Steps

1. ✅ **Set up Docker Desktop Kubernetes** (15 minutes)
2. ✅ **Install Helm** (5 minutes)
3. ✅ **Create Helm chart** (see `k8s/helm/agent-hub/`)
4. ✅ **Install locally** (10 minutes)
5. ✅ **Test hot reload** (edit code, see changes)
6. ✅ **Add monitoring** (Prometheus + Grafana)
7. ✅ **Develop features** (P1: typing indicators, etc.)
8. ⏳ **Deploy to production** (when ready, use production values)

---

## Tips

### 1. Use Aliases

```bash
# Add to ~/.zshrc or ~/.bashrc
alias k=kubectl
alias kgp='kubectl get pods'
alias kgs='kubectl get svc'
alias kgn='kubectl get namespaces'
alias kgl='kubectl get all'
alias kgp-dev='kubectl get pods -n agent-hub-dev'
alias logs-backend='kubectl logs -n agent-hub-dev -l app=backend -f'
alias logs-frontend='kubectl logs -n agent-hub-dev -l app=frontend -f'
```

### 2. Use k9s (Terminal UI)

```bash
# Install
brew install k9s  # macOS
# or
snap install k9s  # Linux

# Run
k9s -n agent-hub-dev
```

### 3. Use Lens (GUI)

```bash
# Download: https://k8slens.dev/
# Open Docker Desktop context
# Manage cluster visually
```

### 4. Speed Up Builds

```bash
# Use BuildKit
export DOCKER_BUILDKIT=1

# Use build cache
docker build --cache-from agent-hub-backend:dev -t agent-hub-backend:dev .
```

---

**Ready to start developing locally?** The Helm chart makes it easy to install, upgrade, and manage your local Kubernetes deployment. Once everything works locally, deploy to production with `values-production.yaml`!

Would you like me to:

- **A)** Create the complete Helm chart structure?
- **B)** Set up Docker Desktop Kubernetes (step-by-step together)?
- **C)** Create values files for dev/staging/production?
- **D)** Start implementing P1 features with hot reload?

What's your priority? 🚀
