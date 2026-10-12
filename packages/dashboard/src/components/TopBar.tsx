import React from 'react';
import { 
  Globe2, 
  PlusCircle, 
  ShieldAlert, 
  Activity, 
  Server, 
  Info,
  CheckCircle2,
  AlertTriangle
} from 'lucide-react';
import { useI18n, Language } from '../i18n.js';
import { RegionId } from '../api.js';

interface TopBarProps {
  currentRegion: RegionId;
  onSelectRegion: (region: RegionId) => void;
  regionStatus: any;
  isError: boolean;
  onOpenReport: () => void;
  onOpenAbout: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({
  currentRegion,
  onSelectRegion,
  regionStatus,
  isError,
  onOpenReport,
  onOpenAbout
}) => {
  const { lang, setLang, t } = useI18n();

  // Determine connectivity from link states
  const links = regionStatus?.linkState || {};
  const cutLinksCount = Object.values(links).filter((l: any) => l.status === 'DISCONNECTED').length;
  const isHealthy = !isError && cutLinksCount === 0;

  return (
    <header className="h-14 bg-[#FFFFFF] border-b border-[#E2E8F0] px-4 flex items-center justify-between shrink-0 select-none">
      {/* Left: Region Selector & Connection Indicator */}
      <div className="flex items-center gap-3">
        {/* Region Selector */}
        <div className="flex items-center bg-[#F1F5F9] p-0.5 rounded-lg border border-[#E2E8F0]">
          <span className="text-[11px] font-semibold text-[#64748B] px-2.5 hidden sm:inline">
            Active Node:
          </span>
          {(['mumbai', 'delhi', 'bengaluru'] as RegionId[]).map(r => {
            const isSelected = currentRegion === r;
            return (
              <button
                key={r}
                onClick={() => onSelectRegion(r)}
                className={`px-3 py-1 rounded-md text-xs font-semibold uppercase transition-all flex items-center gap-1.5 ${
                  isSelected
                    ? 'bg-[#FFFFFF] text-[#2563EB] shadow-xs border border-[#E2E8F0]'
                    : 'text-[#64748B] hover:text-[#0F172A]'
                }`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${
                  isSelected ? 'bg-[#2563EB]' : 'bg-[#94A3B8]'
                }`} />
                <span>{r}</span>
              </button>
            );
          })}
        </div>

        {/* Real Connectivity Pill */}
        <div className={`px-2 py-1 rounded-md border text-[11px] font-medium flex items-center gap-1.5 ${
          isError 
            ? 'bg-red-50 text-red-700 border-red-200' 
            : isHealthy 
              ? 'bg-green-50 text-green-700 border-green-200' 
              : 'bg-amber-50 text-amber-700 border-amber-200'
        }`}>
          <div className={`w-1.5 h-1.5 rounded-full ${
            isError ? 'bg-red-600' : isHealthy ? 'bg-green-600' : 'bg-amber-600 animate-pulse'
          }`} />
          <span className="hidden md:inline">
            {isError ? 'Service Unreachable' : isHealthy ? 'All Regional Links Active' : 'Partition Active (AP Mode)'}
          </span>
        </div>
      </div>

      {/* Right: Actions, Language & New Report */}
      <div className="flex items-center gap-2.5">
        {/* Simulated Demo Notice Badge */}
        <div className="hidden lg:flex items-center gap-1 bg-[#F8FAFC] border border-[#E2E8F0] px-2.5 py-1 rounded-md text-[11px] text-[#64748B]">
          <ShieldAlert size={12} className="text-[#B45309]" />
          <span>Synthetic Disaster Scenario</span>
        </div>

        {/* Language Switcher */}
        <div className="flex items-center bg-[#F1F5F9] p-0.5 rounded-md border border-[#E2E8F0] text-xs">
          <Globe2 size={12} className="text-[#64748B] ml-1.5 mr-0.5" />
          {(['en', 'hi', 'mr'] as const).map(l => (
            <button
              key={l}
              onClick={() => setLang(l)}
              className={`px-1.5 py-0.5 rounded text-[11px] font-bold uppercase transition-all ${
                lang === l
                  ? 'bg-[#FFFFFF] text-[#2563EB] shadow-xs'
                  : 'text-[#64748B] hover:text-[#0F172A]'
              }`}
            >
              {l === 'en' ? 'EN' : l === 'hi' ? 'HI' : 'MR'}
            </button>
          ))}
        </div>

        {/* System Traceability & Docs */}
        <button
          onClick={onOpenAbout}
          className="text-[#64748B] hover:text-[#0F172A] hover:bg-[#F1F5F9] p-1.5 rounded-md border border-transparent hover:border-[#E2E8F0] transition-colors"
          title="System Architecture & Integrity Matrix"
        >
          <Info size={16} />
        </button>

        {/* New Report Primary Action */}
        <button
          onClick={onOpenReport}
          className="bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-xs font-semibold px-3 py-1.5 rounded-md shadow-xs flex items-center gap-1.5 transition-colors"
        >
          <PlusCircle size={14} />
          <span>New Incident</span>
        </button>
      </div>
    </header>
  );
};
