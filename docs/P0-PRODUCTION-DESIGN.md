# P0 Production Readiness - Kubernetes Deployment Design

**Date**: 2026-04-01  
**Phase**: Phase 3 (Polish & Production)  
**Priority**: P0 (Critical)  
**Estimated Effort**: 24-32 hours total

---

## Executive Summary

This document consolidates **Monitoring & Alerting** + **Deployment Architecture** into a single Kubernetes-native design for Agent Hub production deployment.

**Key Decisions**:
- ✅ **Platform**: Kubernetes (K8s) for orchestration
- ✅ **Provider**: Cloud K8s (recommended) or self-hosted
- ✅ **Monitoring**: Prometheus + Grafana + Sentry (cloud-native stack)
- ✅ **Deployment**: GitOps with Helm charts
- ✅ **Database**: SQLite (single-node) or PostgreSQL (multi-node)
- ✅ **Ingress**: Nginx Ingress Controller with Let's Encrypt

---

## 1. Architecture Overview

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Users                                   │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐            │
│  │   Feishu    │  │   Web UI    │  │   Mobile    │            │
│  │   App       │  │   (Browser) │  │   (Future)  │            │
│  └─────────────┘  └─────────────┘  └─────────────┘            │
└─────────────────────────────────────────────────────────────────┘
         │                   │
         │ WebSocket         │ HTTPS
         │                   │
         └─────────┬─────────┘
                   │
         ┌─────────▼─────────┐
         │  Cloudflare CDN   │  ← DDoS protection, SSL termination
         └─────────┬─────────┘
                   │
         ┌─────────▼─────────┐
         │  Kubernetes Cluster│
         ├────────────────────┤
         │  Ingress Controller │
         │  (Nginx + SSL)      │
         └─────────┬─────────┘
                   │
    ┌──────────────┴──────────────┐
    │         Namespace:          │
    │       agent-hub-prod        │
    │                             │
    │  ┌────────────┐  ┌─────────┐│
    │  │  Frontend  │  │ Backend ││
    │  │ Deployment │  │Deployment││
    │  │ (Next.js)  │  │(Express)││
    │  │ Replicas:2 │  │Replicas:3││
    │  └─────┬──────┘  └────┬────┘│
    │        │              │     │
    │  ┌─────▼──────┐  ┌────▼─────┐│
    │  │  Service   │  │ Service  ││
    │  │  :3000     │  │  :4000   ││
    │  └────────────┘  └──────────┘│
    │                              │
    │  ┌──────────────────────────┐│
    │  │   Persistent Volume      ││
    │  │   (SQLite Database)      ││
    │  └──────────────────────────┘│
    │                              │
    │  ┌──────────────────────────┐│
    │  │   Monitoring Stack       ││
    │  │   - Prometheus           ││
    │  │   - Grafana              ││
    │  │   - Alertmanager         ││
    │  └──────────────────────────┘│
    └──────────────────────────────┘
```

### Kubernetes Resources

| Resource | Purpose | Replicas |
|----------|---------|----------|
| **Deployment/backend** | Express.js API server | 3 |
| **Deployment/frontend** | Next.js frontend | 2 |
| **Service/backend** | Internal load balancing | - |
| **Service/frontend** | Internal load balancing | - |
| **Ingress** | External HTTPS access | - |
| **ConfigMap** | Environment variables | - |
| **Secret** | Sensitive data (API keys) | - |
| **PersistentVolumeClaim** | Database storage | - |
| **HorizontalPodAutoscaler** | Auto-scaling | - |
| **NetworkPolicy** | Pod network security | - |

---

## 2. Kubernetes Cluster Options

### Option A: Managed Kubernetes (⭐ RECOMMENDED)

**Providers**:

| Provider | Service | Cost/Month | Regions |
|----------|---------|------------|---------|
| **DigitalOcean** | DOKS | $12 (control plane free) | Singapore, NYC, Amsterdam |
| **Google Cloud** | GKE | $0 (control plane free) | Asia Pacific (multiple) |
| **AWS** | EKS | $73 (control plane) | Asia Pacific (multiple) |
| **Azure** | AKS | $0 (control plane free) | Asia Pacific (multiple) |
| **Linode** | LKE | $0 (control plane free) | Tokyo, Singapore |

**Recommended**: **DigitalOcean DOKS** (Singapore region)
- Control plane: Free
- Worker nodes: $12/month (1 vCPU, 2GB RAM)
- Total: ~$24-36/month for 2-3 nodes
- Simple pricing, easy to use, good Asia-Pacific coverage

**Cluster Configuration** (Recommended):
```yaml
Control Plane: Managed (free)
Worker Nodes: 3x
  - Size: 2 vCPU, 4GB RAM
  - Cost: $12/node/month
  - Total: $36/month
Storage:
  - Block Storage: 100GB ($10/month)
  - Total Storage: $10/month
Load Balancer:
  - 1x Load Balancer: $12/month
