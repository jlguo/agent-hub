# Kubernetes Remote Mode Deployment Guide

**Quick Start:** Deploy Agent Hub to Kubernetes with remote OpenClaw Gateway access using SSH tunnel sidecar.

---

## Architecture

```
┌─────────────────────────┐
│  Kubernetes Pod         │
│  ┌───────────────────┐  │
│  │   Backend         │  │
│  │  (Port 4000)      │  │
│  └─────────┬─────────┘  │
│            │            │
│  ┌─────────▼─────────┐  │
│  │ SSH Tunnel        │  │
│  │ Sidecar           │──┼── SSH ──> Remote OpenClaw Gateway
│  │ (Port 18789)      │  │
│  └───────────────────┘  │
└─────────────────────────┘
```

---

## Prerequisites

1. **Kubernetes cluster** (v1.20+)
   - Docker Desktop K8s, Minikube, EKS, GKE, AKS, or self-hosted
2. **Helm** (v3.0+)
3. **Remote OpenClaw Gateway** running on VPS/home server
4. **SSH key** for tunnel authentication

---

## Quick Start (10 minutes)

### Step 1: Create Kubernetes Secrets

```bash
# Navigate to Helm chart directory
cd /home/jlguo/agent-hub/k8s/helm/agent-hub

# Create secrets (replace with your actual values)
kubectl create secret generic agent-hub-secrets \
  --from-literal=openclaw-verification-token="your-openclaw-token" \
  --from-literal=ssh-host="192.168.1.100" \
  --from-literal=ssh-user="ubuntu" \
  --from-literal=ssh-private-key="$(cat ~/.ssh/id_rsa)" \
  --from-literal=feishu-app-id="cli_xxx" \
  --from-literal=feishu-app-secret="xxx" \
  --from-literal=feishu-chat-id="oc_xxx" \
  --from-literal=feishu-verify-token="your-feishu-token" \
  --from-literal=jwt-secret="your-jwt-secret-min-32-chars" \
  --from-literal=encryption-key="your-64-hex-encryption-key"
```

### Step 2: Build SSH Tunnel Image

```bash
# Build SSH tunnel image
cd /home/jlguo/agent-hub/docker/ssh-tunnel
docker build -t agent-hub-ssh-tunnel:latest .

# For K8s, you may need to push to a registry
# docker tag agent-hub-ssh-tunnel:latest your-registry/agent-hub-ssh-tunnel:latest
# docker push your-registry/agent-hub-ssh-tunnel:latest
```

### Step 3: Deploy with Helm

```bash
# Install with remote mode values
helm install agent-hub-remote ./k8s/helm/agent-hub \
  --namespace agent-hub \
  --create-namespace \
  --values k8s/helm/agent-hub/values-remote.yaml
```

### Step 4: Verify Deployment

```bash
# Check pod status
kubectl get pods -n agent-hub

# Check SSH tunnel pod logs
kubectl logs -n agent-hub -l app=ssh-tunnel -f

# Check backend pod logs
kubectl logs -n agent-hub -l app=backend -f

# Port-forward to test
kubectl port-forward -n agent-hub svc/backend 4000:4000

# Test health endpoint
curl http://localhost:4000/health | jq
```

---

## Configuration

### Values for Remote Mode

Key settings in `values-remote.yaml`:

| Parameter                      | Description                      | Default                |
| ------------------------------ | -------------------------------- | ---------------------- |
| `sshTunnel.enabled`            | Enable SSH tunnel sidecar        | `true`                 |
| `sshTunnel.image.repository`   | SSH tunnel image                 | `agent-hub-ssh-tunnel` |
| `sshTunnel.keepalive.interval` | SSH keepalive interval (seconds) | `60`                   |
| `sshTunnel.keepalive.count`    | SSH keepalive max failures       | `3`                    |
| `backend.env`                  | Environment variables            | See values-remote.yaml |

### Required Secrets

