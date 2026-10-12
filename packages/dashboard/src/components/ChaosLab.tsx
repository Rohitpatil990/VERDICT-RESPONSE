import React, { useState } from 'react';
import { 
  Zap, 
  Unplug, 
  Radio, 
  RotateCcw, 
  ShieldAlert, 
  CheckCircle2, 
  Play, 
  Sliders, 
  Activity, 
  AlertOctagon 
} from 'lucide-react';
import { useI18n } from '../i18n.js';
import { ApiClient } from '../api.js';

interface ChaosLabProps {
  currentRegion: any;
  regionStatus: any;
  records: any[];
  onRefresh: () => void;
  onRunDemoScript?: () => void;
}

export const ChaosLab: React.FC<ChaosLabProps> = ({
  currentRegion,
  regionStatus,
  records,
  onRefresh,
  onRunDemoScript
}) => {
  const { t } = useI18n();
  const [tampering, setTampering] = useState(false);
  const [healing, setHealing] = useState(false);
  const [tamperedOpId, setTamperedOpId] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [demoRunning, setDemoRunning] = useState(false);

  const links = regionStatus?.linkState || {};

  const handleToggleLink = async (r1: any, r2: any, isCurrentlyCut: boolean) => {
    try {
      if (isCurrentlyCut) {
        await ApiClient.adminLink(r1, 'restore', r2);
        setActionMessage(`Restored inter-region link ${r1.toUpperCase()} ↔ ${r2.toUpperCase()}`);
      } else {
        await ApiClient.adminLink(r1, 'cut', r2);
        setActionMessage(`Severed link ${r1.toUpperCase()} ↔ ${r2.toUpperCase()} (Network Partition Simulated)`);
      }
      onRefresh();
    } catch (err: any) {
      alert(`Link operation failed: ${err.message}`);
    }
  };

  const handleFlipByte = async () => {
    if (records.length === 0) return;
    const targetOp = records[0].op;
    setTampering(true);
    try {
      const res = await ApiClient.adminTamper(currentRegion, targetOp.opId);
      if (res.success) {
        setTamperedOpId(targetOp.opId);
        setActionMessage(`Flipped 1 byte in ${targetOp.opId}. Hash corrupted in database.`);
        onRefresh();
      }
    } catch (err: any) {
      alert(`Tamper failed: ${err.message}`);
    } finally {
      setTampering(false);
    }
  };

  const handleHeal = async () => {
    if (!tamperedOpId && records.length === 0) return;
    const opToHeal = tamperedOpId || records[0].op.opId;
    setHealing(true);
    try {
      const res = await ApiClient.adminHeal(currentRegion, opToHeal);
      if (res.healed) {
        setTamperedOpId(null);
        setActionMessage(`Healed ${opToHeal}. Canonical hash and verification restored.`);
        onRefresh();
      }
    } catch (err: any) {
      alert(`Heal failed: ${err.message}`);
    } finally {
      setHealing(false);
    }
  };

  const handleRunScriptedDemo = async () => {
    if (onRunDemoScript) {
      onRunDemoScript();
      return;
    }
    setDemoRunning(true);
    setActionMessage('Running 3-Minute Live Scripted Demo...');
    try {
      // Step 1: Disconnect Mumbai <-> Delhi
      await ApiClient.adminLink('mumbai', 'cut', 'delhi');
      setActionMessage('Demo Step 1: Mumbai ↔ Delhi Link Severed (Partition Active)');
      onRefresh();
      await new Promise(r => setTimeout(r, 2000));

      // Step 2: Submit local reports in Mumbai and Delhi
      await ApiClient.submitReport('mumbai', {
        incidentType: 'flood',
        description: { original: { lang: 'en', text: 'Kurla subway flooded 3ft' } },
        location: { lat: 19.0688, lng: 72.8795, source: 'GPS_DEVICE' }
      });
      await ApiClient.submitOp('delhi', {
        type: 'FACT',
        entityId: 'road-lbs-marg',
        payload: { factType: 'ROAD_STATUS', roadId: 'road-lbs-marg', status: 'OPEN' }
      });
      await ApiClient.submitOp('mumbai', {
        type: 'FACT',
        entityId: 'road-lbs-marg',
        payload: { factType: 'ROAD_STATUS', roadId: 'road-lbs-marg', status: 'BLOCKED' }
      });
      setActionMessage('Demo Step 2: Independent local writes committed in disconnected regions');
      onRefresh();
      await new Promise(r => setTimeout(r, 2500));

      // Step 3: Reconnect with bandwidth cap
      await ApiClient.adminLink('mumbai', 'restore', 'delhi', 80, 1024);
      setActionMessage('Demo Step 3: Reconnected with bandwidth throttle. Delta sync running...');
      onRefresh();
      await new Promise(r => setTimeout(r, 2500));

      // Step 4: Settle round & heal
      await ApiClient.adminSettleRound('mumbai');
      setActionMessage('Demo Step 4: Settlement Round #1 certified across connected nodes!');
      onRefresh();
    } catch (err: any) {
      console.error(err);
    } finally {
      setDemoRunning(false);
    }
  };

  return (
    <div className="h-full flex flex-col p-4 space-y-4 overflow-y-auto">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
            <Zap size={16} className="text-amber-400" />
            Chaos Lab & Real System Invariant Assertions
          </h3>
          <p className="text-xs text-gray-400 mt-0.5">
            Real network fault injection against running regional endpoints. No mock data or faked responses.
          </p>
        </div>

        <button
          onClick={handleRunScriptedDemo}
          disabled={demoRunning}
          className="px-3.5 py-1.5 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-xs font-bold shadow-lg flex items-center gap-2 transition-colors disabled:opacity-50"
        >
          <Play size={13} />
          {demoRunning ? 'Demo Running...' : 'Run 3-Min Scripted Demo'}
        </button>
      </div>

      {actionMessage && (
        <div className="p-3 bg-teal-500/10 border border-teal-500/30 rounded-lg text-xs text-teal-300 flex items-center justify-between">
          <span>{actionMessage}</span>
          <button onClick={() => setActionMessage(null)} className="text-gray-400 hover:text-white">✕</button>
        </div>
      )}

      {/* Grid of Chaos Controls */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Network Partitions */}
        <div className="bg-[#111A2E] border border-[#1E2A44] rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-white flex items-center gap-1.5">
              <Unplug size={14} className="text-rose-400" />
              Network Partition Simulation
            </span>
            <span className="text-[10px] text-gray-400 font-mono">LinkController</span>
          </div>

          <div className="space-y-2">
            {[
              { r1: 'mumbai', r2: 'delhi' },
              { r1: 'mumbai', r2: 'bengaluru' },
              { r1: 'delhi', r2: 'bengaluru' }
            ].map(pair => {
              const key = [pair.r1, pair.r2].sort().join('<->');
              const link = links[key];
              const isCut = link?.status === 'DISCONNECTED';

              return (
                <div key={key} className="bg-[#0B1220] p-2.5 rounded-lg border border-[#1E2A44] flex items-center justify-between text-xs">
                  <div>
                    <span className="font-semibold text-white uppercase">{pair.r1} ↔ {pair.r2}</span>
                    <div className="text-[10px] text-gray-400">
                      Status: <strong className={isCut ? 'text-rose-400' : 'text-teal-400'}>{link?.status || 'CONNECTED'}</strong>
                      {link?.latencyMs && ` · Latency: ${link.latencyMs}ms`}
                    </div>
                  </div>

                  <button
                    onClick={() => handleToggleLink(pair.r1, pair.r2, isCut)}
                    className={`px-3 py-1 rounded text-xs font-semibold transition-colors ${
                      isCut 
                        ? 'bg-teal-500/20 text-teal-300 border border-teal-500/40 hover:bg-teal-500/30' 
                        : 'bg-rose-500/20 text-rose-300 border border-rose-500/40 hover:bg-rose-500/30'
                    }`}
                  >
                    {isCut ? 'Restore Link' : 'Sever Link'}
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* Cryptographic Tamper & Heal */}
        <div className="bg-[#111A2E] border border-[#1E2A44] rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-white flex items-center gap-1.5">
              <AlertOctagon size={14} className="text-amber-400" />
              Cryptographic Tamper & Self-Healing
            </span>
            <span className="text-[10px] text-gray-400 font-mono">Ed25519 & Hash Chain</span>
          </div>

          <p className="text-xs text-gray-400">
            Deliberately corrupt one byte of an operation hash in the SQLite database to watch the integrity check immediately transition to <strong className="text-rose-400">FAILED</strong> with exact verification failure reason.
          </p>

          <div className="grid grid-cols-2 gap-2 pt-2">
            <button
              onClick={handleFlipByte}
              disabled={tampering}
              className="py-2 px-3 bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 rounded-lg text-xs font-bold transition-colors disabled:opacity-50"
            >
              {tampering ? 'Corrupting...' : 'Flip 1 Byte in DB'}
            </button>

            <button
              onClick={handleHeal}
              disabled={healing}
              className="py-2 px-3 bg-teal-500/20 hover:bg-teal-500/30 text-teal-300 border border-teal-500/40 rounded-lg text-xs font-bold transition-colors disabled:opacity-50"
            >
              {healing ? 'Healing...' : 'Heal Ledger'}
            </button>
          </div>

          {tamperedOpId && (
            <div className="p-2.5 bg-rose-500/10 border border-rose-500/30 rounded text-xs text-rose-300 font-mono">
              Corrupted Op: {tamperedOpId} (Integrity FAILED)
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