Total: ~$58/month
```

**Pros**:
- ✅ Managed control plane (no maintenance)
- ✅ Auto-upgrades and patching
- ✅ Integrated with cloud provider services
- ✅ High availability (multi-node)
- ✅ Easy scaling

**Cons**:
- ❌ More expensive than self-hosted
- ❌ Vendor lock-in

---

### Option B: Self-Hosted Kubernetes (VPS-based)

**Tools**:
- **k3s** (Lightweight K8s, perfect for edge/small deployments)
- **kubeadm** (Standard K8s, more complex)
- **RKE2** (Enterprise-grade, security-focused)

**Recommended**: **k3s** (Rancher's lightweight K8s)

**Architecture**:
```
┌─────────────────────────────────────────────────────────┐
│              VPS 1 (Master + Worker)                    │
│  - k3s server                                           │
│  - 2 vCPU, 4GB RAM                                     │
│  - Singapore                                           │
│  - $12/month                                           │
└─────────────────────────────────────────────────────────┘
         │
┌─────────────────────────────────────────────────────────┐
│              VPS 2 (Worker)                             │
│  - k3s agent                                            │
│  - 2 vCPU, 4GB RAM                                     │
│  - Singapore                                           │
│  - $12/month                                           │
└─────────────────────────────────────────────────────────┘
```

**Cost**:
- 2x VPS (Vultr High Frequency): $24/month
- Storage: Included (80GB each)
- Total: **$24/month**

**Pros**:
- ✅ Full control
- ✅ Cost-effective
- ✅ No vendor lock-in
- ✅ Portable

**Cons**:
- ❌ You manage everything (upgrades, security, backups)
- ❌ More operational overhead
- ❌ Single point of failure (unless multi-master)

---

### Option C: Hybrid (Managed K8s + Self-Hosted Monitoring)

**Architecture**:
- **K8s Cluster**: Managed (DigitalOcean DOKS)
- **Monitoring**: Self-hosted Prometheus + Grafana (in-cluster)
- **Database**: Managed SQLite (volume) or PostgreSQL (managed service)

**Cost**: ~$40-50/month

**Best For**: Production with budget consciousness

---

## 3. Kubernetes Manifests

### Namespace

**File**: `k8s/namespace.yaml`

```yaml
apiVersion: v1
kind: Namespace
metadata:
  name: agent-hub-prod
  labels:
    name: agent-hub-prod
    environment: production
```

### ConfigMap

**File**: `k8s/configmap.yaml`

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: agent-hub-config
  namespace: agent-hub-prod
data:
  NODE_ENV: "production"
  PORT: "4000"
  FRONTEND_URL: "https://agent-hub.yourdomain.com"
  BACKEND_URL: "https://api.agent-hub.yourdomain.com"
  DATABASE_URL: "file:/app/prisma/prod.db"
  WS_HEARTBEAT_INTERVAL: "30000"
  WS_MAX_CONNECTIONS: "1000"
  RATE_LIMIT_WINDOW_MS: "60000"
  RATE_LIMIT_MAX_REQUESTS: "100"
  SENTRY_ENVIRONMENT: "production"
  LOG_LEVEL: "info"
```

### Secrets

**File**: `k8s/secrets.yaml`

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: agent-hub-secrets
  namespace: agent-hub-prod
type: Opaque
stringData:
  FEISHU_APP_ID: "cli_xxx"
  FEISHU_APP_SECRET: "xxx"
  FEISHU_CHAT_ID: "oc_xxx"
  FEISHU_VERIFY_TOKEN: "xxx"
  OPENCLAW_VERIFICATION_TOKEN: "xxx"
  JWT_SECRET: "your-super-secret-jwt-key-min-32-chars"
  ENCRYPTION_KEY: "your-32-byte-hex-encryption-key"
  API_KEY: "your-api-key-for-external-services"
  SENTRY_DSN: "https://xxx@sentry.io/xxx"
```

**⚠️ Security Note**: In production, use external secret management:
- **AWS**: Secrets Manager + External Secrets Operator
- **GCP**: Secret Manager + Workload Identity
- **Azure**: Key Vault + AKV Integration
- **HashiCorp**: Vault + Vault Injector

### Backend Deployment

**File**: `k8s/backend-deployment.yaml`

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: backend
  namespace: agent-hub-prod
  labels:
    app: backend
    component: api
spec:
  replicas: 3
  selector:
    matchLabels:
      app: backend
  template:
    metadata:
      labels:
        app: backend
        component: api
      annotations:
        prometheus.io/scrape: "true"
        prometheus.io/port: "4000"
        prometheus.io/path: "/metrics"
    spec:
      containers:
      - name: backend
        image: your-registry/agent-hub-backend:latest
        ports:
        - containerPort: 4000
          name: http
          protocol: TCP
        env:
        - name: NODE_ENV
          valueFrom:
            configMapKeyRef:
              name: agent-hub-config
              key: NODE_ENV
        - name: PORT
          valueFrom:
            configMapKeyRef:
              name: agent-hub-config
              key: PORT
        envFrom:
        - secretRef:
            name: agent-hub-secrets
        resources:
          requests:
            cpu: "100m"
            memory: "256Mi"
          limits:
            cpu: "500m"
            memory: "512Mi"
        livenessProbe:
          httpGet:
            path: /health
            port: 4000
          initialDelaySeconds: 30
          periodSeconds: 10
          timeoutSeconds: 5
          failureThreshold: 3
        readinessProbe:
          httpGet:
            path: /health
            port: 4000
          initialDelaySeconds: 10
          periodSeconds: 5
          timeoutSeconds: 3
          failureThreshold: 3
        volumeMounts:
        - name: prisma-storage
          mountPath: /app/prisma
        - name: logs-storage
          mountPath: /app/logs
      volumes:
      - name: prisma-storage
        persistentVolumeClaim:
          claimName: agent-hub-db-pvc
      - name: logs-storage
        emptyDir: {}
      affinity:
        podAntiAffinity:
          preferredDuringSchedulingIgnoredDuringExecution:
          - weight: 100
            podAffinityTerm:
              labelSelector:
                matchExpressions:
                - key: app
                  operator: In
                  values:
                  - backend
              topologyKey: kubernetes.io/hostname
```