| Secret Key                    | Description                    | Example         |
| ----------------------------- | ------------------------------ | --------------- |
| `openclaw-verification-token` | OpenClaw Gateway auth          | `abc123...`     |
| `ssh-host`                    | Remote host IP/domain          | `192.168.1.100` |
| `ssh-user`                    | SSH username                   | `ubuntu`        |
| `ssh-private-key`             | SSH private key (full content) | `-----BEGIN...` |
| `feishu-app-id`               | Feishu app ID                  | `cli_xxx`       |
| `feishu-app-secret`           | Feishu app secret              | `xxx`           |
| `feishu-chat-id`              | Target chat ID                 | `oc_xxx`        |
| `jwt-secret`                  | JWT signing key                | `min-32-chars`  |
| `encryption-key`              | AES encryption key             | `64-hex-chars`  |

---

## Advanced Configuration

### Custom SSH Tunnel Image

If using a private registry:

```yaml
# values-remote.yaml
sshTunnel:
  image:
    repository: your-registry/agent-hub-ssh-tunnel
    tag: 'latest'
    pullPolicy: Always
```

### Increase SSH Keepalive

For unstable networks:

```yaml
# values-remote.yaml
sshTunnel:
  keepalive:
    interval: 30 # Check every 30 seconds
    count: 5 # Allow 5 failures before restart
```

### Resource Limits

Adjust based on your cluster:

```yaml
# values-remote.yaml
sshTunnel:
  resources:
    limits:
      cpu: 200m
      memory: 128Mi
    requests:
      cpu: 100m
      memory: 64Mi
```

### Enable Ingress

For external access:

```yaml
# values-remote.yaml
ingress:
  enabled: true
  className: nginx
  hosts:
    - host: agent-hub.example.com
      paths:
        - path: /
          pathType: Prefix
  tls:
    - secretName: agent-hub-tls
      hosts:
        - agent-hub.example.com
```

---

## Monitoring

### Check Pod Status

```bash
# All pods
kubectl get pods -n agent-hub

# Detailed status
kubectl describe pod -n agent-hub -l app=ssh-tunnel

# Check health
kubectl exec -n agent-hub -l app=ssh-tunnel -- /healthcheck.sh
```

### View Logs

```bash
# SSH tunnel logs
kubectl logs -n agent-hub -l app=ssh-tunnel -f

# Backend logs
kubectl logs -n agent-hub -l app=backend -f

# Last 100 lines
kubectl logs -n agent-hub -l app=ssh-tunnel --tail=100
```

### Health Check

```bash
# Port-forward backend
kubectl port-forward -n agent-hub svc/backend 4000:4000

# Test health endpoint
curl http://localhost:4000/health | jq

# Expected output:
# {
#   "status": "ok",
#   "openclaw": {
#     "status": "healthy",
#     "mode": "remote",
#     "tunnel": "connected"
#   }
# }
```

---

## Troubleshooting

### SSH Tunnel Pod Not Starting

**Symptom:** Pod in CrashLoopBackOff

```bash
# Check logs
kubectl logs -n agent-hub -l app=ssh-tunnel

# Common issues:
# 1. SSH private key not valid
kubectl get secret agent-hub-secrets -n agent-hub -o jsonpath='{.data.ssh-private-key}' | base64 -d

# 2. SSH host unreachable
kubectl exec -n agent-hub -l app=ssh-tunnel -- ping -c 3 $(SSH_HOST)

# 3. SSH key permissions
kubectl exec -n agent-hub -l app=ssh-tunnel -- ls -la /etc/ssh-tunnel
```

### Backend Can't Connect to OpenClaw

**Symptom:** Health check shows `tunnel: disconnected`

```bash
# Check if tunnel is running
kubectl exec -n agent-hub -l app=ssh-tunnel -- nc -z localhost 18789

# Should return: Connection successful

# Test from backend pod
kubectl exec -n agent-hub -l app=backend -- wget -q -O - http://localhost:18789

# Check OpenClaw config
kubectl exec -n agent-hub -l app=backend -- openclaw config get gateway.remote
```

### Secret Not Found

**Symptom:** Pod fails to start with secret error

```bash
# List secrets
kubectl get secrets -n agent-hub

# Verify secret exists
kubectl get secret agent-hub-secrets -n agent-hub

# Recreate if needed
kubectl delete secret agent-hub-secrets -n agent-hub
# Then recreate with kubectl create secret command
```

