import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { api, Region } from '../api/client.js';
import {
  Map,
  ShieldCheck,
  Activity,
  Package,
  Server,
  GitMerge,
  Inbox,
  FileCode,
  FlaskConical,
  Info,
  Globe,
  User,
  AlertTriangle,
  Play
} from 'lucide-react';
import { MapView } from '../views/MapView.js';
import { GateView } from '../views/GateView.js';
import { BlastRadiusView } from '../views/BlastRadiusView.js';
import { SuppliesView } from '../views/SuppliesView.js';
import { RegionsView } from '../views/RegionsView.js';
import { MergeReportsView } from '../views/MergeReportsView.js';
import { ReviewInboxView } from '../views/ReviewInboxView.js';
import { LedgerView } from '../views/LedgerView.js';
import { LabView } from '../views/LabView.js';
import { AboutView } from '../views/AboutView.js';
import { Inspector } from './Inspector.js';

export const Shell: React.FC = () => {
  const { t, i18n } = useTranslation();
  const [activeTab, setActiveTab] = useState('map');
  const [viewingRegion, setViewingRegion] = useState<Region>('mumbai');
  const [selectedEntityId, setSelectedEntityId] = useState<string | null>('access-corridor-north');
  const [inspectorOpen, setInspectorOpen] = useState(true);

  // Partition ribbon state
  const [isDegraded, setIsDegraded] = useState(false);
  const [degradedText, setDegradedText] = useState('');

  // Failover state
  const [failoverInfo, setFailoverInfo] = useState(api.failoverState);
  const [demoStep, setDemoStep] = useState<number | null>(null);

  useEffect(() => {
    api.currentRegion = viewingRegion;
  }, [viewingRegion]);

  useEffect(() => {
    const unsub = api.onFailoverStateChange((state) => {
      setFailoverInfo(state);
    });
    return unsub;
  }, []);

  // Monitor degradation for the Partition Ribbon
  useEffect(() => {
    const checkLinks = async () => {
      try {
        const st = await api.getStatus(viewingRegion);
        const mapRes = await api.getMap(viewingRegion);
        const downLinks = (mapRes.links || []).filter((l: any) => !l.up);
        if (downLinks.length > 0) {
          setIsDegraded(true);
          const names = downLinks.map((l: any) => `${l.from.toUpperCase()}↔${l.to.toUpperCase()}`).join(', ');
          setDegradedText(`DEGRADED: ${names} down — local writes OK, escrow-limited commitments`);
        } else {
          setIsDegraded(false);
        }
      } catch (err) {
        // Node might be booting
      }
    };

    checkLinks();
    const interval = setInterval(checkLinks, 2000);
    return () => clearInterval(interval);
  }, [viewingRegion]);

  const handleOpenGateWithEntity = (id: string) => {
    setSelectedEntityId(id);
    setActiveTab('gate');
  };

  // Automated 3-minute scripted demo driver
  const runScriptedDemo = async () => {
    setDemoStep(1);
    setActiveTab('map');
    setViewingRegion('mumbai');

    // Step 2: Cut link at 20s
    setTimeout(async () => {
      setDemoStep(2);
      await api.alterLink('mumbai', 'delhi', false);
    }, 2000);

    // Step 3: Switch to Delhi view
    setTimeout(async () => {
      setDemoStep(3);
      setViewingRegion('delhi');
      setActiveTab('gate');
    }, 5000);

    // Step 4: Supplies escrow demonstration
    setTimeout(async () => {
      setDemoStep(4);
      setActiveTab('supplies');
      await api.spendEscrow('medical_kits', 3, 'mumbai');
      await api.spendEscrow('medical_kits', 4, 'delhi');
    }, 8000);

    // Step 5: Reconnect with bandwidth cap
    setTimeout(async () => {
      setDemoStep(5);
      await api.alterLink('mumbai', 'delhi', true, 10240);
      setActiveTab('merge-reports');
    }, 11000);

    // Step 6: Review inbox
    setTimeout(() => {
      setDemoStep(6);
      setActiveTab('review');
    }, 14000);

    // Done
    setTimeout(() => {
      setDemoStep(null);
    }, 17000);
  };

  return (
    <div className="flex h-screen w-screen bg-background text-slate-100 overflow-hidden select-none">
      {/* Left Icon Rail */}
      <div className="w-16 border-r border-border bg-surface flex flex-col items-center py-3 gap-2 shrink-0 z-20">
        {/* App Logo / Mark */}
        <div className="w-10 h-10 rounded-lg bg-tealVerdict/15 border border-tealVerdict/40 flex items-center justify-center font-black text-tealVerdict font-mono text-sm mb-2 shadow-lg">
          V
        </div>

        {/* Navigation Items */}
        {[
          { id: 'map', icon: Map, label: 'Map' },
          { id: 'gate', icon: ShieldCheck, label: 'Gate' },
          { id: 'blast-radius', icon: Activity, label: 'Receipts' },
          { id: 'supplies', icon: Package, label: 'Supplies' },
          { id: 'regions', icon: Server, label: 'Regions' },
          { id: 'merge-reports', icon: GitMerge, label: 'Merges' },
          { id: 'review', icon: Inbox, label: 'Review' },
          { id: 'ledger', icon: FileCode, label: 'Ledger' },
          { id: 'lab', icon: FlaskConical, label: 'Lab' },
          { id: 'about', icon: Info, label: 'About' }
        ].map(item => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              title={item.label}
              className={`w-11 h-11 rounded-lg flex flex-col items-center justify-center gap-0.5 transition ${
                isActive
                  ? 'bg-tealVerdict/15 text-tealVerdict border border-tealVerdict/30 shadow-md'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span className="text-[9px] font-medium tracking-tight">{item.label}</span>
            </button>
          );
        })}
      </div>

      {/* Main Workspace Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Header Bar */}
        <header className="h-12 border-b border-border bg-surface/90 backdrop-blur px-4 flex items-center justify-between shrink-0 z-10">
          <div className="flex items-center gap-3">
            <span className="font-bold text-sm tracking-tight text-slate-100">
              VERDICT <span className="text-tealVerdict font-mono text-xs">Response</span>
            </span>
            <span className="hidden md:inline text-[11px] text-slate-400 border-l border-border pl-3">
              Observe anywhere · Commit safely · Decide with eyes open
            </span>
          </div>

          <div className="flex items-center gap-3">
            {/* Viewing From Region Dropdown */}
            <div className="flex items-center gap-1.5 bg-background border border-border rounded px-2.5 py-1 text-xs">
              <span className="text-slate-400 text-[11px]">Viewing from:</span>
              <select
                value={viewingRegion}
                onChange={e => setViewingRegion(e.target.value as Region)}
                className="bg-transparent font-bold text-tealVerdict focus:outline-none cursor-pointer"
              >
                <option value="mumbai" className="bg-slate-900 text-slate-100">
                  Mumbai (Authority)
                </option>
                <option value="delhi" className="bg-slate-900 text-slate-100">
                  Delhi
                </option>
                <option value="bengaluru" className="bg-slate-900 text-slate-100">
                  Bengaluru
                </option>
              </select>
            </div>

            {/* Language Switcher */}
            <div className="flex items-center gap-1 bg-background border border-border rounded p-0.5 text-xs">
              <button
                onClick={() => i18n.changeLanguage('en')}
                className={`px-1.5 py-0.5 rounded font-mono text-[10px] ${
                  i18n.language === 'en'
                    ? 'bg-tealVerdict text-slate-900 font-bold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                EN
              </button>
              <button
                onClick={() => i18n.changeLanguage('hi')}
                className={`px-1.5 py-0.5 rounded font-mono text-[10px] ${
                  i18n.language === 'hi'
                    ? 'bg-tealVerdict text-slate-900 font-bold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                हिं
              </button>
              <button
                onClick={() => i18n.changeLanguage('mr')}
                className={`px-1.5 py-0.5 rounded font-mono text-[10px] ${
                  i18n.language === 'mr'
                    ? 'bg-tealVerdict text-slate-900 font-bold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                मरा
              </button>
            </div>

            {/* 3-Minute Scripted Demo Button */}
            <button
              onClick={runScriptedDemo}
              disabled={demoStep !== null}
              className="px-2.5 py-1 bg-purpleVerdict text-slate-900 font-bold text-xs rounded hover:bg-purple-400 transition flex items-center gap-1 shadow"
            >
              <Play className="w-3 h-3 fill-current" />
              {demoStep ? `Demo Step ${demoStep}...` : 'Run 3-Min Demo'}
            </button>
          </div>
        </header>

        {/* Partition Ribbon (Appears when any link is degraded) */}
        {isDegraded && (
          <div className="h-7 bg-amberVerdict/15 border-b border-amberVerdict/40 px-4 flex items-center justify-between text-xs text-amber-200 font-medium shrink-0 animate-pulse">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-3.5 h-3.5 text-amberVerdict shrink-0" />
              <span>{degradedText}</span>
            </div>
            <span className="text-[10px] font-mono uppercase bg-amberVerdict/20 text-amberVerdict px-1.5 py-0.5 rounded">
              AP Active
            </span>
          </div>
        )}

        {/* Failover Ribbon (Appears when client reroutes to a fallback replica) */}
        {failoverInfo.isFailover && (
          <div className="h-7 bg-amber-500/20 border-b border-amber-500/50 px-4 flex items-center justify-between text-xs text-amber-300 font-medium shrink-0">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping shrink-0" />
              <span>
                AUTOMATIC FAILOVER ACTIVE: Rerouted from {failoverInfo.preferredRegion.toUpperCase()} to {failoverInfo.activeRegion.toUpperCase()} (Reading fallback replica view)
              </span>
            </div>
            <span className="text-[10px] font-mono uppercase bg-amber-500/30 text-amber-200 px-1.5 py-0.5 rounded">
              Fallback Node Active
            </span>
          </div>
        )}

        {/* Content View Body + Inspector */}
        <div className="flex-1 flex overflow-hidden min-h-0">
          <main className="flex-1 overflow-hidden relative">
            {activeTab === 'map' && (
              <MapView
                viewingRegion={viewingRegion}
                onSelectEntity={id => {
                  setSelectedEntityId(id);
                  setInspectorOpen(true);
                }}
                selectedEntityId={selectedEntityId}
              />
            )}
            {activeTab === 'gate' && (
              <GateView
                viewingRegion={viewingRegion}
                selectedEntityId={selectedEntityId}
                onReceiptCommitted={() => setActiveTab('blast-radius')}
              />
            )}
            {activeTab === 'blast-radius' && (
              <BlastRadiusView
                viewingRegion={viewingRegion}
                onOpenGateWithEntity={handleOpenGateWithEntity}
              />
            )}
            {activeTab === 'supplies' && <SuppliesView viewingRegion={viewingRegion} />}
            {activeTab === 'regions' && <RegionsView viewingRegion={viewingRegion} />}
            {activeTab === 'merge-reports' && <MergeReportsView viewingRegion={viewingRegion} />}
            {activeTab === 'review' && (
              <ReviewInboxView
                viewingRegion={viewingRegion}
                onConflictResolved={() => setActiveTab('map')}
              />
            )}
            {activeTab === 'ledger' && <LedgerView viewingRegion={viewingRegion} />}
            {activeTab === 'lab' && <LabView viewingRegion={viewingRegion} />}
            {activeTab === 'about' && <AboutView />}
          </main>

          {/* Right Inspector Drawer */}
          {inspectorOpen && selectedEntityId && activeTab === 'map' && (
            <Inspector
              entityId={selectedEntityId}
              region={viewingRegion}
              onClose={() => setInspectorOpen(false)}
              onOpenGateWithEntity={handleOpenGateWithEntity}
            />
          )}
        </div>

        {/* Bottom Status Footer */}
        <footer className="h-6 border-t border-border bg-surface px-4 flex items-center justify-between text-[11px] text-slate-500 shrink-0">
          <div className="flex items-center gap-3">
            <span>Simulated demo data, not live disaster information.</span>
            <span>·</span>
            <span>Team print("Winners");</span>
          </div>
          <div className="font-mono text-slate-400">
            {failoverInfo.isFailover ? (
              <span className="text-amber-400 font-semibold flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                Target: {viewingRegion.toUpperCase()} | Active: {failoverInfo.activeRegion.toUpperCase()} (Failover Mode)
              </span>
            ) : (
              <span>Node: {viewingRegion.toUpperCase()} · Latency: 15ms · SHA-256 / Ed25519</span>
            )}
          </div>
        </footer>
      </div>
    </div>
  );
};