### Frontend Deployment

**File**: `k8s/frontend-deployment.yaml`

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: frontend
  namespace: agent-hub-prod
  labels:
    app: frontend
    component: web
spec:
  replicas: 2
  selector:
    matchLabels:
      app: frontend
  template:
    metadata:
      labels:
        app: frontend
        component: web
    spec:
      containers:
      - name: frontend
        image: your-registry/agent-hub-frontend:latest
        ports:
        - containerPort: 3000
          name: http
          protocol: TCP
        env:
        - name: NODE_ENV
          valueFrom:
            configMapKeyRef:
              name: agent-hub-config
              key: NODE_ENV
        - name: NEXT_PUBLIC_API_URL
          valueFrom:
            configMapKeyRef:
              name: agent-hub-config
              key: BACKEND_URL
        - name: NEXT_PUBLIC_WS_URL
          value: "wss://agent-hub.yourdomain.com"
        resources:
          requests:
            cpu: "50m"
            memory: "128Mi"
          limits:
            cpu: "200m"
            memory: "256Mi"
        livenessProbe:
          httpGet:
            path: /
            port: 3000
          initialDelaySeconds: 20
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /
            port: 3000
          initialDelaySeconds: 10
          periodSeconds: 5
```

### Services

**File**: `k8s/services.yaml`

```yaml
apiVersion: v1
kind: Service
metadata:
  name: backend
  namespace: agent-hub-prod
  labels:
    app: backend
spec:
  type: ClusterIP
  ports:
  - port: 4000
    targetPort: 4000
    protocol: TCP
    name: http
  selector:
    app: backend
---
apiVersion: v1
kind: Service
metadata:
  name: frontend
  namespace: agent-hub-prod
  labels:
    app: frontend
spec:
  type: ClusterIP
  ports:
  - port: 3000
    targetPort: 3000
    protocol: TCP
    name: http
  selector:
    app: frontend
```

### Ingress

**File**: `k8s/ingress.yaml`

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: agent-hub-ingress
  namespace: agent-hub-prod
  annotations:
    kubernetes.io/ingress.class: nginx
    cert-manager.io/cluster-issuer: "letsencrypt-prod"
    nginx.ingress.kubernetes.io/ssl-redirect: "true"
    nginx.ingress.kubernetes.io/proxy-body-size: "10m"
    nginx.ingress.kubernetes.io/proxy-read-timeout: "120"
    nginx.ingress.kubernetes.io/proxy-send-timeout: "120"
    nginx.ingress.kubernetes.io/configuration-snippet: |
      # WebSocket support for Socket.io
      proxy_set_header Upgrade $http_upgrade;
      proxy_set_header Connection "upgrade";
      proxy_set_header Host $host;
      proxy_set_header X-Real-IP $remote_addr;
      proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
spec:
  tls:
  - hosts:
    - agent-hub.yourdomain.com
    - api.agent-hub.yourdomain.com
    secretName: agent-hub-tls
  rules:
  - host: agent-hub.yourdomain.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: frontend
            port:
              number: 3000
      - path: /socket.io/
        pathType: Prefix
        backend:
          service:
            name: backend
            port:
              number: 4000
  - host: api.agent-hub.yourdomain.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: backend
            port:
              number: 4000
```

### PersistentVolumeClaim

**File**: `k8s/pvc.yaml`

```yaml
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: agent-hub-db-pvc
  namespace: agent-hub-prod
spec:
  accessModes:
    - ReadWriteOnce
  resources:
    requests:
      storage: 10Gi
  storageClassName: do-block-storage  # DigitalOcean
  # storageClassName: standard  # GCP/AWS
```

### HorizontalPodAutoscaler

**File**: `k8s/hpa.yaml`

