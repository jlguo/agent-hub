# Remote Mode Implementation Plan

**Status:** In Progress  
**Last Updated:** 2026-04-04  
**Priority:** P0 (Critical for Production Deployment)

---

## Executive Summary

Implement official OpenClaw remote access pattern using SSH tunnel + WebSocket CLI mode to enable Agent Hub backend to connect to remote OpenClaw Gateway.

**Architecture:**

```
┌─────────────────┐    SSH Tunnel    ┌──────────────────┐
│ Agent Hub       │ ───────────────> │ OpenClaw Gateway │
│ Backend         │ ws://localhost   │ (Remote VPS)     │
│ (Docker/VPS)    │ 18789            │                  │
└─────────────────┘                  └──────────────────┘
```

---

## Phase 1: Foundation ✅ COMPLETE

### Tasks Completed

- [x] **Research official OpenClaw remote access pattern**
  - Read: https://docs.openclaw.ai/gateway/remote
  - Confirmed: SSH tunnel + WebSocket CLI is official method
  - HTTP API mode doesn't exist (deprecated our implementation)

- [x] **Create comprehensive documentation**
  - Created: `docs/OPENCLAW-REMOTE-SETUP.md` (10.6KB)
  - Updated: `docs/OPENCLAW-DUAL-MODE-DESIGN.md`
  - Deprecated: HTTP mode (marked as not supported)

- [x] **Create setup automation**
  - Created: `k8s/scripts/setup-openclaw-remote.sh` (auto-installs CLI)
  - Created: `k8s/scripts/openclaw-ssh-tunnel.service` (systemd template)
  - Features: Auto-install, SSH config, persistent tunnel

- [x] **Commit to git**
  - Commit: `b0d6789` - Initial remote access implementation
  - Commit: `5579846` - Auto-install CLI if missing

### Phase 1 Deliverables

1. ✅ Setup guide with 5 deployment methods
2. ✅ Automated setup script with CLI installation
3. ✅ Systemd/LaunchAgent templates for persistent tunnels
4. ✅ Docker Compose integration examples
5. ✅ Security best practices documentation

---

## Phase 2: Code Implementation (Current)

### Task 2.1: Update OpenClawService.ts ✅ TODO

**Goal:** Ensure OpenClawService.ts properly supports remote CLI mode

**Current State:**

- OpenClawService uses `openclaw agent` CLI commands
- CLI already supports remote mode via config
- No code changes needed, but should verify

**Action Items:**

- [ ] Test OpenClawService with remote CLI config
- [ ] Add logging to confirm remote mode detection
- [ ] Add error handling for tunnel disconnection
- [ ] Update TypeScript types if needed

**Files to Modify:**

- `server/src/services/OpenClawService.ts`

**Acceptance Criteria:**

- [ ] Agent responses work through remote gateway
- [ ] Logs show "Remote mode: ws://127.0.0.1:18789"
- [ ] Graceful handling of SSH tunnel failures
- [ ] Reconnection logic for tunnel drops

---

### Task 2.2: Docker Integration ✅ TODO

**Goal:** Enable Docker deployments with SSH tunnel sidecar

**Current State:**

- Docker Compose has SSH tunnel sidecar example in docs
- Not yet tested in production

**Action Items:**

- [ ] Create production-ready docker-compose.yml
- [ ] Test SSH tunnel sidecar container
- [ ] Add health checks for tunnel connectivity
- [ ] Document Docker deployment in OPENCLAW-REMOTE-SETUP.md

**Files to Create:**

- `docker-compose.remote.yml` (production template)
- `docker/ssh-tunnel/Dockerfile` (dedicated tunnel image)

**Acceptance Criteria:**

- [ ] `docker-compose -f docker-compose.remote.yml up` works
- [ ] SSH tunnel auto-reconnects on failure
- [ ] Backend can reach OpenClaw Gateway through tunnel
- [ ] Health endpoint reports tunnel status

---

### Task 2.3: Kubernetes Integration ✅ TODO

**Goal:** Deploy Agent Hub to K8s with remote OpenClaw access

**Current State:**

- Helm chart exists (`k8s/helm/agent-hub/`)
- Not configured for remote OpenClaw mode

**Action Items:**

- [ ] Add remote mode config to Helm values
- [ ] Create SSH tunnel sidecar for K8s pods
- [ ] Use Kubernetes Secrets for SSH keys and tokens
- [ ] Add init container for SSH key setup

**Files to Modify:**

- `k8s/helm/agent-hub/values.yaml`
- `k8s/helm/agent-hub/templates/backend-deployment.yaml`
- `k8s/helm/agent-hub/templates/secrets.yaml`

