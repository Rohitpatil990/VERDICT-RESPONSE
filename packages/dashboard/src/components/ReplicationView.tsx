import React, { useState } from 'react';
import { 
  Server, 
  GitBranch, 
  Wifi, 
  RefreshCw, 
  CheckCircle2, 
  AlertTriangle, 
  Unplug, 
  Radio, 
  Database,
  ArrowRight
} from 'lucide-react';
import { ApiClient } from '../api.js';

interface ReplicationViewProps {
  currentRegion: any;
  regionStatus: any;
  onRefresh: () => void;
}

export const ReplicationView: React.FC<ReplicationViewProps> = ({
  currentRegion,
  regionStatus,
  onRefresh
}) => {
  const [acting, setActing] = useState(false);
  const [syncStatusMsg, setSyncStatusMsg] = useState<string | null>(null);

  const links = regionStatus?.linkState || {};

  const handleToggleLink = async (r1: any, r2: any, isCurrentlyCut: boolean) => {
    setActing(true);
    try {
      if (isCurrentlyCut) {
        await ApiClient.adminLink(r1, 'restore', r2);
        setSyncStatusMsg(`Restored ${r1.toUpperCase()} ↔ ${r2.toUpperCase()}. Delta anti-entropy exchange initiated.`);
      } else {
        await ApiClient.adminLink(r1, 'cut', r2);
        setSyncStatusMsg(`Severed link ${r1.toUpperCase()} ↔ ${r2.toUpperCase()}. Network partition active (AP mode).`);
      }
      onRefresh();
    } catch (err: any) {
      alert(`Link toggle failed: ${err.message}`);
    } finally {
      setActing(false);
    }
  };

  const handleManualSync = async () => {
    setActing(true);
    try {
      await ApiClient.adminSync(currentRegion);
      setSyncStatusMsg(`Completed anti-entropy synchronization cycle on ${currentRegion.toUpperCase()}.`);
      onRefresh();
    } catch (err: any) {
      alert(`Sync error: ${err.message}`);
    } finally {
      setActing(false);
    }
  };

  return (
    <div className="h-full flex flex-col p-5 space-y-5 overflow-y-auto">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E2E8F0] pb-3">
        <div>
          <h2 className="text-base font-bold text-[#172033]">Geo-Distributed Replication Mesh</h2>
          <p className="text-xs text-[#64748B] mt-0.5">
            Three independent regional stores operating signed operation anti-entropy replication across priority lanes.
          </p>
        </div>

        <button
          onClick={handleManualSync}
          disabled={acting}
          className="bg-[#FFFFFF] hover:bg-[#F8FAFC] border border-[#E2E8F0] text-[#172033] text-xs font-semibold px-3 py-1.5 rounded-md shadow-2xs flex items-center gap-1.5 transition-colors disabled:opacity-50"
        >
          <RefreshCw size={13} className={acting ? 'animate-spin text-[#2563EB]' : 'text-[#64748B]'} />
          <span>Trigger Anti-Entropy Sync</span>
        </button>
      </div>

      {syncStatusMsg && (
        <div className="bg-[#EFF6FF] border border-blue-200 text-[#1D4ED8] text-xs px-3.5 py-2 rounded-lg flex items-center justify-between shadow-2xs">
          <span>{syncStatusMsg}</span>
          <button onClick={() => setSyncStatusMsg(null)} className="text-blue-500 font-bold ml-2">✕</button>
        </div>
      )}

      {/* 1. Regional Nodes Table */}
      <div className="bg-[#FFFFFF] border border-[#E2E8F0] rounded-lg shadow-2xs overflow-hidden">
        <div className="px-4 py-3 border-b border-[#E2E8F0] flex items-center justify-between bg-[#F8FAFC]">
          <div className="flex items-center gap-2">
            <Server size={15} className="text-[#2563EB]" />
            <h3 className="text-xs font-bold text-[#172033] uppercase tracking-wide">Regional Node Instances</h3>
          </div>
          <span className="text-[11px] text-[#64748B]">Independent SQLite Engines (`node:sqlite`)</span>
        </div>

        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-[#E2E8F0] text-[11px] text-[#64748B] font-semibold bg-[#FFFFFF]">
              <th className="py-2.5 px-3">Region Hub</th>
              <th className="py-2.5 px-3">Service Endpoint</th>
              <th className="py-2.5 px-3">Local Database File</th>
              <th className="py-2.5 px-3">Status</th>
              <th className="py-2.5 px-3">Active Role</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E2E8F0]">
            {[
              { id: 'mumbai', port: 4001, db: 'data/mumbai.db', desc: 'West India Primary Hub' },
              { id: 'delhi', port: 4002, db: 'data/delhi.db', desc: 'North India Command Hub' },
              { id: 'bengaluru', port: 4003, db: 'data/bengaluru.db', desc: 'South India Logistics Depot' }
            ].map(node => {
              const isCurrent = currentRegion === node.id;
              return (
                <tr key={node.id} className={isCurrent ? 'bg-[#EFF6FF]' : 'hover:bg-[#F8FAFC]'}>
                  <td className="py-3 px-3">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-[#15803D]" />
                      <strong className="uppercase text-xs text-[#172033]">{node.id}</strong>
                      <span className="text-[10px] text-[#64748B]">({node.desc})</span>
                    </div>
                  </td>
                  <td className="py-3 px-3 font-mono text-[11px] text-[#2563EB]">
                    http://localhost:{node.port}
                  </td>
                  <td className="py-3 px-3 font-mono text-[11px] text-[#475569]">
                    <span className="flex items-center gap-1">
                      <Database size={12} className="text-[#64748B]" />
                      {node.db}
                    </span>
                  </td>
                  <td className="py-3 px-3">
                    <span className="text-[11px] font-semibold text-[#15803D] bg-green-50 border border-green-200 px-2 py-0.5 rounded">
                      HTTP 200 OK
                    </span>
                  </td>
                  <td className="py-3 px-3">
                    {isCurrent ? (
                      <span className="text-[11px] font-bold text-[#2563EB] bg-blue-50 border border-blue-200 px-2 py-0.5 rounded">
                        Active Viewing Node
                      </span>
                    ) : (
                      <span className="text-[11px] text-[#64748B]">Peer Replica</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* 2. Inter-Region Link Matrix & Partition Simulation */}
      <div className="bg-[#FFFFFF] border border-[#E2E8F0] rounded-lg p-4 shadow-2xs space-y-3">
        <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-2.5">
          <div className="flex items-center gap-2">
            <Wifi size={15} className="text-[#2563EB]" />
            <h3 className="text-xs font-bold text-[#172033] uppercase tracking-wide">
              Network Links & Partition Injection
            </h3>
          </div>
          <span className="text-[11px] text-[#64748B]">Undersea/Fiber Link Simulation via LinkController</span>
        </div>

        <p className="text-xs text-[#64748B]">
          Simulate extended fiber cuts or undersea cable severing between regional command hubs. Observe that disconnected regions continue writing locally without waiting for consensus.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
          {[
            { r1: 'mumbai', r2: 'delhi', title: 'Mumbai ↔ Delhi' },
            { r1: 'mumbai', r2: 'bengaluru', title: 'Mumbai ↔ Bengaluru' },
            { r1: 'delhi', r2: 'bengaluru', title: 'Delhi ↔ Bengaluru' }
          ].map(pair => {
            const key = [pair.r1, pair.r2].sort().join('<->');
            const link = links[key];
            const isCut = link?.status === 'DISCONNECTED';

            return (
              <div 
                key={key}
                className={`p-3.5 rounded-lg border flex flex-col justify-between space-y-3 transition-all ${
                  isCut 
                    ? 'bg-red-50/60 border-red-200' 
                    : 'bg-[#F8FAFC] border-[#E2E8F0]'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[#172033]">{pair.title}</span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase border ${
                      isCut ? 'bg-red-100 text-red-700 border-red-300' : 'bg-green-100 text-green-700 border-green-300'
                    }`}>
                      {isCut ? 'PARTITIONED' : 'CONNECTED'}
                    </span>
                  </div>

                  <div className="text-[11px] text-[#64748B] mt-1 space-y-0.5">
                    <div>Latency: <strong className="text-[#172033] font-mono">{link?.latencyMs || 35} ms</strong></div>
                    <div>Bandwidth: <strong className="text-[#172033]">Unlimited (No throttle)</strong></div>
                  </div>
                </div>

                <button
                  onClick={() => handleToggleLink(pair.r1, pair.r2, isCut)}
                  disabled={acting}
                  className={`w-full py-1.5 px-3 rounded text-xs font-semibold border transition-colors flex items-center justify-center gap-1.5 ${
                    isCut
                      ? 'bg-[#FFFFFF] hover:bg-[#F1F5F9] text-[#15803D] border-[#15803D]'
                      : 'bg-[#FFFFFF] hover:bg-red-50 text-[#B91C1C] border-[#B91C1C]'
                  }`}
                >
                  <Unplug size={12} />
                  <span>{isCut ? 'Restore Connection' : 'Simulate Sever Link'}</span>
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* 3. Replication Protocol & Version Vectors Details */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-[#FFFFFF] border border-[#E2E8F0] rounded-lg p-4 shadow-2xs space-y-2">
          <h4 className="text-xs font-bold text-[#172033] uppercase">Active Vector Clocks</h4>
          <p className="text-xs text-[#64748B]">
            Tracks highest monotonically incrementing operation sequence received from each regional cluster node:
          </p>
          <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded p-2.5 font-mono text-xs text-[#2563EB]">
            {JSON.stringify(regionStatus?.versionVector || { mumbai: 0, delhi: 0, bengaluru: 0 }, null, 2)}
          </div>
        </div>

        <div className="bg-[#FFFFFF] border border-[#E2E8F0] rounded-lg p-4 shadow-2xs space-y-2">
          <h4 className="text-xs font-bold text-[#172033] uppercase">Replication Behavior Guardrails</h4>
          <ul className="text-xs text-[#475569] space-y-1.5 list-disc pl-4">
            <li><strong>During Partition:</strong> Writes immediately saved locally as <em>Tentative</em> into SQLite outbox (`ackState.stage: 'region'`). Zero network wait.</li>
            <li><strong>Upon Reconnection:</strong> Nodes query peer vector clocks and pull only missing delta operations.</li>
            <li><strong>Idempotence:</strong> Duplicate deliveries handled safely via `INSERT OR IGNORE` on cryptographic opId.</li>
          </ul>
        </div>
      </div>
    </div>
  );
};