```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: backend-hpa
  namespace: agent-hub-prod
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: backend
  minReplicas: 3
  maxReplicas: 10
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 80
  behavior:
    scaleDown:
      stabilizationWindowSeconds: 300
      policies:
      - type: Percent
        value: 50
        periodSeconds: 60
    scaleUp:
      stabilizationWindowSeconds: 60
      policies:
      - type: Percent
        value: 100
        periodSeconds: 60
```

### NetworkPolicy

**File**: `k8s/networkpolicy.yaml`

```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: backend-network-policy
  namespace: agent-hub-prod
spec:
  podSelector:
    matchLabels:
      app: backend
  policyTypes:
  - Ingress
  - Egress
  ingress:
  - from:
    - podSelector:
        matchLabels:
          app: frontend
    - podSelector:
        matchLabels:
          app.kubernetes.io/name: ingress-nginx
    ports:
    - protocol: TCP
      port: 4000
  egress:
  - to: []
    ports:
    - protocol: TCP
      port: 443  # External APIs (Feishu, Sentry)
    - protocol: TCP
      port: 53   # DNS
    - protocol: UDP
      port: 53   # DNS
---
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: frontend-network-policy
  namespace: agent-hub-prod
spec:
  podSelector:
    matchLabels:
      app: frontend
  policyTypes:
  - Ingress
  - Egress
  ingress:
  - from:
    - podSelector:
        matchLabels:
          app.kubernetes.io/name: ingress-nginx
    ports:
    - protocol: TCP
      port: 3000
  egress:
  - to:
    - podSelector:
        matchLabels:
          app: backend
    ports:
    - protocol: TCP
      port: 4000
  - to: []
    ports:
    - protocol: TCP
      port: 443  # External APIs
    - protocol: TCP
      port: 53   # DNS
    - protocol: UDP
      port: 53   # DNS
```

---

## 4. Monitoring Stack (Kubernetes-Native)

### Architecture

```
┌─────────────────────────────────────────────────────────┐
│              Monitoring Namespace                        │
├─────────────────────────────────────────────────────────┤
│  Prometheus Operator (manages monitoring stack)         │
│  ├─ Prometheus Server (metrics collection)              │
│  ├─ Alertmanager (alert routing)                        │
│  └─ Grafana (visualization)                             │
├─────────────────────────────────────────────────────────┤
│  ServiceMonitors (auto-discovery)                       │
│  ├─ backend-monitor (scrapes /metrics)                  │
│  └─ frontend-monitor (scrapes /metrics)                 │
├─────────────────────────────────────────────────────────┤
│  PrometheusRules (alerting rules)                       │
│  ├─ HighErrorRate                                       │
│  ├─ HighLatency                                         │
│  └─ PodDown                                             │
└─────────────────────────────────────────────────────────┘
```

### Installation (Helm)

**Commands**:
```bash
# Add Prometheus community Helm repo
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm repo update

# Install kube-prometheus-stack (includes Prometheus, Grafana, Alertmanager)
helm install monitoring prometheus-community/kube-prometheus-stack \
  --namespace monitoring \
  --create-namespace \
  --set grafana.adminPassword=admin123 \
  --set prometheus.serviceMonitorSelectorNilUsesHelmValues=false \
  --set prometheus.podMonitorSelectorNilUsesHelmValues=false
```

### ServiceMonitor

**File**: `k8s/monitoring/service-monitor.yaml`

```yaml
apiVersion: monitoring.coreos.com/v1
kind: ServiceMonitor
metadata:
  name: backend-monitor
  namespace: agent-hub-prod
  labels:
    release: monitoring  # Must match Prometheus Helm release
spec:
  selector:
    matchLabels:
      app: backend
  namespaceSelector:
    matchNames:
    - agent-hub-prod
  endpoints:
  - port: http
    path: /metrics
    interval: 30s
    scrapeTimeout: 10s
---
apiVersion: monitoring.coreos.com/v1
kind: ServiceMonitor
metadata:
  name: frontend-monitor
  namespace: agent-hub-prod
  labels:
    release: monitoring
spec:
  selector:
    matchLabels:
      app: frontend
  namespaceSelector:
    matchNames:
    - agent-hub-prod
  endpoints:
  - port: http
    path: /metrics
    interval: 30s
    scrapeTimeout: 10s
```

### PrometheusRules (Alerting)

**File**: `k8s/monitoring/prometheus-rules.yaml`