### SSH Tunnel Keeps Disconnecting

**Symptom:** Frequent reconnections

```bash
# Increase keepalive
# Edit values-remote.yaml:
sshTunnel:
  keepalive:
    interval: 30
    count: 10

# Upgrade release
helm upgrade agent-hub-remote ./k8s/helm/agent-hub \
  -f k8s/helm/agent-hub/values-remote.yaml \
  -n agent-hub
```

---

## Security Best Practices

1. **Use SSH key authentication only** (no passwords)

   ```bash
   ssh-keygen -t ed25519 -C "agent-hub-k8s"
   ```

2. **Restrict SSH key usage** (in `~/.ssh/authorized_keys` on remote):

   ```
   from="10.0.0.0/8",command="openclaw gateway" ssh-ed25519 AAAA...
   ```

3. **Use Kubernetes Secrets** (not ConfigMaps) for sensitive data

   ```bash
   kubectl create secret generic ...
   ```

4. **Enable Pod Security Standards**:

   ```yaml
   podSecurityContext:
     runAsNonRoot: true
     runAsUser: 1000
     seccompProfile:
       type: RuntimeDefault
   ```

5. **Network Policies** (optional, for extra isolation):
   ```yaml
   # Create NetworkPolicy to restrict pod communication
   ```

---

## Backup & Recovery

### Backup Secrets

```bash
# Export secrets
kubectl get secret agent-hub-secrets -n agent-hub -o yaml > secrets-backup.yaml

# Store securely (encrypted!)
```

### Restore from Backup

```bash
# Recreate secrets
kubectl apply -f secrets-backup.yaml

# Restart pods
kubectl rollout restart deployment -n agent-hub
```

### Backup Database

```bash
# Get PVC name
PVC_NAME=$(kubectl get pvc -n agent-hub -l app=backend -o jsonpath='{.items[0].metadata.name}')

# Create backup pod
kubectl run backup --rm -it --image=alpine --restart=Never \
  --volume-mounts=$PVC_NAME:/data \
  -- cp -r /data /backup
```

---

## Scaling

### Scale Frontend Only

```bash
# Frontend can scale independently
kubectl scale deployment agent-hub-frontend -n agent-hub --replicas=3

# Backend should stay at 1 replica (stateful with SQLite)
```

### Horizontal Pod Autoscaler

Already configured in Helm chart:

```yaml
# values-remote.yaml
autoscaling:
  enabled: true
  minReplicas: 1
  maxReplicas: 10
  targetCPUUtilizationPercentage: 80
```

---

## Migration from Docker Compose

### Step 1: Export Configuration

```bash
# From docker-compose environment
# Copy .env values to Kubernetes secrets
```

### Step 2: Create Secrets

```bash
# Create Kubernetes secrets (see Quick Start Step 1)
```

### Step 3: Deploy to K8s

```bash
# Deploy with Helm
helm install agent-hub-remote ./k8s/helm/agent-hub \
  --namespace agent-hub \
  --create-namespace \
  --values k8s/helm/agent-hub/values-remote.yaml
```

### Step 4: Migrate Database

```bash
# Export from Docker
docker-compose -f docker-compose.remote.yml exec backend \
  tar czf - /app/prisma > prisma-data.tar.gz

# Import to K8s PVC
kubectl cp prisma-data.tar.gz agent-hub-backend-pod:/tmp/
kubectl exec -n agent-hub agent-hub-backend-pod -- \
  tar xzf /tmp/prisma-data.tar.gz -C /app/
```

---

## References

- [OpenClaw Remote Access Docs](https://docs.openclaw.ai/gateway/remote)
- [Helm Documentation](https://helm.sh/docs/)
- [Kubernetes Secrets](https://kubernetes.io/docs/concepts/configuration/secret/)
- [SSH Tunnel Best Practices](https://www.ssh.com/academy/ssh/tunneling)
- [Docker Compose Remote Mode](docker/README-REMOTE.md)

---

**Last Updated:** 2026-04-06  
**Status:** Production Ready
