# VERDICT — Docker Setup & Container Runbook

**Project:** VERDICT — Geo-Distributed Disaster Data Replication with Graceful Degradation  
**Tool:** Docker Compose v2 / Docker v20+  
**Architecture:** 4 Isolated Containers (`verdict-web`, `verdict-mumbai`, `verdict-delhi`, `verdict-bengaluru`)  

---

## 1. Quick Start

### Build and Launch the Entire Stack
From the repository root:

```bash
docker compose up --build -d
```

### Check Container Status & Health
```bash
docker compose ps
```

Expected output:
```text
NAME                IMAGE                  STATUS                    PORTS
verdict-mumbai      verdict-mumbai:latest  Up (healthy)              0.0.0.0:4001->4001/tcp
verdict-delhi       verdict-delhi:latest   Up (healthy)              0.0.0.0:4002->4002/tcp
verdict-bengaluru   verdict-blr:latest     Up (healthy)              0.0.0.0:4003->4003/tcp
verdict-web         verdict-web:latest     Up                        0.0.0.0:3000->3000/tcp
```

Open the web dashboard:
👉 **`http://localhost:3000`**

---

## 2. Container Network & Host Mapping

| Container Name | Internal Port | Host Port | Internal Network DNS Hostname | Persistent Volume |
| :--- | :--- | :--- | :--- | :--- |
| **`verdict-web`** | 3000 | **`3000`** | `verdict-web` | N/A (Stateless UI) |
| **`verdict-mumbai`** | 4001 | **`4001`** | `verdict-mumbai` | `mumbai_data:/app/data` |
| **`verdict-delhi`** | 4002 | **`4002`** | `verdict-delhi` | `delhi_data:/app/data` |
| **`verdict-bengaluru`** | 4003 | **`4003`** | `verdict-bengaluru` | `bengaluru_data:/app/data` |

---

## 3. Persistent Volumes: `down` vs `down -v`

VERDICT gives each region an isolated, independent named volume so that restarting a container does not destroy its local database.

### Safe Normal Shutdown (Preserves Persisted Data)
```bash
docker compose down
```
*Stops and removes containers, but keeps all named volumes (`mumbai_data`, `delhi_data`, `bengaluru_data`) intact. When you run `docker compose up`, all previously committed operations are reloaded from disk.*

### Destructive Volume Reset (Deletes All Data)
```bash
docker compose down -v
```
> [!WARNING]
> The `-v` flag deletes all named persistent volumes! Only use this if you explicitly intend to purge all demo data and reset to initial state.

---

## 4. Viewing Logs

### View Consolidated Cluster Logs
```bash
docker compose logs -f
```

### View Individual Regional Node Logs
```bash
docker compose logs -f verdict-mumbai
docker compose logs -f verdict-delhi
docker compose logs -f verdict-bengaluru
docker compose logs -f verdict-web
```

---

## 5. Verifying Inter-Container Replication

To verify that the regional containers are replicating over Docker's bridge network (`verdict-net`):

```bash
# Query health of Mumbai from host:
curl http://localhost:4001/api/v1/status

# Submit test report to Mumbai container:
curl -X POST http://localhost:4001/api/v1/reports \
  -H "Content-Type: application/json" \
  -d '{"entityId":"corridor-docker","entityType":"road","field":"status","newValue":"OPEN","authorRole":"FIELD_OFFICER"}'

# Verify that Delhi received the replicated operation over internal Docker DNS:
curl http://localhost:4002/api/v1/records/corridor-docker
```
