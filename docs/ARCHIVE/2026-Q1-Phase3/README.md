# Remote Mode Monitoring Guide

**Complete monitoring stack for Agent Hub remote mode deployments with Prometheus metrics, Grafana dashboards, and alerting.**

---

## Architecture

```
┌─────────────────────┐
│  Agent Hub Backend  │
│  (with metrics)     │
└──────────┬──────────┘
           │
           │ /metrics
           ↓
┌─────────────────────┐
│  Prometheus         │
│  - Scrape metrics   │
│  - Store time-series│
└──────────┬──────────┘
           │
           ├──────────────┐
           │              │
           ↓              ↓
┌─────────────────┐ ┌──────────────┐
│  Grafana        │ │  Alertmanager│
│  - Dashboards   │ │  - Alerts    │
│  - Visualization│ │  - Notify    │
└─────────────────┘ └──────────────┘
```

---

## Quick Start (15 minutes)

### Step 1: Enable Metrics Endpoint

Metrics are automatically available at:

```
http://localhost:4000/metrics
http://localhost:4000/metrics/remote-mode
```

### Step 2: Configure Prometheus

Add to `prometheus.yml`:

```yaml
scrape_configs:
  - job_name: 'agent-hub-remote'
    static_configs:
      - targets: ['backend:4000']
    metrics_path: '/metrics/remote-mode'
    scrape_interval: 30s
```

### Step 3: Import Alert Rules

```bash
# Copy alert rules to Prometheus
cp monitoring/prometheus-alerts-remote-mode.yaml /etc/prometheus/rules/

# Reload Prometheus
curl -X POST http://prometheus:9090/-/reload
```

### Step 4: Import Grafana Dashboard

```bash
# Via Grafana UI:
# 1. Go to Dashboards → Import
# 2. Upload: monitoring/grafana-dashboard-remote-mode.json
# 3. Select Prometheus data source
# 4. Click Import

# Via API:
curl -X POST \
  -H "Content-Type: application/json" \
  -d @monitoring/grafana-dashboard-remote-mode.json \
  http://admin:admin@grafana:3000/api/dashboards/db
```

### Step 5: Configure Alerts

Add to `alertmanager.yml`:

```yaml
route:
  receiver: 'slack-notifications'
  group_by: ['alertname']
  group_wait: 30s
  group_interval: 5m
  repeat_interval: 4h

receivers:
  - name: 'slack-notifications'
    slack_configs:
      - api_url: 'YOUR_SLACK_WEBHOOK_URL'
        channel: '#alerts'
        send_resolved: true
```

---

## Metrics Reference

### SSH Tunnel Metrics

| Metric                                 | Type      | Description                                     | Labels       |
| -------------------------------------- | --------- | ----------------------------------------------- | ------------ |
| `openclaw_ssh_tunnel_connected`        | Gauge     | SSH tunnel status (1=connected, 0=disconnected) | host, user   |
| `openclaw_ssh_tunnel_uptime_seconds`   | Gauge     | Time since tunnel connected                     | host         |
| `openclaw_ssh_tunnel_reconnects_total` | Counter   | Total reconnections                             | host, reason |
| `openclaw_ssh_tunnel_latency_seconds`  | Histogram | Tunnel round-trip latency                       | host         |

### OpenClaw Gateway Metrics

| Metric                                     | Type      | Description           | Labels                   |
| ------------------------------------------ | --------- | --------------------- | ------------------------ |
| `openclaw_gateway_health`                  | Gauge     | Gateway health status | mode, gateway_url        |
| `openclaw_agent_response_duration_seconds` | Histogram | Agent response time   | agent_name, mode         |
| `openclaw_agent_requests_total`            | Counter   | Total agent requests  | agent_name, status, mode |

### Health Check Metrics

| Metric                                            | Type    | Description            | Labels                |
| ------------------------------------------------- | ------- | ---------------------- | --------------------- |
| `openclaw_health_check_failures_total`            | Counter | Health check failures  | component, check_type |
| `openclaw_last_successful_health_check_timestamp` | Gauge   | Last success timestamp | component             |

---

## Dashboards

### Main Dashboard Panels

1. **SSH Tunnel Status** - Real-time connection status
2. **OpenClaw Gateway Health** - Gateway health indicator
3. **Agent Response Time (p95)** - 95th percentile response time
4. **Tunnel Uptime** - Time since last connection
5. **SSH Tunnel Latency** - p50, p95, p99 latency over time
6. **Agent Response Time** - Response time by agent
7. **Agent Requests per Second** - Request rate by agent
8. **Agent Request Failures** - Failure rate by agent
9. **Health Check Status** - Last successful check per component
10. **Tunnel Reconnections** - Reconnection count (1h)
11. **Health Check Failures** - Failure count (1h)
12. **System Uptime** - Backend uptime

---

## Alert Rules

### Critical Alerts

| Alert                             | Condition           | Duration | Severity |
| --------------------------------- | ------------------- | -------- | -------- |
| SSHTunnelDown                     | Tunnel disconnected | 1m       | Critical |
| OpenClawGatewayUnhealthy          | Gateway unhealthy   | 2m       | Critical |
| OpenClawAgentResponseTimeVeryHigh | p95 > 120s          | 5m       | Critical |
| BackendPodDown                    | Pod in Failed state | 2m       | Critical |

### Warning Alerts

