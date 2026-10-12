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
  const [targetEntityId, setTargetEntityId] = useState(selectedEntityId || 'access-corridor-north');
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
    <div className="h-full flex overflow-hidden bg-background">
      {/* Left Composer Form */}
      <div className="w-80 border-r border-border bg-surface p-5 flex flex-col gap-4 overflow-y-auto">
        <div>
          <h2 className="text-sm font-bold text-primaryText">Decision Composer</h2>
          <p className="text-xs text-secondaryText mt-0.5">
            Evaluate operational safety before committing resources.
          </p>
        </div>

        {/* Viewing Region Badge */}
        <div className="p-2.5 bg-slate-50 border border-border rounded-md text-xs space-y-0.5">
          <div className="text-secondaryText text-[11px]">Evaluating Replica:</div>
          <div className="font-semibold text-primaryText flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-tealVerdict" />
            {viewingRegion.toUpperCase()} Regional View
          </div>
        </div>

        {/* Decision Type */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-secondaryText">Decision Action</label>
          <div className="grid grid-cols-1 gap-1">
            {[
              { id: 'DISPATCH', label: 'Dispatch Team along Route' },
              { id: 'ALLOCATE_SUPPLY', label: 'Allocate Scarce Supplies' },
              { id: 'CLOSE_INCIDENT', label: 'Close Active Incident' }
            ].map(dt => (
              <button
                key={dt.id}
                type="button"
                onClick={() => setDecisionType(dt.id as any)}
                className={`py-2 px-3 rounded-md text-xs text-left font-medium border transition ${
                  decisionType === dt.id
                    ? 'bg-blue-50 border-primaryAction text-primaryAction font-semibold shadow-subtle'
                    : 'bg-white border-border text-secondaryText hover:text-primaryText hover:bg-slate-50'
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
              <label className="text-xs font-semibold text-secondaryText">Target Entity</label>
              <input
                type="text"
                value={targetEntityId}
                onChange={e => setTargetEntityId(e.target.value)}
                className="w-full bg-white border border-border rounded-md p-2 text-xs font-mono text-primaryText focus:outline-none focus:border-primaryAction"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-secondaryText">Transit Corridor Segments</label>
              <div className="space-y-1 bg-slate-50 p-2.5 rounded-md border border-border">
                {['access-corridor-north', 'transit-artery-east', 'evacuation-route-1'].map(r => (
                  <label key={r} className="flex items-center gap-2 text-xs text-primaryText cursor-pointer">
                    <input
                      type="checkbox"
                      checked={routeRoads.includes(r)}
                      onChange={e => {
                        if (e.target.checked) setRouteRoads([...routeRoads, r]);
                        else setRouteRoads(routeRoads.filter(x => x !== r));
                      }}
                      className="accent-primaryAction"
                    />
                    <span className="font-mono text-[11px]">{r}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        )}

        {decisionType === 'ALLOCATE_SUPPLY' && (
          <div className="space-y-3">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-secondaryText">Resource Name</label>
              <select
                value={resourceName}
                onChange={e => setResourceName(e.target.value)}
                className="w-full bg-white border border-border rounded-md p-2 text-xs text-primaryText focus:outline-none focus:border-primaryAction"
              >
                <option value="medical_kits">medical_kits (Stock: 5)</option>
                <option value="emergency_rations">emergency_rations (Stock: 10)</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-secondaryText">Requested Quantity</label>
              <input
                type="number"
                min={1}
                max={10}
                value={supplyQty}
                onChange={e => setSupplyQty(parseInt(e.target.value, 10) || 1)}
                className="w-full bg-white border border-border rounded-md p-2 text-xs font-mono text-primaryText focus:outline-none focus:border-primaryAction"
              />
            </div>
          </div>
        )}

        {decisionType === 'CLOSE_INCIDENT' && (
          <div className="space-y-3">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-secondaryText">Incident Target</label>
              <input
                type="text"
                value={targetEntityId}
                onChange={e => setTargetEntityId(e.target.value)}
                className="w-full bg-white border border-border rounded-md p-2 text-xs font-mono text-primaryText focus:outline-none focus:border-primaryAction"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-secondaryText">Actor Authorization</label>
              <select
                value={actorRole}
                onChange={e => setActorRole(e.target.value as any)}
                className="w-full bg-white border border-border rounded-md p-2 text-xs text-primaryText focus:outline-none focus:border-primaryAction"
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
          className="mt-auto py-2 bg-slate-100 hover:bg-slate-200 text-primaryText rounded-md text-xs font-semibold flex items-center justify-center gap-2 border border-border transition"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${evaluating ? 'animate-spin text-primaryAction' : ''}`} />
          Re-evaluate Gate
        </button>
      </div>

      {/* Right Gate Verdict Display */}
      <div className="flex-1 p-6 overflow-y-auto space-y-5">
        {evaluation ? (
          <>
            {/* Prominent Verdict Card */}
            <div
              className={`p-5 rounded-lg border transition shadow-subtle ${
                evaluation.verdict === 'GO'
                  ? 'bg-green-50/70 border-green-200'
                  : evaluation.verdict === 'CAUTION'
                  ? 'bg-amber-50/70 border-amber-200'
                  : 'bg-red-50/70 border-red-200'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {evaluation.verdict === 'GO' && (
                    <CheckCircle2 className="w-8 h-8 text-success" />
                  )}
                  {evaluation.verdict === 'CAUTION' && (
                    <AlertTriangle className="w-8 h-8 text-warning" />
                  )}
                  {evaluation.verdict === 'HOLD' && (
                    <XCircle className="w-8 h-8 text-error" />
                  )}
                  <div>
                    <span className="text-[11px] font-mono uppercase tracking-wider text-secondaryText">
                      Operational Gate Evaluation
                    </span>
                    <h1
                      className={`text-2xl font-bold tracking-tight ${
                        evaluation.verdict === 'GO'
                          ? 'text-success'
                          : evaluation.verdict === 'CAUTION'
                          ? 'text-warning'
                          : 'text-error'
                      }`}
                    >
                      {evaluation.verdict}
                    </h1>
                  </div>
                </div>

                <div className="text-right text-xs text-secondaryText font-mono">
                  Evaluated at: {new Date(evaluation.evaluatedAt).toLocaleTimeString()}
                </div>
              </div>

              {/* Honest Rule Disclaimer */}
              <div className="mt-3 p-2.5 bg-white/80 rounded-md border border-border text-xs text-secondaryText leading-relaxed flex items-start gap-2">
                <Info className="w-4 h-4 text-secondaryText shrink-0 mt-0.5" />
                <span>{evaluation.disclaimer}</span>
              </div>
            </div>

            {/* Explanation Tree */}
            <div className="bg-surface border border-border rounded-lg p-5 space-y-3 shadow-subtle">
              <h2 className="text-xs font-semibold uppercase text-secondaryText tracking-wider">
                Safety & Consistency Checks ({evaluation.checks.length} Evaluated)
              </h2>
              <div className="space-y-2">
                {evaluation.checks.map((chk: any, idx: number) => (
                  <div
                    key={idx}
                    className="p-3 bg-slate-50/70 rounded-md border border-border flex items-start justify-between gap-4"
                  >
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span
                          className={`w-2 h-2 rounded-full ${
                            chk.severity === 'pass'
                              ? 'bg-success'
                              : chk.severity === 'warn'
                              ? 'bg-warning'
                              : 'bg-error'
                          }`}
                        />
                        <span className="text-xs font-semibold text-primaryText">{chk.name}</span>
                      </div>
                      <p className="text-xs text-secondaryText pl-4">{chk.reason}</p>
                    </div>
                    <span
                      className={`text-[10px] font-mono px-2 py-0.5 rounded font-semibold uppercase ${
                        chk.severity === 'pass'
                          ? 'bg-green-100 text-success'
                          : chk.severity === 'warn'
                          ? 'bg-amber-100 text-warning'
                          : 'bg-red-100 text-error'
                      }`}
                    >
                      {chk.severity}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* What Would Change This Verdict */}
            {evaluation.whatWouldChange?.length > 0 && (
              <div className="bg-surface border border-border rounded-lg p-5 space-y-2.5 shadow-subtle">
                <h2 className="text-xs font-semibold uppercase text-warning tracking-wider">
                  What Would Change This Verdict
                </h2>
                <ul className="space-y-1.5 text-xs text-primaryText">
                  {evaluation.whatWouldChange.map((item: string, i: number) => (
                    <li key={i} className="flex items-center gap-2">
                      <ArrowRight className="w-3.5 h-3.5 text-warning shrink-0" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Commitment Controls */}
            <div className="bg-surface border border-border rounded-lg p-5 space-y-3.5 shadow-subtle">
              <h2 className="text-xs font-semibold uppercase text-secondaryText tracking-wider">
                Commitment Action
              </h2>

              {evaluation.verdict === 'CAUTION' && (
                <label className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-md cursor-pointer text-xs text-amber-900">
                  <input
                    type="checkbox"
                    checked={acknowledged}
                    onChange={e => setAcknowledged(e.target.checked)}
                    className="mt-0.5 accent-warning"
                  />
                  <span>
                    I acknowledge remote authority blind-spots and accept potential downstream re-evaluation risk.
                  </span>
                </label>
              )}

              {evaluation.verdict === 'HOLD' && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-md text-xs text-error font-medium">
                  HOLD decisions cannot be committed. Remedy the failing safety checks first.
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
                  className={`px-4 py-2 rounded-md text-xs font-semibold transition flex items-center gap-1.5 shadow-subtle ${
                    evaluation.verdict === 'HOLD' ||
                    (evaluation.verdict === 'CAUTION' && !acknowledged)
                      ? 'bg-slate-100 text-tertiaryText cursor-not-allowed border border-border'
                      : 'bg-primaryAction hover:bg-primaryActionHover text-white'
                  }`}
                >
                  <Shield className="w-4 h-4" />
                  Commit Decision Receipt
                </button>

                {commitSuccess && (
                  <span className="text-xs text-success font-mono flex items-center gap-1">
                    <CheckSquare className="w-4 h-4" />
                    Receipt Committed: {commitSuccess}
                  </span>
                )}
                {commitError && (
                  <span className="text-xs text-error font-mono">
                    Error: {commitError}
                  </span>
                )}
              </div>
            </div>
          </>
        ) : (
          <div className="text-center py-20 text-secondaryText font-mono text-xs">
            Evaluating decision invariants...
          </div>
        )}
      </div>
    </div>
  );
};
