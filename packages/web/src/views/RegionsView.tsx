import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api, Region } from '../api/client.js';
import {
  Server,
  Wifi,
  WifiOff,
  Sliders,
  RefreshCw,
  GitPullRequest,
  CheckCircle,
  Activity
} from 'lucide-react';

interface RegionsViewProps {
  viewingRegion: Region;
}

export const RegionsView: React.FC<RegionsViewProps> = ({ viewingRegion }) => {
  const { t } = useTranslation();
  const [statusData, setStatusData] = useState<any | null>(null);
  const [links, setLinks] = useState<any[]>([]);
  const [bandwidthCap, setBandwidthCap] = useState(false);
  const [latencyVal, setLatencyVal] = useState(15);

  const loadStatus = async () => {
    try {
      const st = await api.getStatus(viewingRegion);
      setStatusData(st);
      const mapRes = await api.getMap(viewingRegion);
      setLinks(mapRes.links || []);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    loadStatus();
    const interval = setInterval(loadStatus, 2000);
    return () => clearInterval(interval);
  }, [viewingRegion]);

  const togglePartition = async (target: Region, currentUp: boolean) => {
    try {
      await api.alterLink(
        viewingRegion,
        target,
        !currentUp,
        bandwidthCap ? 10240 : null,
        latencyVal,
        viewingRegion
      );
      loadStatus();
    } catch (err) {
      console.error(err);
    }
  };

  const handleReconnectWithBandwidthCap = async (target: Region) => {
    try {
      // Reconnect with 10 KB/s bandwidth cap for demonstration
      await api.alterLink(viewingRegion, target, true, 10240, 50, viewingRegion);
      loadStatus();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="h-full flex overflow-hidden">
      {/* Regions Status Cards */}
      <div className="w-[50%] border-r border-border bg-surface p-6 overflow-y-auto space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold uppercase tracking-wider text-tealVerdict">
              Regional Topology & Sync Engine
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Multi-process node replicas with isolated local persistence and version vectors.
            </p>
          </div>
          <button
            onClick={loadStatus}
            className="p-1.5 text-slate-400 hover:text-slate-100 hover:bg-slate-800 rounded transition"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        {/* Local Node Health */}
        {statusData && (
          <div className="p-4 bg-background border border-border rounded-lg space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Server className="w-4 h-4 text-tealVerdict" />
                <span className="font-bold text-xs text-slate-200">
                  Node [{statusData.region?.toUpperCase()}] (Local Instance)
                </span>
              </div>
              <span className="text-[10px] font-mono px-2 py-0.5 bg-tealVerdict/10 text-tealVerdict rounded font-bold">
                {statusData.degradationLevel}
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2 text-xs">
              <div className="p-2 bg-slate-900 rounded border border-slate-800">
                <span className="text-[10px] text-slate-400 uppercase">Port</span>
                <div className="font-mono text-slate-200 font-bold">{statusData.port}</div>
              </div>
              <div className="p-2 bg-slate-900 rounded border border-slate-800">
                <span className="text-[10px] text-slate-400 uppercase">Outbox Depth</span>
                <div className="font-mono text-slate-200 font-bold">{statusData.outboxPending}</div>
              </div>
              <div className="p-2 bg-slate-900 rounded border border-slate-800">
                <span className="text-[10px] text-slate-400 uppercase">Conflicts</span>
                <div className="font-mono text-roseVerdict font-bold">
                  {statusData.conflictCount}
                </div>
              </div>
            </div>

            <div className="space-y-1">
              <span className="text-[11px] text-slate-400 uppercase font-semibold">
                Version Vector:
              </span>
              <div className="p-2 bg-slate-900 rounded border border-slate-800 font-mono text-xs text-tealVerdict">
                {JSON.stringify(statusData.versionVector)}
              </div>
            </div>
          </div>
        )}

        {/* Peer Nodes */}
        <div className="space-y-3">
          <h3 className="text-xs font-bold uppercase text-slate-300 tracking-wider">
            Replication Peers
          </h3>
          {statusData?.peers?.map((p: any) => {
            const link = links.find(
              l => (l.from === viewingRegion && l.to === p.region) || (l.to === viewingRegion && l.from === p.region)
            );
            const isUp = link ? link.up : p.reachable;

            return (
              <div
                key={p.region}
                className="p-4 bg-background border border-border rounded-lg space-y-3"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span
                      className={`w-2.5 h-2.5 rounded-full ${
                        isUp ? 'bg-tealVerdict animate-pulse' : 'bg-roseVerdict'
                      }`}
                    />
                    <span className="text-xs font-bold text-slate-200 uppercase">
                      Peer: {p.region}
                    </span>
                  </div>

                  <span
                    className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold ${
                      isUp ? 'bg-tealVerdict/10 text-tealVerdict' : 'bg-roseVerdict/10 text-roseVerdict'
                    }`}
                  >
                    {isUp ? 'CONNECTED' : 'PARTITIONED'}
                  </span>
                </div>

                <div className="text-xs text-slate-400 flex justify-between">
                  <span>Last Contact: {new Date(p.lastContactAt).toLocaleTimeString()}</span>
                  <span className="font-mono">Last Known Seq: {p.lastKnownSeq}</span>
                </div>

                {/* Quick partition toggle */}
                <div className="flex gap-2 pt-1">
                  <button
                    onClick={() => togglePartition(p.region, isUp)}
                    className={`flex-1 py-1.5 rounded text-xs font-semibold flex items-center justify-center gap-1.5 transition ${
                      isUp
                        ? 'bg-roseVerdict/15 border border-roseVerdict text-roseVerdict hover:bg-roseVerdict/25'
                        : 'bg-tealVerdict text-slate-900 font-bold hover:bg-teal-400'
                    }`}
                  >
                    {isUp ? (
                      <>
                        <WifiOff className="w-3.5 h-3.5" /> Cut Link ({p.region.toUpperCase()})
                      </>
                    ) : (
                      <>
                        <Wifi className="w-3.5 h-3.5" /> Restore Link
                      </>
                    )}
                  </button>

                  {!isUp && (
                    <button
                      onClick={() => handleReconnectWithBandwidthCap(p.region)}
                      className="px-3 py-1.5 bg-amberVerdict/15 border border-amberVerdict text-amberVerdict hover:bg-amberVerdict/25 rounded text-xs font-semibold flex items-center gap-1"
                    >
                      Reconnect (10 KB/s Cap)
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Network Link Controller Controls */}
      <div className="flex-1 p-6 overflow-y-auto space-y-6">
        <div className="bg-surface border border-border rounded-lg p-5 space-y-4">
          <h3 className="text-xs font-bold uppercase text-slate-300 tracking-wider flex items-center gap-2">
            <Sliders className="w-4 h-4 text-purpleVerdict" />
            In-Process Network Link Controller
          </h3>
          <p className="text-xs text-slate-400 leading-relaxed">
            Deterministic inter-region link gate. Simulates physical fiber cuts, latency degradation,
            and low-bandwidth disaster recovery without external network daemons.
          </p>

          <div className="space-y-3 pt-2">
            <div>
              <div className="flex justify-between text-xs text-slate-300 mb-1">
                <span>Simulated Round-Trip Latency:</span>
                <span className="font-mono text-tealVerdict">{latencyVal} ms</span>
              </div>
              <input
                type="range"
                min={5}
                max={1500}
                value={latencyVal}
                onChange={e => setLatencyVal(parseInt(e.target.value, 10))}
                className="w-full accent-tealVerdict"
              />
            </div>

            <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer pt-2">
              <input
                type="checkbox"
                checked={bandwidthCap}
                onChange={e => setBandwidthCap(e.target.checked)}
                className="accent-tealVerdict"
              />
              <span>Throttle reconnection bandwidth to 10 KB/s (tests priority lanes)</span>
            </label>
          </div>
        </div>

        {/* Priority Lanes Display */}
        <div className="bg-surface border border-border rounded-lg p-5 space-y-3">
          <h3 className="text-xs font-bold uppercase text-slate-300 tracking-wider">
            Replication Priority Lanes
          </h3>
          <div className="space-y-2 text-xs">
            <div className="p-2.5 bg-background border border-border rounded flex justify-between items-center">
              <span className="font-semibold text-roseVerdict">L0: Control & Heartbeats</span>
              <span className="text-slate-400 text-[11px]">Strict precedence</span>
            </div>
            <div className="p-2.5 bg-background border border-border rounded flex justify-between items-center">
              <span className="font-semibold text-amberVerdict">
                L1: Critical Operations (Decisions, Medical/Stranded, Conflicts)
              </span>
              <span className="text-slate-400 text-[11px]">Syncs first on heal</span>
            </div>
            <div className="p-2.5 bg-background border border-border rounded flex justify-between items-center">
              <span className="font-semibold text-tealVerdict">L2: Normal Operations (General Reports, Notes)</span>
              <span className="text-slate-400 text-[11px]">Adaptive batching</span>
            </div>
            <div className="p-2.5 bg-background border border-border rounded flex justify-between items-center">
              <span className="font-semibold text-slate-400">L3: Blobs & Evidence</span>
              <span className="text-slate-400 text-[11px]">Deferred backfill</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