```yaml
apiVersion: monitoring.coreos.com/v1
kind: PrometheusRule
metadata:
  name: agent-hub-alerts
  namespace: agent-hub-prod
  labels:
    release: monitoring
spec:
  groups:
  - name: agent-hub.rules
    rules:
    # High Error Rate
    - alert: AgentHubHighErrorRate
      expr: |
        sum(rate(http_requests_total{namespace="agent-hub-prod",status=~"5.."}[5m])) 
        / sum(rate(http_requests_total{namespace="agent-hub-prod"}[5m])) > 0.05
      for: 5m
      labels:
        severity: critical
      annotations:
        summary: "High error rate in Agent Hub"
        description: "Error rate is {{ $value | humanizePercentage }} (>5%)"
    
    # High Latency
    - alert: AgentHubHighLatency
      expr: |
        histogram_quantile(0.95, 
          sum(rate(http_request_duration_seconds_bucket{namespace="agent-hub-prod"}[5m])) 
          by (le)
        ) > 2
      for: 5m
      labels:
        severity: warning
      annotations:
        summary: "High latency in Agent Hub"
        description: "P95 latency is {{ $value | humanizeDuration }} (>2s)"
    
    # Pod Down
    - alert: AgentHubPodDown
      expr: |
        kube_pod_status_phase{namespace="agent-hub-prod",phase="Running"} == 0
      for: 5m
      labels:
        severity: critical
      annotations:
        summary: "Agent Hub pod is down"
        description: "Pod {{ $labels.pod }} has been down for more than 5 minutes"
    
    # OpenClaw CLI Timeout
    - alert: AgentHubOpenClawTimeout
      expr: |
        rate(openclaw_cli_duration_seconds_count{status="timeout"}[5m]) > 0
      for: 2m
      labels:
        severity: warning
      annotations:
        summary: "OpenClaw CLI timeouts detected"
        description: "OpenClaw CLI is timing out frequently"
    
    # Database Disk Space Low
    - alert: AgentHubDatabaseDiskSpaceLow
      expr: |
        (kubelet_volume_stats_capacity_bytes - kubelet_volume_stats_used_bytes) 
        / kubelet_volume_stats_capacity_bytes < 0.1
      for: 10m
      labels:
        severity: warning
      annotations:
        summary: "Database disk space low"
        description: "Less than 10% disk space remaining"
    
    # WebSocket Connections High
    - alert: AgentHubWebSocketConnectionsHigh
      expr: |
        websocket_connections > 800
      for: 5m
      labels:
        severity: warning
      annotations:
        summary: "High WebSocket connection count"
        description: "{{ $value }} active WebSocket connections (>800)"
```

### Grafana Dashboards

**Dashboard 1: System Overview**

Import Grafana dashboard ID: `10693` (Node Exporter Full)  
Import Grafana dashboard ID: `315` (Prometheus Stats)

**Dashboard 2: Application Metrics** (Custom)

**File**: `k8s/monitoring/grafana-dashboard.json`

```json
{
  "dashboard": {
    "title": "Agent Hub Overview",
    "panels": [
      {
        "title": "Request Rate",
        "type": "graph",
        "targets": [
          {
            "expr": "sum(rate(http_requests_total{namespace=\"agent-hub-prod\"}[5m])) by (status)"
          }
        ]
      },
      {
        "title": "Response Time (P95)",
        "type": "graph",
        "targets": [
          {
            "expr": "histogram_quantile(0.95, sum(rate(http_request_duration_seconds_bucket{namespace=\"agent-hub-prod\"}[5m])) by (le))"
          }
        ]
      },
      {
        "title": "Active WebSocket Connections",
        "type": "singlestat",
        "targets": [
          {
            "expr": "sum(websocket_connections{namespace=\"agent-hub-prod\"})"
          }
        ]
      },
      {
        "title": "OpenClaw CLI Duration",
        "type": "graph",
        "targets": [
          {
            "expr": "histogram_quantile(0.95, sum(rate(openclaw_cli_duration_seconds_bucket[5m])) by (le))"
          }
        ]
      },
      {
        "title": "Database Size",
        "type": "graph",
        "targets": [
          {
            "expr": "kubelet_volume_stats_used_bytes{persistentvolumeclaim=\"agent-hub-db-pvc\"}"
          }
        ]
      },
      {
        "title": "Pod Memory Usage",
        "type": "graph",
        "targets": [
          {
            "expr": "sum(container_memory_usage_bytes{namespace=\"agent-hub-prod\"}) by (pod)"
          }
        ]
      }
    ]
  }
}
```

### Alertmanager Configuration

**File**: `k8s/monitoring/alertmanager-config.yaml`

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: alertmanager-main
  namespace: monitoring
type: Opaque
stringData:
  alertmanager.yml: |
    global:
      resolve_timeout: 5m
    
    route:
      group_by: ['alertname', 'severity']
      group_wait: 30s
      group_interval: 5m
      repeat_interval: 4h
      receiver: 'slack-notifications'
      routes:
      - match:
          severity: critical
        receiver: 'slack-critical'
        repeat_interval: 1h
      - match:
          severity: warning
        receiver: 'slack-warnings'
        repeat_interval: 12h
    
    receivers:
    - name: 'slack-notifications'
      slack_configs:
      - api_url: 'https://hooks.slack.com/services/YOUR/WEBHOOK/URL'
        channel: '#agent-hub-alerts'
        send_resolved: true
        title: '{{ range .Alerts }}{{ .Annotations.summary }}{{ end }}'
        text: '{{ range .Alerts }}{{ .Annotations.description }}{{ end }}'
    
    - name: 'slack-critical'
      slack_configs:
      - api_url: 'https://hooks.slack.com/services/YOUR/WEBHOOK/URL'
        channel: '#agent-hub-critical'
        send_resolved: true
        title: '🚨 CRITICAL: {{ range .Alerts }}{{ .Annotations.summary }}{{ end }}'
        text: '{{ range .Alerts }}{{ .Annotations.description }}{{ end }}'
    
    - name: 'slack-warnings'
      slack_configs:
      - api_url: 'https://hooks.slack.com/services/YOUR/WEBHOOK/URL'
        channel: '#agent-hub-warnings'
        send_resolved: true
        title: '⚠️ Warning: {{ range .Alerts }}{{ .Annotations.summary }}{{ end }}'
        text: '{{ range .Alerts }}{{ .Annotations.description }}{{ end }}'