**Files to Create:**

- `k8s/helm/agent-hub/templates/ssh-tunnel-sidecar.yaml`

**Acceptance Criteria:**

- [ ] `helm install agent-hub ./k8s/helm/agent-hub --values values-remote.yaml` works
- [ ] SSH tunnel runs as sidecar in same pod
- [ ] Backend connects to remote gateway successfully
- [ ] Pod restarts if tunnel fails health checks

---

### Task 2.4: Monitoring & Alerting ✅ TODO

**Goal:** Monitor SSH tunnel health and gateway connectivity

**Current State:**

- No monitoring for remote gateway connection
- No alerting on tunnel failures

**Action Items:**

- [ ] Add tunnel health check endpoint
- [ ] Create Prometheus metrics for tunnel status
- [ ] Add Grafana dashboard for remote mode
- [ ] Configure alerts for tunnel disconnection

**Files to Create:**

- `server/src/routes/health-remote.ts` (tunnel health)
- `monitoring/grafana-remote-mode-dashboard.json`
- `monitoring/alerts-remote-mode.yaml`

**Acceptance Criteria:**

- [ ] `/health/remote` endpoint shows tunnel status
- [ ] Metrics: `openclaw_tunnel_connected`, `openclaw_gateway_latency`
- [ ] Alert fires if tunnel disconnected > 1 minute
- [ ] Dashboard shows connection history

---

## Phase 3: Testing & Validation

### Task 3.1: Local Testing ✅ TODO

**Goal:** Test remote mode locally before production

**Action Items:**

- [ ] Setup local OpenClaw Gateway (second machine or VM)
- [ ] Configure SSH tunnel on development machine
- [ ] Run full E2E test suite with remote mode
- [ ] Document test results

**Test Cases:**

- [ ] Agent responses through remote gateway
- [ ] SSH tunnel reconnection after network blip
- [ ] Gateway restart recovery
- [ ] Multiple concurrent agent requests
- [ ] Long-running tunnel stability (24+ hours)

**Acceptance Criteria:**

- [ ] All 79 existing tests pass with remote mode
- [ ] No performance degradation vs local mode
- [ ] Tunnel recovers automatically from failures

---

### Task 3.2: Production Staging ✅ TODO

**Goal:** Deploy to staging environment with production-like setup

**Action Items:**

- [ ] Deploy OpenClaw Gateway to staging VPS
- [ ] Deploy Agent Hub backend to staging
- [ ] Configure SSH tunnel between them
- [ ] Run load testing

**Staging Environment:**

- OpenClaw Gateway: Hetzner VPS (4GB RAM, 2 vCPU)
- Agent Hub Backend: Local machine or second VPS
- SSH Tunnel: Persistent systemd service
- Load Testing: 100 concurrent users

**Acceptance Criteria:**

- [ ] 99.9% uptime over 7 days
- [ ] Agent response time < 30s p95
- [ ] Tunnel auto-recovers from network failures
- [ ] No memory leaks in long-running tunnel

---

### Task 3.3: Documentation Updates ✅ TODO

**Goal:** Ensure all documentation reflects remote mode

**Action Items:**

- [ ] Update README.md with remote mode section
- [ ] Create migration guide from local to remote
- [ ] Add troubleshooting section
- [ ] Record video walkthrough

**Files to Update:**

- `README.md`
- `docs/MILESTONES.md`
- `docs/PHASES.md`
- `docs/TROUBLESHOOTING-GUIDE.md`

**Files to Create:**

- `docs/MIGRATION-TO-REMOTE.md`
- `docs/REMOTE-MODE-TROUBLESHOOTING.md`

---

## Phase 4: Production Rollout

### Task 4.1: Gradual Rollout Plan ✅ TODO

**Goal:** Deploy remote mode to production with minimal risk

**Rollout Strategy:**

1. **Week 1:** Internal team only (dogfooding)
2. **Week 2:** Beta users (5-10 friendly users)
3. **Week 3:** General availability (all users)
4. **Week 4:** Deprecate local mode (optional)

**Rollback Plan:**

- Keep local mode as fallback for 30 days
- Document rollback procedure
- Monitor error rates closely

---

### Task 4.2: Production Monitoring ✅ TODO

**Goal:** Ensure production remote mode is monitored 24/7

**Action Items:**

- [ ] Setup PagerDuty alerts for tunnel failures
- [ ] Create runbook for tunnel issues
- [ ] Train support team on remote mode troubleshooting
- [ ] Document escalation procedures

---

## Risk Assessment

### Technical Risks

