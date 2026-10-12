import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api, Region } from '../api/client.js';
import {
  FileText,
  ShieldCheck,
  ShieldAlert,
  Bug,
  HeartPulse,
  RefreshCw,
  Hash
} from 'lucide-react';

interface LedgerViewProps {
  viewingRegion: Region;
}

export const LedgerView: React.FC<LedgerViewProps> = ({ viewingRegion }) => {
  const { t } = useTranslation();
  const [ops, setOps] = useState<any[]>([]);
  const [verifyResults, setVerifyResults] = useState<Record<string, any>>({});
  const [selectedOp, setSelectedOp] = useState<any | null>(null);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  const loadOps = async () => {
    try {
      const res = await fetch(`http://127.0.0.1:4001/api/v1/status`); // local
      const data = await api.getStatus(viewingRegion);
      // fetch ops list
      const traceRes = await api.getMap(viewingRegion);
      const allOps: any[] = [];
      for (const ent of traceRes.entities || []) {
        if (ent.participatingOpIds) {
          for (const opId of ent.participatingOpIds) {
            if (!allOps.some(o => o.opId === opId)) {
              allOps.push({ opId, entityId: ent.entityId, type: ent.type });
            }
          }
        }
      }
      setOps(allOps.slice(0, 30));
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    loadOps();
  }, [viewingRegion]);

  const handleVerify = async (opId: string) => {
    try {
      const res = await api.verifyOp(opId, viewingRegion);
      setVerifyResults(prev => ({ ...prev, [opId]: res }));
      setStatusMsg(`Op ${opId}: ${res.status}`);
    } catch (err) {
      console.error(err);
    }
  };

  const handleFlipByte = async (opId: string) => {
    try {
      await api.tamperOp(opId, viewingRegion);
      await handleVerify(opId);
      setStatusMsg(`Tampered: Flipped 1 byte in ${opId}. Verification now fails.`);
      loadOps();
    } catch (err) {
      console.error(err);
    }
  };

  const handleHeal = async (opId: string) => {
    try {
      const remotePeer: Region = viewingRegion === 'mumbai' ? 'delhi' : 'mumbai';
      await api.healOp(opId, remotePeer, viewingRegion);
      await handleVerify(opId);
      setStatusMsg(`Healed: Restored ${opId} from authoritative peer. Verification verified.`);
      loadOps();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="h-full flex overflow-hidden">
      {/* Op Chain List */}
      <div className="w-[45%] border-r border-border bg-surface flex flex-col">
        <div className="p-4 border-b border-border flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold uppercase tracking-wider text-tealVerdict">
              Ledger & Cryptographic Audit
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Append-only SHA-256 hash-chained and Ed25519-signed operations.
            </p>
          </div>
          <button
            onClick={loadOps}
            className="p-1.5 text-slate-400 hover:text-slate-100 hover:bg-slate-800 rounded transition"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto divide-y divide-border">
          {ops.length === 0 ? (
            <div className="text-center py-16 text-slate-500 text-xs font-mono">
              Loading operation chain...
            </div>
          ) : (
            ops.map(o => {
              const res = verifyResults[o.opId];
              return (
                <div
                  key={o.opId}
                  onClick={() => setSelectedOp(o)}
                  className={`p-4 cursor-pointer transition ${
                    selectedOp?.opId === o.opId
                      ? 'bg-slate-800/80 border-l-2 border-tealVerdict'
                      : 'bg-background/40 hover:bg-slate-800/40'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-mono font-bold text-slate-200">{o.opId}</span>
                    {res ? (
                      <span
                        className={`text-[10px] font-mono px-1.5 py-0.5 rounded font-bold ${
                          res.status === 'VERIFIED'
                            ? 'bg-tealVerdict/10 text-tealVerdict'
                            : 'bg-roseVerdict/10 text-roseVerdict'
                        }`}
                      >
                        {res.status}
                      </span>
                    ) : (
                      <span className="text-[10px] font-mono text-slate-500">UNTESTED</span>
                    )}
                  </div>
                  <div className="text-xs text-slate-400">Target Entity: {o.entityId}</div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Verification & Tamper Simulation Deck */}
      <div className="flex-1 p-6 overflow-y-auto space-y-6">
        {selectedOp ? (
          <>
            <div className="bg-surface border border-border rounded-lg p-5 space-y-3">
              <span className="text-xs font-mono text-slate-400">Selected Ledger Op</span>
              <h1 className="text-base font-bold font-mono text-slate-100">{selectedOp.opId}</h1>
              <div className="text-xs text-slate-400">
                Target Entity: <strong className="text-slate-200">{selectedOp.entityId}</strong>
              </div>

              {statusMsg && (
                <div className="p-3 bg-background rounded border border-border text-xs font-mono text-tealVerdict">
                  {statusMsg}
                </div>
              )}
            </div>

            {/* Verification Detail */}
            {verifyResults[selectedOp.opId] && (
              <div className="bg-surface border border-border rounded-lg p-5 space-y-3">
                <h3 className="text-xs font-bold uppercase text-slate-300 tracking-wider">
                  Audit Report
                </h3>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between p-2 bg-background rounded border border-border">
                    <span className="text-slate-400">SHA-256 Canonical Hash Match:</span>
                    <span
                      className={`font-mono font-bold ${
                        verifyResults[selectedOp.opId].hashMatches
                          ? 'text-tealVerdict'
                          : 'text-roseVerdict'
                      }`}
                    >
                      {verifyResults[selectedOp.opId].hashMatches ? 'VALID' : 'CORRUPTED'}
                    </span>
                  </div>
                  <div className="flex justify-between p-2 bg-background rounded border border-border">
                    <span className="text-slate-400">Ed25519 Origin Signature:</span>
                    <span
                      className={`font-mono font-bold ${
                        verifyResults[selectedOp.opId].sigValid
                          ? 'text-tealVerdict'
                          : 'text-roseVerdict'
                      }`}
                    >
                      {verifyResults[selectedOp.opId].sigValid ? 'VALID' : 'SIGNATURE REJECTED'}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Tamper / Heal Controls */}
            <div className="bg-surface border border-border rounded-lg p-5 space-y-4">
              <h3 className="text-xs font-bold uppercase text-slate-300 tracking-wider">
                Chaos Audit & Self-Healing Testing
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Test tamper detection by modifying a single stored byte in disk payload, then heal
                by pulling the signed authoritative op from a peer.
              </p>

              <div className="flex gap-3">
                <button
                  onClick={() => handleVerify(selectedOp.opId)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-xs font-semibold flex items-center gap-1.5 border border-border"
                >
                  <ShieldCheck className="w-4 h-4 text-tealVerdict" />
                  Verify Cryptographic Chain
                </button>

                <button
                  onClick={() => handleFlipByte(selectedOp.opId)}
                  className="px-4 py-2 bg-roseVerdict/15 border border-roseVerdict text-roseVerdict hover:bg-roseVerdict/25 rounded text-xs font-bold flex items-center gap-1.5"
                >
                  <Bug className="w-4 h-4" />
                  Flip 1 Byte (Tamper Test)
                </button>

                <button
                  onClick={() => handleHeal(selectedOp.opId)}
                  className="px-4 py-2 bg-tealVerdict text-slate-900 rounded text-xs font-bold hover:bg-teal-400 transition flex items-center gap-1.5"
                >
                  <HeartPulse className="w-4 h-4" />
                  Heal from Peer
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="text-center py-24 text-slate-500 font-mono text-xs">
            Select an operation from the ledger to run verification and tamper tests.
          </div>
        )}
      </div>
    </div>
  );
};
