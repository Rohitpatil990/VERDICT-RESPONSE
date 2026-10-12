import React from 'react';
import { 
  Server, 
  Send, 
  AlertTriangle, 
  GitBranch, 
  Activity, 
  CheckCircle2, 
  Clock, 
  ShieldAlert,
  Wifi,
  Radio
} from 'lucide-react';
import { useI18n } from '../i18n.js';

interface OperationalStatusStripProps {
  currentRegion: string;
  regionStatus: any;
  records: any[];
  isError: boolean;
}

export const OperationalStatusStrip: React.FC<OperationalStatusStripProps> = ({
  currentRegion,
  regionStatus,
  records,
  isError
}) => {
  const { t } = useI18n();

  // Compute live node availability from real links
  const links = regionStatus?.linkState || {};
  const cutLinksCount = Object.values(links).filter((l: any) => l.status === 'DISCONNECTED').length;
  const nodesAvailable = isError ? '0 / 3' : cutLinksCount === 0 ? '3 / 3 Online' : `${3 - Math.min(cutLinksCount, 2)} / 3 Available`;

  const pendingOps = isError ? '—' : (regionStatus?.outboxPending ?? 0);
  
  const conflictCount = isError ? '—' : records.filter(r => 
    r.indicators?.conflict?.status === 'Conflicting' || 
    r.indicators?.conflict?.status?.includes('review') ||
    (r.allOps && r.allOps.length > 1)
  ).length;

  const isConverged = !isError && regionStatus?.converged === true;
  const degradation = isError ? 'DISCONNECTED' : (regionStatus?.degradationLevel || 'L0_FULL');

  return (
    <div className="h-14 bg-[#0B1220] border-b border-[#1E2A44] px-4 py-2 flex items-center justify-between gap-3 overflow-x-auto shrink-0 select-none">
      <div className="flex items-center gap-3 w-full">
        {/* Card 1: Regional Nodes Available */}
        <div className="flex-1 min-w-[170px] bg-[#111A2E] border border-[#1E2A44] rounded-lg px-3 py-1.5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={`w-7 h-7 rounded-md flex items-center justify-center ${
              isError ? 'bg-rose-500/10 text-rose-400' : 'bg-teal-500/10 text-teal-400'
            }`}>
              <Server size={14} />
            </div>
            <div>
              <span className="text-[10px] text-gray-400 uppercase tracking-wider block font-semibold">Nodes Available</span>
              <span className="text-xs font-bold text-white font-mono">{nodesAvailable}</span>
            </div>
          </div>
          <div className={`w-2 h-2 rounded-full ${
            isError ? 'bg-rose-500' : cutLinksCount > 0 ? 'bg-amber-400 animate-pulse' : 'bg-teal-400'
          }`} />
        </div>

        {/* Card 2: Pending Outbox Ops */}
        <div className="flex-1 min-w-[160px] bg-[#111A2E] border border-[#1E2A44] rounded-lg px-3 py-1.5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-md bg-sky-500/10 text-sky-400 flex items-center justify-center">
              <Send size={14} />
            </div>
            <div>
              <span className="text-[10px] text-gray-400 uppercase tracking-wider block font-semibold">Pending Outbox</span>
              <span className="text-xs font-bold text-white font-mono">{pendingOps} Ops</span>
            </div>
          </div>
          <span className="text-[10px] text-gray-400 font-mono">Delta</span>
        </div>

        {/* Card 3: Unresolved Conflicts */}
        <div className={`flex-1 min-w-[160px] rounded-lg px-3 py-1.5 flex items-center justify-between border transition-all ${
          Number(conflictCount) > 0 
            ? 'bg-rose-500/10 border-rose-500/40 text-rose-300 shadow-sm' 
            : 'bg-[#111A2E] border-[#1E2A44]'
        }`}>
          <div className="flex items-center gap-2">
            <div className={`w-7 h-7 rounded-md flex items-center justify-center ${
              Number(conflictCount) > 0 ? 'bg-rose-500/20 text-rose-400' : 'bg-gray-800 text-gray-400'
            }`}>
              <AlertTriangle size={14} />
            </div>
            <div>
              <span className="text-[10px] text-gray-400 uppercase tracking-wider block font-semibold">Unresolved Conflicts</span>
              <span className={`text-xs font-bold font-mono ${Number(conflictCount) > 0 ? 'text-rose-400' : 'text-white'}`}>
                {conflictCount} Claims
              </span>
            </div>
          </div>
          {Number(conflictCount) > 0 && (
            <span className="text-[9px] bg-rose-500 text-white font-bold px-1.5 py-0.5 rounded uppercase">Review</span>
          )}
        </div>

        {/* Card 4: Replication Convergence */}
        <div className="flex-1 min-w-[190px] bg-[#111A2E] border border-[#1E2A44] rounded-lg px-3 py-1.5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={`w-7 h-7 rounded-md flex items-center justify-center ${
              isConverged ? 'bg-teal-500/10 text-teal-400' : 'bg-amber-500/10 text-amber-400'
            }`}>
              <GitBranch size={14} />
            </div>
            <div>
              <span className="text-[10px] text-gray-400 uppercase tracking-wider block font-semibold">Replication State</span>
              <span className="text-xs font-bold text-white flex items-center gap-1">
                {isConverged ? 'Converged (Equal Root)' : 'Syncing Vectors...'}
              </span>
            </div>
          </div>
          <span className="text-[10px] font-mono text-teal-400 truncate max-w-[55px]" title={regionStatus?.stateRoot}>
            {regionStatus?.stateRoot ? `${regionStatus.stateRoot.slice(0, 6)}…` : '—'}
          </span>
        </div>

        {/* Card 5: Degradation Level */}
        <div className="flex-1 min-w-[170px] bg-[#111A2E] border border-[#1E2A44] rounded-lg px-3 py-1.5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={`w-7 h-7 rounded-md flex items-center justify-center ${
              degradation === 'L0_FULL' ? 'bg-teal-500/10 text-teal-400' :
              degradation === 'L1_DEGRADED' ? 'bg-amber-500/10 text-amber-400' :
              'bg-rose-500/10 text-rose-400'
            }`}>
              <Activity size={14} />
            </div>
            <div>
              <span className="text-[10px] text-gray-400 uppercase tracking-wider block font-semibold">Degradation Tier</span>
              <span className={`text-xs font-bold uppercase font-mono ${
                degradation === 'L0_FULL' ? 'text-teal-400' :
                degradation === 'L1_DEGRADED' ? 'text-amber-400' :
                'text-rose-400'
              }`}>
                {degradation}
              </span>
            </div>
          </div>
          <span className="text-[10px] text-gray-400 font-semibold uppercase">AP Mode</span>
        </div>
      </div>
    </div>
  );
};
