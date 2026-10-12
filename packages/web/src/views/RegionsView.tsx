import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api, Region } from '../api/client.js';
import {
  Server,
  Wifi,
  WifiOff,
  Sliders,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  AlertTriangle,
  ShieldCheck,
  CheckCircle,
  Database
} from 'lucide-react';

interface RegionsViewProps {
  viewingRegion: Region;
}

export const RegionsView: React.FC<RegionsViewProps> = ({ viewingRegion }) => {
  const { t } = useTranslation();
  const [statusData, setStatusData] = useState<any | null>(null);
  const [convergenceReport, setConvergenceReport] = useState<any | null>(null);
  const [verifyingConvergence, setVerifyingConvergence] = useState(false);
  const [links, setLinks] = useState<any[]>([]);
  const [bandwidthCap, setBandwidthCap] = useState(false);
  const [latencyVal, setLatencyVal] = useState(15);
  const [showTechnicalDetails, setShowTechnicalDetails] = useState(false);

  const loadStatus = async () => {
    try {
      const st = await api.getStatus(viewingRegion);
      setStatusData(st);
      const mapRes = await api.getMap(viewingRegion);
      setLinks(mapRes?.links || []);
    } catch (err) {
      console.error(err);
    }
  };

  const loadConvergence = async () => {
    setVerifyingConvergence(true);
    try {
      const rep = await api.getConvergence(viewingRegion);
      setConvergenceReport(rep);
    } catch (err) {
      console.error('Failed to load convergence report:', err);
    } finally {
      setVerifyingConvergence(false);
    }
  };

  useEffect(() => {
    loadStatus();
    loadConvergence();
    const interval = setInterval(() => {
      loadStatus();
      loadConvergence();
    }, 3000);
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
      loadConvergence();
    } catch (err) {
      console.error(err);
    }
  };

  const allRegions: Region[] = ['mumbai', 'delhi', 'bengaluru'];

  return (
    <div className="h-full flex overflow-hidden bg-background">
      {/* 3 Regional Rows Panel */}
      <div className="w-[52%] border-r border-border bg-surface p-6 overflow-y-auto space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-primaryText">Regional Replication Nodes</h2>
            <p className="text-xs text-secondaryText mt-0.5">
              3 independent regional nodes with isolated local persistence.
            </p>
          </div>
          <button
            onClick={loadStatus}
            className="p-1.5 text-secondaryText hover:text-primaryText hover:bg-slate-100 rounded-md transition"
            title="Refresh status"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* 3 Concise Regional Status Rows */}
        <div className="space-y-3">
          {allRegions.map((regId) => {
            const isLocal = regId === viewingRegion;
            const peer = statusData?.peers?.find((p: any) => p.region === regId);
            const link = links.find(
              l => (l.from === viewingRegion && l.to === regId) || (l.to === viewingRegion && l.from === regId)
            );
            const isConnected = isLocal ? true : link ? link.up : peer?.reachable;

            return (
              <div
                key={regId}
                className={`p-4 rounded-lg border transition shadow-subtle ${
                  isLocal
                    ? 'bg-blue-50/40 border-blue-200'
                    : isConnected
                    ? 'bg-white border-border'
                    : 'bg-amber-50/40 border-amber-200'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span
                      className={`w-2 h-2 rounded-full ${
                        isConnected ? 'bg-success' : 'bg-warning'
                      }`}
                    />
                    <span className="text-xs font-bold text-primaryText uppercase">
                      {regId} {regId === 'mumbai' && '(Authority)'}
                    </span>
                    {isLocal && (
                      <span className="text-[10px] bg-primaryAction text-white px-1.5 py-0.5 rounded font-medium">
                        Local Viewing Node
                      </span>
                    )}
                  </div>

                  <span
                    className={`text-[10px] font-mono px-2 py-0.5 rounded font-semibold uppercase ${
                      isConnected
                        ? 'bg-green-100 text-success'
                        : 'bg-amber-100 text-warning'
                    }`}
                  >
                    {isConnected ? 'Connected' : 'Partitioned'}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2 text-xs py-1 border-t border-b border-border/60 my-2">
                  <div>
                    <span className="text-[10px] text-secondaryText uppercase">Port</span>
                    <div className="font-mono text-primaryText font-semibold">
                      {regId === 'mumbai' ? 4001 : regId === 'delhi' ? 4002 : 4003}
                    </div>
                  </div>
                  <div>
                    <span className="text-[10px] text-secondaryText uppercase">Latency</span>
                    <div className="font-mono text-primaryText font-semibold">
                      {isLocal ? '0 ms' : isConnected ? `${latencyVal} ms` : '∞ (Cut)'}
                    </div>
                  </div>
                  <div>
                    <span className="text-[10px] text-secondaryText uppercase">Outbox Queue</span>
                    <div className="font-mono text-primaryText font-semibold">
                      {isLocal ? statusData?.outboxPending ?? 0 : isConnected ? 0 : 2} ops
                    </div>
                  </div>
                </div>

                {/* Link Action */}
                {!isLocal && (
                  <div className="flex items-center justify-between pt-1">
                    <span className="text-[11px] text-secondaryText">
                      Link: {viewingRegion.toUpperCase()} ↔ {regId.toUpperCase()}
                    </span>
                    <button
                      onClick={() => togglePartition(regId, !!isConnected)}
                      className={`px-3 py-1 rounded-md text-xs font-semibold flex items-center gap-1.5 transition ${
                        isConnected
                          ? 'border border-red-300 text-error hover:bg-red-50'
                          : 'bg-primaryAction hover:bg-primaryActionHover text-white'
                      }`}
                    >
                      {isConnected ? (
                        <>
                          <WifiOff className="w-3.5 h-3.5" /> Cut Link
                        </>
                      ) : (
                        <>
                          <Wifi className="w-3.5 h-3.5" /> Restore Link
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Progressive Disclosure: Technical Sync Details */}
        <div className="pt-2">
          <button
            onClick={() => setShowTechnicalDetails(!showTechnicalDetails)}
            className="flex items-center gap-1.5 text-xs font-medium text-primaryAction hover:underline"
          >
            <span>{showTechnicalDetails ? 'Hide' : 'Show'} Version Vectors & Ledger Diagnostics</span>
            {showTechnicalDetails ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>

          {showTechnicalDetails && statusData && (
            <div className="mt-3 p-3 bg-slate-50 rounded-md border border-border space-y-2 text-xs">
              <div>
                <span className="text-[11px] text-secondaryText font-medium">Local Version Vector:</span>
                <div className="font-mono text-[11px] bg-white p-2 rounded border border-border mt-0.5 text-primaryText">
                  {JSON.stringify(statusData.versionVector)}
                </div>
              </div>
              <div className="flex justify-between text-[11px] text-secondaryText pt-1">
                <span>Active Conflicts: <strong className="text-primaryText">{statusData.conflictCount}</strong></span>
                <span>Degradation: <strong className="text-primaryText">{statusData.degradationLevel}</strong></span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Network Controller & Priority Lanes Deck */}
      <div className="flex-1 p-6 overflow-y-auto space-y-5">
        {/* Hash-Based Convergence Verification Card */}
        <div className="bg-surface border border-border rounded-lg p-5 space-y-4 shadow-subtle">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-primaryAction" />
                <h3 className="text-xs font-bold uppercase text-primaryText tracking-wider">
                  Hash-Based Convergence Verification
                </h3>
              </div>
              <p className="text-xs text-secondaryText mt-1">
                Deterministic SHA-256 canonical state digest across replicated entities & escrow quotas.
              </p>
            </div>
            <button
              onClick={loadConvergence}
              disabled={verifyingConvergence}
              className="px-2.5 py-1 text-xs font-medium bg-slate-50 hover:bg-slate-100 border border-border rounded-md text-primaryText flex items-center gap-1.5 transition"
              title="Re-verify canonical state hashes"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${verifyingConvergence ? 'animate-spin text-primaryAction' : ''}`} />
              <span>{verifyingConvergence ? 'Verifying...' : 'Verify'}</span>
            </button>
          </div>

          {/* Status Banner */}
          {convergenceReport && (
            <div
              className={`p-3 rounded-md border text-xs flex items-center justify-between ${
                convergenceReport.overallStatus === 'CONVERGED'
                  ? 'bg-green-50 border-green-200 text-success'
                  : convergenceReport.overallStatus === 'CONFLICT_PENDING'
                  ? 'bg-amber-50 border-amber-200 text-warning'
                  : convergenceReport.overallStatus === 'SYNCING'
                  ? 'bg-blue-50 border-blue-200 text-primaryAction'
                  : convergenceReport.overallStatus === 'UNAVAILABLE'
                  ? 'bg-slate-100 border-slate-300 text-secondaryText'
                  : 'bg-red-50 border-red-200 text-error'
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="font-bold uppercase tracking-wider text-[11px] px-1.5 py-0.5 rounded bg-white/80 border border-current">
                  {convergenceReport.overallStatus}
                </span>
                <span className="text-[11px] text-primaryText font-medium">
                  {convergenceReport.summary}
                </span>
              </div>
              <span className="text-[10px] font-mono text-secondaryText shrink-0">
                Scope: {convergenceReport.scope}
              </span>
            </div>
          )}

          {/* Simple Comparison Table */}
          <div className="overflow-x-auto border border-border rounded-md">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-border text-[11px] text-secondaryText">
                  <th className="py-2 px-3 font-semibold">Region</th>
                  <th className="py-2 px-3 font-semibold">State Hash</th>
                  <th className="py-2 px-3 font-semibold text-right">Pending Ops</th>
                  <th className="py-2 px-3 font-semibold text-right">Conflicts</th>
                  <th className="py-2 px-3 font-semibold text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {allRegions.map((regId) => {
                  const isLocal = regId === viewingRegion;
                  const peerInfo = convergenceReport?.peers?.[regId];
                  const localStateHash = convergenceReport?.canonicalStateHash || statusData?.canonicalStateHash || statusData?.stateHash;
                  const stateHash = isLocal
                    ? localStateHash
                    : peerInfo?.stateHash;
                  const pendingOps = isLocal
                    ? convergenceReport?.outboxPending ?? statusData?.outboxPending ?? 0
                    : peerInfo?.outboxPending ?? (peerInfo?.reachable ? 0 : '—');
                  const conflicts = isLocal
                    ? convergenceReport?.unresolvedConflicts ?? statusData?.conflictCount ?? 0
                    : peerInfo?.unresolvedConflicts ?? (peerInfo?.reachable ? 0 : '—');
                  
                  let rowStatus: string = 'SYNCING';
                  if (isLocal) {
                    rowStatus = (convergenceReport?.unresolvedConflicts ?? 0) > 0
                      ? 'CONFLICT_PENDING'
                      : (convergenceReport?.outboxPending ?? 0) > 0
                      ? 'SYNCING'
                      : 'CONVERGED';
                  } else if (peerInfo) {
                    rowStatus = peerInfo.status;
                  } else {
                    rowStatus = 'SYNCING';
                  }

                  return (
                    <tr key={regId} className={`hover:bg-slate-50/60 ${isLocal ? 'bg-blue-50/20' : ''}`}>
                      <td className="py-2.5 px-3 font-medium text-primaryText">
                        <div className="flex items-center gap-1.5">
                          <span className="capitalize">{regId}</span>
                          {regId === 'mumbai' && (
                            <span className="text-[9px] uppercase px-1 py-0.2 bg-slate-100 text-secondaryText rounded font-mono">
                              Auth
                            </span>
                          )}
                          {isLocal && (
                            <span className="text-[9px] uppercase px-1 py-0.2 bg-blue-100 text-primaryAction rounded font-semibold">
                              Local
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-2.5 px-3 font-mono text-[11px] text-secondaryText">
                        {stateHash ? (
                          <span title={stateHash} className="text-primaryText font-semibold">
                            {stateHash.slice(0, 10)}...{stateHash.slice(-6)}
                          </span>
                        ) : (
                          <span className="text-tertiaryText italic">
                            {peerInfo?.reachable === false ? '— (Partitioned)' : 'Pending query'}
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-primaryText">
                        {pendingOps}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-primaryText">
                        {conflicts}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <span
                          className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold uppercase ${
                            rowStatus === 'CONVERGED'
                              ? 'bg-green-100 text-success'
                              : rowStatus === 'CONFLICT_PENDING'
                              ? 'bg-amber-100 text-warning'
                              : rowStatus === 'SYNCING'
                              ? 'bg-blue-100 text-primaryAction'
                              : rowStatus === 'UNAVAILABLE'
                              ? 'bg-slate-100 text-secondaryText'
                              : 'bg-red-100 text-error'
                          }`}
                        >
                          {rowStatus}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-surface border border-border rounded-lg p-5 space-y-3.5 shadow-subtle">
          <h3 className="text-xs font-semibold uppercase text-secondaryText tracking-wider flex items-center gap-2">
            <Sliders className="w-4 h-4 text-primaryAction" />
            In-Process Network Link Simulation
          </h3>
          <p className="text-xs text-secondaryText leading-relaxed">
            Deterministic inter-region link gate. Simulates physical fiber cuts, latency degradation,
            and low-bandwidth disaster recovery without external network daemons.
          </p>

          <div className="space-y-3 pt-1">
            <div>
              <div className="flex justify-between text-xs text-primaryText font-medium mb-1">
                <span>Simulated Round-Trip Latency:</span>
                <span className="font-mono text-primaryAction font-bold">{latencyVal} ms</span>
              </div>
              <input
                type="range"
                min={5}
                max={1500}
                value={latencyVal}
                onChange={e => setLatencyVal(parseInt(e.target.value, 10))}
                className="w-full accent-primaryAction"
              />
            </div>

            <label className="flex items-center gap-2 text-xs text-primaryText cursor-pointer pt-1">
              <input
                type="checkbox"
                checked={bandwidthCap}
                onChange={e => setBandwidthCap(e.target.checked)}
                className="accent-primaryAction"
              />
              <span>Throttle reconnection bandwidth to 10 KB/s (evaluates priority lanes)</span>
            </label>
          </div>
        </div>

        {/* Priority Lanes Display */}
        <div className="bg-surface border border-border rounded-lg p-5 space-y-3 shadow-subtle">
          <h3 className="text-xs font-semibold uppercase text-secondaryText tracking-wider">
            Replication Priority Lanes
          </h3>
          <div className="space-y-2 text-xs">
            <div className="p-2.5 bg-slate-50 border border-border rounded-md flex justify-between items-center">
              <span className="font-semibold text-error">L0: Control & Heartbeats</span>
              <span className="text-secondaryText text-[11px]">Strict precedence</span>
            </div>
            <div className="p-2.5 bg-slate-50 border border-border rounded-md flex justify-between items-center">
              <span className="font-semibold text-warning">
                L1: Critical Operations (Decisions, Medical/Stranded, Conflicts)
              </span>
              <span className="text-secondaryText text-[11px]">Syncs first on heal</span>
            </div>
            <div className="p-2.5 bg-slate-50 border border-border rounded-md flex justify-between items-center">
              <span className="font-semibold text-primaryAction">L2: Normal Operations (General Reports, Notes)</span>
              <span className="text-secondaryText text-[11px]">Adaptive batching</span>
            </div>
            <div className="p-2.5 bg-slate-50 border border-border rounded-md flex justify-between items-center">
              <span className="font-semibold text-secondaryText">L3: Blobs & Evidence</span>
              <span className="text-secondaryText text-[11px]">Deferred backfill</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