| Risk                               | Probability | Impact | Mitigation                                |
| ---------------------------------- | ----------- | ------ | ----------------------------------------- |
| SSH tunnel instability             | Low         | High   | Auto-reconnect, health checks, monitoring |
| Gateway performance degradation    | Low         | Medium | Load testing, staging validation          |
| Security vulnerabilities in tunnel | Low         | High   | SSH key hardening, regular audits         |
| Docker/K8s integration issues      | Medium      | Medium | Extensive testing, rollback plan          |

### Operational Risks

| Risk                               | Probability | Impact | Mitigation                                            |
| ---------------------------------- | ----------- | ------ | ----------------------------------------------------- |
| Users struggle with setup          | Medium      | Medium | Comprehensive docs, setup script, video tutorials     |
| Increased support tickets          | Medium      | Low    | Troubleshooting guide, support training               |
| Gateway downtime affects all users | Low         | High   | Gateway clustering (future), fast recovery procedures |

---

## Success Metrics

### Technical KPIs

- **Tunnel Uptime:** > 99.9% (measured weekly)
- **Agent Response Time:** < 30s p95 (same as local mode)
- **Tunnel Reconnection Time:** < 10s after network blip
- **Error Rate:** < 0.1% of agent requests fail due to tunnel

### User Experience KPIs

- **Setup Time:** < 10 minutes for new users
- **Support Tickets:** < 5% of users need support for remote mode
- **User Satisfaction:** > 4.5/5 stars in post-setup survey

---

## Timeline

### Phase 1: Foundation ✅ COMPLETE

- **Duration:** 1 day
- **Status:** ✅ Done (2026-04-04)
- **Deliverables:** Documentation, setup script, templates

### Phase 2: Code Implementation

- **Duration:** 3-5 days
- **Status:** 🔄 In Progress
- **Deliverables:** OpenClawService updates, Docker/K8s integration, monitoring

### Phase 3: Testing & Validation

- **Duration:** 5-7 days
- **Status:** ⏳ Pending
- **Deliverables:** Test results, staging deployment, updated docs

### Phase 4: Production Rollout

- **Duration:** 2-4 weeks
- **Status:** ⏳ Pending
- **Deliverables:** Gradual rollout, monitoring, support training

**Total Estimated Time:** 3-5 weeks to full production

---

## Resource Requirements

### Infrastructure

- **Staging VPS:** Hetzner or similar (€5-10/month)
- **Production VPS:** For OpenClaw Gateway (if not using existing)
- **Monitoring:** Grafana/Prometheus (existing or new setup)

### Human Resources

- **Developer:** 3-5 days for implementation
- **QA:** 2-3 days for testing
- **DevOps:** 1-2 days for K8s integration
- **Technical Writer:** 1 day for documentation review

---

## Next Steps (Immediate)

1. **Today:** Complete Task 2.1 (OpenClawService.ts verification)
2. **This Week:** Complete Task 2.2 (Docker integration)
3. **Next Week:** Begin Phase 3 (Testing & Validation)

---

## Appendix A: Related Documents

- [`docs/OPENCLAW-REMOTE-SETUP.md`](docs/OPENCLAW-REMOTE-SETUP.md) - Setup guide
- [`docs/OPENCLAW-DUAL-MODE-DESIGN.md`](docs/OPENCLAW-DUAL-MODE-DESIGN.md) - Technical design
- [`k8s/scripts/setup-openclaw-remote.sh`](k8s/scripts/setup-openclaw-remote.sh) - Setup script
- [OpenClaw Official Docs](https://docs.openclaw.ai/gateway/remote) - Reference

---

## Appendix B: Command Reference

### Quick Setup (Automated)

```bash
cd /home/jlguo/agent-hub/k8s/scripts
./setup-openclaw-remote.sh
```

### Manual Setup

```bash
# Install CLI
npm install -g openclaw@latest

# Configure remote mode
openclaw config set gateway.mode remote
openclaw config set gateway.remote.url ws://127.0.0.1:18789
openclaw config set gateway.remote.token YOUR_TOKEN

# Start SSH tunnel
ssh -N -L 18789:127.0.0.1:18789 user@remote-host

# Test connection
openclaw health
openclaw agent --message "test" --agent "family-mom"
```

### Docker Deployment

```bash
docker-compose -f docker-compose.remote.yml up -d
```

### Kubernetes Deployment

```bash
helm install agent-hub ./k8s/helm/agent-hub \
  --values values-remote.yaml \
  --namespace agent-hub \
  --create-namespace
```

---

**Document Owner:** Agent Hub Development Team  
**Review Cycle:** Weekly during implementation  
**Last Review:** 2026-04-04
