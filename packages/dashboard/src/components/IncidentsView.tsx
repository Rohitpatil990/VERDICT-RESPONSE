import React, { useState } from 'react';
import { 
  Search, 
  PlusCircle, 
  ListFilter, 
  Clock, 
  MapPin, 
  ShieldCheck, 
  AlertTriangle,
  User,
  ArrowRight
} from 'lucide-react';
import { useI18n } from '../i18n.js';

interface IncidentsViewProps {
  currentRegion: any;
  records: any[];
  selectedRecordId: string | null;
  onSelectRecord: (id: string) => void;
  onOpenReport: () => void;
}

export const IncidentsView: React.FC<IncidentsViewProps> = ({
  currentRegion,
  records,
  selectedRecordId,
  onSelectRecord,
  onOpenReport
}) => {
  const { t } = useI18n();
  const [search, setSearch] = useState('');
  const [severityFilter, setSeverityFilter] = useState('ALL');
  const [typeFilter, setTypeFilter] = useState('ALL');

  const filtered = records.filter(item => {
    const text = (item.op?.payload?.description?.original?.text || '').toLowerCase();
    const id = (item.entityId || '').toLowerCase();
    const type = (item.op?.payload?.incidentType || item.op?.type || '').toLowerCase();

    const matchesSearch = text.includes(search.toLowerCase()) || 
                          id.includes(search.toLowerCase()) || 
                          type.includes(search.toLowerCase());

    const itemSev = item.op?.payload?.severity?.value || 'UNSET';
    const matchesSev = severityFilter === 'ALL' || itemSev === severityFilter;

    const matchesType = typeFilter === 'ALL' || type === typeFilter.toLowerCase();

    return matchesSearch && matchesSev && matchesType;
  });

  return (
    <div className="h-full flex flex-col p-5 space-y-4 overflow-y-auto">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E2E8F0] pb-3">
        <div>
          <h2 className="text-base font-bold text-[#172033]">Incident Records & Field Reports</h2>
          <p className="text-xs text-[#64748B] mt-0.5">
            Locally persisted operations and verified replicated records in {currentRegion.toUpperCase()} store.
          </p>
        </div>

        <button
          onClick={onOpenReport}
          className="bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-xs font-semibold px-3 py-1.5 rounded-md shadow-xs flex items-center gap-1.5 transition-colors"
        >
          <PlusCircle size={14} />
          <span>New Incident Report</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-[#FFFFFF] border border-[#E2E8F0] rounded-lg p-3 shadow-2xs flex flex-wrap items-center justify-between gap-3">
        <div className="relative flex-1 min-w-[240px]">
          <Search size={14} className="absolute left-3 top-2.5 text-[#94A3B8]" />
          <input
            type="text"
            placeholder="Search by keywords, entity ID, or description..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-md pl-9 pr-3 py-1.5 text-xs text-[#172033] outline-none focus:border-[#2563EB] transition-colors"
          />
        </div>

        <div className="flex items-center gap-2 text-xs">
          <span className="text-[#64748B] font-medium hidden sm:inline">Severity:</span>
          <select
            value={severityFilter}
            onChange={e => setSeverityFilter(e.target.value)}
            className="bg-[#F8FAFC] border border-[#E2E8F0] rounded px-2.5 py-1 text-xs text-[#172033] outline-none"
          >
            <option value="ALL">All Severities</option>
            <option value="CRITICAL">Critical</option>
            <option value="HIGH">High</option>
            <option value="MEDIUM">Medium</option>
            <option value="LOW">Low</option>
          </select>

          <span className="text-[#64748B] font-medium hidden sm:inline ml-2">Type:</span>
          <select
            value={typeFilter}
            onChange={e => setTypeFilter(e.target.value)}
            className="bg-[#F8FAFC] border border-[#E2E8F0] rounded px-2.5 py-1 text-xs text-[#172033] outline-none"
          >
            <option value="ALL">All Types</option>
            <option value="flood">Flood</option>
            <option value="blocked_road">Blocked Road</option>
            <option value="stranded_people">Stranded People</option>
            <option value="damaged_infrastructure">Damaged Infrastructure</option>
            <option value="medical_emergency">Medical Emergency</option>
          </select>
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-[#FFFFFF] border border-[#E2E8F0] rounded-lg shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-[#E2E8F0] text-[11px] text-[#64748B] font-semibold bg-[#F8FAFC]">
                <th className="py-2.5 px-3">Entity ID</th>
                <th className="py-2.5 px-3">Type & Severity</th>
                <th className="py-2.5 px-3">Description</th>
                <th className="py-2.5 px-3">Authority Tier</th>
                <th className="py-2.5 px-3">Crypto Integrity</th>
                <th className="py-2.5 px-3">Replication Extent</th>
                <th className="py-2.5 px-3">Resolution State</th>
                <th className="py-2.5 px-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E2E8F0]">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-xs text-[#64748B]">
                    No incident records match the filter criteria in {currentRegion.toUpperCase()} database.
                  </td>
                </tr>
              ) : (
                filtered.map(item => {
                  const { entityId, op, indicators } = item;
                  const rep = op?.payload;
                  const isConflict = indicators?.conflict?.status === 'Conflicting' || indicators?.conflict?.status?.includes('review');
                  const isSynced = indicators?.replication?.syncedCount === 3;
                  const severity = rep?.severity?.value;
                  const isSelected = selectedRecordId === entityId;

                  return (
                    <tr
                      key={entityId}
                      onClick={() => onSelectRecord(entityId)}
                      className={`hover:bg-[#F8FAFC] transition-colors cursor-pointer ${
                        isSelected ? 'bg-[#EFF6FF]' : ''
                      }`}
                    >
                      <td className="py-2.5 px-3 font-mono font-medium text-[#2563EB]">
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
                      <td className="py-2.5 px-3 text-[#334155] max-w-xs truncate">
                        {rep?.description?.original?.text || JSON.stringify(rep || op?.payload)}
                      </td>
                      <td className="py-2.5 px-3 text-[#475569]">
                        <span className="font-semibold text-[11px]">
                          {indicators?.source?.tier?.replace('_', ' ') || 'OFFICER'}
                        </span>
                      </td>
                      <td className="py-2.5 px-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-semibold flex items-center gap-1 w-fit ${
                          indicators?.integrity?.status === 'Verified'
                            ? 'bg-green-50 text-green-700 border border-green-200'
                            : 'bg-red-50 text-red-700 border border-red-200'
                        }`}>
                          <ShieldCheck size={11} />
                          {indicators?.integrity?.status}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 font-mono text-[#475569]">
                        <span className={`font-semibold ${isSynced ? 'text-[#15803D]' : 'text-[#B45309]'}`}>
                          {indicators?.replication?.syncedCount || 1}/3
                        </span> Regions
                      </td>
                      <td className="py-2.5 px-3">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
                          isConflict ? 'bg-red-50 text-red-700 border border-red-200' :
                          isSynced ? 'bg-green-50 text-green-700 border border-green-200' :
                          'bg-amber-50 text-amber-700 border border-amber-200'
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
                          SourceTrace →
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