```

---

## 5. Logging Stack

### Architecture

```
┌─────────────────────────────────────────────────────────┐
│              Logging Stack                               │
├─────────────────────────────────────────────────────────┤
│  Fluent Bit (DaemonSet)                                │
│  ├─ Collects logs from all pods                        │
│  └─ Forwards to Loki                                    │
├─────────────────────────────────────────────────────────┤
│  Loki (Log Aggregation)                                │
│  ├─ Stores logs with labels                            │
│  └─ Integrates with Grafana                            │
├─────────────────────────────────────────────────────────┤
│  Grafana (Log Visualization)                           │
│  └─ Query logs with LogQL                              │
└─────────────────────────────────────────────────────────┘
```

### Installation (Helm)

```bash
# Add Grafana Labs Helm repo
helm repo add grafana https://grafana.github.io/helm-charts
helm repo update

# Install Loki stack (Loki + Fluent Bit + Promtail)
helm install loki grafana/loki-stack \
  --namespace monitoring \
  --set loki.enabled=true \
  --set fluent-bit.enabled=true \
  --set promtail.enabled=false
```

### Log Format (JSON)

**Backend** (`server/src/utils/logger.ts`):
```typescript
import winston from 'winston';

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp({ format: 'ISO8601' }),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: {
    service: 'agent-hub-backend',
    namespace: process.env.NAMESPACE || 'agent-hub-prod'
  },
  transports: [
    new winston.transports.Console()
  ]
});
```

### LogQL Queries (Grafana)

**Error Logs**:
```logql
{namespace="agent-hub-prod", app="backend"} |= "level\":\"error"
```

**Slow Requests**:
```logql
{namespace="agent-hub-prod", app="backend"} | json | duration_ms > 1000
```

**Agent Responses**:
```logql
{namespace="agent-hub-prod", app="backend"} |= "agent response"
```

---

## 6. CI/CD Pipeline (GitOps with ArgoCD)

### Architecture

```
┌─────────────────────────────────────────────────────────┐
│              Developer Workflow                          │
├─────────────────────────────────────────────────────────┤
│  1. Developer pushes code to GitHub                    │
│  2. GitHub Actions builds Docker images                │
│  3. GitHub Actions updates Helm chart version          │
│  4. ArgoCD detects changes in Git repo                 │
│  5. ArgoCD syncs cluster to match Git state            │
│  6. Kubernetes deploys new version                     │
└─────────────────────────────────────────────────────────┘
```

### GitHub Actions Workflow

**File**: `.github/workflows/ci-cd.yaml`

```yaml
name: CI/CD Pipeline

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

env:
  REGISTRY: ghcr.io
  IMAGE_NAME_BACKEND: ${{ github.repository }}/backend
  IMAGE_NAME_FRONTEND: ${{ github.repository }}/frontend

jobs:
  build-and-push:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Log in to Container Registry
      uses: docker/login-action@v2
      with:
        registry: ${{ env.REGISTRY }}
        username: ${{ github.actor }}
        password: ${{ secrets.GITHUB_TOKEN }}
    
    - name: Build and Push Backend
      uses: docker/build-push-action@v4
      with:
        context: .
        file: ./Dockerfile
        push: true
        tags: ${{ env.REGISTRY }}/${{ env.IMAGE_NAME_BACKEND }}:${{ github.sha }}
        cache-from: type=gha
        cache-to: type=gha,mode=max
    
    - name: Build and Push Frontend
      uses: docker/build-push-action@v4
      with:
        context: ./client
        file: ./client/Dockerfile
        push: true
        tags: ${{ env.REGISTRY }}/${{ env.IMAGE_NAME_FRONTEND }}:${{ github.sha }}
        cache-from: type=gha
        cache-to: type=gha,mode=max
    
    - name: Update Helm Chart
      run: |
        # Update image tags in Helm values
        sed -i "s|tag:.*|tag: ${{ github.sha }}|" k8s/helm/agent-hub/values.yaml
        
        # Commit and push changes
        git config --global user.name 'GitHub Actions'
        git config --global user.email 'actions@github.com'
        git add k8s/helm/agent-hub/values.yaml
        git commit -m "Update image tag to ${{ github.sha }}" || echo "No changes"
        git push

  deploy:
    runs-on: ubuntu-latest
    needs: build-and-push
    if: github.ref == 'refs/heads/main'
    
    steps:
    - name: Deploy via ArgoCD
      uses: argoproj-labs/argocd-actions@v0.4.0
      with:
        argocd-server: ${{ secrets.ARGOCD_SERVER }}
        argocd-token: ${{ secrets.ARGOCD_TOKEN }}
        app-name: agent-hub-prod
        command: sync
