import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { api, Region } from '../api/client.js';
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Shield,
  ArrowRight,
  RefreshCw,
  Info,
  CheckSquare
} from 'lucide-react';

interface GateViewProps {
  viewingRegion: Region;
  selectedEntityId: string | null;
  onReceiptCommitted?: (receipt: any) => void;
}

export const GateView: React.FC<GateViewProps> = ({
  viewingRegion,
  selectedEntityId,
  onReceiptCommitted
}) => {
  const { t } = useTranslation();

  const [decisionType, setDecisionType] = useState<'DISPATCH' | 'ALLOCATE_SUPPLY' | 'CLOSE_INCIDENT'>('DISPATCH');
  const [targetEntityId, setTargetEntityId] = useState(selectedEntityId || 'incident-101');
  const [routeRoads, setRouteRoads] = useState<string[]>(['access-corridor-north', 'route-nh48']);
  const [supplyQty, setSupplyQty] = useState(2);
  const [resourceName, setResourceName] = useState('medical_kits');
  const [actorRole, setActorRole] = useState<'FIELD_OFFICER' | 'OFFICIAL' | 'REVIEWER'>('FIELD_OFFICER');

  const [evaluation, setEvaluation] = useState<any>(null);
  const [evaluating, setEvaluating] = useState(false);
  const [acknowledged, setAcknowledged] = useState(false);
  const [commitSuccess, setCommitSuccess] = useState<string | null>(null);
  const [commitError, setCommitError] = useState<string | null>(null);

  useEffect(() => {
    if (selectedEntityId) {
      setTargetEntityId(selectedEntityId);
    }
  }, [selectedEntityId]);

  const handleEvaluate = async () => {
    setEvaluating(true);
    setCommitSuccess(null);
    setCommitError(null);
    setAcknowledged(false);

    try {
      let params: any = {};
      if (decisionType === 'DISPATCH') {
        params = { routeEntityIds: routeRoads, teamId: 'team-t12' };
      } else if (decisionType === 'ALLOCATE_SUPPLY') {
        params = { resource: resourceName, qty: supplyQty };
      } else if (decisionType === 'CLOSE_INCIDENT') {
        params = { closureReason: 'Rescue completed by municipal unit' };
      }

      const req = {
        type: decisionType,
        entityId: targetEntityId,
        params,
        actorId: `operator-${viewingRegion}`,
        actorRole
      };

      const res = await api.evaluateDecision(req, viewingRegion);
      setEvaluation(res);
    } catch (err: any) {
      console.error(err);
    } finally {
      setEvaluating(false);
    }
  };

  useEffect(() => {
    handleEvaluate();
  }, [decisionType, targetEntityId, routeRoads, supplyQty, resourceName, actorRole, viewingRegion]);

  const handleCommit = async () => {
    if (!evaluation) return;
    try {
      const res = await api.commitDecision(
        {
          request: {
            type: decisionType,
            entityId: targetEntityId,
            params: evaluation.dependencies,
            actorId: `operator-${viewingRegion}`,
            actorRole
          },
          evaluation,
          acknowledgedRisks: acknowledged ? ['Acknowledged remote authority blind-spots'] : []
        },
        viewingRegion
      );
      setCommitSuccess(res.decisionId);
      if (onReceiptCommitted) onReceiptCommitted(res);
    } catch (err: any) {
      setCommitError(err.message || 'Failed to commit receipt');
    }
  };

  return (
    <div className="h-full flex overflow-hidden">
      {/* Left Composer Form */}
      <div className="w-96 border-r border-border bg-surface p-6 flex flex-col gap-5 overflow-y-auto">
        <div>
          <h2 className="text-sm font-bold uppercase tracking-wider text-tealVerdict">
            Decision Composer
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Turn multi-region consistency state into an operational verdict.
          </p>
        </div>

        {/* Viewing Region Badge */}
        <div className="p-3 bg-background border border-border rounded text-xs space-y-1">
          <div className="text-slate-400">Evaluating Region View:</div>
          <div className="font-semibold text-slate-200 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-tealVerdict animate-pulse" />
            {viewingRegion.toUpperCase()} Regional Replica
          </div>
        </div>

        {/* Decision Type */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-slate-300">Decision Type</label>
          <div className="grid grid-cols-1 gap-1.5">
            {[
              { id: 'DISPATCH', label: 'DISPATCH Team along Route' },
              { id: 'ALLOCATE_SUPPLY', label: 'ALLOCATE Scarce Supply' },
              { id: 'CLOSE_INCIDENT', label: 'CLOSE Incident' }
            ].map(dt => (
              <button
                key={dt.id}
                type="button"
                onClick={() => setDecisionType(dt.id as any)}
                className={`py-2 px-3 rounded text-xs text-left font-medium border transition ${
                  decisionType === dt.id
                    ? 'bg-tealVerdict/15 border-tealVerdict text-tealVerdict'
                    : 'bg-background border-border text-slate-400 hover:text-slate-200'
                }`}
              >
                {dt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Dynamic Params */}
        {decisionType === 'DISPATCH' && (
          <div className="space-y-3">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-300">Incident Target</label>
              <input
                type="text"
                value={targetEntityId}
                onChange={e => setTargetEntityId(e.target.value)}
                className="w-full bg-background border border-border rounded p-2 text-xs font-mono text-slate-200"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-300">Route Segments (Roads)</label>
              <div className="space-y-1 bg-background p-2 rounded border border-border">
                {['access-corridor-north', 'route-nh48', 'road-segment-1', 'bypass-corridor-2'].map(r => (
                  <label key={r} className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={routeRoads.includes(r)}
                      onChange={e => {
                        if (e.target.checked) setRouteRoads([...routeRoads, r]);
                        else setRouteRoads(routeRoads.filter(x => x !== r));
                      }}
                      className="accent-tealVerdict"
                    />
                    <span className="font-mono">{r}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        )}

        {decisionType === 'ALLOCATE_SUPPLY' && (
          <div className="space-y-3">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-300">Resource</label>
              <select
                value={resourceName}
                onChange={e => setResourceName(e.target.value)}
                className="w-full bg-background border border-border rounded p-2 text-xs text-slate-200"
              >
                <option value="medical_kits">medical_kits (Stock: 5)</option>
                <option value="emergency_rations">emergency_rations (Stock: 10)</option>
                <option value="portable_generators">portable_generators (Stock: 3)</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-300">Requested Quantity</label>
              <input
                type="number"
                min={1}
                max={10}
                value={supplyQty}
                onChange={e => setSupplyQty(parseInt(e.target.value, 10) || 1)}
                className="w-full bg-background border border-border rounded p-2 text-xs font-mono text-slate-200"
              />
            </div>
          </div>
        )}

        {decisionType === 'CLOSE_INCIDENT' && (
          <div className="space-y-3">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-300">Incident ID</label>
              <input
                type="text"
                value={targetEntityId}
                onChange={e => setTargetEntityId(e.target.value)}
                className="w-full bg-background border border-border rounded p-2 text-xs font-mono text-slate-200"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-300">Actor Role</label>
              <select
                value={actorRole}
                onChange={e => setActorRole(e.target.value as any)}
                className="w-full bg-background border border-border rounded p-2 text-xs text-slate-200"
              >
                <option value="FIELD_OFFICER">FIELD_OFFICER (Non-Reviewer)</option>
                <option value="OFFICIAL">OFFICIAL</option>
                <option value="REVIEWER">REVIEWER (Authorized for Closure)</option>
              </select>
            </div>
          </div>
        )}

        <button
          onClick={handleEvaluate}
          disabled={evaluating}
          className="mt-auto py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-xs font-semibold flex items-center justify-center gap-2 border border-border"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${evaluating ? 'animate-spin' : ''}`} />
          Re-evaluate Gate
        </button>
      </div>

      {/* Right Gate Verdict Display */}
      <div className="flex-1 p-8 overflow-y-auto space-y-6">
        {evaluation ? (
          <>
            {/* Prominent Verdict Card */}
            <div
              className={`p-6 rounded-lg border flex flex-col gap-3 transition shadow-xl ${
                evaluation.verdict === 'GO'
                  ? 'bg-tealVerdict/10 border-tealVerdict'
                  : evaluation.verdict === 'CAUTION'
                  ? 'bg-amberVerdict/10 border-amberVerdict'
                  : 'bg-roseVerdict/10 border-roseVerdict'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {evaluation.verdict === 'GO' && (
                    <CheckCircle2 className="w-8 h-8 text-tealVerdict" />
                  )}
                  {evaluation.verdict === 'CAUTION' && (
                    <AlertTriangle className="w-8 h-8 text-amberVerdict" />
                  )}
                  {evaluation.verdict === 'HOLD' && (
                    <XCircle className="w-8 h-8 text-roseVerdict" />
                  )}
                  <div>
                    <span className="text-xs font-mono uppercase tracking-wider text-slate-400">
                      Operational Gate Result
                    </span>
                    <h1
                      className={`text-2xl font-black tracking-tight ${
                        evaluation.verdict === 'GO'
                          ? 'text-tealVerdict'
                          : evaluation.verdict === 'CAUTION'
                          ? 'text-amberVerdict'
                          : 'text-roseVerdict'
                      }`}
                    >
                      {evaluation.verdict}
                    </h1>
                  </div>
                </div>

                <div className="text-right text-xs text-slate-400 font-mono">
                  Evaluated at: {new Date(evaluation.evaluatedAt).toLocaleTimeString()}
                </div>
              </div>

              {/* Not-a-prediction honest rule */}
              <div className="p-3 bg-background/80 rounded border border-border text-xs text-slate-300 leading-relaxed flex items-start gap-2.5">
                <Info className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                <span>{evaluation.disclaimer}</span>
              </div>
            </div>

            {/* Explanation Tree */}
            <div className="bg-surface border border-border rounded-lg p-5 space-y-4 shadow-md">
              <h3 className="text-xs font-bold uppercase text-slate-300 tracking-wider">
                Invariant Checks Tree ({evaluation.checks.length} Evaluated)
              </h3>
              <div className="space-y-2">
                {evaluation.checks.map((chk: any, idx: number) => (
                  <div
                    key={idx}
                    className="p-3 bg-background rounded border border-border flex items-start justify-between gap-4"
                  >
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span
                          className={`w-2 h-2 rounded-full ${
                            chk.severity === 'pass'
                              ? 'bg-tealVerdict'
                              : chk.severity === 'warn'
                              ? 'bg-amberVerdict'
                              : 'bg-roseVerdict'
                          }`}
                        />
                        <span className="text-xs font-semibold text-slate-200">{chk.name}</span>
                      </div>
                      <p className="text-xs text-slate-400 pl-4">{chk.reason}</p>
                    </div>
                    <span
                      className={`text-[11px] font-mono px-2 py-0.5 rounded font-semibold uppercase ${
                        chk.severity === 'pass'
                          ? 'bg-tealVerdict/10 text-tealVerdict'
                          : chk.severity === 'warn'
                          ? 'bg-amberVerdict/10 text-amberVerdict'
                          : 'bg-roseVerdict/10 text-roseVerdict'
                      }`}
                    >
                      {chk.severity}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* What Would Change This Verdict */}
            {evaluation.whatWouldChange.length > 0 && (
              <div className="bg-surface border border-border rounded-lg p-5 space-y-3 shadow-md">
                <h3 className="text-xs font-bold uppercase text-amberVerdict tracking-wider">
                  What Would Change This Verdict
                </h3>
                <ul className="space-y-1.5 text-xs text-slate-300">
                  {evaluation.whatWouldChange.map((item: string, i: number) => (
                    <li key={i} className="flex items-center gap-2">
                      <ArrowRight className="w-3.5 h-3.5 text-amberVerdict" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Commitment Controls */}
            <div className="bg-surface border border-border rounded-lg p-5 space-y-4 shadow-md">
              <h3 className="text-xs font-bold uppercase text-slate-300 tracking-wider">
                Commitment Action
              </h3>

              {evaluation.verdict === 'CAUTION' && (
                <label className="flex items-start gap-2 p-3 bg-amberVerdict/10 border border-amberVerdict/30 rounded cursor-pointer text-xs text-amber-200">
                  <input
                    type="checkbox"
                    checked={acknowledged}
                    onChange={e => setAcknowledged(e.target.checked)}
                    className="mt-0.5 accent-amberVerdict"
                  />
                  <span>
                    I acknowledge these operational consistency risks (e.g. unreachable authority
                    blind-spot, possible concurrent updates in other partition).
                  </span>
                </label>
              )}

              {evaluation.verdict === 'HOLD' && (
                <div className="p-3 bg-roseVerdict/10 border border-roseVerdict/30 rounded text-xs text-rose-200">
                  HOLD decisions cannot be committed. Remedy the failing invariant checks first.
                </div>
              )}

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  disabled={
                    evaluation.verdict === 'HOLD' ||
                    (evaluation.verdict === 'CAUTION' && !acknowledged)
                  }
                  onClick={handleCommit}
                  className={`px-5 py-2.5 rounded text-xs font-bold transition flex items-center gap-2 ${
                    evaluation.verdict === 'HOLD' ||
                    (evaluation.verdict === 'CAUTION' && !acknowledged)
                      ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-border'
                      : 'bg-tealVerdict text-slate-900 hover:bg-teal-400'
                  }`}
                >
                  <Shield className="w-4 h-4" />
                  Commit Decision Receipt
                </button>

                {commitSuccess && (
                  <span className="text-xs text-tealVerdict font-mono flex items-center gap-1.5">
                    <CheckSquare className="w-4 h-4" />
                    Receipt Committed: {commitSuccess}
                  </span>
                )}
                {commitError && (
                  <span className="text-xs text-roseVerdict font-mono">
                    Error: {commitError}
                  </span>
                )}
              </div>
            </div>
          </>
        ) : (
          <div className="text-center py-24 text-slate-500 font-mono text-xs">
            Evaluating decision invariants...
          </div>
        )}
      </div>
    </div>
  );
};
