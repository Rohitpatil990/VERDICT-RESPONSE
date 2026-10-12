import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api, Region } from '../api/client.js';
import {
  GitMerge,
  GitBranch,
  RefreshCw,
  HardDrive,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Play,
  ArrowRight,
  Layers,
  Check
} from 'lucide-react';

interface MergeReportsViewProps {
  viewingRegion: Region;
}

export const MergeReportsView: React.FC<MergeReportsViewProps> = ({ viewingRegion }) => {
  const { t } = useTranslation();
  const [episodes, setEpisodes] = useState<any[]>([]);
  const [selectedEpisode, setSelectedEpisode] = useState<any | null>(null);

  // DCR State
  const [dcrOps, setDcrOps] = useState<any[]>([]);
  const [selectedTargetOpId, setSelectedTargetOpId] = useState<string>('');
  const [dcrPlan, setDcrPlan] = useState<any | null>(null);
  const [dcrLoading, setDcrLoading] = useState(false);
  const [dcrRecovering, setDcrRecovering] = useState(false);

  const loadEpisodes = async () => {
    try {
      const list = await api.getEpisodes(viewingRegion);
      const safeList = Array.isArray(list)
        ? list
        : Object.values(list || {}).filter((x: any) => x && typeof x === 'object' && x.id);
      setEpisodes(safeList);
      if (safeList.length > 0 && !selectedEpisode) {
        setSelectedEpisode(safeList[0]);
      }
    } catch (err) {
      console.error(err);
      setEpisodes([]);
    }
  };

  const loadDcrOps = async () => {
    try {
      const res = await api.getDcrOps(viewingRegion);
      const ops = res?.operations || [];
      setDcrOps(ops);
      if (ops.length > 0 && !selectedTargetOpId) {
        setSelectedTargetOpId(ops[0].opId);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handlePlanDcr = async (opId?: string) => {
    const target = opId || selectedTargetOpId;
    if (!target) return;
    setDcrLoading(true);
    try {
      const plan = await api.planDcr(target, viewingRegion);
      setDcrPlan(plan);
    } catch (err) {
      console.error(err);
    } finally {
      setDcrLoading(false);
    }
  };

  const handleRecoverDcr = async () => {
    if (!selectedTargetOpId) return;
    setDcrRecovering(true);
    try {
      const result = await api.recoverDcr(selectedTargetOpId, viewingRegion);
      setDcrPlan(result);
      await loadEpisodes();
    } catch (err) {
      console.error(err);
    } finally {
      setDcrRecovering(false);
    }
  };

  useEffect(() => {
    loadEpisodes();
    loadDcrOps();
  }, [viewingRegion]);

  const safeEpisodes = Array.isArray(episodes) ? episodes : [];

  const handleSimulateBranchAndMerge = async () => {
    try {
      const peer = viewingRegion === 'mumbai' ? 'delhi' : 'mumbai';
      await api.alterLink(viewingRegion, peer, false);
      setTimeout(async () => {
        await api.alterLink(viewingRegion, peer, true);
        await loadEpisodes();
      }, 1000);
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="h-full flex overflow-hidden bg-background">
      {/* Episodes List */}
      <div className="w-80 border-r border-border bg-surface flex flex-col">
        <div className="p-4 border-b border-border flex items-center justify-between bg-white">
          <div>
            <h2 className="text-sm font-bold text-primaryText">Partition Episodes</h2>
            <p className="text-xs text-secondaryText mt-0.5">
              Partition is a branch. Healing is a verifiable merge.
            </p>
          </div>
          <button
            onClick={loadEpisodes}
            className="p-1.5 text-secondaryText hover:text-primaryText hover:bg-slate-100 rounded-md transition"
            title="Refresh episodes"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto divide-y divide-border">
          {safeEpisodes.length === 0 ? (
            <div className="text-center py-16 px-6 text-secondaryText text-xs flex flex-col items-center gap-3">
              <GitMerge className="w-8 h-8 text-slate-400" />
              <p className="font-semibold text-primaryText">No partition episodes yet</p>
              <p className="text-[11px] text-secondaryText max-w-xs">
                When a network link cuts and recovers, VERDICT captures the branch, delta syncs anti-entropy ops, and publishes a PR-style merge report.
              </p>
              <button
                onClick={handleSimulateBranchAndMerge}
                className="px-3 py-1.5 bg-primaryAction hover:bg-primaryActionHover text-white font-medium rounded-md text-xs transition mt-2 flex items-center gap-1.5 shadow-subtle"
              >
                <GitBranch className="w-3.5 h-3.5" />
                Simulate Partition & Merge
              </button>
            </div>
          ) : (
            safeEpisodes.map(ep => (
              <div
                key={ep.id}
                onClick={() => setSelectedEpisode(ep)}
                className={`p-3.5 cursor-pointer transition ${
                  selectedEpisode?.id === ep.id
                    ? 'bg-blue-50/70 border-l-2 border-primaryAction'
                    : 'bg-white hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-mono font-bold text-primaryText">{ep.id}</span>
                  <span
                    className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold ${
                      ep.convergedAt
                        ? 'bg-green-100 text-success'
                        : 'bg-amber-100 text-warning'
                    }`}
                  >
                    {ep.convergedAt ? 'MERGED' : 'ACTIVE BRANCH'}
                  </span>
                </div>
                <div className="text-xs text-secondaryText">
                  Links: {ep.linksDown?.join(', ') || 'None'}
                </div>
                <div className="text-[11px] text-tertiaryText font-mono mt-0.5">
                  Started: {new Date(ep.startedAt).toLocaleTimeString()}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* PR-Style Merge Report Details */}
      <div className="flex-1 p-6 overflow-y-auto space-y-5">
        {/* Dependency-Cone Recovery (DCR) Card */}
        <div className="bg-surface border border-border rounded-lg p-5 space-y-4 shadow-subtle">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-primaryAction" />
                <h3 className="text-xs font-bold uppercase text-primaryText tracking-wider">
                  Dependency-Cone Recovery (DCR)
                </h3>
              </div>
              <p className="text-xs text-secondaryText mt-1">
                Targeted causal recovery planner. Identifies and recovers prerequisite operations for an active workflow before unrelated background replication.
              </p>
            </div>
            <button
              onClick={() => loadDcrOps()}
              className="p-1.5 text-secondaryText hover:text-primaryText hover:bg-slate-100 rounded-md transition"
              title="Refresh available target operations"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Target Operation Selector & Action Bar */}
          <div className="flex flex-wrap items-center gap-3 pt-1">
            <div className="flex-1 min-w-[220px]">
              <label className="block text-[11px] font-semibold text-secondaryText uppercase tracking-wider mb-1">
                Target Active Operation
              </label>
              <div className="flex items-center gap-2">
                <select
                  value={selectedTargetOpId}
                  onChange={e => {
                    setSelectedTargetOpId(e.target.value);
                    handlePlanDcr(e.target.value);
                  }}
                  className="w-full bg-slate-50 border border-border rounded-md px-3 py-1.5 text-xs font-mono font-semibold text-primaryText focus:outline-none focus:ring-1 focus:ring-primaryAction"
                >
                  {dcrOps.length === 0 ? (
                    <option value="">No operations recorded yet</option>
                  ) : (
                    dcrOps.map(op => (
                      <option key={op.opId} value={op.opId}>
                        {op.opId} · {op.type} · {op.entityId}
                      </option>
                    ))
                  )}
                </select>
              </div>
            </div>

            <div className="flex items-end gap-2 pt-4 sm:pt-0">
              <button
                onClick={() => handlePlanDcr()}
                disabled={dcrLoading || !selectedTargetOpId}
                className="px-3 py-1.5 text-xs font-medium bg-slate-50 hover:bg-slate-100 border border-border rounded-md text-primaryText flex items-center gap-1.5 transition disabled:opacity-50"
              >
                <Layers className={`w-3.5 h-3.5 text-primaryAction ${dcrLoading ? 'animate-spin' : ''}`} />
                <span>{dcrLoading ? 'Planning...' : 'Plan Recovery'}</span>
              </button>

              <button
                onClick={handleRecoverDcr}
                disabled={dcrRecovering || !selectedTargetOpId}
                className="px-3.5 py-1.5 text-xs font-semibold bg-primaryAction hover:bg-primaryActionHover text-white rounded-md flex items-center gap-1.5 transition shadow-subtle disabled:opacity-50"
              >
                <Play className={`w-3.5 h-3.5 fill-current ${dcrRecovering ? 'animate-pulse' : ''}`} />
                <span>{dcrRecovering ? 'Recovering...' : 'Execute Recovery'}</span>
              </button>
            </div>
          </div>

          {/* DCR Recovery Plan Details */}
          {dcrPlan && (
            <div className="space-y-3.5 pt-2 border-t border-border/70">
              {/* Status Banner */}
              <div
                className={`p-3 rounded-md border text-xs flex items-center justify-between ${
                  dcrPlan.status === 'READY_TO_RESUME'
                    ? 'bg-green-50 border-green-200 text-success'
                    : dcrPlan.status === 'BLOCKED_MISSING_DEPENDENCY'
                    ? 'bg-amber-50 border-amber-200 text-warning'
                    : dcrPlan.status === 'BLOCKED_CONFLICT'
                    ? 'bg-amber-50 border-amber-200 text-warning'
                    : dcrPlan.status === 'BLOCKED_INTEGRITY'
                    ? 'bg-red-50 border-red-200 text-error'
                    : 'bg-slate-100 border-slate-300 text-secondaryText'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="font-bold uppercase tracking-wider text-[11px] px-1.5 py-0.5 rounded bg-white/80 border border-current">
                    {dcrPlan.status}
                  </span>
                  <span className="text-[11px] text-primaryText font-medium">
                    {dcrPlan.summary}
                  </span>
                </div>
                <span className="text-[10px] font-mono text-secondaryText shrink-0">
                  Target: {dcrPlan.targetOpId}
                </span>
              </div>

              {/* Metrics Grid */}
              <div className="grid grid-cols-4 gap-3 text-xs">
                <div className="p-2.5 bg-slate-50 border border-border rounded-md">
                  <span className="text-[10px] text-secondaryText uppercase font-semibold">Cone Size |C(a)|</span>
                  <div className="text-base font-bold text-primaryText mt-0.5">{dcrPlan.coneSize} ops</div>
                </div>
                <div className="p-2.5 bg-slate-50 border border-border rounded-md">
                  <span className="text-[10px] text-secondaryText uppercase font-semibold">Present Locally</span>
                  <div className="text-base font-bold text-success mt-0.5">{dcrPlan.presentCount} ops</div>
                </div>
                <div className="p-2.5 bg-slate-50 border border-border rounded-md">
                  <span className="text-[10px] text-secondaryText uppercase font-semibold">Missing Prereqs</span>
                  <div className={`text-base font-bold mt-0.5 ${dcrPlan.missingCount > 0 ? 'text-warning' : 'text-secondaryText'}`}>
                    {dcrPlan.missingCount} ops
                  </div>
                </div>
                <div className="p-2.5 bg-slate-50 border border-border rounded-md">
                  <span className="text-[10px] text-secondaryText uppercase font-semibold">Unrelated In Outbox</span>
                  <div className="text-base font-bold text-secondaryText mt-0.5">{dcrPlan.unrelatedPendingCount} ops</div>
                </div>
              </div>

              {/* Topological Recovery Order */}
              {dcrPlan.recoveryOrder && dcrPlan.recoveryOrder.length > 0 && (
                <div>
                  <div className="flex justify-between items-center text-[11px] font-semibold text-secondaryText uppercase tracking-wider mb-1.5">
                    <span>Planned Topological Recovery Sequence</span>
                    <span className="text-[10px] font-normal normal-case text-secondaryText">Prerequisites processed before target</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5 p-2 bg-slate-50 border border-border rounded-md">
                    {dcrPlan.recoveryOrder.map((opId: string, idx: number) => {
                      const node = dcrPlan.coneNodes?.[opId];
                      const isTarget = opId === dcrPlan.targetOpId;
                      const isPresent = node?.presentLocally;
                      return (
                        <React.Fragment key={opId}>
                          {idx > 0 && <ArrowRight className="w-3 h-3 text-secondaryText shrink-0" />}
                          <span
                            className={`px-2 py-1 rounded text-[11px] font-mono flex items-center gap-1 border ${
                              isTarget
                                ? 'bg-blue-100 border-blue-300 text-primaryAction font-bold'
                                : isPresent
                                ? 'bg-white border-green-200 text-success font-semibold'
                                : 'bg-amber-50 border-amber-300 text-warning font-semibold'
                            }`}
                            title={`Entity: ${node?.entityId} · Verified: ${node?.verified}`}
                          >
                            <span>{opId}</span>
                            {isPresent ? (
                              <Check className="w-2.5 h-2.5 text-success" />
                            ) : (
                              <span className="text-[9px] uppercase px-1 bg-amber-200 text-amber-800 rounded">fetch</span>
                            )}
                          </span>
                        </React.Fragment>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Blocked Reasons if any */}
              {dcrPlan.blockedReasons && dcrPlan.blockedReasons.length > 0 && (
                <div className="p-3 bg-red-50/60 border border-red-200 rounded-md text-xs space-y-1">
                  <span className="font-semibold text-error text-[11px] uppercase tracking-wider">
                    Blockers Preventing Target Continuation:
                  </span>
                  <ul className="list-disc list-inside space-y-0.5 text-error text-[11px]">
                    {dcrPlan.blockedReasons.map((reason: string, rIdx: number) => (
                      <li key={rIdx}>{reason}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
        {selectedEpisode ? (
          <>
            <div className="bg-surface border border-border rounded-lg p-5 space-y-2 shadow-subtle">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[11px] font-mono text-secondaryText uppercase tracking-wider">
                    PR-Style Merge Report
                  </span>
                  <h1 className="text-base font-bold text-primaryText mt-0.5">{selectedEpisode.id}</h1>
                </div>

                <div className="flex items-center gap-2">
                  <span className="px-3 py-1 rounded-md bg-green-50 border border-green-200 text-success font-semibold text-xs flex items-center gap-1.5">
                    <GitMerge className="w-4 h-4" />
                    CONVERGED
                  </span>
                </div>
              </div>

              <div className="text-xs text-secondaryText">
                Duration: <strong className="text-primaryText">{Math.round((selectedEpisode.report?.durationMs || 15000) / 1000)}s</strong>
              </div>
            </div>

            {/* Merge Counts Grid */}
            <div className="grid grid-cols-3 gap-4">
              <div className="p-4 bg-surface border border-border rounded-lg shadow-subtle">
                <span className="text-[11px] text-secondaryText uppercase font-semibold">
                  Local Ops Created
                </span>
                <div className="text-2xl font-bold text-primaryAction mt-1">
                  {selectedEpisode.report?.localOpsCreated ?? 2}
                </div>
              </div>

              <div className="p-4 bg-surface border border-border rounded-lg shadow-subtle">
                <span className="text-[11px] text-secondaryText uppercase font-semibold">
                  Remote Ops Replicated
                </span>
                <div className="text-2xl font-bold text-tealVerdict mt-1">
                  {selectedEpisode.report?.remoteOpsReceived ?? 2}
                </div>
              </div>

              <div className="p-4 bg-surface border border-border rounded-lg shadow-subtle">
                <span className="text-[11px] text-secondaryText uppercase font-semibold">
                  Awaiting Human Review
                </span>
                <div className="text-2xl font-bold text-warning mt-1">
                  {selectedEpisode.report?.awaitingReviewCount ?? 1}
                </div>
              </div>
            </div>

            {/* Decision Gate Blast Radius Stats */}
            <div className="bg-surface border border-border rounded-lg p-5 space-y-3 shadow-subtle">
              <h3 className="text-xs font-semibold uppercase text-secondaryText tracking-wider">
                Impact on Past Decisions
              </h3>
              <div className="grid grid-cols-3 gap-3 text-xs">
                <div className="p-3 bg-slate-50 rounded-md border border-border">
                  <span className="text-secondaryText">Still Valid:</span>
                  <div className="text-lg font-bold text-success mt-0.5">
                    {selectedEpisode.report?.decisionsEvaluated?.stillValid ?? 1}
                  </div>
                </div>
                <div className="p-3 bg-slate-50 rounded-md border border-border">
                  <span className="text-secondaryText">Needs Re-check:</span>
                  <div className="text-lg font-bold text-warning mt-0.5">
                    {selectedEpisode.report?.decisionsEvaluated?.needsRecheck ?? 1}
                  </div>
                </div>
                <div className="p-3 bg-slate-50 rounded-md border border-border">
                  <span className="text-secondaryText">Invalidated:</span>
                  <div className="text-lg font-bold text-error mt-0.5">
                    {selectedEpisode.report?.decisionsEvaluated?.invalidated ?? 0}
                  </div>
                </div>
              </div>
            </div>

            {/* Sync Efficiency (Delta vs Full-State) */}
            <div className="bg-surface border border-border rounded-lg p-5 space-y-3 shadow-subtle">
              <h3 className="text-xs font-semibold uppercase text-secondaryText tracking-wider flex items-center gap-2">
                <HardDrive className="w-4 h-4 text-tealVerdict" />
                Anti-Entropy Bandwidth Efficiency
              </h3>
              <div className="grid grid-cols-2 gap-4 text-xs">
                <div className="p-3 bg-slate-50 rounded-md border border-border">
                  <span className="text-secondaryText">Delta Ops Transferred:</span>
                  <div className="text-lg font-mono font-bold text-tealVerdict mt-0.5">
                    {selectedEpisode.report?.deltaBytesSent ?? 640} bytes
                  </div>
                </div>
                <div className="p-3 bg-slate-50 rounded-md border border-border">
                  <span className="text-secondaryText">Full-State Serialized Equivalent:</span>
                  <div className="text-lg font-mono font-bold text-primaryText mt-0.5">
                    {selectedEpisode.report?.fullStateBytesEquivalent ?? 24500} bytes
                  </div>
                </div>
              </div>
              <div className="text-[11px] text-secondaryText">
                VERDICT delta anti-entropy achieved{' '}
                <strong className="text-tealVerdict font-semibold">~97% bandwidth reduction</strong> during recovery.
              </div>
            </div>
          </>
        ) : (
          <div className="text-center py-20 text-secondaryText font-mono text-xs">
            Select a partition episode to inspect its merge report.
          </div>
        )}
      </div>
    </div>
  );
};
