# VERDICT — Network Failure & Partition Demonstration

**Project:** VERDICT — Geo-Distributed Disaster Data Replication with Graceful Degradation  
**Scope:** Controlled, Non-Destructive Partition Simulation (No OS iptables disruption)  

---

## 1. Principles of the Partition Simulation

To guarantee safety during hackathon demonstrations, VERDICT simulates physical fiber cuts at the **application transport layer** (`LinkController` in `packages/region-service/src/network/link-controller.ts`).

- Does **not** alter host network cards or kernel iptables rules.
- Suppresses P2P HTTP synchronization calls between selected regions.
- Regional processes remain alive and fully responsive to local clients.
- Outbox priority queues automatically buffer pending replication payloads until link restoration.

---

## 2. Interactive Failure Demo (Web UI Method)

The simplest and most visual method is using the **Recovery & Sync** tab in the web dashboard:

1. Navigate to **`http://localhost:3000`** and click the **Recovery & Sync** tab.
2. Under **"Guided Demonstration Sequence"**, click **"2. Cut Network Link"**.
3. **Observation:**
   - The large network banner turns amber: `NETWORK PARTITION ACTIVE`.
   - Node status indicators show `L1_DEGRADED`.
4. Click **"3. Local Write in Partition"**.
   - **Observation:** Mumbai commits the operation locally to `data/mumbai.db.json` and increments its outbox count.
5. Click **"4. Restore Link"** $\to$ **"5. Sync & Verify"**.
   - **Observation:** Replication resumes, outbox drains to 0, and the status returns to green `ALL LINKS ACTIVE`.

---

## 3. Terminal / CLI Failure Demo (API Method)

You can also trigger partitions programmatically via HTTP requests from PowerShell or Bash:

### Step 1: Check Baseline Health
```bash
curl http://localhost:4001/api/v1/status
```

### Step 2: Sever Link Between Mumbai and Delhi
```bash
curl -X POST http://localhost:4001/admin/link \
  -H "Content-Type: application/json" \
  -d '{"from":"mumbai","to":"delhi","up":false}'
```
*Mumbai immediately stops transmitting outbox items to Delhi and marks Delhi as unreachable.*

### Step 3: Perform Local Operation in Mumbai
```bash
curl -X POST http://localhost:4001/api/v1/reports \
  -H "Content-Type: application/json" \
  -d '{"entityId":"road-isolated-test","entityType":"road","field":"status","newValue":"BLOCKED","authorRole":"FIELD_OFFICER"}'
```
*Returns HTTP 200 with committed `clientTxId`. Operation is saved to Mumbai's disk.*

### Step 4: Verify Delhi Has NOT Received the Write Yet
```bash
curl http://localhost:4002/api/v1/records/road-isolated-test
```
*Returns 404 / null because the network partition prevented premature replication.*

### Step 5: Restore the Link
```bash
curl -X POST http://localhost:4001/admin/link \
  -H "Content-Type: application/json" \
  -d '{"from":"mumbai","to":"delhi","up":true}'
```
*The background heartbeat worker flushes the outbox in priority order.*

### Step 6: Verify Convergence Across Both Nodes
```bash
# Query Delhi - it now holds the synced record:
curl http://localhost:4002/api/v1/records/road-isolated-test

# Compare canonical state hashes:
curl http://localhost:4001/api/v1/convergence
```
*Canonical state hashes match bit-for-bit across both regions.*
