import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api, Region } from '../api/client.js';
import {
  ShieldCheck,
  Bug,
  HeartPulse,
  RefreshCw,
  Search
} from 'lucide-react';

interface LedgerViewProps {
  viewingRegion: Region;
}

export const LedgerView: React.FC<LedgerViewProps> = ({ viewingRegion }) => {
  const { t } = useTranslation();
  const [ops, setOps] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [verifyResults, setVerifyResults] = useState<Record<string, any>>({});
  const [selectedOp, setSelectedOp] = useState<any | null>(null);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  const loadOps = async () => {
    try {
      const traceRes = await api.getMap(viewingRegion);
      const allOps: any[] = [];
      for (const ent of traceRes?.entities || []) {
        if (ent.participatingOpIds) {
          for (const opId of ent.participatingOpIds) {
            if (!allOps.some(o => o.opId === opId)) {
              allOps.push({ opId, entityId: ent.entityId, type: ent.type });
            }
          }
        }
      }
      setOps(allOps.slice(0, 30));
      if (allOps.length > 0 && !selectedOp) {
        setSelectedOp(allOps[0]);
      }
    } catch (err) {
      console.error(err);
      setOps([]);
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
      setStatusMsg(`Tampered: Flipped 1 byte in ${opId}. Signature verification failed as expected.`);
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
      setStatusMsg(`Healed: Restored ${opId} from authoritative peer. Verification valid.`);
      loadOps();
    } catch (err) {
      console.error(err);
    }
  };

  const filteredOps = ops.filter(o =>
    o.opId.toLowerCase().includes(searchTerm.toLowerCase()) ||
    o.entityId.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="h-full flex overflow-hidden bg-background">
      {/* Op Chain List */}
      <div className="w-80 border-r border-border bg-surface flex flex-col">
        <div className="p-4 border-b border-border space-y-2.5 bg-white">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-primaryText">Audit Ledger</h2>
              <p className="text-xs text-secondaryText mt-0.5">
                Append-only SHA-256 hash-chained operations.
              </p>
            </div>
            <button
              onClick={loadOps}
              className="p-1.5 text-secondaryText hover:text-primaryText hover:bg-slate-100 rounded-md transition"
              title="Refresh ledger"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="relative">
            <Search className="w-3.5 h-3.5 text-secondaryText absolute left-2.5 top-2.5" />
            <input
              type="text"
              placeholder="Search op or entity ID..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full text-xs pl-8 pr-2.5 py-1.5 bg-slate-50 border border-border rounded-md text-primaryText focus:outline-none focus:border-primaryAction"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto divide-y divide-border">
          {filteredOps.length === 0 ? (
            <div className="text-center py-16 text-secondaryText text-xs font-mono">
              {ops.length === 0 ? 'Loading operation chain...' : 'No matching operations'}
            </div>
          ) : (
            filteredOps.map(o => {
              const res = verifyResults[o.opId];
              return (
                <div
                  key={o.opId}
                  onClick={() => setSelectedOp(o)}
                  className={`p-3.5 cursor-pointer transition ${
                    selectedOp?.opId === o.opId
                      ? 'bg-blue-50/70 border-l-2 border-primaryAction'
                      : 'bg-white hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-mono font-bold text-primaryText truncate max-w-[170px]">
                      {o.opId}
                    </span>
                    {res ? (
                      <span
                        className={`text-[10px] font-mono px-1.5 py-0.5 rounded font-bold ${
                          res.status === 'VERIFIED'
                            ? 'bg-green-100 text-success'
                            : 'bg-red-100 text-error'
                        }`}
                      >
                        {res.status}
                      </span>
                    ) : (
                      <span className="text-[10px] font-mono text-tertiaryText">UNTESTED</span>
                    )}
                  </div>
                  <div className="text-xs text-secondaryText">Entity: {o.entityId}</div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Verification & Tamper Simulation Deck */}
      <div className="flex-1 p-6 overflow-y-auto space-y-5">
        {selectedOp ? (
          <>
            <div className="bg-surface border border-border rounded-lg p-5 space-y-2 shadow-subtle">
              <span className="text-[11px] font-mono text-secondaryText uppercase tracking-wider">
                Audited Operation
              </span>
              <h1 className="text-base font-bold font-mono text-primaryText">{selectedOp.opId}</h1>
              <div className="text-xs text-secondaryText">
                Target Entity: <strong className="text-primaryText">{selectedOp.entityId}</strong>
              </div>

              {statusMsg && (
                <div className="p-2.5 bg-slate-50 rounded-md border border-border text-xs font-mono text-primaryText mt-2">
                  {statusMsg}
                </div>
              )}
            </div>

            {/* Verification Detail */}
            {verifyResults[selectedOp.opId] && (
              <div className="bg-surface border border-border rounded-lg p-5 space-y-3 shadow-subtle">
                <h3 className="text-xs font-semibold uppercase text-secondaryText tracking-wider">
                  Cryptographic Audit Report
                </h3>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between p-2.5 bg-slate-50 rounded-md border border-border">
                    <span className="text-secondaryText">SHA-256 Canonical Hash Match:</span>
                    <span
                      className={`font-mono font-bold ${
                        verifyResults[selectedOp.opId].hashMatches
                          ? 'text-success'
                          : 'text-error'
                      }`}
                    >
                      {verifyResults[selectedOp.opId].hashMatches ? 'VALID' : 'CORRUPTED'}
                    </span>
                  </div>
                  <div className="flex justify-between p-2.5 bg-slate-50 rounded-md border border-border">
                    <span className="text-secondaryText">Ed25519 Origin Signature:</span>
                    <span
                      className={`font-mono font-bold ${
                        verifyResults[selectedOp.opId].sigValid
                          ? 'text-success'
                          : 'text-error'
                      }`}
                    >
                      {verifyResults[selectedOp.opId].sigValid ? 'VALID' : 'REJECTED'}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Tamper / Heal Controls */}
            <div className="bg-surface border border-border rounded-lg p-5 space-y-3.5 shadow-subtle">
              <h3 className="text-xs font-semibold uppercase text-secondaryText tracking-wider">
                Integrity Verification & Chaos Testing
              </h3>
              <p className="text-xs text-secondaryText leading-relaxed">
                Test tamper detection by flipping a single byte on disk, then heal by pulling the signed authoritative op from a peer.
              </p>

              <div className="flex gap-2.5 pt-1">
                <button
                  onClick={() => handleVerify(selectedOp.opId)}
                  className="px-3.5 py-1.5 bg-primaryAction hover:bg-primaryActionHover text-white rounded-md text-xs font-medium flex items-center gap-1.5 shadow-subtle transition"
                >
                  <ShieldCheck className="w-3.5 h-3.5" />
                  Verify Chain
                </button>

                <button
                  onClick={() => handleFlipByte(selectedOp.opId)}
                  className="px-3.5 py-1.5 border border-red-300 text-error hover:bg-red-50 rounded-md text-xs font-medium flex items-center gap-1.5 transition"
                >
                  <Bug className="w-3.5 h-3.5" />
                  Flip 1 Byte (Tamper Test)
                </button>

                <button
                  onClick={() => handleHeal(selectedOp.opId)}
                  className="px-3.5 py-1.5 bg-green-50 border border-green-300 text-success hover:bg-green-100 rounded-md text-xs font-medium flex items-center gap-1.5 transition"
                >
                  <HeartPulse className="w-3.5 h-3.5" />
                  Heal from Peer
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="text-center py-20 text-secondaryText font-mono text-xs">
            Select an operation from the ledger to run verification and tamper tests.
          </div>
        )}
      </div>
    </div>
  );
};
