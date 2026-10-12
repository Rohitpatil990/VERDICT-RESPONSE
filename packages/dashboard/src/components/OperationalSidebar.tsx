import React, { useState } from 'react';
import { 
  ListFilter, 
  AlertTriangle, 
  Layers, 
  Package, 
  Zap, 
  Search, 
  Clock, 
  ShieldCheck, 
  ShieldAlert, 
  MapPin, 
  ArrowRight,
  RefreshCw,
  Server,
  Wifi,
  Radio,
  Sliders,
  CheckCircle2,
  XCircle,
  Unplug
} from 'lucide-react';
import { useI18n } from '../i18n.js';
import { ConflictInbox } from './ConflictInbox.js';
import { ReliefSupplies } from './ReliefSupplies.js';
import { ChaosLab } from './ChaosLab.js';
import { EfficiencyPanel } from './EfficiencyPanel.js';
import { ApiClient } from '../api.js';

interface OperationalSidebarProps {
  currentRegion: any;
  records: any[];
  regionStatus: any;
  selectedRecordId: string | null;
  onSelectRecord: (id: string) => void;
  onRefresh: () => void;
}

export type SidebarTab = 'incidents' | 'conflicts' | 'regions' | 'supplies' | 'chaos';

export const OperationalSidebar: React.FC<OperationalSidebarProps> = ({
  currentRegion,
  records,
  regionStatus,
  selectedRecordId,
  onSelectRecord,
  onRefresh
}) => {
  const { t } = useI18n();
  const [activeTab, setActiveTab] = useState<SidebarTab>('incidents');
  const [searchQuery, setSearchQuery] = useState('');
  const [severityFilter, setSeverityFilter] = useState<string>('ALL');

  // Filter incidents
  const filteredRecords = records.filter(item => {
    const text = (item.op?.payload?.description?.original?.text || '').toLowerCase();
    const entityId = (item.entityId || '').toLowerCase();
    const type = (item.op?.payload?.incidentType || item.op?.type || '').toLowerCase();
    const matchesSearch = text.includes(searchQuery.toLowerCase()) || 
                          entityId.includes(searchQuery.toLowerCase()) || 
                          type.includes(searchQuery.toLowerCase());

    const severity = item.op?.payload?.severity?.value || 'UNSET';
    const matchesSeverity = severityFilter === 'ALL' || severity === severityFilter;

    return matchesSearch && matchesSeverity;
  });

  const conflictCount = records.filter(r => 
    r.indicators?.conflict?.status === 'Conflicting' || 
    r.indicators?.conflict?.status?.includes('review') ||
    (r.allOps && r.allOps.length > 1)
  ).length;

  return (
    <div className="h-full flex flex-col bg-[#111A2E] border-l border-[#1E2A44] overflow-hidden text-gray-100">
      {/* Sidebar Top Navigation Tabs */}
      <div className="h-11 bg-[#0B1220] border-b border-[#1E2A44] px-2 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-1 overflow-x-auto w-full">
          {[
            { id: 'incidents', label: 'Incidents', icon: ListFilter, count: records.length },
            { id: 'conflicts', label: 'Conflicts', icon: AlertTriangle, count: conflictCount, alert: conflictCount > 0 },
            { id: 'regions', label: 'Replication', icon: Layers },
            { id: 'supplies', label: 'Supplies', icon: Package },
            { id: 'chaos', label: 'Chaos & Stats', icon: Zap }
          ].map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as SidebarTab)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                  isActive
                    ? 'bg-[#16223B] text-teal-400 border border-[#1E2A44] shadow-sm'
                    : 'text-gray-400 hover:text-gray-200 hover:bg-[#16223B]/40'
                }`}
              >
                <Icon size={13} className={isActive ? 'text-teal-400' : 'text-gray-400'} />
                <span>{tab.label}</span>
                {tab.count !== undefined && (
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                    tab.alert 
                      ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40' 
                      : isActive 
                        ? 'bg-teal-500/20 text-teal-300' 
                        : 'bg-[#1E2A44] text-gray-400'
                  }`}>
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Sidebar Content Area */}
      <div className="flex-1 overflow-y-auto">
        {/* Tab 1: Incidents List */}
        {activeTab === 'incidents' && (
          <div className="p-3 space-y-3">
            {/* Search and Filter Strip */}
            <div className="space-y-2">
              <div className="relative">
                <Search size={13} className="absolute left-3 top-2.5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Filter incidents by keyword, entity, or type..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-[#0B1220] border border-[#1E2A44] rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder-gray-500 outline-none focus:border-teal-400 transition-colors"
                />
              </div>

              <div className="flex items-center gap-1.5 overflow-x-auto text-[11px]">
                {['ALL', 'CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].map(sev => (
                  <button
                    key={sev}
                    onClick={() => setSeverityFilter(sev)}
                    className={`px-2 py-0.5 rounded font-medium transition-colors ${
                      severityFilter === sev
                        ? 'bg-teal-500 text-gray-950 font-bold'
                        : 'bg-[#0B1220] text-gray-400 border border-[#1E2A44] hover:text-white'
                    }`}
                  >
                    {sev}
                  </button>
                ))}
              </div>
            </div>

            {/* Incident Cards */}
            <div className="space-y-2">
              {filteredRecords.length === 0 ? (
                <div className="p-8 text-center text-xs text-gray-400 border border-dashed border-[#1E2A44] rounded-xl space-y-2">
                  <ListFilter size={24} className="mx-auto text-gray-500" />
                  <p>No disaster reports match current criteria in {currentRegion.toUpperCase()} store.</p>
                </div>
              ) : (
                filteredRecords.map(item => {
                  const { entityId, op, indicators } = item;
                  const rep = op?.payload;
                  const isSelected = selectedRecordId === entityId;
                  const isConflict = indicators?.conflict?.status === 'Conflicting' || indicators?.conflict?.status?.includes('review');
                  const isSynced = indicators?.replication?.syncedCount === 3;
                  const severity = rep?.severity?.value;

                  return (
                    <div
                      key={entityId}
                      onClick={() => onSelectRecord(entityId)}
                      className={`p-3 rounded-xl border transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-[#16223B] border-teal-400/80 shadow-lg ring-1 ring-teal-400/50'
                          : isConflict
                            ? 'bg-[#16223B]/60 border-rose-500/40 hover:border-rose-400'
                            : 'bg-[#0B1220] border-[#1E2A44] hover:border-[#2A3B5C] hover:bg-[#111A2E]'
                      }`}
                    >
                      {/* Top Bar: Type & Entity ID */}
                      <div className="flex items-center justify-between gap-2 mb-1.5">
                        <div className="flex items-center gap-1.5">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${
                            severity === 'CRITICAL' ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40' :
                            severity === 'HIGH' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40' :
                            'bg-teal-500/20 text-teal-300 border border-teal-500/40'
                          }`}>
                            {rep?.incidentType || op?.type || 'INCIDENT'}
                          </span>
                          <span className="font-mono text-[10px] text-gray-400">{entityId}</span>
                        </div>

                        <span className="text-[10px] font-mono text-gray-400 flex items-center gap-1">
                          <Clock size={10} />
                          {op?.createdAt ? new Date(op.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Recent'}
                        </span>
                      </div>

                      {/* Description */}
                      <p className="text-xs text-gray-200 line-clamp-2 mb-2 leading-relaxed font-normal">
                        {rep?.description?.original?.text || JSON.stringify(rep || op?.payload)}
                      </p>

                      {/* Six Indicators Micro-Pills */}
                      <div className="grid grid-cols-4 gap-1 pt-1.5 border-t border-[#1E2A44]/60 text-[9px]">
                        <div className="bg-[#111A2E] p-1 rounded border border-[#1E2A44] text-center" title="Authority Tier">
                          <span className="text-gray-400 block text-[8px] uppercase">Tier</span>
                          <span className="font-semibold text-gray-200 truncate block">
                            {indicators?.source?.tier?.replace('_', ' ') || 'OFFICER'}
                          </span>
                        </div>

                        <div className="bg-[#111A2E] p-1 rounded border border-[#1E2A44] text-center" title="Cryptographic Integrity">
                          <span className="text-gray-400 block text-[8px] uppercase">Crypto</span>
                          <span className={`font-semibold flex items-center justify-center gap-0.5 ${
                            indicators?.integrity?.status === 'Verified' ? 'text-teal-400' : 'text-rose-400'
                          }`}>
                            {indicators?.integrity?.status === 'Verified' ? '✔ Ed25519' : '✘ Fail'}
                          </span>
                        </div>

                        <div className="bg-[#111A2E] p-1 rounded border border-[#1E2A44] text-center" title="Replication Count">
                          <span className="text-gray-400 block text-[8px] uppercase">Replicas</span>
                          <span className="font-semibold text-teal-400 font-mono">
                            {indicators?.replication?.syncedCount || 1}/3
                          </span>
                        </div>

                        <div className="bg-[#111A2E] p-1 rounded border border-[#1E2A44] text-center" title="Policy Resolution Status">
                          <span className="text-gray-400 block text-[8px] uppercase">Status</span>
                          <span className={`font-semibold truncate block ${
                            isConflict ? 'text-rose-400' : isSynced ? 'text-teal-400' : 'text-amber-400'
                          }`}>
                            {isConflict ? 'Conflict' : isSynced ? 'Settled' : 'Tentative'}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* Tab 2: Conflicts & Review Inbox */}
        {activeTab === 'conflicts' && (
          <ConflictInbox
            currentRegion={currentRegion}
            records={records}
            onResolved={onRefresh}
          />
        )}

        {/* Tab 3: Regional Replication Mesh */}
        {activeTab === 'regions' && (
          <div className="p-3 space-y-4">
            <div>
              <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                <Server size={14} className="text-teal-400" />
                Multi-Region Cluster Nodes
              </h4>
              <p className="text-[11px] text-gray-400 mt-0.5">
                Each node operates a genuinely separate SQLite database file.
              </p>
            </div>

            <div className="space-y-2">
              {[
                { id: 'mumbai', port: 4001, db: 'data/mumbai.db', title: 'Mumbai Region (West Hub)' },
                { id: 'delhi', port: 4002, db: 'data/delhi.db', title: 'Delhi Region (North Hub)' },
                { id: 'bengaluru', port: 4003, db: 'data/bengaluru.db', title: 'Bengaluru Region (South Hub)' }
              ].map(node => {
                const isCurrent = currentRegion === node.id;
                return (
                  <div
                    key={node.id}
                    className={`p-3 rounded-xl border transition-all ${
                      isCurrent 
                        ? 'bg-[#16223B] border-teal-500/60 shadow-lg' 
                        : 'bg-[#0B1220] border-[#1E2A44]'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <span className={`w-2.5 h-2.5 rounded-full ${
                          isCurrent ? 'bg-teal-400 animate-pulse' : 'bg-teal-500'
                        }`} />
                        <span className="text-xs font-bold text-white uppercase">{node.id}</span>
                        {isCurrent && (
                          <span className="text-[10px] bg-teal-500/20 text-teal-300 px-1.5 py-0.2 rounded font-semibold">
                            Viewing Node
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] font-mono text-gray-400">Port {node.port}</span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-[10px] text-gray-400 pt-1 border-t border-[#1E2A44]">
                      <div>
                        <span>Persistence: </span>
                        <strong className="text-gray-200 font-mono">{node.db}</strong>
                      </div>
                      <div>
                        <span>Local State: </span>
                        <strong className="text-teal-400">
                          {regionStatus?.degradationLevel || 'L0_FULL'}
                        </strong>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Inter-Region Link States & Partition Controls */}
            <div className="space-y-2 pt-2 border-t border-[#1E2A44]">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white uppercase flex items-center gap-1.5">
                  <Wifi size={14} className="text-sky-400" />
                  Inter-Region Network Links
                </span>
                <span className="text-[10px] text-gray-400 font-mono">LinkController</span>
              </div>

              <div className="space-y-2">
                {[
                  { r1: 'mumbai', r2: 'delhi' },
                  { r1: 'mumbai', r2: 'bengaluru' },
                  { r1: 'delhi', r2: 'bengaluru' }
                ].map(pair => {
                  const key = [pair.r1, pair.r2].sort().join('<->');
                  const links = regionStatus?.linkState || {};
                  const link = links[key];
                  const isCut = link?.status === 'DISCONNECTED';

                  return (
                    <div
                      key={key}
                      className="bg-[#0B1220] p-2.5 rounded-lg border border-[#1E2A44] flex items-center justify-between text-xs"
                    >
                      <div>
                        <span className="font-semibold text-white uppercase">{pair.r1} ↔ {pair.r2}</span>
                        <div className="text-[10px] text-gray-400 flex items-center gap-1.5 mt-0.5">
                          <span>Status:</span>
                          <strong className={isCut ? 'text-rose-400' : 'text-teal-400'}>
                            {link?.status || 'CONNECTED'}
                          </strong>
                          {link?.latencyMs && <span>· {link.latencyMs}ms</span>}
                        </div>
                      </div>

                      <button
                        onClick={async () => {
                          if (isCut) {
                            await ApiClient.adminLink(pair.r1 as any, 'restore', pair.r2 as any);
                          } else {
                            await ApiClient.adminLink(pair.r1 as any, 'cut', pair.r2 as any);
                          }
                          onRefresh();
                        }}
                        className={`px-2.5 py-1 rounded text-[11px] font-bold transition-all ${
                          isCut
                            ? 'bg-teal-500/20 hover:bg-teal-500/30 text-teal-300 border border-teal-500/40'
                            : 'bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40'
                        }`}
                      >
                        {isCut ? 'Restore Link' : 'Sever Link'}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Version Vectors View */}
            <div className="bg-[#0B1220] p-3 rounded-xl border border-[#1E2A44] space-y-1.5">
              <span className="text-[11px] font-bold text-gray-300 uppercase block">Active Version Vector</span>
              <div className="font-mono text-xs text-teal-300 bg-[#111A2E] p-2 rounded border border-[#1E2A44]">
                {JSON.stringify(regionStatus?.versionVector || { mumbai: 0, delhi: 0, bengaluru: 0 })}
              </div>
              <p className="text-[10px] text-gray-400">
                Monotonically increasing sequence counters per region used for delta-only anti-entropy pull.
              </p>
            </div>
          </div>
        )}

        {/* Tab 4: Relief Supplies Escrow */}
        {activeTab === 'supplies' && (
          <ReliefSupplies
            currentRegion={currentRegion}
            onRefresh={onRefresh}
          />
        )}

        {/* Tab 5: Chaos Lab & Measured Stats */}
        {activeTab === 'chaos' && (
          <div className="space-y-4">
            <ChaosLab
              currentRegion={currentRegion}
              regionStatus={regionStatus}
              records={records}
              onRefresh={onRefresh}
            />
            <div className="p-3 pt-0">
              <EfficiencyPanel currentRegion={currentRegion} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