```

### ArgoCD Application

**File**: `k8s/argocd/application.yaml`

```yaml
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: agent-hub-prod
  namespace: argocd
spec:
  project: default
  source:
    repoURL: https://github.com/your-org/agent-hub.git
    targetRevision: HEAD
    path: k8s/helm/agent-hub
    helm:
      valueFiles:
      - values.yaml
  destination:
    server: https://kubernetes.default.svc
    namespace: agent-hub-prod
  syncPolicy:
    automated:
      prune: true
      selfHeal: true
    syncOptions:
    - CreateNamespace=true
```

---

## 7. Database Strategy

### Option A: SQLite (Single-Node, Simple)

**Pros**:
- ✅ Simple setup (just a file)
- ✅ No external dependencies
- ✅ Zero maintenance
- ✅ Perfect for single-region deployments

**Cons**:
- ❌ Single point of failure
- ❌ No horizontal scaling
- ❌ Limited concurrent writes

**Configuration**:
```yaml
# In Deployment
volumeMounts:
- name: db-storage
  mountPath: /app/prisma

volumes:
- name: db-storage
  persistentVolumeClaim:
    claimName: agent-hub-db-pvc
```

**Backup Strategy**:
```bash
#!/bin/bash
# backup-sqlite.sh
PVC_NAME="agent-hub-db-pvc"
BACKUP_BUCKET="s3://your-bucket/backups"
DATE=$(date +%Y%m%d_%H%M%S)

# Create snapshot (DigitalOcean)
doctl compute volume-action snapshot $PVC_NAME agent-hub-db-$DATE

# Or copy file
kubectl exec -n agent-hub-prod deploy/backend -- tar czf - /app/prisma/prod.db | \
  aws s3 cp - $BACKUP_BUCKET/prod.db.$DATE.gz

# Keep last 7 backups
aws s3 ls $BACKUP_BUCKET | sort | head -n -7 | awk '{print $4}' | \
  xargs -I {} aws s3 rm $BACKUP_BUCKET/{}
```

### Option B: PostgreSQL (Multi-Node, Production)

**Pros**:
- ✅ High availability
- ✅ Horizontal scaling (read replicas)
- ✅ Point-in-time recovery
- ✅ Managed services available

**Cons**:
- ❌ More complex
- ❌ Requires migration from SQLite

**Managed Options**:
- **DigitalOcean**: Managed PostgreSQL ($15/month)
- **AWS**: RDS PostgreSQL
- **GCP**: Cloud SQL PostgreSQL
- **Azure**: Database for PostgreSQL

**Migration**:
```bash
# Export SQLite
sqlite3 prisma/prod.db .dump > dump.sql

# Convert to PostgreSQL (use pgloader or manual)
pgloader sqlite://prisma/prod.db postgresql://user:pass@host:5432/db

# Or use Prisma migration
npx prisma migrate dev --name switch-to-postgres
```

**Recommendation**: Start with SQLite, migrate to PostgreSQL when you need HA or scaling.

---

## 8. Security Hardening

### Pod Security Standards

**File**: `k8s/pod-security.yaml`

```yaml
apiVersion: v1
kind: Namespace
metadata:
  name: agent-hub-prod
  labels:
    pod-security.kubernetes.io/enforce: restricted
    pod-security.kubernetes.io/audit: restricted
    pod-security.kubernetes.io/warn: restricted
```

### Security Context

**Add to Deployments**:
```yaml
securityContext:
  runAsNonRoot: true
  runAsUser: 1000
  runAsGroup: 1000
  fsGroup: 1000
  seccompProfile:
    type: RuntimeDefault

containers:
- name: backend
  securityContext:
    allowPrivilegeEscalation: false
    readOnlyRootFilesystem: true
    capabilities:
      drop:
      - ALL
```

### RBAC (Role-Based Access Control)

**File**: `k8s/rbac.yaml`

```yaml
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  namespace: agent-hub-prod
  name: agent-hub-role
rules:
- apiGroups: [""]
  resources: ["configmaps", "secrets"]
  verbs: ["get", "list"]
- apiGroups: [""]
  resources: ["pods"]
  verbs: ["get", "list", "watch"]
---
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: agent-hub-role-binding
  namespace: agent-hub-prod
subjects:
- kind: ServiceAccount
  name: agent-hub-sa
  namespace: agent-hub-prod
roleRef:
  kind: Role
  name: agent-hub-role
  apiGroup: rbac.authorization.k8s.io
