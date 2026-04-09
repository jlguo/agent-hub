# SSH Key Setup for OpenClaw Remote Mode

This guide covers SSH key configuration for both Docker Compose (local/development) and Kubernetes (production) deployments.

## Overview

OpenClaw remote mode requires SSH tunnel access to the OpenClaw Gateway. The SSH key must be available to the backend container/pod.

**Two approaches:**

- **Option 1: Volume Mount** - For Docker Compose (local/dev)
- **Option 2: Kubernetes Secrets** - For Kubernetes (production)

---

## Option 1: Docker Compose (Volume Mount)

### Step 1: Create SSH Key Directory

```bash
mkdir -p ~/.ssh/agent-hub
```

### Step 2: Generate SSH Key Pair

```bash
ssh-keygen -t ed25519 -f ~/.ssh/agent-hub/id_ed25519 -N '' -C 'agent-hub-production'
```

### Step 3: Add Public Key to Host

```bash
# Add to root's authorized_keys (for SSH tunnel to localhost)
sudo tee -a /root/.ssh/authorized_keys < ~/.ssh/agent-hub/id_ed25519.pub

# Set correct permissions
sudo chmod 700 /root/.ssh
sudo chmod 600 /root/.ssh/authorized_keys
```

### Step 4: Update docker-compose.yml

The `docker-compose.yml` already includes the volume mount:

```yaml
volumes:
  - ${SSH_KEY_PATH:-~/.ssh/agent-hub}:/home/nodeuser/.ssh:ro
```

### Step 5: Start Containers

```bash
docker-compose up -d
```

### Verification

```bash
# Check SSH tunnel status
docker exec agent-hub-backend-1 pgrep -f "ssh.*-L.*18789"

# Test OpenClaw health
docker exec agent-hub-backend-1 openclaw health
```

---

## Option 2: Kubernetes Secrets

### Step 1: Generate SSH Key Pair

```bash
mkdir -p /tmp/agent-hub-ssh
ssh-keygen -t ed25519 -f /tmp/agent-hub-ssh/id_ed25519 -N '' -C 'agent-hub-production-k8s'
```

### Step 2: Add Public Key to Gateway Host

```bash
# Copy public key to remote Gateway host
ssh-copy-id -i /tmp/agent-hub-ssh/id_ed25519.pub user@gateway-host.example.com

# Or for localhost Gateway (development)
sudo tee -a /root/.ssh/authorized_keys < /tmp/agent-hub-ssh/id_ed25519.pub
```

### Step 3: Create Kubernetes Secret

```bash
kubectl create secret generic agent-hub-ssh-key \
  --from-file=id_ed25519=/tmp/agent-hub-ssh/id_ed25519 \
  --from-file=id_ed25519.pub=/tmp/agent-hub-ssh/id_ed25519.pub \
  --namespace=agent-hub-prod
```

### Step 4: Deploy with Helm

```bash
# Ensure sshKey is enabled in values-prod.yaml
helm upgrade agent-hub ./k8s/helm/agent-hub \
  --namespace agent-hub-prod \
  --create-namespace \
  --values k8s/helm/agent-hub/values-prod.yaml \
  --set sshKey.enabled=true \
  --set sshKey.secretName=agent-hub-ssh-key
```

### Verification

```bash
# Check pod is running
kubectl get pods -n agent-hub-prod -l app=backend

# Check SSH key is mounted
kubectl exec -n agent-hub-prod deploy/agent-hub-backend -- ls -la /home/nodeuser/.ssh/

# Test OpenClaw health
kubectl exec -n agent-hub-prod deploy/agent-hub-backend -- openclaw health
```

---

## Key Rotation

### Docker Compose

1. Generate new key pair:

   ```bash
   ssh-keygen -t ed25519 -f ~/.ssh/agent-hub/id_ed25519 -N '' -C 'agent-hub-rotated'
   ```

2. Update authorized_keys on Gateway host:

   ```bash
   sudo tee -a /root/.ssh/authorized_keys < ~/.ssh/agent-hub/id_ed25519.pub
   ```

3. Restart container:
   ```bash
   docker-compose restart backend
   ```

### Kubernetes

1. Generate new key pair:

   ```bash
   ssh-keygen -t ed25519 -f /tmp/agent-hub-ssh-new/id_ed25519 -N '' -C 'agent-hub-rotated-k8s'
   ```

2. Update secret (rolling update):

   ```bash
   kubectl create secret generic agent-hub-ssh-key-new \
     --from-file=id_ed25519=/tmp/agent-hub-ssh-new/id_ed25519 \
     --from-file=id_ed25519.pub=/tmp/agent-hub-ssh-new/id_ed25519.pub \
     --namespace=agent-hub-prod \
     --dry-run=client -o yaml | \
     kubectl replace -f -
   ```

3. Trigger rollout restart:
   ```bash
   kubectl rollout restart deployment/agent-hub-backend -n agent-hub-prod
   ```

---

## Troubleshooting

### SSH Connection Fails

```bash
# Check SSH key permissions (must be 400 or 600)
docker exec agent-hub-backend-1 ls -la /home/nodeuser/.ssh/

# Test SSH connection manually
docker exec agent-hub-backend-1 ssh -v -i /home/nodeuser/.ssh/id_ed25519 root@host.docker.internal echo "Success"
```

### Tunnel Not Starting

```bash
# Check if tunnel process exists
docker exec agent-hub-backend-1 pgrep -f "ssh.*-L.*18789"

# Check entrypoint logs
docker logs agent-hub-backend-1 2>&1 | grep -E "(SSH|tunnel)"
```

### Permission Denied

```bash
# Fix authorized_keys permissions on host
sudo chmod 700 /root/.ssh
sudo chmod 600 /root/.ssh/authorized_keys
sudo chown -R root:root /root/.ssh
```

---

## Security Best Practices

1. **Use ED25519 keys** (more secure than RSA)
2. **Set key expiration** for production:
   ```bash
   ssh-keygen -t ed25519 -f ~/.ssh/agent-hub/id_ed25519 -V 52w  # 1 year validity
   ```
3. **Restrict SSH key** in authorized_keys:
   ```
   from="10.0.0.0/8",command="ssh -N -L 18789:127.0.0.1:18789" ssh-ed25519 AAAA...
   ```
4. **Use separate keys** for dev/staging/production
5. **Rotate keys quarterly** for production environments
6. **Monitor SSH access logs** for unauthorized attempts

---

## Related Documentation

- [DEPLOYMENT-REMOTE-MODE.md](DEPLOYMENT-REMOTE-MODE.md) - Full remote mode deployment guide
- [docker-compose.yml](../docker-compose.yml) - Docker Compose configuration
- [k8s/helm/agent-hub/](../k8s/helm/agent-hub/) - Kubernetes Helm chart
