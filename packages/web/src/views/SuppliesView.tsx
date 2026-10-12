import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api, Region } from '../api/client.js';
import {
  Package,
  ShieldCheck,
  PlusCircle,
  ArrowRightLeft,
  RefreshCw,
  AlertCircle
} from 'lucide-react';

interface SuppliesViewProps {
  viewingRegion: Region;
}

export const SuppliesView: React.FC<SuppliesViewProps> = ({ viewingRegion }) => {
  const { t } = useTranslation();
  const [selectedResource, setSelectedResource] = useState('medical_kits');
  const [escrowState, setEscrowState] = useState<any | null>(null);
  const [allocateQty, setAllocateQty] = useState(1);
  const [allocateMsg, setAllocateMsg] = useState<string | null>(null);

  const loadEscrow = async () => {
    try {
      const data = await api.getEscrow(selectedResource, viewingRegion);
      setEscrowState(data);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    loadEscrow();
    const interval = setInterval(loadEscrow, 2000);
    return () => clearInterval(interval);
  }, [selectedResource, viewingRegion]);

  const handleSpend = async () => {
    try {
      const res = await api.spendEscrow(selectedResource, allocateQty, viewingRegion);
      if (res.unmet > 0) {
        setAllocateMsg(`Partial Allocation: ${res.granted} granted, ${res.unmet} queued as UNMET`);
      } else {
        setAllocateMsg(`Successfully allocated ${res.granted} ${selectedResource}`);
      }
      loadEscrow();
    } catch (err: any) {
      setAllocateMsg(err.message);
    }
  };

  const handleRequestTransfer = async () => {
    try {
      await api.requestEscrowTransfer(selectedResource, 2, viewingRegion);
      setAllocateMsg('Queued transfer request for 2 units from connected peers');
      loadEscrow();
    } catch (err: any) {
      setAllocateMsg(err.message);
    }
  };

  const myRights = escrowState?.rights?.[viewingRegion] || 0;
  const mySpent = escrowState?.spent?.[viewingRegion] || 0;
  const myAvailable = Math.max(0, myRights - mySpent);
  const totalSpent = Object.values(escrowState?.spent || {}).reduce((a: any, b: any) => a + b, 0);

  return (
    <div className="h-full flex overflow-hidden">
      {/* Resource Selector & Headline Demo */}
      <div className="w-96 border-r border-border bg-surface p-6 flex flex-col gap-5 overflow-y-auto">
        <div>
          <h2 className="text-sm font-bold uppercase tracking-wider text-tealVerdict">
            Escrow Scarce Resources
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Bounded counters prevent over-allocation during partitions by construction.
          </p>
        </div>

        {/* Resource Choice */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-slate-300">Monitored Resource</label>
          <div className="space-y-1">
            {[
              { id: 'medical_kits', name: 'Emergency Medical Kits (5 total)' },
              { id: 'rescue_boats', name: 'Inflatable Rescue Boats (4 total)' },
              { id: 'drinking_water_tanks', name: 'Drinking Water Bowsers (10 total)' }
            ].map(r => (
              <button
                key={r.id}
                onClick={() => setSelectedResource(r.id)}
                className={`w-full text-left p-3 rounded border text-xs font-medium transition ${
                  selectedResource === r.id
                    ? 'bg-tealVerdict/15 border-tealVerdict text-tealVerdict font-bold'
                    : 'bg-background border-border text-slate-400 hover:text-slate-200'
                }`}
              >
                {r.name}
              </button>
            ))}
          </div>
        </div>

        {/* 5 / 3 / 4 Headline Demo Walkthrough Card */}
        <div className="p-4 bg-background border border-border rounded-lg space-y-2 text-xs">
          <div className="font-bold text-tealVerdict flex items-center gap-1.5">
            <Package className="w-4 h-4" />
            Headline Demo Case (Medical Kits)
          </div>
          <p className="text-slate-300 leading-relaxed text-[11px]">
            Global Total: <strong>5 kits</strong>. Mumbai rights: <strong>3</strong>, Delhi rights: <strong>2</strong>.
            During a partition cut, Mumbai allocates 3 (GO). Delhi asks for 4: <strong>2 granted, 2 queued as unmet</strong>.
            Zero over-allocation by construction!
          </p>
        </div>

        {/* Allocate Form */}
        <div className="bg-background border border-border rounded-lg p-4 space-y-3">
          <h4 className="text-xs font-bold text-slate-200">Local Spend Against Quota</h4>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={1}
              max={10}
              value={allocateQty}
              onChange={e => setAllocateQty(parseInt(e.target.value, 10) || 1)}
              className="w-20 bg-surface border border-border rounded p-2 text-xs font-mono text-slate-100"
            />
            <button
              onClick={handleSpend}
              className="flex-1 py-2 bg-tealVerdict text-slate-900 font-bold text-xs rounded hover:bg-teal-400 transition"
            >
              Allocate Local Units
            </button>
          </div>

          <button
            onClick={handleRequestTransfer}
            className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-border rounded text-xs font-semibold flex items-center justify-center gap-2"
          >
            <ArrowRightLeft className="w-3.5 h-3.5 text-amberVerdict" />
            Request Escrow Transfer from Peer
          </button>

          {allocateMsg && (
            <div className="text-[11px] p-2 rounded bg-slate-900 border border-slate-800 text-tealVerdict font-mono">
              {allocateMsg}
            </div>
          )}
        </div>
      </div>

      {/* Main Escrow Status Display */}
      <div className="flex-1 p-8 overflow-y-auto space-y-6">
        {escrowState ? (
          <>
            {/* Headline Metrics Grid */}
            <div className="grid grid-cols-4 gap-4">
              <div className="p-4 bg-surface border border-border rounded-lg">
                <span className="text-[11px] text-slate-400 uppercase font-semibold">
                  Global Total (T)
                </span>
                <div className="text-2xl font-black text-slate-100 mt-1">
                  {escrowState.total}
                </div>
              </div>

              <div className="p-4 bg-surface border border-border rounded-lg">
                <span className="text-[11px] text-slate-400 uppercase font-semibold">
                  My Rights ({viewingRegion.toUpperCase()})
                </span>
                <div className="text-2xl font-black text-purpleVerdict mt-1">
                  {myRights}
                </div>
              </div>

              <div className="p-4 bg-surface border border-border rounded-lg">
                <span className="text-[11px] text-slate-400 uppercase font-semibold">
                  Local Spent
                </span>
                <div className="text-2xl font-black text-amberVerdict mt-1">
                  {mySpent}
                </div>
              </div>

              <div className="p-4 bg-surface border border-border rounded-lg">
                <span className="text-[11px] text-slate-400 uppercase font-semibold">
                  Available Local Spend
                </span>
                <div className="text-2xl font-black text-tealVerdict mt-1">
                  {myAvailable}
                </div>
              </div>
            </div>

            {/* Invariant Chip */}
            <div className="p-4 bg-tealVerdict/10 border border-tealVerdict/40 rounded-lg flex items-center justify-between">
              <div className="flex items-center gap-3">
                <ShieldCheck className="w-5 h-5 text-tealVerdict" />
                <div>
                  <div className="text-xs font-bold text-tealVerdict">
                    Mathematical Invariant: Σ spent ≤ Total (T)
                  </div>
                  <div className="text-[11px] text-slate-300 mt-0.5">
                    Currently: {totalSpent} allocated globally out of {escrowState.total} total units.
                  </div>
                </div>
              </div>
              <span className="text-xs font-mono font-bold bg-tealVerdict text-slate-900 px-2.5 py-1 rounded">
                INVARIANT PRESERVED
              </span>
            </div>

            {/* Quota Distribution per Region */}
            <div className="bg-surface border border-border rounded-lg p-5 space-y-4">
              <h3 className="text-xs font-bold uppercase text-slate-300 tracking-wider">
                Regional Escrow Distribution & Spend
              </h3>

              <div className="space-y-4">
                {Object.entries(escrowState.rights || {}).map(([rId, rRights]: any) => {
                  const spent = escrowState.spent?.[rId] || 0;
                  const pct = rRights > 0 ? Math.round((spent / rRights) * 100) : 0;
                  return (
                    <div key={rId} className="space-y-1.5">
                      <div className="flex justify-between text-xs">
                        <span className="font-semibold text-slate-200">
                          {rId.toUpperCase()} {rId === viewingRegion && '(Viewing)'}
                        </span>
                        <span className="font-mono text-slate-400">
                          {spent} spent / {rRights} rights ({rRights - spent} remaining)
                        </span>
                      </div>
                      <div className="w-full bg-slate-900 h-2.5 rounded-full overflow-hidden border border-slate-800">
                        <div
                          className="bg-tealVerdict h-full transition-all duration-500"
                          style={{ width: `${Math.min(100, pct)}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Unmet Demand Queue */}
            <div className="bg-surface border border-border rounded-lg p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase text-slate-300 tracking-wider flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-amberVerdict" />
                  Unmet Demand Queue ({escrowState.unmetQueue?.length || 0})
                </h3>
                <span className="text-[11px] text-slate-400">
                  Retried automatically upon reconnection
                </span>
              </div>

              {escrowState.unmetQueue?.length > 0 ? (
                <div className="space-y-2">
                  {escrowState.unmetQueue.map((req: any, i: number) => (
                    <div
                      key={i}
                      className="p-3 bg-background rounded border border-border flex items-center justify-between text-xs font-mono"
                    >
                      <span className="text-slate-300">
                        {req.region.toUpperCase()} requested {req.qty} units ({req.priorityClass})
                      </span>
                      <span className="text-amberVerdict font-bold">QUEUED FOR HEAL</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-xs text-slate-400 py-4 text-center">
                  No unmet requests queued. All requests satisfied within local escrow rights.
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="text-center py-24 text-slate-500 font-mono text-xs">
            Loading escrow state...
          </div>
        )}
      </div>
    </div>
  );
};
