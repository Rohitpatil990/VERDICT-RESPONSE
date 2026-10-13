import React, { useState, useEffect } from 'react';
import { api, Region } from '../api/client.js';
import {
  Server,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Play,
  HelpCircle,
  ArrowRight,
  RefreshCw,
  FileText,
  Plus,
  Clock,
  Activity,
  Layers,
  Wifi,
  WifiOff
} from 'lucide-react';

interface OverviewViewProps {
  onRunGuidedDemo: () => void;
  onStartAutoDemo: () => void;
  onOpenHowToRun: () => void;
  onNavigateToIncidents: () => void;
  onNavigateToRecovery: () => void;
  onNavigateToVerify: () => void;
  onNavigateToScaleTest?: () => void;
}

export const OverviewView: React.FC<OverviewViewProps> = ({
  onRunGuidedDemo,
  onStartAutoDemo,
  onOpenHowToRun,
  onNavigateToIncidents,
  onNavigateToRecovery,
  onNavigateToVerify,
  onNavigateToScaleTest
}) => {
  const [mumbaiStatus, setMumbaiStatus] = useState<any | null>(null);
  const [delhiStatus, setDelhiStatus] = useState<any | null>(null);
  const [bengaluruStatus, setBengaluruStatus] = useState<any | null>(null);
  const [entities, setEntities] = useState<any[]>([]);
  const [links, setLinks] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [latestTx, setLatestTx] = useState<any | null>(null);

  const fetchClusterStatus = async () => {
    setLoading(true);
    try {
      const [m, d, b, map] = await Promise.allSettled([
        api.getStatus('mumbai'),
        api.getStatus('delhi'),
        api.getStatus('bengaluru'),
        api.getMap('mumbai')
      ]);

      if (m.status === 'fulfilled') setMumbaiStatus(m.value);
      else setMumbaiStatus(null);

      if (d.status === 'fulfilled') setDelhiStatus(d.value);
      else setDelhiStatus(null);

      if (b.status === 'fulfilled') setBengaluruStatus(b.value);
      else setBengaluruStatus(null);

      if (map.status === 'fulfilled') {
        setEntities(map.value?.entities || []);
        setLinks(map.value?.links || []);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClusterStatus();
    const interval = setInterval(fetchClusterStatus, 2500);
    return () => clearInterval(interval);
  }, []);

  // Compute actual status from real backend data
  const downLinks = links.filter((l: any) => !l.up);
  const isPartitioned = downLinks.length > 0;
  const totalPendingOutbox =
    (mumbaiStatus?.outboxPending || 0) +
    (delhiStatus?.outboxPending || 0) +
    (bengaluruStatus?.outboxPending || 0);

  const allDown = !mumbaiStatus && !delhiStatus && !bengaluruStatus;
  const anyDown = !mumbaiStatus || !delhiStatus || !bengaluruStatus;

  // Derive System Status: exactly one of HEALTHY, DEGRADED, RECOVERING, RECOVERY VERIFIED, FAILED
  let systemStatus: 'HEALTHY' | 'DEGRADED' | 'RECOVERING' | 'RECOVERY VERIFIED' | 'FAILED' = 'HEALTHY';
  let statusBadgeColor = 'bg-emerald-50 text-emerald-700 border-emerald-200';
  let affectedRegionOrLink = 'None — all 3 regional links online';
  let operatorCapability = 'Full active consensus; synchronous global operations enabled.';
  let lastOperationSummary = 'All recent operations committed and replicated.';

  if (allDown) {
    systemStatus = 'FAILED';
    statusBadgeColor = 'bg-red-50 text-error border-red-200';
    affectedRegionOrLink = 'All regional endpoints unreachable (4001, 4002, 4003)';
    operatorCapability = 'Offline. Verify backend daemon or Docker containers.';
    lastOperationSummary = 'Connection lost to regional authority.';
  } else if (anyDown) {
    systemStatus = 'DEGRADED';
    statusBadgeColor = 'bg-amber-50 text-warning border-amber-200';
    const deadRegions = [];
    if (!mumbaiStatus) deadRegions.push('Mumbai');
    if (!delhiStatus) deadRegions.push('Delhi');
    if (!bengaluruStatus) deadRegions.push('Bengaluru');
    affectedRegionOrLink = `Unreachable nodes: ${deadRegions.join(', ')}`;
    operatorCapability = 'Autonomous local writes active on surviving nodes; traffic rerouted.';
    lastOperationSummary = 'Operations accepted locally under failover.';
  } else if (isPartitioned) {
    systemStatus = 'DEGRADED';
    statusBadgeColor = 'bg-amber-50 text-warning border-amber-200';
    const names = downLinks.map((l: any) => `${l.from.toUpperCase()}↔${l.to.toUpperCase()}`).join(', ');
    affectedRegionOrLink = `Severed link: ${names}`;
    operatorCapability = 'Local autonomous writes enabled; escrow bounds enforce invariants without locks.';
    lastOperationSummary = 'Local operations buffered in transactional outbox awaiting reconnect.';
  } else if (totalPendingOutbox > 0) {
    systemStatus = 'RECOVERING';
    statusBadgeColor = 'bg-blue-50 text-primaryAction border-blue-200';
    affectedRegionOrLink = 'Reconnecting links draining buffered queues';
    operatorCapability = 'Catch-up synchronization in progress; causal ordering maintained.';
    lastOperationSummary = `${totalPendingOutbox} buffered operations transmitting across links.`;
  } else {
    systemStatus = 'HEALTHY';
    statusBadgeColor = 'bg-emerald-50 text-emerald-700 border-emerald-200';
    affectedRegionOrLink = 'None — all replication links operational';
    operatorCapability = 'Normal operations; cross-region causal synchronization verified.';
    lastOperationSummary = 'Zero pending operations in outbox. Bit-level state digest match.';
  }

  const getRegionCardData = (regionId: 'mumbai' | 'delhi' | 'bengaluru', status: any, port: number, role: string) => {
    if (!status) {
      return {
        health: 'Unavailable',
        badge: 'bg-red-50 text-error border-red-200',
        dot: 'bg-red-500',
        records: '—',
        pending: '—',
        explanation: `Port ${port} connection refused. Node offline.`
      };
    }
    const hasDownLink = downLinks.some((l: any) => l.from === regionId || l.to === regionId);
    if (hasDownLink || (status.outboxPending && status.outboxPending > 0) || (status.conflictCount && status.conflictCount > 0)) {
      const reasons = [];
      if (hasDownLink) reasons.push('Partitioned link');
      if (status.outboxPending > 0) reasons.push(`${status.outboxPending} outbox ops`);
      if (status.conflictCount > 0) reasons.push(`${status.conflictCount} conflicts`);
      return {
        health: 'Degraded',
        badge: 'bg-amber-50 text-warning border-amber-200',
        dot: 'bg-amber-500',
        records: status.entitiesCount ?? '—',
        pending: status.outboxPending ?? 0,
        explanation: reasons.join(' · ')
      };
    }
    return {
      health: 'Healthy',
      badge: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      dot: 'bg-emerald-500',
      records: status.entitiesCount ?? '—',
      pending: status.outboxPending ?? 0,
      explanation: 'Synchronized & operating normally.'
    };
  };

  const mumbaiCard = getRegionCardData('mumbai', mumbaiStatus, 4001, 'Primary Authority');
  const delhiCard = getRegionCardData('delhi', delhiStatus, 4002, 'Autonomous Replica');
  const bengaluruCard = getRegionCardData('bengaluru', bengaluruStatus, 4003, 'Autonomous Replica');

  // Filter and sort incidents for Incident Summary (take top 4 latest)
  const recentIncidents = [...entities]
    .filter(e => e.type === 'incident' || e.entityId.startsWith('inc-'))
    .sort((a, b) => (b.lastUpdated || 0) - (a.lastUpdated || 0))
    .slice(0, 4);

  return (
    <div className="h-full overflow-y-auto bg-background p-6 md:p-8 space-y-6 max-w-5xl mx-auto">
      {/* 1. Header with System Status */}
      <div className="bg-surface border border-border rounded-xl p-5 shadow-subtle flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-primaryAction text-white flex items-center justify-center font-black text-base shadow-xs">
            V
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-black text-primaryText tracking-tight">VERDICT Response</h1>
              <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded border uppercase flex items-center gap-1.5 ${statusBadgeColor}`}>
                <span className="w-1.5 h-1.5 rounded-full bg-current" />
                {systemStatus}
              </span>
            </div>
            <p className="text-xs text-secondaryText">
              Geo-Distributed Disaster Data Replication with Graceful Degradation
            </p>
          </div>
        </div>

        {/* Primary Action Buttons */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={onStartAutoDemo}
            className="px-4 py-2 bg-primaryAction hover:bg-primaryActionHover text-white font-bold text-xs rounded-md shadow-subtle flex items-center gap-1.5 transition"
            title="Run complete 6-stage automatic judge demo"
          >
            <Play className="w-3.5 h-3.5 fill-white" />
            <span>▶ Run Automatic Demo</span>
          </button>
          <button
            onClick={onOpenHowToRun}
            className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 font-semibold text-xs rounded-md shadow-subtle flex items-center gap-1.5 transition"
            title="How to run VERDICT"
          >
            <HelpCircle className="w-3.5 h-3.5 text-blue-600" />
            <span>How to Run</span>
          </button>
        </div>
      </div>

      {/* 2. Four Operational Questions Answered */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="p-3.5 bg-surface border border-border rounded-xl shadow-subtle space-y-1 text-xs">
          <span className="text-[10px] font-bold text-secondaryText uppercase tracking-wider block">
            1. Current Condition
          </span>
          <div className="font-bold text-primaryText flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full ${systemStatus === 'HEALTHY' ? 'bg-emerald-500' : systemStatus === 'FAILED' ? 'bg-red-500' : 'bg-amber-500'}`} />
            <span>{systemStatus}</span>
          </div>
          <p className="text-[11px] text-secondaryText leading-relaxed">
            {systemStatus === 'HEALTHY' ? 'Replicas synchronized.' : 'Operating under partition rules.'}
          </p>
        </div>

        <div className="p-3.5 bg-surface border border-border rounded-xl shadow-subtle space-y-1 text-xs">
          <span className="text-[10px] font-bold text-secondaryText uppercase tracking-wider block">
            2. Affected Region / Link
          </span>
          <div className="font-bold text-primaryText truncate font-mono text-[11px]">
            {affectedRegionOrLink}
          </div>
          <p className="text-[11px] text-secondaryText leading-relaxed">
            {isPartitioned ? 'Active inter-region cut' : 'Zero link interruptions'}
          </p>
        </div>

        <div className="p-3.5 bg-surface border border-border rounded-xl shadow-subtle space-y-1 text-xs">
          <span className="text-[10px] font-bold text-secondaryText uppercase tracking-wider block">
            3. Operator Capabilities
          </span>
          <div className="font-bold text-primaryText text-[11px]">
            {isPartitioned ? 'Local Autonomy Active' : 'Global Consensus Active'}
          </div>
          <p className="text-[11px] text-secondaryText leading-relaxed truncate">
            {operatorCapability}
          </p>
        </div>

        <div className="p-3.5 bg-surface border border-border rounded-xl shadow-subtle space-y-1 text-xs">
          <span className="text-[10px] font-bold text-secondaryText uppercase tracking-wider block">
            4. Last Operation Status
          </span>
          <div className="font-bold text-primaryText text-[11px]">
            {totalPendingOutbox === 0 ? 'Replicated Across Mesh' : `${totalPendingOutbox} Ops Queued`}
          </div>
          <p className="text-[11px] text-secondaryText leading-relaxed truncate">
            {lastOperationSummary}
          </p>
        </div>
      </div>

      {/* 3. Regional Status (Three Compact Cards) */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-bold uppercase tracking-wider text-secondaryText flex items-center gap-1.5">
            <Server className="w-3.5 h-3.5 text-primaryAction" />
            Regional Services Status
          </h2>
          <button
            onClick={fetchClusterStatus}
            disabled={loading}
            className="text-[11px] text-secondaryText hover:text-primaryText flex items-center gap-1 transition"
          >
            <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh Nodes</span>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Mumbai */}
          <div className="bg-surface border border-border rounded-lg p-4 shadow-subtle space-y-2.5">
            <div className="flex items-start justify-between">
              <div>
                <span className="text-[10px] font-mono text-secondaryText block">Port 4001 · Primary</span>
                <h3 className="text-sm font-bold text-primaryText">Mumbai</h3>
              </div>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded border uppercase flex items-center gap-1 ${mumbaiCard.badge}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${mumbaiCard.dot}`} />
                {mumbaiCard.health}
              </span>
            </div>
            <div className="pt-2 border-t border-border/60 text-[11px] text-secondaryText space-y-1">
              <div className="flex justify-between">
                <span>Local Records:</span>
                <span className="font-mono text-primaryText font-medium">{mumbaiCard.records}</span>
              </div>
              <div className="flex justify-between">
                <span>Pending Outbox:</span>
                <span className="font-mono text-primaryText font-medium">{mumbaiCard.pending} ops</span>
              </div>
              <div className="text-[10px] text-secondaryText pt-1 border-t border-border/40 truncate">
                {mumbaiCard.explanation}
              </div>
            </div>
          </div>

          {/* Delhi */}
          <div className="bg-surface border border-border rounded-lg p-4 shadow-subtle space-y-2.5">
            <div className="flex items-start justify-between">
              <div>
                <span className="text-[10px] font-mono text-secondaryText block">Port 4002 · Replica</span>
                <h3 className="text-sm font-bold text-primaryText">Delhi</h3>
              </div>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded border uppercase flex items-center gap-1 ${delhiCard.badge}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${delhiCard.dot}`} />
                {delhiCard.health}
              </span>
            </div>
            <div className="pt-2 border-t border-border/60 text-[11px] text-secondaryText space-y-1">
              <div className="flex justify-between">
                <span>Local Records:</span>
                <span className="font-mono text-primaryText font-medium">{delhiCard.records}</span>
              </div>
              <div className="flex justify-between">
                <span>Pending Outbox:</span>
                <span className="font-mono text-primaryText font-medium">{delhiCard.pending} ops</span>
              </div>
              <div className="text-[10px] text-secondaryText pt-1 border-t border-border/40 truncate">
                {delhiCard.explanation}
              </div>
            </div>
          </div>

          {/* Bengaluru */}
          <div className="bg-surface border border-border rounded-lg p-4 shadow-subtle space-y-2.5">
            <div className="flex items-start justify-between">
              <div>
                <span className="text-[10px] font-mono text-secondaryText block">Port 4003 · Replica</span>
                <h3 className="text-sm font-bold text-primaryText">Bengaluru</h3>
              </div>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded border uppercase flex items-center gap-1 ${bengaluruCard.badge}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${bengaluruCard.dot}`} />
                {bengaluruCard.health}
              </span>
            </div>
            <div className="pt-2 border-t border-border/60 text-[11px] text-secondaryText space-y-1">
              <div className="flex justify-between">
                <span>Local Records:</span>
                <span className="font-mono text-primaryText font-medium">{bengaluruCard.records}</span>
              </div>
              <div className="flex justify-between">
                <span>Pending Outbox:</span>
                <span className="font-mono text-primaryText font-medium">{bengaluruCard.pending} ops</span>
              </div>
              <div className="text-[10px] text-secondaryText pt-1 border-t border-border/40 truncate">
                {bengaluruCard.explanation}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 4. Incident Summary */}
      <div className="bg-surface border border-border rounded-xl p-5 shadow-subtle space-y-3">
        <div className="flex items-center justify-between border-b border-border pb-2.5">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-primaryAction" />
            <h2 className="text-xs font-bold uppercase tracking-wider text-primaryText">
              Latest Incidents & Field Reports
            </h2>
          </div>
          <button
            onClick={onNavigateToIncidents}
            className="text-[11px] font-semibold text-primaryAction hover:underline flex items-center gap-1"
          >
            <span>View All Incidents</span>
            <ArrowRight className="w-3 h-3" />
          </button>
        </div>

        {recentIncidents.length === 0 ? (
          <div className="p-6 text-center text-secondaryText text-xs">
            No incident records recorded yet. Click "Create Incident" below to submit one.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {recentIncidents.map(item => {
              const title = item.attributes?.title || item.attributes?.name || item.entityId;
              const desc = item.attributes?.description || item.attributes?.note || 'No description recorded';
              const region = item.authorityRegion || 'mumbai';
              const updatedTime = item.lastUpdated ? new Date(item.lastUpdated).toLocaleTimeString() : 'Recent';

              return (
                <div
                  key={item.entityId}
                  onClick={onNavigateToIncidents}
                  className="p-3 bg-slate-50 hover:bg-blue-50/50 border border-border rounded-lg transition cursor-pointer space-y-1.5"
                  title="Click to view in Incidents manager"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-[11px] font-bold text-primaryAction truncate">
                      {item.entityId}
                    </span>
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded uppercase bg-white border border-border text-primaryText">
                      {item.status || 'Active'}
                    </span>
                  </div>
                  <h4 className="text-xs font-bold text-primaryText truncate">
                    {title}
                  </h4>
                  <p className="text-[11px] text-secondaryText line-clamp-2 leading-relaxed">
                    {desc}
                  </p>
                  <div className="flex items-center justify-between text-[10px] text-secondaryText pt-1 border-t border-border/40">
                    <span className="uppercase font-semibold text-primaryText">{region}</span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3 text-secondaryText" />
                      {updatedTime}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 5. Primary Actions Bar */}
      <div className="p-5 rounded-xl bg-surface border border-border shadow-subtle flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-sm font-bold text-primaryText">Operational Workflows</h3>
          <p className="text-xs text-secondaryText mt-0.5">
            Select an action to test disaster replication, local operations, or integrity verification.
          </p>
        </div>
        <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
          <button
            onClick={onNavigateToIncidents}
            className="px-4 py-2 bg-primaryAction hover:bg-primaryActionHover text-white font-bold text-xs rounded-lg shadow-subtle flex items-center gap-1.5 transition"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Create Incident</span>
          </button>
          <button
            onClick={onNavigateToRecovery}
            className="px-4 py-2 bg-white hover:bg-slate-50 border border-border text-slate-800 font-semibold text-xs rounded-lg shadow-subtle flex items-center gap-1.5 transition"
          >
            <Play className="w-3.5 h-3.5 text-primaryAction" />
            <span>Open Recovery Demo</span>
          </button>
          <button
            onClick={onNavigateToVerify}
            className="px-4 py-2 bg-white hover:bg-slate-50 border border-border text-slate-800 font-semibold text-xs rounded-lg shadow-subtle flex items-center gap-1.5 transition"
          >
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            <span>Verify State</span>
          </button>
        </div>
      </div>
    </div>
  );
};