| Alert                               | Condition           | Duration | Severity |
| ----------------------------------- | ------------------- | -------- | -------- |
| SSHTunnelFrequentReconnects         | > 3 reconnects/hour | 5m       | Warning  |
| OpenClawAgentResponseTimeHigh       | p95 > 60s           | 10m      | Warning  |
| OpenClawAgentRequestFailureRateHigh | > 10% failures      | 5m       | Warning  |
| SSHTunnelLatencyHigh                | p95 > 1s            | 10m      | Warning  |
| HealthCheckFailures                 | > 0.1 failures/s    | 5m       | Warning  |
| BackendPodRestarting                | > 2 restarts/hour   | 30m      | Warning  |

### Info Alerts

| Alert                            | Condition             | Duration | Severity |
| -------------------------------- | --------------------- | -------- | -------- |
| LastHealthCheckOld               | No check for 5m       | 1m       | Info     |
| SSHTunnelCertificateExpiringSoon | Cert expires < 7 days | 1h       | Info     |

---

## Troubleshooting

### Metrics Not Showing

**Symptom:** Prometheus shows "No data"

```bash
# Check if metrics endpoint is accessible
curl http://backend:4000/metrics/remote-mode

# Check Prometheus targets
curl http://prometheus:9090/api/v1/targets

# Verify scrape config
promtool check config /etc/prometheus/prometheus.yml
```

### Alerts Not Firing

**Symptom:** Alerts configured but not triggering

```bash
# Check alertmanager status
curl http://alertmanager:9093/api/v1/status

# Check pending alerts
curl http://prometheus:9090/api/v1/rules

# Verify alert rules
promtool check rules /etc/prometheus/rules/remote-mode-alerts.yaml
```

### Grafana Dashboard Not Loading

**Symptom:** Dashboard shows "Template variable not found"

```bash
# Check Prometheus data source in Grafana
# Go to Configuration → Data Sources → Prometheus
# Ensure URL is correct (http://prometheus:9090)

# Re-import dashboard with correct data source
```

---

## Advanced Configuration

### Custom Alert Thresholds

Edit `monitoring/prometheus-alerts-remote-mode.yaml`:

```yaml
# Change response time threshold from 60s to 90s
- alert: OpenClawAgentResponseTimeHigh
  expr: histogram_quantile(0.95, rate(openclaw_agent_response_duration_seconds_bucket[5m])) > 90
  for: 10m
```

### Add Custom Metrics

In your code:

```typescript
import { remoteModeRegistry } from './metrics/remote-mode-metrics';

const customMetric = new Gauge({
  name: 'custom_metric_name',
  help: 'Description of metric',
  registers: [remoteModeRegistry],
});
```

### Multi-Cluster Monitoring

For multiple Agent Hub deployments:

```yaml
# prometheus.yml
scrape_configs:
  - job_name: 'agent-hub-remote-prod'
    static_configs:
      - targets: ['prod-backend:4000']
    metrics_path: '/metrics/remote-mode'
    honor_labels: true
    relabel_configs:
      - target_label: environment
        replacement: production

  - job_name: 'agent-hub-remote-staging'
    static_configs:
      - targets: ['staging-backend:4000']
    metrics_path: '/metrics/remote-mode'
    honor_labels: true
    relabel_configs:
      - target_label: environment
        replacement: staging
```

---

## Kubernetes Integration

### ServiceMonitor (Prometheus Operator)

If using Prometheus Operator:

```yaml
apiVersion: monitoring.coreos.com/v1
kind: ServiceMonitor
metadata:
  name: agent-hub-remote
  namespace: agent-hub
spec:
  selector:
    matchLabels:
      app: backend
  endpoints:
    - port: http
      path: /metrics/remote-mode
      interval: 30s
```

### PodMonitor Alternative

```yaml
apiVersion: monitoring.coreos.com/v1
kind: PodMonitor
metadata:
  name: agent-hub-remote
  namespace: agent-hub
spec:
  selector:
    matchLabels:
      app: backend
  podMetricsEndpoints:
    - port: http
      path: /metrics/remote-mode
      interval: 30s
```

---

## Best Practices

1. **Scrape Interval**: 30s recommended for remote mode
2. **Retention**: Keep metrics for at least 30 days
3. **Alert Routing**: Route critical alerts to PagerDuty, warnings to Slack
4. **Dashboard Refresh**: Set to 30s for near real-time monitoring
5. **Metric Cardinality**: Use labels sparingly to avoid high cardinality
6. **Health Check Frequency**: Match scrape interval (30s)

---

## Testing

### Test Metrics Endpoint

```bash
# Verify metrics are exposed
curl http://localhost:4000/metrics/remote-mode | grep openclaw

# Expected output:
# # HELP openclaw_ssh_tunnel_connected SSH tunnel connection status
# # TYPE openclaw_ssh_tunnel_connected gauge
# openclaw_ssh_tunnel_connected{host="...",user="..."} 1
```

### Test Alerts

```bash
# Simulate tunnel disconnection (for testing)
# This will trigger SSHTunnelDown alert after 1m

# Check alert status in Prometheus
curl http://prometheus:9090/api/v1/rules | jq

# Check pending alerts
curl http://prometheus:9090/api/v1/alerts
```

### Test Dashboard

1. Open Grafana dashboard
2. Change time range to "Last 15 minutes"
3. Verify all panels show data
4. Test template variables (host, agent_name)

---

## References

- [Prometheus Documentation](https://prometheus.io/docs/)
- [Grafana Documentation](https://grafana.com/docs/)
- [Alertmanager Documentation](https://prometheus.io/docs/alerting/alertmanager/)
- [prom-client (Node.js)](https://github.com/siimon/prom-client)
- [Remote Mode Setup](../k8s/README-REMOTE.md)

---

**Last Updated:** 2026-04-06  
**Status:** Production Ready
