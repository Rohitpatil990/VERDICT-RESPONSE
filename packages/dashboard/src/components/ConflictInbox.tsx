import React, { useState } from 'react';
import { AlertTriangle, CheckCircle2, ShieldCheck, UserCheck, ArrowRight } from 'lucide-react';
import { useI18n } from '../i18n.js';
import { ApiClient } from '../api.js';

interface ConflictInboxProps {
  currentRegion: any;
  records: any[];
  onResolved: () => void;
}

export const ConflictInbox: React.FC<ConflictInboxProps> = ({
  currentRegion,
  records,
  onResolved
}) => {
  const { t } = useI18n();
  const [selectedEntity, setSelectedEntity] = useState<string | null>(null);
  const [justification, setJustification] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Filter entities with conflicts
  const conflictingRecords = records.filter(r => 
    r.indicators?.conflict?.status === 'Conflicting' || 
    r.indicators?.conflict?.status.includes('review') ||
    r.allOps?.length > 1
  );

  const activeRecord = records.find(r => r.entityId === selectedEntity) || conflictingRecords[0];

  const handleResolve = async (chosenOp: any) => {
    if (!activeRecord) return;
    setSubmitting(true);
    try {
      await ApiClient.resolveConflict(
        currentRegion,
        activeRecord.entityId,
        chosenOp.opId,
        chosenOp.payload,
        justification || 'Verified on ground by sector commander'
      );
      setJustification('');
      onResolved();
    } catch (err: any) {
      alert(`Resolution error: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="h-full flex flex-col p-4 space-y-4 overflow-y-auto">
      <div>
        <h3 className="text-sm font-semibold text-white flex items-center gap-2">
          <AlertTriangle size={16} className="text-rose-400" />
          Conflict Investigation & Review Inbox
        </h3>
        <p className="text-xs text-gray-400 mt-0.5">
          Contradictory updates under policy v1. Decisions are committed as separate signed RESOLVE operations.
        </p>
      </div>

      {conflictingRecords.length === 0 ? (
        <div className="bg-[#111A2E] p-8 rounded-xl border border-[#1E2A44] text-center space-y-2">
          <CheckCircle2 size={36} className="text-teal-400 mx-auto" />
          <h4 className="text-sm font-medium text-white">No Active Conflicts</h4>
          <p className="text-xs text-gray-400">All regional stores are consistent or resolved by deterministic policy.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Conflict List */}
          <div className="space-y-2">
            <div className="text-xs text-gray-400 font-semibold uppercase tracking-wider">Unsettled Entities</div>
            {conflictingRecords.map(item => {
              const isSelected = activeRecord?.entityId === item.entityId;
              return (
                <div
                  key={item.entityId}
                  onClick={() => setSelectedEntity(item.entityId)}
                  className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                    isSelected 
                      ? 'bg-rose-500/10 border-rose-500/50 text-white' 
                      : 'bg-[#111A2E] border-[#1E2A44] text-gray-300 hover:bg-[#16223B]'
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <span className="font-semibold text-xs">{item.entityId}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/40">
                      {item.allOps?.length || 2} Claims
                    </span>
                  </div>
                  <div className="text-[11px] text-gray-400 mt-1 truncate">
                    Status: {item.indicators?.conflict?.status}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Conflict Side-by-Side Review */}
          {activeRecord && (
            <div className="md:col-span-2 bg-[#111A2E] border border-[#1E2A44] rounded-xl p-4 space-y-4">
              <div className="flex items-center justify-between border-b border-[#1E2A44] pb-3">
                <div>
                  <h4 className="text-xs font-semibold text-white">Reviewing: {activeRecord.entityId}</h4>
                  <div className="text-[11px] text-rose-400 mt-0.5">
                    {activeRecord.indicators?.conflict?.notes || 'Contradictory updates require human review'}
                  </div>
                </div>
              </div>

              {/* Side by side cards */}
              <div className="grid grid-cols-2 gap-3">
                {activeRecord.allOps?.map((op: any, idx: number) => (
                  <div key={idx} className="bg-[#0B1220] p-3 rounded-lg border border-[#1E2A44] space-y-2 text-xs">
                    <div className="flex justify-between items-center">
                      <span className="font-mono text-teal-400 font-semibold">{op.opId}</span>
                      <span className="uppercase text-[10px] text-gray-400 font-semibold">{op.region}</span>
                    </div>

                    <div className="p-2 bg-[#111A2E] rounded border border-[#1E2A44]">
                      <div className="text-[10px] text-gray-400">Claimed State:</div>
                      <div className="font-medium text-amber-300 mt-0.5">
                        {op.payload?.status || op.payload?.incidentType || JSON.stringify(op.payload)}
                      </div>
                    </div>

                    <div className="space-y-1 text-[11px] text-gray-400">
                      <div>Author: <span className="text-gray-200">{op.authorId}</span></div>
                      <div>Role: <span className="text-purple-300">{op.authorRole}</span></div>
                      <div>Reported: <span className="text-gray-300">{new Date(op.createdAt).toLocaleTimeString()}</span></div>
                    </div>

                    <button
                      onClick={() => handleResolve(op)}
                      disabled={submitting}
                      className="w-full mt-2 py-1.5 bg-teal-500/20 hover:bg-teal-500/30 text-teal-300 border border-teal-500/40 rounded text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
                    >
                      <UserCheck size={13} />
                      Choose This State
                    </button>
                  </div>
                ))}
              </div>

              <div>
                <label className="block text-xs text-gray-400 mb-1">Reviewer Justification (Included in Signed Resolve Op)</label>
                <input
                  type="text"
                  value={justification}
                  onChange={e => setJustification(e.target.value)}
                  placeholder="e.g. Ground inspection confirmed road is submerged"
                  className="w-full bg-[#0B1220] border border-[#1E2A44] rounded p-2 text-xs text-white outline-none"
                />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
