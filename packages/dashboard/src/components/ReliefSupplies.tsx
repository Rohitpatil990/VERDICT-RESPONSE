import React, { useState } from 'react';
import { Package, ShieldCheck, AlertCircle, ArrowRight, Layers, CheckCircle2 } from 'lucide-react';
import { useI18n } from '../i18n.js';
import { ApiClient } from '../api.js';

interface ReliefSuppliesProps {
  currentRegion: any;
  onRefresh: () => void;
}

export const ReliefSupplies: React.FC<ReliefSuppliesProps> = ({ currentRegion, onRefresh }) => {
  const { t } = useI18n();

  const [settling, setSettling] = useState(false);
  const [isSettled, setIsSettled] = useState(false);

  // The 5 / 3 / 4 stock scenario
  const totalStock = 5;
  const mumbaiRequested = 3;
  const delhiRequested = 4;

  const delhiGranted = isSettled ? 4 : delhiRequested;
  const delhiBackordered = isSettled ? 0 : 0;

  const mumbaiGranted = isSettled ? 1 : mumbaiRequested;
  const mumbaiBackordered = isSettled ? 2 : 0;

  const handleSettleRound = async () => {
    setSettling(true);
    try {
      await ApiClient.adminSettleRound(currentRegion);
      setIsSettled(true);
      onRefresh();
    } catch (err: any) {
      alert(`Settle error: ${err.message}`);
    } finally {
      setSettling(false);
    }
  };

  return (
    <div className="h-full flex flex-col p-5 space-y-4 overflow-y-auto bg-[#F8FAFC]">
      <div>
        <h3 className="text-sm font-bold text-[#172033] flex items-center gap-2">
          <Package size={16} className="text-[#2563EB]" />
          Bounded Resource Claims & Relief Supplies (Escrow Safety)
        </h3>
        <p className="text-xs text-[#64748B] mt-0.5">
          Invariant: Settled allocated ≤ available capacity. Competing concurrent claims are resolved in certified settlement rounds.
        </p>
      </div>

      <div className="bg-[#FFFFFF] border border-[#E2E8F0] rounded-xl p-5 shadow-xs space-y-5">
        {/* Scenario Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E2E8F0] pb-4">
          <div>
            <div className="text-[11px] font-mono text-[#2563EB] font-bold uppercase tracking-wide">Item ID: stock-med-kits</div>
            <h4 className="text-base font-bold text-[#172033] mt-0.5">Critical Trauma Medical Kits</h4>
            <div className="text-xs text-[#64748B] mt-1">
              Available Quota: <strong className="text-[#172033]">{totalStock} Kits</strong> · Class: <span className="text-[#2563EB] font-semibold bg-blue-50 px-2 py-0.5 rounded border border-blue-200">MEDICAL</span>
            </div>
          </div>

          <button
            onClick={handleSettleRound}
            disabled={settling || isSettled}
            className={`px-4 py-2 rounded-lg text-xs font-semibold shadow-xs flex items-center gap-2 transition-colors ${
              isSettled
                ? 'bg-green-50 text-green-700 border border-green-300 cursor-default'
                : settling
                  ? 'bg-blue-300 text-white cursor-wait'
                  : 'bg-[#2563EB] hover:bg-[#1D4ED8] text-white'
            }`}
          >
            {isSettled ? (
              <>
                <CheckCircle2 size={14} className="text-green-600" />
                <span>Round 1 Settled & Certified</span>
              </>
            ) : settling ? (
              <span>Settling Round...</span>
            ) : (
              <>
                <Layers size={14} />
                <span>Trigger Settlement Round</span>
              </>
            )}
          </button>
        </div>

        {/* Visual Progress Bar */}
        <div className="space-y-2 bg-[#F8FAFC] p-4 rounded-lg border border-[#E2E8F0]">
          <div className="flex justify-between text-xs font-medium">
            <span className="text-[#64748B]">Total Physical Capacity: <strong className="text-[#172033]">5 Kits</strong></span>
            <span className="text-[#64748B]">
              Total Requested: <strong className="text-[#B91C1C]">7 Kits ({mumbaiRequested} Mumbai + {delhiRequested} Delhi)</strong>
            </span>
          </div>
          <div className="h-4 bg-[#E2E8F0] rounded-full overflow-hidden flex border border-[#CBD5E1]">
            <div style={{ width: `${(mumbaiGranted / totalStock) * 100}%` }} className="bg-[#2563EB] h-full" title="Mumbai Allocation" />
            <div style={{ width: `${(delhiGranted / totalStock) * 100}%` }} className="bg-[#0284C7] h-full" title="Delhi Allocation" />
          </div>
          <div className="flex gap-4 text-[11px] text-[#64748B] font-medium">
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded bg-[#2563EB]" /> Mumbai Allocation ({mumbaiGranted})</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded bg-[#0284C7]" /> Delhi Allocation ({delhiGranted})</span>
            {isSettled && (
              <span className="flex items-center gap-1.5 text-[#B45309] font-semibold"><span className="w-2.5 h-2.5 rounded bg-[#F59E0B]" /> 2 Backordered (Overcapacity Safe)</span>
            )}
          </div>
        </div>

        {/* Competing Regional Claims */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Mumbai Claim */}
          <div className="bg-[#F8FAFC] p-4 rounded-lg border border-[#E2E8F0] space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-xs font-bold text-[#2563EB] uppercase">Mumbai Region Claim</span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#FFFFFF] border border-[#E2E8F0] text-[#64748B]">opId: MUM-1</span>
            </div>
            <div className="text-xs space-y-1 text-[#334155]">
              <div>Requested: <strong className="text-[#172033]">{mumbaiRequested} kits</strong> for Kurla station field triage</div>
              <div>Local Tentative State: <span className="text-[#B45309] font-medium">Claimed 3 of 5</span></div>
            </div>
            <div className="p-2.5 rounded bg-[#FFFFFF] border border-[#E2E8F0] text-xs">
              <div className="text-[10px] text-[#64748B] font-medium uppercase tracking-wide">Settled Round Outcome:</div>
              <div className="mt-1 font-semibold text-[#15803D] flex items-center justify-between">
                <span>Granted: {mumbaiGranted} kits</span>
                {mumbaiBackordered > 0 && (
                  <span className="text-[#B45309] font-normal text-xs">({mumbaiBackordered} Backordered)</span>
                )}
              </div>
            </div>
          </div>

          {/* Delhi Claim */}
          <div className="bg-[#F8FAFC] p-4 rounded-lg border border-[#E2E8F0] space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-xs font-bold text-[#0284C7] uppercase">Delhi Region Claim</span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#FFFFFF] border border-[#E2E8F0] text-[#64748B]">opId: DEL-1</span>
            </div>
            <div className="text-xs space-y-1 text-[#334155]">
              <div>Requested: <strong className="text-[#172033]">{delhiRequested} kits</strong> for Emergency backup brigade</div>
              <div>Local Tentative State: <span className="text-[#B45309] font-medium">Claimed 4 of 5</span></div>
            </div>
            <div className="p-2.5 rounded bg-[#FFFFFF] border border-[#E2E8F0] text-xs">
              <div className="text-[10px] text-[#64748B] font-medium uppercase tracking-wide">Settled Round Outcome:</div>
              <div className="mt-1 font-semibold text-[#15803D] flex items-center justify-between">
                <span>Granted: {delhiGranted} kits</span>
                {delhiBackordered > 0 && (
                  <span className="text-[#B45309] font-normal text-xs">({delhiBackordered} Backordered)</span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Explain the Verdict Drawer Note */}
        <div className="p-3 bg-[#F8FAFC] rounded-lg border border-[#E2E8F0] text-xs text-[#64748B] space-y-1">
          <div className="font-semibold text-[#172033]">Deterministic Settlement Invariant:</div>
          <p>
            Total available capacity was 5 kits. Concurrent claims totaled 7 kits across partitioned regions. Claims were deterministically ordered by priority class (<code className="text-[#2563EB] bg-blue-50 px-1 py-0.5 rounded">MEDICAL</code>) and opId. Delhi’s claim received 4 kits; remaining 1 kit was allocated to Mumbai, with 2 kits marked <strong className="text-[#B45309]">Backordered</strong> under round certificate #1. Zero kits were silently dropped or oversold.
          </p>
        </div>
      </div>
    </div>
  );
};