```

---

## 9. Cost Breakdown

### Managed Kubernetes (DigitalOcean DOKS)

| Component | Spec | Cost/Month |
|-----------|------|------------|
| **Control Plane** | Managed | $0 |
| **Worker Nodes** | 3x (2 vCPU, 4GB) | $36 |
| **Load Balancer** | 1x | $12 |
| **Block Storage** | 100GB | $10 |
| **Data Transfer** | 4TB included | $0 |
| **Total** | | **$58/month** |

### Monitoring Stack (Included)

| Service | Tier | Cost |
|---------|------|------|
| Prometheus | Self-hosted | $0 |
| Grafana | Self-hosted | $0 |
| Loki | Self-hosted | $0 |
| Sentry | Free (5K errors) | $0 |
| **Total** | | **$0** (included in VPS cost) |

### Total Monthly Cost

| Setup | Cost |
|-------|------|
| **Kubernetes (DO)** | $58 |
| **Domain** | $1 |
| **Cloudflare** | $0 |
| **Backups (S3)** | $0.12 |
| **Total** | **$59.12/month** |

### Cost Optimization

1. **Start smaller**: 2 nodes instead of 3 ($46/month)
2. **Use spot instances**: 60-70% discount (but can be terminated)
3. **Annual billing**: Some providers offer 10-20% discount
4. **Free tiers**: GCP/AWS free tiers for first 12 months

---

## 10. Implementation Plan

### Week 1: Kubernetes Setup (8-10 hours)

**Day 1-2**: Cluster Provisioning (4 hours)
- Create DigitalOcean account
- Set up DOKS cluster (3 nodes)
- Configure kubectl access
- Install Helm
- **Deliverable**: Running K8s cluster

**Day 3-4**: Deploy Application (4-6 hours)
- Create Kubernetes manifests
- Build Docker images
- Push to registry
- Deploy to cluster
- **Deliverable**: Agent Hub running on K8s

**Day 5**: Ingress + SSL (2 hours)
- Install Nginx Ingress Controller
- Set up cert-manager
- Configure Let's Encrypt
- **Deliverable**: HTTPS working

### Week 2: Monitoring Stack (8-10 hours)

**Day 1-2**: Prometheus + Grafana (4 hours)
- Install kube-prometheus-stack
- Configure ServiceMonitors
- Import dashboards
- **Deliverable**: Metrics collection working

**Day 3**: Alerting Rules (2 hours)
- Create PrometheusRules
- Configure Alertmanager
- Set up Slack integration
- **Deliverable**: Alerts firing to Slack

**Day 4**: Loki Logging (2-4 hours)
- Install Loki stack
- Configure Fluent Bit
- Create LogQL queries
- **Deliverable**: Logs visible in Grafana

**Day 5**: Sentry Integration (2 hours)
- Install Sentry SDK
- Configure DSN
- Test error tracking
- **Deliverable**: Errors tracked in Sentry

### Week 3: CI/CD + Hardening (8-12 hours)

**Day 1-2**: GitHub Actions (4 hours)
- Create CI/CD workflow
- Configure Docker build
- Set up container registry
- **Deliverable**: Automated builds

**Day 3-4**: ArgoCD GitOps (4 hours)
- Install ArgoCD
- Create Application manifest
- Configure auto-sync
- **Deliverable**: GitOps deployment working

**Day 5**: Security Hardening (4 hours)
- Configure NetworkPolicies
- Set up Pod Security Standards
- Implement RBAC
- **Deliverable**: Hardened cluster

---

## 11. Success Criteria

### Kubernetes Deployment ✅
- [ ] Application deployed to K8s cluster
- [ ] Ingress working with HTTPS
- [ ] Auto-scaling configured (HPA)
- [ ] Health checks passing (liveness/readiness)
- [ ] Persistent storage mounted (database)

### Monitoring ✅
- [ ] Prometheus scraping metrics
- [ ] Grafana dashboards showing data
- [ ] Alert rules configured
- [ ] Slack alerts working
- [ ] Loki collecting logs

### CI/CD ✅
- [ ] GitHub Actions building images
- [ ] ArgoCD auto-syncing changes
- [ ] Zero-downtime deployments
- [ ] Rollback capability

### Security ✅
- [ ] NetworkPolicies enforced
- [ ] Pod Security Standards applied
- [ ] Secrets managed securely
- [ ] RBAC configured

---

## 12. Next Steps

1. **Choose Kubernetes provider** (recommendation: DigitalOcean DOKS)
2. **Set up cluster** (follow Week 1 plan)
3. **Deploy application** (apply manifests)
4. **Configure monitoring** (install Prometheus stack)
5. **Set up CI/CD** (GitHub Actions + ArgoCD)
6. **Test disaster recovery** (backup/restore)

---

**Ready to deploy on Kubernetes?** I recommend starting with Week 1 (cluster setup) and deploying a simple version first, then adding monitoring and CI/CD incrementally.

Would you like me to:
- **A)** Create all Kubernetes manifest files?
- **B)** Set up DigitalOcean DOKS cluster (step-by-step)?
- **C)** Create Helm chart for easier management?
- **D)** Start with Week 1 implementation?

What's your priority? 🚀
