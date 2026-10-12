import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api, Region } from '../api/client.js';
import {
  CheckCircle,
  AlertTriangle,
  XCircle,
  RefreshCw,
  ShieldCheck,
  Activity,
  ArrowRight
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
      const safeList = Array.isArray(list)
        ? list
        : Object.values(list || {}).filter((x: any) => x && typeof x === 'object' && x.decisionId);
      setDecisions(safeList);
      if (safeList.length > 0 && !selectedDecision) {
        setSelectedDecision(safeList[0]);
      }
    } catch (err) {
      console.error(err);
      setDecisions([]);
    }
  };

  useEffect(() => {
    loadDecisions();
  }, [viewingRegion]);

  useEffect(() => {
    if (!selectedDecision?.decisionId) return;
    setLoading(true);
    api
      .getReevaluation(selectedDecision.decisionId, viewingRegion)
      .then(res => setReevalData(res))
      .catch((err) => {
        console.error(err);
        setReevalData(null);
      })
      .finally(() => setLoading(false));
  }, [selectedDecision, viewingRegion]);

  const safeDecisions = Array.isArray(decisions) ? decisions : [];

  return (
    <div className="h-full flex overflow-hidden bg-background">
      {/* Decisions List Table */}
      <div className="w-80 border-r border-border bg-surface flex flex-col">
        <div className="p-4 border-b border-border flex items-center justify-between bg-white">
          <div>
            <h2 className="text-sm font-bold text-primaryText">Decision Receipts</h2>
            <p className="text-xs text-secondaryText mt-0.5">
              Re-evaluates past commitments against merged state.
            </p>
          </div>
          <button
            onClick={loadDecisions}
            className="p-1.5 text-secondaryText hover:text-primaryText hover:bg-slate-100 rounded-md transition"
            title="Refresh receipts"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto divide-y divide-border">
          {safeDecisions.length === 0 ? (
            <div className="text-center py-16 px-6 text-secondaryText text-xs flex flex-col items-center gap-3">
              <ShieldCheck className="w-8 h-8 text-slate-400" />
              <p className="font-semibold text-primaryText">No decision receipts yet</p>
              <p className="text-[11px] text-secondaryText max-w-xs">
                Commit a decision from the <strong>Decision Gate</strong> tab to generate an immutable cryptographic receipt.
              </p>
              {onOpenGateWithEntity && (
                <button
                  onClick={() => onOpenGateWithEntity('access-corridor-north')}
                  className="px-3 py-1.5 bg-primaryAction hover:bg-primaryActionHover text-white font-medium rounded-md text-xs transition mt-2 shadow-subtle"
                >
                  Open Decision Gate
                </button>
              )}
            </div>
          ) : (
            safeDecisions.map(d => (
              <div
                key={d.decisionId}
                onClick={() => setSelectedDecision(d)}
                className={`p-3.5 cursor-pointer transition ${
                  selectedDecision?.decisionId === d.decisionId
                    ? 'bg-blue-50/70 border-l-2 border-primaryAction'
                    : 'bg-white hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-mono font-semibold text-primaryText">
                    {d.decisionId}
                  </span>
                  <span
                    className={`text-[10px] font-mono px-1.5 py-0.5 rounded font-bold ${
                      d.verdictAtTime === 'GO'
                        ? 'bg-green-100 text-success'
                        : d.verdictAtTime === 'CAUTION'
                        ? 'bg-amber-100 text-warning'
                        : 'bg-red-100 text-error'
                    }`}
                  >
                    {d.verdictAtTime}
                  </span>
                </div>
                <div className="text-xs text-secondaryText">
                  Type: <span className="font-medium text-primaryText">{d.type}</span> · {d.region?.toUpperCase()}
                </div>
                <div className="text-[11px] text-tertiaryText font-mono mt-0.5">
                  Actor: {d.actor} · {new Date(d.timestamp).toLocaleTimeString()}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Decision Detail & Then-vs-Now Diff */}
      <div className="flex-1 p-6 overflow-y-auto space-y-5">
        {selectedDecision ? (
          <>
            {/* Status Header */}
            <div className="bg-surface border border-border rounded-lg p-5 space-y-3 shadow-subtle">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[11px] font-mono text-secondaryText uppercase tracking-wider">
                    Immutable Decision Receipt
                  </span>
                  <h1 className="text-base font-bold text-primaryText mt-0.5">
                    {selectedDecision.decisionId}
                  </h1>
                </div>

                {reevalData && (
                  <div className="flex items-center gap-2">
                    {reevalData.status === 'STILL_VALID' && (
                      <span className="px-3 py-1 rounded-md bg-green-50 border border-green-200 text-success font-semibold text-xs flex items-center gap-1.5">
                        <CheckCircle className="w-4 h-4" />
                        STILL VALID
                      </span>
                    )}
                    {reevalData.status === 'NEEDS_RECHECK' && (
                      <span className="px-3 py-1 rounded-md bg-amber-50 border border-amber-200 text-warning font-semibold text-xs flex items-center gap-1.5">
                        <AlertTriangle className="w-4 h-4" />
                        NEEDS RE-CHECK
                      </span>
                    )}
                    {reevalData.status === 'INVALIDATED' && (
                      <span className="px-3 py-1 rounded-md bg-red-50 border border-red-200 text-error font-semibold text-xs flex items-center gap-1.5">
                        <XCircle className="w-4 h-4" />
                        INVALIDATED
                      </span>
                    )}
                  </div>
                )}
              </div>

              {reevalData && (
                <div className="p-3 bg-slate-50 rounded-md border border-border text-xs text-secondaryText">
                  <strong className="text-primaryText">Re-evaluation Basis:</strong> {reevalData.summary}
                </div>
              )}
            </div>

            {/* Then vs Now Diff */}
            <div className="bg-surface border border-border rounded-lg p-5 space-y-3.5 shadow-subtle">
              <h2 className="text-xs font-semibold uppercase text-secondaryText tracking-wider flex items-center gap-2">
                <Activity className="w-4 h-4 text-primaryAction" />
                Then vs Now Dependency Diff (Conflict Blast Radius)
              </h2>

              {loading ? (
                <div className="text-xs font-mono text-secondaryText py-6 text-center">
                  Comparing dependency vectors against current merged truth...
                </div>
              ) : reevalData?.diffs?.length > 0 ? (
                <div className="space-y-2.5">
                  {reevalData.diffs.map((diff: any, idx: number) => (
                    <div
                      key={idx}
                      className={`p-3.5 rounded-md border text-xs space-y-2 ${
                        diff.statusChanged
                          ? 'bg-red-50/50 border-red-200'
                          : 'bg-slate-50/70 border-border'
                      }`}
                    >
                      <div className="flex items-center justify-between font-mono">
                        <span className="font-semibold text-primaryText">Entity: {diff.entityId}</span>
                        {diff.statusChanged && (
                          <span className="text-[10px] uppercase font-bold text-error bg-red-100 px-2 py-0.5 rounded">
                            Basis Changed
                          </span>
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-3 pt-1">
                        <div className="p-2.5 rounded bg-white border border-border">
                          <div className="text-[10px] uppercase text-secondaryText font-medium mb-0.5">
                            What It Saw Then
                          </div>
                          <div className="font-mono text-primaryText font-bold">
                            {diff.assumedStatus}
                          </div>
                        </div>

                        <div className="p-2.5 rounded bg-white border border-border">
                          <div className="text-[10px] uppercase text-secondaryText font-medium mb-0.5">
                            What Is Known Now
                          </div>
                          <div
                            className={`font-mono font-bold ${
                              diff.statusChanged ? 'text-error' : 'text-success'
                            }`}
                          >
                            {diff.currentStatus}
                          </div>
                        </div>
                      </div>

                      {diff.causingOpIds?.length > 0 && (
                        <div className="text-[11px] text-secondaryText pt-1">
                          Causing operations arrived after heal:{' '}
                          <span className="font-mono text-warning font-semibold">
                            {diff.causingOpIds.join(', ')}
                          </span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-xs text-secondaryText py-4 text-center">
                  All recorded dependencies match current replica view.
                </div>
              )}
            </div>

            {/* Remediation Action */}
            <div className="p-4 bg-surface border border-border rounded-lg flex items-center justify-between shadow-subtle">
              <div>
                <div className="text-xs font-semibold text-primaryText">Operational Remediation</div>
                <div className="text-[11px] text-secondaryText">
                  Re-evaluate Decision Gate against current truth to create a newly linked receipt.
                </div>
              </div>

              {onOpenGateWithEntity && (
                <button
                  onClick={() =>
                    onOpenGateWithEntity(selectedDecision.dependencies?.[0]?.entityId || 'access-corridor-north')
                  }
                  className="px-3.5 py-1.5 bg-primaryAction hover:bg-primaryActionHover text-white font-medium text-xs rounded-md transition shadow-subtle"
                >
                  Re-evaluate in Gate
                </button>
              )}
            </div>
          </>
        ) : (
          <div className="text-center py-20 text-secondaryText font-mono text-xs">
            Select a decision receipt on the left to inspect its blast radius.
          </div>
        )}
      </div>
    </div>
  );
};
