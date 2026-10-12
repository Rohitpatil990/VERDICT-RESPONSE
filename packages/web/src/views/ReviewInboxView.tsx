import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api, Region } from '../api/client.js';
import {
  Inbox,
  AlertTriangle,
  CheckCircle,
  FileCheck,
  Shield,
  RefreshCw,
  UserCheck
} from 'lucide-react';

interface ReviewInboxViewProps {
  viewingRegion: Region;
  onConflictResolved?: (id: string) => void;
}

export const ReviewInboxView: React.FC<ReviewInboxViewProps> = ({
  viewingRegion,
  onConflictResolved
}) => {
  const { t } = useTranslation();
  const [entities, setEntities] = useState<any[]>([]);
  const [selectedConflict, setSelectedConflict] = useState<any | null>(null);
  const [resolutionStatus, setResolutionStatus] = useState('BLOCKED');
  const [resolutionReason, setResolutionReason] = useState('Confirmed ground reconnaissance report');
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const loadConflicts = async () => {
    try {
      const mapRes = await api.getMap(viewingRegion);
      const confs = (mapRes.entities || []).filter(
        (e: any) => e.conflict?.status === 'AWAITING_REVIEW'
      );
      setEntities(confs);
      if (confs.length > 0 && !selectedConflict) {
        setSelectedConflict(confs[0]);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    loadConflicts();
  }, [viewingRegion]);

  const handleResolve = async () => {
    if (!selectedConflict) return;
    try {
      await api.resolveConflict(
        selectedConflict.entityId,
        resolutionStatus,
        resolutionReason,
        'reviewer_alice',
        viewingRegion
      );
      setSuccessMsg(`Conflict on ${selectedConflict.entityId} resolved by Reviewer Alice.`);
      loadConflicts();
      if (onConflictResolved) onConflictResolved(selectedConflict.entityId);
    } catch (err: any) {
      console.error(err);
    }
  };

  return (
    <div className="h-full flex overflow-hidden">
      {/* Conflicts List */}
      <div className="w-[40%] border-r border-border bg-surface flex flex-col">
        <div className="p-4 border-b border-border flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold uppercase tracking-wider text-roseVerdict">
              Review Inbox
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Concurrent disputes requiring certified human reviewer adjudication.
            </p>
          </div>
          <button
            onClick={loadConflicts}
            className="p-1.5 text-slate-400 hover:text-slate-100 hover:bg-slate-800 rounded transition"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto divide-y divide-border">
          {entities.length === 0 ? (
            <div className="text-center py-16 text-slate-500 text-xs font-mono">
              Zero contested records! All operations causally merged or clean.
            </div>
          ) : (
            entities.map(e => (
              <div
                key={e.entityId}
                onClick={() => setSelectedConflict(e)}
                className={`p-4 cursor-pointer transition ${
                  selectedConflict?.entityId === e.entityId
                    ? 'bg-slate-800/80 border-l-2 border-roseVerdict'
                    : 'bg-background/40 hover:bg-slate-800/40'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-mono font-bold text-slate-200">
                    {e.attributes?.reports?.[0]?.name || e.entityId}
                  </span>
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-roseVerdict/10 text-roseVerdict font-bold">
                    AWAITING REVIEW
                  </span>
                </div>
                <div className="text-xs text-slate-400">
                  Type: <span className="font-semibold text-slate-300">{e.type}</span> · Authority:{' '}
                  {e.authorityRegion?.toUpperCase()}
                </div>
                <div className="text-[11px] text-slate-500 font-mono mt-1">
                  Claims: {e.conflict?.claims?.length || 0} concurrent assertions
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Side-by-Side Adjudication View */}
      <div className="flex-1 p-6 overflow-y-auto space-y-6">
        {selectedConflict ? (
          <>
            <div className="bg-surface border border-border rounded-lg p-5 space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-mono text-slate-400">Entity Under Dispute</span>
                  <h1 className="text-lg font-bold text-slate-100">
                    {selectedConflict.attributes?.reports?.[0]?.name || selectedConflict.entityId}
                  </h1>
                </div>
                <span className="text-xs font-mono bg-slate-900 border border-slate-800 px-3 py-1 rounded text-slate-300">
                  ID: {selectedConflict.entityId}
                </span>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                {selectedConflict.conflict?.resolution?.reason}
              </p>
            </div>

            {/* Side-by-Side Claims Comparison */}
            <div className="bg-surface border border-border rounded-lg p-5 space-y-4">
              <h3 className="text-xs font-bold uppercase text-slate-300 tracking-wider">
                Competing Evidence & Source Tiers
              </h3>

              <div className="grid grid-cols-2 gap-4">
                {selectedConflict.conflict?.claims?.map((claim: any, idx: number) => (
                  <div
                    key={idx}
                    className="p-4 rounded-lg bg-background border border-border space-y-2.5 text-xs"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-200">
                        Claimed Status: <span className="text-tealVerdict">{claim.value}</span>
                      </span>
                      <span className="text-[10px] font-mono bg-slate-800 px-2 py-0.5 rounded text-slate-300">
                        {claim.region.toUpperCase()}
                      </span>
                    </div>

                    <div className="space-y-1 text-slate-400 text-[11px]">
                      <div>
                        Author: <strong className="text-slate-200">{claim.authorId}</strong> (
                        {claim.authorRole})
                      </div>
                      <div>
                        Source Tier: <strong className="text-amberVerdict">{claim.tier}</strong>
                      </div>
                      <div className="font-mono text-slate-500">
                        Timestamp: {new Date(claim.timestamp).toLocaleTimeString()}
                      </div>
                      <div className="font-mono text-[10px] text-slate-500 truncate">
                        Op ID: {claim.opId}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Adjudication Action Box */}
            <div className="bg-surface border border-border rounded-lg p-5 space-y-4">
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-tealVerdict" />
                <h3 className="text-xs font-bold uppercase text-slate-200 tracking-wider">
                  Reviewer Adjudication & Signature
                </h3>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs text-slate-300 font-semibold">Adjudicated Status</label>
                  <select
                    value={resolutionStatus}
                    onChange={e => setResolutionStatus(e.target.value)}
                    className="w-full bg-background border border-border rounded p-2 text-xs text-slate-100"
                  >
                    <option value="OPEN">OPEN (Verified Clear)</option>
                    <option value="BLOCKED">BLOCKED (Safety Hazard Confirmed)</option>
                    <option value="Investigating">Investigating</option>
                    <option value="Resolved">Resolved (Rescue Complete)</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs text-slate-300 font-semibold">Audited Reviewer Identity</label>
                  <div className="p-2 bg-background border border-border rounded text-xs font-mono text-slate-200 flex items-center gap-2">
                    <UserCheck className="w-3.5 h-3.5 text-tealVerdict" />
                    reviewer_alice (Certified Incident Reviewer)
                  </div>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs text-slate-300 font-semibold">Resolution Rationale</label>
                <input
                  type="text"
                  value={resolutionReason}
                  onChange={e => setResolutionReason(e.target.value)}
                  className="w-full bg-background border border-border rounded p-2 text-xs text-slate-100"
                />
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  onClick={handleResolve}
                  className="px-5 py-2.5 bg-tealVerdict text-slate-900 font-bold text-xs rounded hover:bg-teal-400 transition flex items-center gap-2"
                >
                  <FileCheck className="w-4 h-4" />
                  Sign Operational Resolution
                </button>
                {successMsg && (
                  <span className="text-xs text-tealVerdict font-mono">{successMsg}</span>
                )}
              </div>
            </div>
          </>
        ) : (
          <div className="text-center py-24 text-slate-500 font-mono text-xs">
            Select a contested record from the inbox to review conflicting claims.
          </div>
        )}
      </div>
    </div>
  );
};
