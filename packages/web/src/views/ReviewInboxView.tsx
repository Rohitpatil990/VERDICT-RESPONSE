import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api, Region } from '../api/client.js';
import {
  Inbox,
  AlertTriangle,
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
      const confs = (mapRes?.entities || []).filter(
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
    <div className="h-full flex overflow-hidden bg-background">
      {/* Conflicts List */}
      <div className="w-80 border-r border-border bg-surface flex flex-col">
        <div className="p-4 border-b border-border flex items-center justify-between bg-white">
          <div>
            <h2 className="text-sm font-bold text-primaryText">Review Inbox</h2>
            <p className="text-xs text-secondaryText mt-0.5">
              Unresolved concurrent disputes requiring human adjudication.
            </p>
          </div>
          <button
            onClick={loadConflicts}
            className="p-1.5 text-secondaryText hover:text-primaryText hover:bg-slate-100 rounded-md transition"
            title="Refresh conflicts"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto divide-y divide-border">
          {entities.length === 0 ? (
            <div className="text-center py-16 px-6 text-secondaryText text-xs flex flex-col items-center gap-3">
              <Inbox className="w-8 h-8 text-slate-400" />
              <p className="font-semibold text-primaryText">Zero contested records</p>
              <p className="text-[11px] text-secondaryText max-w-xs">
                All records are causally resolved. To trigger a dispute, simulate a partition and submit conflicting reports from different regions.
              </p>
            </div>
          ) : (
            entities.map(e => (
              <div
                key={e.entityId}
                onClick={() => setSelectedConflict(e)}
                className={`p-3.5 cursor-pointer transition ${
                  selectedConflict?.entityId === e.entityId
                    ? 'bg-red-50/60 border-l-2 border-error'
                    : 'bg-white hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-bold text-primaryText">
                    {e.attributes?.reports?.[0]?.name || e.entityId}
                  </span>
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-amber-100 text-warning font-semibold">
                    DISPUTE
                  </span>
                </div>
                <div className="text-xs text-secondaryText">
                  Authority: {e.authorityRegion?.toUpperCase()} · Claims: {e.conflict?.claims?.length || 0}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Adjudication View */}
      <div className="flex-1 p-6 overflow-y-auto space-y-5">
        {selectedConflict ? (
          <>
            <div className="bg-surface border border-border rounded-lg p-5 space-y-2 shadow-subtle">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[11px] font-mono text-secondaryText uppercase tracking-wider">
                    Contested Incident Record
                  </span>
                  <h1 className="text-base font-bold text-primaryText mt-0.5">
                    {selectedConflict.attributes?.reports?.[0]?.name || selectedConflict.entityId}
                  </h1>
                </div>
                <span className="text-xs font-mono bg-slate-50 border border-border px-2.5 py-1 rounded text-secondaryText">
                  ID: {selectedConflict.entityId}
                </span>
              </div>
              <p className="text-xs text-secondaryText leading-relaxed">
                {selectedConflict.conflict?.resolution?.reason || 'Concurrent updates arrived during partition.'}
              </p>
            </div>

            {/* Competing Evidence Comparison */}
            <div className="bg-surface border border-border rounded-lg p-5 space-y-3.5 shadow-subtle">
              <h3 className="text-xs font-semibold uppercase text-secondaryText tracking-wider">
                Competing Regional Claims
              </h3>

              <div className="grid grid-cols-2 gap-4">
                {selectedConflict.conflict?.claims?.map((claim: any, idx: number) => (
                  <div
                    key={idx}
                    className="p-3.5 rounded-md bg-slate-50 border border-border space-y-2 text-xs"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-primaryText">
                        Claimed: <strong className={claim.value === 'OPEN' ? 'text-success' : 'text-error'}>{claim.value}</strong>
                      </span>
                      <span className="text-[10px] font-mono bg-white border border-border px-1.5 py-0.5 rounded text-primaryText">
                        {claim.region.toUpperCase()}
                      </span>
                    </div>

                    <div className="space-y-0.5 text-secondaryText text-[11px]">
                      <div>Author: {claim.authorId} ({claim.authorRole})</div>
                      <div>Source Tier: {claim.tier}</div>
                      <div className="font-mono text-tertiaryText text-[10px] truncate">
                        Op: {claim.opId}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Adjudication Action Box */}
            <div className="bg-surface border border-border rounded-lg p-5 space-y-3.5 shadow-subtle">
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-primaryAction" />
                <h3 className="text-xs font-semibold uppercase text-primaryText tracking-wider">
                  Reviewer Adjudication
                </h3>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs text-secondaryText font-medium">Adjudicated Status</label>
                  <select
                    value={resolutionStatus}
                    onChange={e => setResolutionStatus(e.target.value)}
                    className="w-full bg-white border border-border rounded-md p-2 text-xs text-primaryText focus:outline-none focus:border-primaryAction"
                  >
                    <option value="OPEN">OPEN (Verified Clear)</option>
                    <option value="BLOCKED">BLOCKED (Hazard Confirmed)</option>
                    <option value="Investigating">Investigating</option>
                    <option value="Resolved">Resolved</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs text-secondaryText font-medium">Audited Reviewer Identity</label>
                  <div className="p-2 bg-slate-50 border border-border rounded-md text-xs font-mono text-primaryText flex items-center gap-2">
                    <UserCheck className="w-3.5 h-3.5 text-primaryAction" />
                    reviewer_alice (Certified)
                  </div>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs text-secondaryText font-medium">Resolution Rationale</label>
                <input
                  type="text"
                  value={resolutionReason}
                  onChange={e => setResolutionReason(e.target.value)}
                  className="w-full bg-white border border-border rounded-md p-2 text-xs text-primaryText focus:outline-none focus:border-primaryAction"
                />
              </div>

              <div className="flex items-center gap-3 pt-1">
                <button
                  onClick={handleResolve}
                  className="px-4 py-2 bg-primaryAction hover:bg-primaryActionHover text-white font-semibold text-xs rounded-md transition shadow-subtle flex items-center gap-1.5"
                >
                  <FileCheck className="w-4 h-4" />
                  Sign Operational Resolution
                </button>
                {successMsg && (
                  <span className="text-xs text-success font-mono">{successMsg}</span>
                )}
              </div>
            </div>
          </>
        ) : (
          <div className="text-center py-20 text-secondaryText font-mono text-xs">
            Select a contested record from the inbox to review conflicting claims.
          </div>
        )}
      </div>
    </div>
  );
};
