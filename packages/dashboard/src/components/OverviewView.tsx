import React from 'react';
import { 
  Server, 
  Send, 
  AlertTriangle, 
  AlertCircle,
  Clock, 
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  ListFilter
} from 'lucide-react';
import { MapOperations } from './MapOperations.js';

interface OverviewViewProps {
  currentRegion: any;
  records: any[];
  regionStatus: any;
  isError: boolean;
  selectedRecordId: string | null;
  onSelectRecord: (id: string) => void;
  onOpenReport: (coords?: { lat: number; lng: number; name?: string }) => void;
  onNavigateTab: (tab: any) => void;
}

export const OverviewView: React.FC<OverviewViewProps> = ({
  currentRegion,
  records,
  regionStatus,
  isError,
  selectedRecordId,
  onSelectRecord,
  onOpenReport,
  onNavigateTab
}) => {
  const links = regionStatus?.linkState || {};
  const cutLinksCount = Object.values(links).filter((l: any) => l.status === 'DISCONNECTED').length;
  const nodesAvailableText = isError ? '0 / 3 Online' : cutLinksCount === 0 ? '3 of 3 Online' : `${3 - Math.min(cutLinksCount, 2)} of 3 Online`;

  const pendingOps = isError ? '—' : (regionStatus?.outboxPending ?? 0);
  
  const conflictingRecords = records.filter(r => 
    r.indicators?.conflict?.status === 'Conflicting' || 
    r.indicators?.conflict?.status?.includes('review') ||
    (r.allOps && r.allOps.length > 1)
  );

  const recentRecords = records.slice(0, 6);

  return (
    <div className="h-full flex flex-col p-5 space-y-4 overflow-y-auto">
      {/* 1. Defined Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {/* Card 1: Regional Nodes Available */}
        <div 
          onClick={() => onNavigateTab('replication')}
          className="bg-[#FFFFFF] border border-[#E2E8F0] rounded-lg p-3.5 flex items-center justify-between shadow-2xs hover:border-[#CBD5E1] cursor-pointer transition-colors"
        >
          <div>
            <span className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wider block">Regional Nodes</span>
            <div className="text-lg font-bold text-[#172033] mt-0.5">{nodesAvailableText}</div>
            <span className="text-[11px] text-[#15803D] font-medium flex items-center gap-1 mt-0.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#15803D]" />
              {cutLinksCount === 0 ? 'Full Mesh Active' : 'Partition Active'}
            </span>
          </div>
          <div className="w-9 h-9 rounded-md bg-[#EFF6FF] text-[#2563EB] flex items-center justify-center shrink-0">
            <Server size={18} />
          </div>
        </div>

        {/* Card 2: Active Incident Reports */}
        <div 
          onClick={() => onNavigateTab('incidents')}
          className="bg-[#FFFFFF] border border-[#E2E8F0] rounded-lg p-3.5 flex items-center justify-between shadow-2xs hover:border-[#CBD5E1] cursor-pointer transition-colors"
        >
          <div>
            <span className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wider block">Total Incidents</span>
            <div className="text-lg font-bold text-[#172033] mt-0.5">{records.length} Reports</div>
            <span className="text-[11px] text-[#64748B] font-medium mt-0.5 block">
              In {currentRegion.toUpperCase()} store
            </span>
          </div>
          <div className="w-9 h-9 rounded-md bg-[#F1F5F9] text-[#475569] flex items-center justify-center shrink-0">
            <AlertCircle size={18} />
          </div>
        </div>

        {/* Card 3: Unresolved Conflicts */}
        <div 
          onClick={() => onNavigateTab('conflicts')}
          className={`border rounded-lg p-3.5 flex items-center justify-between shadow-2xs cursor-pointer transition-colors ${
            conflictingRecords.length > 0
              ? 'bg-[#FEF2F2] border-red-200 text-red-900'
              : 'bg-[#FFFFFF] border-[#E2E8F0]'
          }`}
        >
          <div>
            <span className="text-[11px] font-semibold uppercase tracking-wider block text-[#64748B]">Unresolved Conflicts</span>
            <div className={`text-lg font-bold mt-0.5 ${conflictingRecords.length > 0 ? 'text-[#B91C1C]' : 'text-[#172033]'}`}>
              {conflictingRecords.length} Contradictions
            </div>
            <span className={`text-[11px] font-medium mt-0.5 block ${conflictingRecords.length > 0 ? 'text-[#B91C1C]' : 'text-[#15803D]'}`}>
              {conflictingRecords.length > 0 ? 'Awaiting human review' : 'No conflicts detected'}
            </span>
          </div>
          <div className={`w-9 h-9 rounded-md flex items-center justify-center shrink-0 ${
            conflictingRecords.length > 0 ? 'bg-red-100 text-[#B91C1C]' : 'bg-[#F0FDF4] text-[#15803D]'
          }`}>
            <AlertTriangle size={18} />
          </div>
        </div>

        {/* Card 4: Replication Outbox Status */}
        <div 
          onClick={() => onNavigateTab('replication')}
          className="bg-[#FFFFFF] border border-[#E2E8F0] rounded-lg p-3.5 flex items-center justify-between shadow-2xs hover:border-[#CBD5E1] cursor-pointer transition-colors"
        >
          <div>
            <span className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wider block">Pending Outbox</span>
            <div className="text-lg font-bold text-[#172033] mt-0.5">{pendingOps} Operations</div>
            <span className="text-[11px] text-[#2563EB] font-medium mt-0.5 block">
              {regionStatus?.converged ? 'State root converged' : 'Replication delta active'}
            </span>
          </div>
          <div className="w-9 h-9 rounded-md bg-[#EFF6FF] text-[#2563EB] flex items-center justify-center shrink-0">
            <Send size={18} />
          </div>
        </div>
      </div>

      {/* 2. Interactive Map Workspace */}
      <div className="bg-[#FFFFFF] border border-[#E2E8F0] rounded-lg p-4 shadow-2xs flex flex-col space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-xs font-bold text-[#172033] uppercase tracking-wide">Live Geographic Operations Map</h3>
            <p className="text-[11px] text-[#64748B]">Real disaster markers, field GPS units, and regional node communication topology.</p>
          </div>
          <button 
            onClick={() => onNavigateTab('incidents')}
            className="text-xs font-semibold text-[#2563EB] hover:text-[#1D4ED8] flex items-center gap-1 transition-colors"
          >
            <span>View All Incidents</span>
            <ArrowRight size={13} />
          </button>
        </div>

        <div className="h-[430px] w-full">
          <MapOperations
            currentRegion={currentRegion}
            records={records}
            regionStatus={regionStatus}
            selectedRecordId={selectedRecordId}
            onSelectRecord={onSelectRecord}
            onReportHere={onOpenReport}
          />
        </div>
      </div>

      {/* 3. Recent / High-Priority Incidents Table */}
      <div className="bg-[#FFFFFF] border border-[#E2E8F0] rounded-lg p-4 shadow-2xs space-y-3">
        <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-2.5">
          <div className="flex items-center gap-2">
            <ListFilter size={15} className="text-[#2563EB]" />
            <h3 className="text-xs font-bold text-[#172033] uppercase tracking-wide">Recent Disaster Operations</h3>
          </div>
          <span className="text-[11px] text-[#64748B]">
            Showing latest {recentRecords.length} records in {currentRegion.toUpperCase()}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-[#E2E8F0] text-[11px] text-[#64748B] font-semibold bg-[#F8FAFC]">
                <th className="py-2.5 px-3">Entity ID</th>
                <th className="py-2.5 px-3">Type & Severity</th>
                <th className="py-2.5 px-3">Description</th>
                <th className="py-2.5 px-3">Replication</th>
                <th className="py-2.5 px-3">Status</th>
                <th className="py-2.5 px-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E2E8F0]">
              {recentRecords.map(item => {
                const { entityId, op, indicators } = item;
                const rep = op?.payload;
                const isConflict = indicators?.conflict?.status === 'Conflicting' || indicators?.conflict?.status?.includes('review');
                const isSynced = indicators?.replication?.syncedCount === 3;
                const severity = rep?.severity?.value;

                return (
                  <tr 
                    key={entityId} 
                    onClick={() => onSelectRecord(entityId)}
                    className="hover:bg-[#F8FAFC] transition-colors cursor-pointer"
                  >
                    <td className="py-2.5 px-3 font-mono text-[#2563EB] font-medium text-[11px]">
                      {entityId}
                    </td>
                    <td className="py-2.5 px-3">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase border ${
                        severity === 'CRITICAL' ? 'bg-red-50 text-red-700 border-red-200' :
                        severity === 'HIGH' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                        'bg-blue-50 text-blue-700 border-blue-200'
                      }`}>
                        {rep?.incidentType || op?.type || 'INCIDENT'}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-[#334155] max-w-sm truncate text-[11px]">
                      {rep?.description?.original?.text || JSON.stringify(rep || op?.payload)}
                    </td>
                    <td className="py-2.5 px-3 text-[11px] font-mono text-[#475569]">
                      <span className={`font-semibold ${isSynced ? 'text-[#15803D]' : 'text-[#B45309]'}`}>
                        {indicators?.replication?.syncedCount || 1}/3
                      </span> Regions
                    </td>
                    <td className="py-2.5 px-3 text-[11px]">
                      <span className={`px-2 py-0.5 rounded-full font-medium ${
                        isConflict ? 'bg-red-50 text-red-700' :
                        isSynced ? 'bg-green-50 text-green-700' :
                        'bg-amber-50 text-amber-700'
                      }`}>
                        {indicators?.resolution?.status || 'Tentative'}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectRecord(entityId);
                        }}
                        className="text-xs text-[#2563EB] hover:text-[#1D4ED8] font-semibold"
                      >
                        Inspect
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
