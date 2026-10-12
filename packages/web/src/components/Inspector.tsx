import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api, Region } from '../api/client.js';
import {
  ShieldCheck,
  ShieldAlert,
  Clock,
  AlertTriangle,
  GitBranch,
  CheckCircle,
  X,
  FileText,
  ExternalLink,
  ChevronRight
} from 'lucide-react';

interface InspectorProps {
  entityId: string | null;
  region: Region;
  onClose: () => void;
  onOpenGateWithEntity?: (id: string) => void;
}

export const Inspector: React.FC<InspectorProps> = ({
  entityId,
  region,
  onClose,
  onOpenGateWithEntity
}) => {
  const { t } = useTranslation();
  const [data, setData] = useState<any>(null);
  const [trace, setTrace] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'indicators' | 'claims' | 'lineage'>('indicators');

  useEffect(() => {
    if (!entityId) {
      setData(null);
      setTrace(null);
      return;
    }
    setLoading(true);
    Promise.all([api.getRecord(entityId, region), api.getTrace(entityId, region)])
      .then(([rec, tr]) => {
        setData(rec);
        setTrace(tr);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [entityId, region]);

  if (!entityId) return null;

  return (
    <aside aria-label="Entity Inspector" className="w-96 border-l border-border bg-surface flex flex-col h-full shadow-card z-20">
      {/* Header */}
      <div className="p-4 border-b border-border flex items-start justify-between bg-white">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-mono font-semibold uppercase bg-slate-100 text-secondaryText px-1.5 py-0.5 rounded border border-border">
              {data?.type || 'Entity'}
            </span>
            <span className="text-xs text-secondaryText font-mono">{entityId}</span>
          </div>
          <h2 className="text-sm font-bold text-primaryText">
            {data?.attributes?.reports?.[0]?.name || data?.entityId}
          </h2>
          <div className="flex items-center gap-2 mt-1.5">
            <span className="text-xs text-secondaryText">Effective Status:</span>
            <span
              className={`text-xs font-semibold px-2 py-0.5 rounded ${
                data?.status === 'OPEN' || data?.status === 'Resolved'
                  ? 'bg-green-50 text-success border border-green-200'
                  : data?.status === 'BLOCKED'
                  ? 'bg-red-50 text-error border border-red-200'
                  : 'bg-amber-50 text-warning border border-amber-200'
              }`}
            >
              {data?.status || 'Active'}
            </span>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-1 text-secondaryText hover:text-primaryText hover:bg-slate-100 rounded-md transition"
          title="Close Inspector"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border bg-slate-50/60 text-xs font-medium px-2">
        <button
          onClick={() => setActiveTab('indicators')}
          className={`py-2 px-3 border-b-2 transition ${
            activeTab === 'indicators'
              ? 'border-primaryAction text-primaryAction font-semibold'
              : 'border-transparent text-secondaryText hover:text-primaryText'
          }`}
        >
          SourceTrace
        </button>
        <button
          onClick={() => setActiveTab('claims')}
          className={`py-2 px-3 border-b-2 transition ${
            activeTab === 'claims'
              ? 'border-primaryAction text-primaryAction font-semibold'
              : 'border-transparent text-secondaryText hover:text-primaryText'
          }`}
        >
          Claims & Conflicts
        </button>
        <button
          onClick={() => setActiveTab('lineage')}
          className={`py-2 px-3 border-b-2 transition ${
            activeTab === 'lineage'
              ? 'border-primaryAction text-primaryAction font-semibold'
              : 'border-transparent text-secondaryText hover:text-primaryText'
          }`}
        >
          Lineage
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-white">
        {loading ? (
          <div className="text-center py-12 text-secondaryText text-xs font-mono">
            Loading entity ledger...
          </div>
        ) : (
          <>
            {activeTab === 'indicators' && trace && (
              <div className="space-y-2.5">
                <div className="text-[11px] font-semibold text-secondaryText uppercase tracking-wider mb-1">
                  6-Indicator Operational Audit
                </div>

                {/* 1. Source */}
                <div className="p-3 rounded-md bg-slate-50 border border-border flex items-start gap-3">
                  <FileText className="w-4 h-4 text-primaryAction mt-0.5 shrink-0" />
                  <div className="text-xs">
                    <div className="font-semibold text-primaryText">1. Source & Provenance</div>
                    <div className="text-secondaryText mt-0.5">
                      Origin: <strong className="text-primaryText">{trace.indicators.source.originRegion.toUpperCase()}</strong> · Tier:{' '}
                      {trace.indicators.source.tier}
                    </div>
                    <div className="text-secondaryText font-mono text-[11px] mt-0.5">
                      Author: {trace.indicators.source.authorId} ({trace.indicators.source.role})
                    </div>
                  </div>
                </div>

                {/* 2. Freshness */}
                <div className="p-3 rounded-md bg-slate-50 border border-border flex items-start gap-3">
                  <Clock className="w-4 h-4 text-tealVerdict mt-0.5 shrink-0" />
                  <div className="text-xs">
                    <div className="font-semibold text-primaryText">2. Observation Freshness</div>
                    <div className="text-secondaryText mt-0.5">
                      Observed {trace.indicators.freshness.minutesAgo} min ago (
                      {trace.indicators.freshness.isFresh ? 'Within freshness window' : 'Stale observation'}
                      )
                    </div>
                  </div>
                </div>

                {/* 3. Conflict */}
                <div className="p-3 rounded-md bg-slate-50 border border-border flex items-start gap-3">
                  {trace.indicators.conflict.hasConflict ? (
                    <AlertTriangle className="w-4 h-4 text-error mt-0.5 shrink-0" />
                  ) : (
                    <CheckCircle className="w-4 h-4 text-success mt-0.5 shrink-0" />
                  )}
                  <div className="text-xs">
                    <div className="font-semibold text-primaryText">3. Conflict Status</div>
                    <div
                      className={`mt-0.5 font-medium ${
                        trace.indicators.conflict.hasConflict ? 'text-error' : 'text-success'
                      }`}
                    >
                      {trace.indicators.conflict.status}
                    </div>
                    {trace.indicators.conflict.hasConflict && (
                      <div className="text-secondaryText text-[11px] mt-0.5">
                        Concurrent divergent claims detected across partitioned regions.
                      </div>
                    )}
                  </div>
                </div>

                {/* 4. Replication */}
                <div className="p-3 rounded-md bg-slate-50 border border-border flex items-start gap-3">
                  <GitBranch className="w-4 h-4 text-warning mt-0.5 shrink-0" />
                  <div className="text-xs">
                    <div className="font-semibold text-primaryText">4. Cross-Region Replication</div>
                    <div className="text-secondaryText mt-0.5">
                      Present in: {trace.indicators.replication.replicatedRegions.join(', ')}
                    </div>
                  </div>
                </div>

                {/* 5. Integrity */}
                <div className="p-3 rounded-md bg-slate-50 border border-border flex items-start gap-3">
                  {trace.indicators.integrity.status === 'VERIFIED' ? (
                    <ShieldCheck className="w-4 h-4 text-success mt-0.5 shrink-0" />
                  ) : (
                    <ShieldAlert className="w-4 h-4 text-error mt-0.5 shrink-0" />
                  )}
                  <div className="text-xs">
                    <div className="font-semibold text-primaryText">5. Cryptographic Integrity</div>
                    <div className="text-secondaryText mt-0.5">
                      Ed25519 & SHA-256 Hash Chain: <strong className="text-primaryText">{trace.indicators.integrity.status}</strong>
                    </div>
                  </div>
                </div>

                {/* 6. Resolution */}
                <div className="p-3 rounded-md bg-slate-50 border border-border flex items-start gap-3">
                  <CheckCircle className="w-4 h-4 text-primaryAction mt-0.5 shrink-0" />
                  <div className="text-xs">
                    <div className="font-semibold text-primaryText">6. Operational Resolution</div>
                    <div className="text-primaryText font-semibold mt-0.5">
                      Status: {trace.indicators.resolution.effectiveStatus}
                    </div>
                    <div className="text-secondaryText text-[11px] mt-0.5">
                      Rule: {trace.indicators.resolution.resolvedBy}
                    </div>
                  </div>
                </div>

                {/* Disclaimer */}
                <div className="p-2.5 bg-slate-50 rounded-md border border-border text-[11px] text-secondaryText leading-relaxed">
                  {trace.disclaimer}
                </div>
              </div>
            )}

            {activeTab === 'claims' && (
              <div className="space-y-2.5">
                <div className="text-xs font-semibold text-secondaryText">
                  Participating Status Claims ({trace?.indicators?.conflict?.claims?.length || 0})
                </div>
                {trace?.indicators?.conflict?.claims?.length > 0 ? (
                  trace.indicators.conflict.claims.map((c: any, i: number) => (
                    <div key={i} className="p-3 rounded-md bg-slate-50 border border-border space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-xs text-primaryText">
                          Claim: {c.value}
                        </span>
                        <span className="text-[10px] font-mono font-medium bg-white border border-border px-1.5 py-0.5 rounded text-secondaryText">
                          {c.region.toUpperCase()}
                        </span>
                      </div>
                      <div className="text-[11px] text-secondaryText">
                        Author: {c.authorId} ({c.authorRole}) · Tier: {c.tier}
                      </div>
                      <div className="text-[10px] text-tertiaryText font-mono">
                        Op ID: {c.opId}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-xs text-secondaryText py-6 text-center">
                    Single consistent state claim. No active conflict disputes.
                  </div>
                )}
              </div>
            )}

            {activeTab === 'lineage' && (
              <div className="space-y-2">
                <div className="text-xs font-semibold text-secondaryText">Operation Hash Chain Lineage</div>
                {data?.participatingOpIds?.map((opId: string, idx: number) => (
                  <div
                    key={idx}
                    className="p-2.5 rounded-md bg-slate-50 border border-border flex items-center justify-between text-xs"
                  >
                    <span className="font-mono text-primaryText text-[11px] truncate max-w-[200px]">{opId}</span>
                    <span className="text-secondaryText text-[11px] font-mono">Seq #{idx + 1}</span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Footer Actions */}
      <div className="p-4 border-t border-border bg-slate-50 space-y-2">
        {onOpenGateWithEntity && (
          <button
            onClick={() => onOpenGateWithEntity(entityId)}
            className="w-full py-2 bg-primaryAction hover:bg-primaryActionHover text-white font-semibold text-xs rounded-md transition shadow-subtle flex items-center justify-center gap-1.5"
          >
            <span>Evaluate in Decision Gate</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </aside>
  );
};
