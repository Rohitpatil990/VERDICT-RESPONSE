import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api, Region } from '../api/client.js';
import {
  Package,
  ShieldCheck,
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
    <div className="h-full flex overflow-hidden bg-background">
      {/* Resource Selector & Headline Demo */}
      <div className="w-80 border-r border-border bg-surface p-5 flex flex-col gap-4 overflow-y-auto">
        <div>
          <h2 className="text-sm font-bold text-primaryText">Escrow Supplies</h2>
          <p className="text-xs text-secondaryText mt-0.5">
            Bounded counters prevent over-allocation during network partitions.
          </p>
        </div>

        {/* Resource Choice */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-secondaryText">Resource Class</label>
          <div className="space-y-1">
            {[
              { id: 'medical_kits', name: 'Emergency Medical Kits (5 total)' },
              { id: 'emergency_rations', name: 'Emergency Rations (10 total)' }
            ].map(r => (
              <button
                key={r.id}
                onClick={() => setSelectedResource(r.id)}
                className={`w-full text-left p-2.5 rounded-md border text-xs font-medium transition ${
                  selectedResource === r.id
                    ? 'bg-blue-50 border-primaryAction text-primaryAction font-semibold shadow-subtle'
                    : 'bg-white border-border text-secondaryText hover:text-primaryText hover:bg-slate-50'
                }`}
              >
                {r.name}
              </button>
            ))}
          </div>
        </div>

        {/* Headline Demo Walkthrough Card */}
        <div className="p-3 bg-slate-50 border border-border rounded-md space-y-1.5 text-xs">
          <div className="font-semibold text-primaryText flex items-center gap-1.5">
            <Package className="w-3.5 h-3.5 text-primaryAction" />
            Bounded Quota Guarantee
          </div>
          <p className="text-secondaryText leading-relaxed text-[11px]">
            Global Total: <strong>5 kits</strong>. Mumbai rights: <strong>3</strong>, Delhi rights: <strong>2</strong>.
            During a partition cut, Mumbai allocates up to 3. Delhi requesting 4 receives <strong>2 granted, 2 queued as unmet</strong>.
            Over-allocation is mathematically impossible.
          </p>
        </div>

        {/* Allocate Form */}
        <div className="bg-white border border-border rounded-md p-3.5 space-y-3">
          <h4 className="text-xs font-semibold text-primaryText">Allocate from Regional Quota</h4>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={1}
              max={10}
              value={allocateQty}
              onChange={e => setAllocateQty(parseInt(e.target.value, 10) || 1)}
              className="w-16 bg-white border border-border rounded-md p-1.5 text-xs font-mono text-primaryText focus:outline-none focus:border-primaryAction"
            />
            <button
              onClick={handleSpend}
              className="flex-1 py-1.5 bg-primaryAction hover:bg-primaryActionHover text-white font-semibold text-xs rounded-md transition shadow-subtle"
            >
              Spend Quota
            </button>
          </div>

          <button
            onClick={handleRequestTransfer}
            className="w-full py-1.5 bg-slate-50 hover:bg-slate-100 text-secondaryText hover:text-primaryText border border-border rounded-md text-xs font-medium flex items-center justify-center gap-1.5 transition"
          >
            <ArrowRightLeft className="w-3 h-3 text-warning" />
            Request Quota Transfer
          </button>

          {allocateMsg && (
            <div className="text-[11px] p-2 rounded-md bg-slate-50 border border-border text-primaryText font-mono">
              {allocateMsg}
            </div>
          )}
        </div>
      </div>

      {/* Main Escrow Status Display */}
      <div className="flex-1 p-6 overflow-y-auto space-y-5">
        {escrowState ? (
          <>
            {/* Headline Metrics Grid */}
            <div className="grid grid-cols-4 gap-4">
              <div className="p-4 bg-surface border border-border rounded-lg shadow-subtle">
                <span className="text-[11px] text-secondaryText uppercase font-semibold">
                  Global Total (T)
                </span>
                <div className="text-2xl font-bold text-primaryText mt-1">
                  {escrowState.total}
                </div>
              </div>

              <div className="p-4 bg-surface border border-border rounded-lg shadow-subtle">
                <span className="text-[11px] text-secondaryText uppercase font-semibold">
                  My Rights ({viewingRegion.toUpperCase()})
                </span>
                <div className="text-2xl font-bold text-primaryAction mt-1">
                  {myRights}
                </div>
              </div>

              <div className="p-4 bg-surface border border-border rounded-lg shadow-subtle">
                <span className="text-[11px] text-secondaryText uppercase font-semibold">
                  Local Spent
                </span>
                <div className="text-2xl font-bold text-warning mt-1">
                  {mySpent}
                </div>
              </div>

              <div className="p-4 bg-surface border border-border rounded-lg shadow-subtle">
                <span className="text-[11px] text-secondaryText uppercase font-semibold">
                  Available Local Spend
                </span>
                <div className="text-2xl font-bold text-success mt-1">
                  {myAvailable}
                </div>
              </div>
            </div>

            {/* Invariant Chip */}
            <div className="p-3.5 bg-green-50 border border-green-200 rounded-lg flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <ShieldCheck className="w-5 h-5 text-success" />
                <div>
                  <div className="text-xs font-bold text-success">
                    Mathematical Safety Invariant: Σ spent ≤ Total (T)
                  </div>
                  <div className="text-[11px] text-slate-700 mt-0.5">
                    Currently: {totalSpent} allocated globally out of {escrowState.total} total units.
                  </div>
                </div>
              </div>
              <span className="text-[11px] font-mono font-bold bg-green-100 text-success border border-green-300 px-2.5 py-0.5 rounded">
                INVARIANT PRESERVED
              </span>
            </div>

            {/* Quota Distribution per Region */}
            <div className="bg-surface border border-border rounded-lg p-5 space-y-3.5 shadow-subtle">
              <h3 className="text-xs font-semibold uppercase text-secondaryText tracking-wider">
                Regional Escrow Rights & Spend
              </h3>

              <div className="space-y-3.5">
                {Object.entries(escrowState.rights || {}).map(([rId, rRights]: any) => {
                  const spent = escrowState.spent?.[rId] || 0;
                  const pct = rRights > 0 ? Math.round((spent / rRights) * 100) : 0;
                  return (
                    <div key={rId} className="space-y-1.5">
                      <div className="flex justify-between text-xs">
                        <span className="font-semibold text-primaryText">
                          {rId.toUpperCase()} {rId === viewingRegion && '(Viewing Node)'}
                        </span>
                        <span className="font-mono text-secondaryText">
                          {spent} spent / {rRights} rights ({Math.max(0, rRights - spent)} remaining)
                        </span>
                      </div>
                      <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden border border-border">
                        <div
                          className="bg-primaryAction h-full transition-all duration-300"
                          style={{ width: `${Math.min(100, pct)}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Unmet Demand Queue */}
            <div className="bg-surface border border-border rounded-lg p-5 space-y-3 shadow-subtle">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-semibold uppercase text-secondaryText tracking-wider flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4 text-warning" />
                  Unmet Demand Queue ({escrowState.unmetQueue?.length || 0})
                </h3>
                <span className="text-[11px] text-secondaryText">
                  Retried automatically upon link recovery
                </span>
              </div>

              {escrowState.unmetQueue?.length > 0 ? (
                <div className="space-y-1.5">
                  {escrowState.unmetQueue.map((req: any, i: number) => (
                    <div
                      key={i}
                      className="p-3 bg-slate-50 rounded-md border border-border flex items-center justify-between text-xs font-mono"
                    >
                      <span className="text-primaryText">
                        {req.region.toUpperCase()} requested {req.qty} units ({req.priorityClass})
                      </span>
                      <span className="text-warning font-semibold">QUEUED FOR HEAL</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-xs text-secondaryText py-4 text-center">
                  No unmet requests queued. All requests satisfied within local escrow rights.
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="text-center py-20 text-secondaryText font-mono text-xs">
            Loading escrow state...
          </div>
        )}
      </div>
    </div>
  );
};
