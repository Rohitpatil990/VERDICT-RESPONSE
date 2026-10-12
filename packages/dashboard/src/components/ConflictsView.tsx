import React, { useState } from 'react';
import { 
  Scale, 
  AlertTriangle, 
  CheckCircle2, 
  UserCheck, 
  ShieldCheck, 
  Clock, 
  User, 
  MapPin,
  ArrowRight
} from 'lucide-react';
import { ApiClient } from '../api.js';

interface ConflictsViewProps {
  currentRegion: any;
  records: any[];
  onResolved: () => void;
}

export const ConflictsView: React.FC<ConflictsViewProps> = ({
  currentRegion,
  records,
  onResolved
}) => {
  const [selectedEntityId, setSelectedEntityId] = useState<string | null>(null);
  const [justification, setJustification] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Filter entities with conflicts
  const conflictingRecords = records.filter(r => 
    r.indicators?.conflict?.status === 'Conflicting' || 
    r.indicators?.conflict?.status?.includes('review') ||
    (r.allOps && r.allOps.length > 1)
  );

  const activeRecord = conflictingRecords.find(r => r.entityId === selectedEntityId) || conflictingRecords[0];

  const handleResolve = async (chosenOp: any) => {
    if (!activeRecord) return;
    setSubmitting(true);
    try {
      const res = await ApiClient.resolveConflict(
        currentRegion,
        activeRecord.entityId,
        chosenOp.opId,
        chosenOp.payload,
        justification || 'Verified on ground by sector commander survey'
      );
      setSuccessMsg(`Committed signed RESOLVE operation [${res.op_id || 'RESOLVE-1'}] to regional ledger.`);
      setJustification('');
      onResolved();
    } catch (err: any) {
      alert(`Resolution error: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="h-full flex flex-col p-5 space-y-4 overflow-y-auto">
      {/* Header */}
      <div className="border-b border-[#E2E8F0] pb-3">
        <h2 className="text-base font-bold text-[#172033]">Conflict Investigation & Review</h2>
        <p className="text-xs text-[#64748B] mt-0.5">
          Safety-critical contradictions retained for human review under policy v1 rather than naive automated Last-Write-Wins overwriting.
        </p>
      </div>

      {successMsg && (
        <div className="bg-green-50 border border-green-200 text-[#15803D] text-xs px-3.5 py-2.5 rounded-lg flex items-center justify-between shadow-2xs">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={15} />
            <span>{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg(null)} className="text-green-700 font-bold ml-2">✕</button>
        </div>
      )}

      {conflictingRecords.length === 0 ? (
        <div className="bg-[#FFFFFF] p-12 rounded-lg border border-[#E2E8F0] text-center space-y-3 shadow-2xs">
          <div className="w-12 h-12 rounded-full bg-green-50 text-[#15803D] flex items-center justify-center mx-auto">
            <CheckCircle2 size={24} />
          </div>
          <h4 className="text-sm font-bold text-[#172033]">No Active Contradictions</h4>
          <p className="text-xs text-[#64748B] max-w-md mx-auto">
            All regional updates are mathematically consistent under policy v1. Any concurrent reports were reconciled via causal version vectors or monotonic state rules.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* List of Conflicting Entities */}
          <div className="space-y-2">
            <span className="text-xs font-bold text-[#64748B] uppercase tracking-wider block">
              Contradictory Entities ({conflictingRecords.length})
            </span>

            <div className="space-y-1.5">
              {conflictingRecords.map(item => {
                const isSelected = activeRecord?.entityId === item.entityId;
                return (
                  <div
                    key={item.entityId}
                    onClick={() => setSelectedEntityId(item.entityId)}
                    className={`p-3 rounded-lg border cursor-pointer transition-all ${
                      isSelected
                        ? 'bg-[#EFF6FF] border-[#2563EB] text-[#172033] shadow-xs'
                        : 'bg-[#FFFFFF] border-[#E2E8F0] hover:border-[#CBD5E1]'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs font-bold text-[#172033]">{item.entityId}</span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded uppercase bg-red-50 text-red-700 border border-red-200">
                        {item.allOps?.length || 2} Claims
                      </span>
                    </div>

                    <div className="text-[11px] text-[#64748B] mt-1 truncate">
                      {item.indicators?.conflict?.notes || 'Conflicting updates from disconnected regions'}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Side-by-Side Investigation Panel */}
          {activeRecord && (
            <div className="lg:col-span-2 bg-[#FFFFFF] border border-[#E2E8F0] rounded-lg p-4 shadow-2xs space-y-4">
              <div className="border-b border-[#E2E8F0] pb-3 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-[#172033]">Active Review:</span>
                    <span className="font-mono text-xs text-[#2563EB] font-bold">{activeRecord.entityId}</span>
                  </div>
                  <p className="text-[11px] text-[#B91C1C] mt-0.5 font-medium">
                    {activeRecord.indicators?.conflict?.notes || 'Contradictory updates from disconnected regions'}
                  </p>
                </div>
              </div>

              {/* Competing Claims Side-by-Side */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {activeRecord.allOps?.map((op: any, idx: number) => (
                  <div key={idx} className="bg-[#F8FAFC] p-3.5 rounded-lg border border-[#E2E8F0] space-y-2.5">
                    <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-1.5">
                      <span className="font-mono text-xs font-bold text-[#2563EB]">{op.opId}</span>
                      <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-[#FFFFFF] border border-[#E2E8F0]">
                        Region: {op.region}
                      </span>
                    </div>

                    <div className="bg-[#FFFFFF] p-2.5 rounded border border-[#E2E8F0] space-y-1">
                      <span className="text-[10px] font-semibold text-[#64748B] uppercase block">Claimed Status:</span>
                      <div className="font-bold text-xs text-[#172033]">
                        {op.payload?.status || op.payload?.incidentType || JSON.stringify(op.payload)}
                      </div>
                    </div>

                    <div className="text-[11px] text-[#64748B] space-y-0.5">
                      <div>Author: <span className="text-[#172033] font-medium">{op.authorId}</span></div>
                      <div>Role: <span className="text-[#2563EB] font-medium">{op.authorRole}</span></div>
                      <div>Observed: <span className="text-[#172033]">{new Date(op.createdAt).toLocaleTimeString()}</span></div>
                    </div>

                    <button
                      onClick={() => handleResolve(op)}
                      disabled={submitting}
                      className="w-full mt-2 py-1.5 px-3 bg-[#FFFFFF] hover:bg-[#EFF6FF] text-[#2563EB] border border-[#2563EB] rounded text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50"
                    >
                      <UserCheck size={13} />
                      <span>Approve This Update</span>
                    </button>
                  </div>
                ))}
              </div>

              {/* Reviewer Justification & Note */}
              <div className="bg-[#F8FAFC] p-3.5 rounded-lg border border-[#E2E8F0] space-y-2">
                <label className="block text-xs font-semibold text-[#172033]">
                  Sector Commander Justification (Committed into signed RESOLVE operation)
                </label>
                <input
                  type="text"
                  value={justification}
                  onChange={e => setJustification(e.target.value)}
                  placeholder="e.g. Physical ground verification by team confirmed road is fully clear"
                  className="w-full bg-[#FFFFFF] border border-[#E2E8F0] rounded p-2 text-xs text-[#172033] outline-none focus:border-[#2563EB]"
                />
                <p className="text-[10px] text-[#64748B]">
                  * A valid signature proves integrity and origin under the configured key; it does not prove that the reported event is factually true.
                </p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
