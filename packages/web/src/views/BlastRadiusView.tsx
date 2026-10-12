import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api, Region } from '../api/client.js';
import {
  GitCommit,
  CheckCircle,
  AlertTriangle,
  XCircle,
  RefreshCw,
  ArrowRight,
  ShieldCheck,
  Activity
} from 'lucide-react';

interface BlastRadiusViewProps {
  viewingRegion: Region;
  onOpenGateWithEntity?: (entityId: string) => void;
}

export const BlastRadiusView: React.FC<BlastRadiusViewProps> = ({
  viewingRegion,
  onOpenGateWithEntity
}) => {
  const { t } = useTranslation();
  const [decisions, setDecisions] = useState<any[]>([]);
  const [selectedDecision, setSelectedDecision] = useState<any | null>(null);
  const [reevalData, setReevalData] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);

  const loadDecisions = async () => {
    try {
      const list = await api.getDecisions(viewingRegion);
      setDecisions(list);
      if (list.length > 0 && !selectedDecision) {
        setSelectedDecision(list[0]);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    loadDecisions();
  }, [viewingRegion]);

  useEffect(() => {
    if (!selectedDecision) return;
    setLoading(true);
    api
      .getReevaluation(selectedDecision.decisionId, viewingRegion)
      .then(res => setReevalData(res))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [selectedDecision, viewingRegion]);

  return (
    <div className="h-full flex overflow-hidden">
      {/* Decisions List Table */}
      <div className="w-[45%] border-r border-border bg-surface flex flex-col">
        <div className="p-4 border-b border-border flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold uppercase tracking-wider text-tealVerdict">
              Decision Receipts & Blast Radius
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Re-evaluates past commitments against merged multi-region state.
            </p>
          </div>
          <button
            onClick={loadDecisions}
            className="p-1.5 text-slate-400 hover:text-slate-100 hover:bg-slate-800 rounded transition"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto divide-y divide-border">
          {decisions.length === 0 ? (
            <div className="text-center py-16 text-slate-500 text-xs font-mono">
              No decisions recorded yet. Commit a decision from the Decision Gate.
            </div>
          ) : (
            decisions.map(d => (
              <div
                key={d.decisionId}
                onClick={() => setSelectedDecision(d)}
                className={`p-4 cursor-pointer transition ${
                  selectedDecision?.decisionId === d.decisionId
                    ? 'bg-slate-800/80 border-l-2 border-tealVerdict'
                    : 'bg-background/40 hover:bg-slate-800/40'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-mono font-semibold text-slate-200">
                    {d.decisionId}
                  </span>
                  <span
                    className={`text-[10px] font-mono px-1.5 py-0.5 rounded font-bold ${
                      d.verdictAtTime === 'GO'
                        ? 'bg-tealVerdict/10 text-tealVerdict'
                        : d.verdictAtTime === 'CAUTION'
                        ? 'bg-amberVerdict/10 text-amberVerdict'
                        : 'bg-roseVerdict/10 text-roseVerdict'
                    }`}
                  >
                    {d.verdictAtTime}
                  </span>
                </div>
                <div className="text-xs text-slate-400">
                  Type: <span className="font-semibold text-slate-300">{d.type}</span> · Region:{' '}
                  {d.region?.toUpperCase()}
                </div>
                <div className="text-[11px] text-slate-500 font-mono mt-1">
                  Actor: {d.actor} · {new Date(d.timestamp).toLocaleTimeString()}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Decision Detail & Then-vs-Now Diff */}
      <div className="flex-1 p-6 overflow-y-auto space-y-6">
        {selectedDecision ? (
          <>
            {/* Status Header */}
            <div className="bg-surface border border-border rounded-lg p-5 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-mono text-slate-400">Selected Decision Receipt</span>
                  <h1 className="text-base font-bold text-slate-100">{selectedDecision.decisionId}</h1>
                </div>

                {reevalData && (
                  <div className="flex items-center gap-2">
                    {reevalData.status === 'STILL_VALID' && (
                      <span className="px-3 py-1 rounded bg-tealVerdict/15 border border-tealVerdict text-tealVerdict font-bold text-xs flex items-center gap-1.5">
                        <CheckCircle className="w-4 h-4" />
                        STILL VALID
                      </span>
                    )}
                    {reevalData.status === 'NEEDS_RECHECK' && (
                      <span className="px-3 py-1 rounded bg-amberVerdict/15 border border-amberVerdict text-amberVerdict font-bold text-xs flex items-center gap-1.5">
                        <AlertTriangle className="w-4 h-4" />
                        NEEDS RE-CHECK
                      </span>
                    )}
                    {reevalData.status === 'INVALIDATED' && (
                      <span className="px-3 py-1 rounded bg-roseVerdict/15 border border-roseVerdict text-roseVerdict font-bold text-xs flex items-center gap-1.5">
                        <XCircle className="w-4 h-4" />
                        INVALIDATED
                      </span>
                    )}
                  </div>
                )}
              </div>

              {reevalData && (
                <div className="p-3 bg-background rounded border border-border text-xs text-slate-300">
                  <span className="font-semibold">Re-evaluation Basis:</span> {reevalData.summary}
                </div>
              )}
            </div>

            {/* Then vs Now Diff */}
            <div className="bg-surface border border-border rounded-lg p-5 space-y-4">
              <h3 className="text-xs font-bold uppercase text-slate-300 tracking-wider flex items-center gap-2">
                <Activity className="w-4 h-4 text-purpleVerdict" />
                Then vs Now Dependency Diff (Conflict Blast Radius)
              </h3>

              {loading ? (
                <div className="text-xs font-mono text-slate-500 py-6 text-center animate-pulse">
                  Comparing dependency vectors against current merged truth...
                </div>
              ) : reevalData?.diffs?.length > 0 ? (
                <div className="space-y-3">
                  {reevalData.diffs.map((diff: any, idx: number) => (
                    <div
                      key={idx}
                      className={`p-4 rounded border text-xs space-y-2 ${
                        diff.statusChanged
                          ? 'bg-roseVerdict/5 border-roseVerdict/40'
                          : 'bg-background border-border'
                      }`}
                    >
                      <div className="flex items-center justify-between font-mono">
                        <span className="font-bold text-slate-200">Entity: {diff.entityId}</span>
                        {diff.statusChanged && (
                          <span className="text-[10px] uppercase font-bold text-roseVerdict bg-roseVerdict/10 px-2 py-0.5 rounded">
                            Basis Changed
                          </span>
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-4 pt-1">
                        <div className="p-2.5 rounded bg-slate-900 border border-slate-800">
                          <div className="text-[10px] uppercase text-slate-400 font-semibold mb-0.5">
                            What It Saw Then
                          </div>
                          <div className="font-mono text-slate-300 font-bold">
                            {diff.assumedStatus}
                          </div>
                        </div>

                        <div className="p-2.5 rounded bg-slate-900 border border-slate-800">
                          <div className="text-[10px] uppercase text-slate-400 font-semibold mb-0.5">
                            What Is Known Now
                          </div>
                          <div
                            className={`font-mono font-bold ${
                              diff.statusChanged ? 'text-roseVerdict' : 'text-tealVerdict'
                            }`}
                          >
                            {diff.currentStatus}
                          </div>
                        </div>
                      </div>

                      {diff.causingOpIds.length > 0 && (
                        <div className="text-[11px] text-slate-400 pt-1">
                          Causing operations arrived after heal:{' '}
                          <span className="font-mono text-amberVerdict">
                            {diff.causingOpIds.join(', ')}
                          </span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-xs text-slate-400 py-4 text-center">
                  All recorded dependencies match current replica view.
                </div>
              )}
            </div>

            {/* Remediation Action */}
            <div className="p-4 bg-surface border border-border rounded-lg flex items-center justify-between">
              <div>
                <div className="text-xs font-semibold text-slate-200">Operational Remediation</div>
                <div className="text-[11px] text-slate-400">
                  Re-run Decision Gate against current truth to create a newly linked decision receipt.
                </div>
              </div>

              {onOpenGateWithEntity && (
                <button
                  onClick={() =>
                    onOpenGateWithEntity(selectedDecision.dependencies?.[0]?.entityId || 'access-corridor-north')
                  }
                  className="px-4 py-2 bg-tealVerdict text-slate-900 font-bold text-xs rounded hover:bg-teal-400 transition"
                >
                  Re-evaluate in Gate Now
                </button>
              )}
            </div>
          </>
        ) : (
          <div className="text-center py-24 text-slate-500 font-mono text-xs">
            Select a decision from the left to inspect its blast radius.
          </div>
        )}
      </div>
    </div>
  );
};
