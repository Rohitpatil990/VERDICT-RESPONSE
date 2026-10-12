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
  FileText
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
    <div className="w-96 border-l border-border bg-surface flex flex-col h-full shadow-2xl z-20 transition-all">
      {/* Header */}
      <div className="p-4 border-b border-border flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono uppercase bg-slate-800 text-tealVerdict px-2 py-0.5 rounded border border-border">
              {data?.type || 'Entity'}
            </span>
            <span className="text-xs text-slate-400 font-mono">{entityId}</span>
          </div>
          <h3 className="text-sm font-semibold text-slate-100 mt-1">
            {data?.attributes?.reports?.[0]?.name || data?.entityId}
          </h3>
        </div>
        <button
          onClick={onClose}
          className="p-1 text-slate-400 hover:text-slate-100 hover:bg-slate-800 rounded transition"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border bg-background text-xs font-medium">
        <button
          onClick={() => setActiveTab('indicators')}
          className={`flex-1 py-2 text-center border-b-2 transition ${
            activeTab === 'indicators'
              ? 'border-tealVerdict text-tealVerdict'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          SourceTrace
        </button>
        <button
          onClick={() => setActiveTab('claims')}
          className={`flex-1 py-2 text-center border-b-2 transition ${
            activeTab === 'claims'
              ? 'border-tealVerdict text-tealVerdict'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          Claims & Conflicts
        </button>
        <button
          onClick={() => setActiveTab('lineage')}
          className={`flex-1 py-2 text-center border-b-2 transition ${
            activeTab === 'lineage'
              ? 'border-tealVerdict text-tealVerdict'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          Lineage
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {loading ? (
          <div className="text-center py-12 text-slate-400 text-xs font-mono animate-pulse">
            Loading entity ledger...
          </div>
        ) : (
          <>
            {activeTab === 'indicators' && trace && (
              <div className="space-y-3">
                <div className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                  Six-Indicator Operational Audit
                </div>

                {/* 1. Source */}
                <div className="p-2.5 rounded bg-background border border-border flex items-start gap-3">
                  <FileText className="w-4 h-4 text-purpleVerdict mt-0.5 shrink-0" />
                  <div className="text-xs">
                    <div className="font-semibold text-slate-200">1. Source & Provenance</div>
                    <div className="text-slate-400 mt-0.5">
                      Origin: {trace.indicators.source.originRegion.toUpperCase()} · Tier:{' '}
                      {trace.indicators.source.tier}
                    </div>
                    <div className="text-slate-500 font-mono text-[11px]">
                      Author: {trace.indicators.source.authorId} ({trace.indicators.source.role})
                    </div>
                  </div>
                </div>

                {/* 2. Freshness */}
                <div className="p-2.5 rounded bg-background border border-border flex items-start gap-3">
                  <Clock className="w-4 h-4 text-tealVerdict mt-0.5 shrink-0" />
                  <div className="text-xs">
                    <div className="font-semibold text-slate-200">2. Freshness</div>
                    <div className="text-slate-400 mt-0.5">
                      Reported {trace.indicators.freshness.minutesAgo} min ago (
                      {trace.indicators.freshness.isFresh ? 'Within freshness window' : 'Stale observation'}
                      )
                    </div>
                  </div>
                </div>

                {/* 3. Conflict */}
                <div className="p-2.5 rounded bg-background border border-border flex items-start gap-3">
                  {trace.indicators.conflict.hasConflict ? (
                    <AlertTriangle className="w-4 h-4 text-roseVerdict mt-0.5 shrink-0" />
                  ) : (
                    <CheckCircle className="w-4 h-4 text-tealVerdict mt-0.5 shrink-0" />
                  )}
                  <div className="text-xs">
                    <div className="font-semibold text-slate-200">3. Conflict Status</div>
                    <div
                      className={`mt-0.5 font-medium ${
                        trace.indicators.conflict.hasConflict ? 'text-roseVerdict' : 'text-tealVerdict'
                      }`}
                    >
                      {trace.indicators.conflict.status}
                    </div>
                    {trace.indicators.conflict.hasConflict && (
                      <div className="text-slate-400 text-[11px] mt-0.5">
                        Multiple concurrent claims detected; awaiting reviewer signature.
                      </div>
                    )}
                  </div>
                </div>

                {/* 4. Replication */}
                <div className="p-2.5 rounded bg-background border border-border flex items-start gap-3">
                  <GitBranch className="w-4 h-4 text-amberVerdict mt-0.5 shrink-0" />
                  <div className="text-xs">
                    <div className="font-semibold text-slate-200">4. Cross-Region Replication</div>
                    <div className="text-slate-400 mt-0.5">
                      Present in: {trace.indicators.replication.replicatedRegions.join(', ')}
                    </div>
                  </div>
                </div>

                {/* 5. Integrity */}
                <div className="p-2.5 rounded bg-background border border-border flex items-start gap-3">
                  {trace.indicators.integrity.status === 'VERIFIED' ? (
                    <ShieldCheck className="w-4 h-4 text-tealVerdict mt-0.5 shrink-0" />
                  ) : (
                    <ShieldAlert className="w-4 h-4 text-roseVerdict mt-0.5 shrink-0" />
                  )}
                  <div className="text-xs">
                    <div className="font-semibold text-slate-200">5. Cryptographic Integrity</div>
                    <div className="text-slate-400 mt-0.5">
                      Ed25519 & Hash Chain: {trace.indicators.integrity.status}
                    </div>
                  </div>
                </div>

                {/* 6. Resolution */}
                <div className="p-2.5 rounded bg-background border border-border flex items-start gap-3">
                  <CheckCircle className="w-4 h-4 text-tealVerdict mt-0.5 shrink-0" />
                  <div className="text-xs">
                    <div className="font-semibold text-slate-200">6. Operational Resolution</div>
                    <div className="text-tealVerdict font-semibold mt-0.5">
                      Effective Status: {trace.indicators.resolution.effectiveStatus}
                    </div>
                    <div className="text-slate-400 text-[11px] mt-0.5">
                      Basis: {trace.indicators.resolution.resolvedBy}
                    </div>
                  </div>
                </div>

                {/* Disclaimer */}
                <div className="p-3 bg-slate-900/60 rounded border border-border text-[11px] text-slate-400 leading-relaxed">
                  {trace.disclaimer}
                </div>
              </div>
            )}

            {activeTab === 'claims' && (
              <div className="space-y-3">
                <div className="text-xs font-semibold text-slate-300">
                  Participating Status Claims ({trace?.indicators?.conflict?.claims?.length || 0})
                </div>
                {trace?.indicators?.conflict?.claims?.length > 0 ? (
                  trace.indicators.conflict.claims.map((c: any, i: number) => (
                    <div key={i} className="p-3 rounded bg-background border border-border space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-xs text-slate-200">
                          Claim: {c.value}
                        </span>
                        <span className="text-[10px] font-mono bg-slate-800 px-1.5 py-0.5 rounded text-slate-300">
                          {c.region.toUpperCase()}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-400">
                        Author: {c.authorId} ({c.authorRole}) · Tier: {c.tier}
                      </div>
                      <div className="text-[10px] text-slate-500 font-mono">
                        Op: {c.opId}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-xs text-slate-400 py-4 text-center">
                    Single consistent state claim. No active conflict disputes.
                  </div>
                )}
              </div>
            )}

            {activeTab === 'lineage' && (
              <div className="space-y-3">
                <div className="text-xs font-semibold text-slate-300">Operation Hash Chain</div>
                {data?.participatingOpIds?.map((opId: string, idx: number) => (
                  <div
                    key={idx}
                    className="p-2.5 rounded bg-background border border-border flex items-center justify-between text-xs"
                  >
                    <span className="font-mono text-tealVerdict">{opId}</span>
                    <span className="text-slate-500 text-[11px]">Seq #{idx + 1}</span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Footer Actions */}
      <div className="p-4 border-t border-border bg-background space-y-2">
        {onOpenGateWithEntity && (
          <button
            onClick={() => onOpenGateWithEntity(entityId)}
            className="w-full py-2 bg-tealVerdict text-slate-900 font-semibold text-xs rounded hover:bg-teal-400 transition"
          >
            Evaluate Decision Gate on {entityId}
          </button>
        )}
      </div>
    </div>
  );
};
