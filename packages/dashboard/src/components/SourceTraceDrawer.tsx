import React, { useState } from 'react';
import { 
  ShieldCheck, 
  AlertTriangle, 
  Clock, 
  MapPin, 
  User, 
  CheckCircle2, 
  XCircle, 
  Copy, 
  ChevronDown, 
  ChevronRight, 
  ExternalLink,
  Layers,
  FileText,
  Info,
  RefreshCw,
  GitBranch
} from 'lucide-react';
import { useI18n } from '../i18n.js';
import { ApiClient } from '../api.js';

interface SourceTraceDrawerProps {
  traceData: any;
  currentRegion: any;
  onClose: () => void;
  onRefresh: () => void;
}

export const SourceTraceDrawer: React.FC<SourceTraceDrawerProps> = ({
  traceData,
  currentRegion,
  onClose,
  onRefresh
}) => {
  const { t } = useI18n();
  const [showTechnicalDetails, setShowTechnicalDetails] = useState(false);
  const [copied, setCopied] = useState(false);
  const [verifying, setVerifying] = useState(false);

  if (!traceData) return null;

  const { entityId, record, indicators, lineage, conflictEvidence, audit } = traceData;

  const handleCopyJson = () => {
    navigator.clipboard.writeText(JSON.stringify(record, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleVerifyNow = async () => {
    setVerifying(true);
    try {
      await ApiClient.verifyOp(currentRegion, record.opId);
      onRefresh();
    } catch (err) {
      console.error(err);
    } finally {
      setVerifying(false);
    }
  };

  return (
    <div className="fixed inset-y-0 right-0 w-full max-w-xl bg-[#FFFFFF] border-l border-[#E2E8F0] shadow-xl flex flex-col z-[1000] text-[#172033] select-none">
      {/* Header */}
      <div className="p-4 border-b border-[#E2E8F0] flex items-center justify-between bg-[#F8FAFC]">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-blue-50 text-[#2563EB] border border-blue-200 font-bold">
              {record.type}
            </span>
            <h2 className="text-sm font-bold text-[#172033]">SourceTrace™ Provenance</h2>
          </div>
          <p className="text-xs text-[#64748B] mt-0.5">
            Entity: <strong className="font-mono text-[#172033]">{entityId}</strong>
          </p>
        </div>

        <button 
          onClick={onClose}
          className="p-1.5 rounded-md hover:bg-[#E2E8F0] text-[#64748B] hover:text-[#0F172A] transition-colors"
          title="Close Drawer"
        >
          ✕
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* The 6 Decision-Safe Indicators Grid */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[#172033] uppercase tracking-wide">
              The 6 Decision-Safe Indicators
            </span>
            <span className="text-[10px] text-[#64748B]">Never collapsed into a single score</span>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            {/* 1. Source */}
            <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg p-2.5">
              <div className="text-[10px] font-semibold text-[#64748B] uppercase">1. Source Authority</div>
              <div className="text-xs font-bold text-[#172033] mt-0.5 flex items-center gap-1.5">
                <User size={13} className="text-[#2563EB]" />
                <span>{indicators.source.tier?.replace('_', ' ')}</span>
              </div>
              <p className="text-[10px] text-[#64748B] mt-0.5">
                Logged in {indicators.source.originRegion?.toUpperCase()} node
              </p>
            </div>

            {/* 2. Freshness */}
            <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg p-2.5">
              <div className="text-[10px] font-semibold text-[#64748B] uppercase">2. Freshness & Age</div>
              <div className="text-xs font-bold text-[#172033] mt-0.5 flex items-center gap-1.5">
                <Clock size={13} className="text-[#2563EB]" />
                <span>{indicators.freshness.bucket}</span>
              </div>
              <p className="text-[10px] text-[#64748B] mt-0.5">
                {indicators.freshness.ageMinutes} min elapsed · No clock drift
              </p>
            </div>

            {/* 3. Conflict */}
            <div className={`border rounded-lg p-2.5 ${
              indicators.conflict.status === 'None'
                ? 'bg-[#F8FAFC] border-[#E2E8F0]'
                : 'bg-red-50 border-red-200'
            }`}>
              <div className="text-[10px] font-semibold text-[#64748B] uppercase">3. Conflict State</div>
              <div className={`text-xs font-bold mt-0.5 flex items-center gap-1.5 ${
                indicators.conflict.status === 'None' ? 'text-[#15803D]' : 'text-[#B91C1C]'
              }`}>
                {indicators.conflict.status === 'None' ? <CheckCircle2 size={13} /> : <AlertTriangle size={13} />}
                <span>{indicators.conflict.status === 'None' ? 'Uncontested (Clear)' : 'Contradiction Detected'}</span>
              </div>
              <p className="text-[10px] text-[#64748B] mt-0.5">
                {indicators.conflict.status === 'None' ? 'Zero competing claims' : 'Requires sector review'}
              </p>
            </div>

            {/* 4. Replication */}
            <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg p-2.5">
              <div className="text-[10px] font-semibold text-[#64748B] uppercase">4. Replication Extent</div>
              <div className="text-xs font-bold text-[#172033] mt-0.5 flex items-center gap-1.5">
                <Layers size={13} className="text-[#2563EB]" />
                <span className="text-[#2563EB]">{indicators.replication.syncedCount}/3 Regions</span>
              </div>
              <p className="text-[10px] text-[#64748B] mt-0.5">
                {indicators.replication.status}
              </p>
            </div>

            {/* 5. Integrity */}
            <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg p-2.5">
              <div className="text-[10px] font-semibold text-[#64748B] uppercase">5. Cryptographic Integrity</div>
              <div className="text-xs font-bold text-[#15803D] mt-0.5 flex items-center gap-1.5">
                <ShieldCheck size={13} />
                <span>{indicators.integrity.status} (Ed25519)</span>
              </div>
              <p className="text-[10px] text-[#64748B] mt-0.5">
                SHA-256 hash chain verified
              </p>
            </div>

            {/* 6. Resolution */}
            <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg p-2.5">
              <div className="text-[10px] font-semibold text-[#64748B] uppercase">6. Resolution Policy</div>
              <div className="text-xs font-bold text-[#172033] mt-0.5">
                {indicators.resolution.status}
              </div>
              <p className="text-[10px] text-[#64748B] mt-0.5">
                {indicators.resolution.status.includes('Settled') ? 'Included in certified round' : 'Local ingestion phase'}
              </p>
            </div>
          </div>
        </div>

        {/* Legal / Authenticity Disclaimer Box */}
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-900 text-xs space-y-1">
          <div className="flex items-center gap-1.5 font-bold text-amber-950">
            <Info size={14} className="text-[#B45309]" />
            <span>Digital Signature Disclaimer</span>
          </div>
          <p className="text-[11px] leading-relaxed text-amber-900">
            A valid signature proves integrity and origin under the configured key; it does not prove that the reported event is factually true. Correctness comes from verified evidence and human inspection.
          </p>
        </div>

        {/* Original Content Snippet */}
        <div className="bg-[#FFFFFF] border border-[#E2E8F0] rounded-lg p-3 space-y-2">
          <span className="text-xs font-bold text-[#172033] block">Reported Disaster Payload</span>
          <div className="text-xs text-[#334155] bg-[#F8FAFC] p-2.5 rounded border border-[#E2E8F0] leading-relaxed">
            {record.payload?.description?.original?.text || JSON.stringify(record.payload, null, 2)}
          </div>
          <div className="flex items-center justify-between text-[11px] text-[#64748B] pt-1">
            <span>Author: <strong className="text-[#172033]">{record.authorId}</strong></span>
            <span>Created: <strong>{new Date(record.createdAt).toLocaleTimeString()}</strong></span>
          </div>
        </div>

        {/* Expandable Technical Details Section */}
        <div className="border border-[#E2E8F0] rounded-lg overflow-hidden bg-[#FFFFFF]">
          <button
            onClick={() => setShowTechnicalDetails(!showTechnicalDetails)}
            className="w-full p-3 flex items-center justify-between text-xs font-bold text-[#172033] hover:bg-[#F8FAFC] transition-colors"
          >
            <span>Technical Verification Details</span>
            {showTechnicalDetails ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </button>

          {showTechnicalDetails && (
            <div className="p-3 border-t border-[#E2E8F0] space-y-3 bg-[#F8FAFC] text-xs">
              <div>
                <span className="text-[10px] font-bold text-[#64748B] uppercase block">Operation ID & Region</span>
                <div className="font-mono text-[11px] text-[#2563EB]">{record.opId} ({record.region.toUpperCase()})</div>
              </div>

              <div>
                <span className="text-[10px] font-bold text-[#64748B] uppercase block">SHA-256 Hash</span>
                <div className="font-mono text-[10px] text-[#172033] break-all bg-[#FFFFFF] p-1.5 rounded border border-[#E2E8F0]">
                  {record.hash}
                </div>
              </div>

              <div>
                <span className="text-[10px] font-bold text-[#64748B] uppercase block">Ed25519 Signature</span>
                <div className="font-mono text-[10px] text-[#172033] break-all bg-[#FFFFFF] p-1.5 rounded border border-[#E2E8F0]">
                  {record.sig}
                </div>
              </div>

              <div>
                <span className="text-[10px] font-bold text-[#64748B] uppercase block">Vector Clock Dependencies</span>
                <div className="font-mono text-[10px] text-[#2563EB] bg-[#FFFFFF] p-1.5 rounded border border-[#E2E8F0]">
                  {JSON.stringify(record.deps || {})}
                </div>
              </div>

              <div className="pt-2 flex items-center gap-2">
                <button
                  onClick={handleCopyJson}
                  className="px-3 py-1.5 bg-[#FFFFFF] hover:bg-[#F1F5F9] text-[#172033] border border-[#E2E8F0] rounded text-xs font-semibold flex items-center gap-1.5 transition-colors"
                >
                  <Copy size={12} />
                  <span>{copied ? 'Copied to Clipboard!' : 'Copy Raw JSON'}</span>
                </button>

                <button
                  onClick={handleVerifyNow}
                  disabled={verifying}
                  className="px-3 py-1.5 bg-[#2563EB] hover:bg-[#1D4ED8] text-white rounded text-xs font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-50"
                >
                  <RefreshCw size={12} className={verifying ? 'animate-spin' : ''} />
                  <span>Re-Verify Signature</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
