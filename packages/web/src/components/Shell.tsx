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

class TabErrorBoundary extends React.Component<
  { children: React.ReactNode; tabName: string },
  { hasError: boolean; error: any }
> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }
  componentDidCatch(error: any, info: any) {
    console.error(`[TabErrorBoundary] Error in tab:`, error, info);
  }
  componentDidUpdate(prevProps: any) {
    if (prevProps.tabName !== this.props.tabName && this.state.hasError) {
      this.setState({ hasError: false, error: null });
    }
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="h-full flex flex-col items-center justify-center p-8 text-center bg-surface">
          <div className="w-12 h-12 rounded-full bg-roseVerdict/10 border border-roseVerdict/40 flex items-center justify-center text-roseVerdict mb-4">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <h2 className="text-base font-bold text-slate-100 mb-1">View Rendering Error</h2>
          <p className="text-xs text-slate-400 max-w-md mb-4 font-mono">
            {this.state.error?.message || 'An unexpected rendering error occurred in this view.'}
          </p>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            className="px-4 py-2 bg-tealVerdict text-slate-900 rounded font-bold text-xs hover:bg-teal-400 transition"
          >
            Retry View
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

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
    <div className="flex h-screen w-screen bg-background text-primaryText overflow-hidden select-none">
      {/* Left Icon Rail */}
      <nav aria-label="Main Navigation" className="w-16 border-r border-border bg-surface flex flex-col items-center py-3 gap-1 shrink-0 z-20">
        {/* App Logo / Mark */}
        <div className="w-9 h-9 rounded-lg bg-primaryAction text-white flex items-center justify-center font-bold text-sm mb-3 shadow-subtle tracking-tight">
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
              className={`w-12 h-11 rounded-md flex flex-col items-center justify-center gap-0.5 transition ${
                isActive
                  ? 'bg-blue-50 text-primaryAction font-semibold border border-blue-200/60 shadow-subtle'
                  : 'text-secondaryText hover:text-primaryText hover:bg-slate-100'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span className="text-[10px] tracking-tight">{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Main Workspace Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Header Bar */}
        <header className="h-13 border-b border-border bg-surface px-5 flex items-center justify-between shrink-0 z-10 shadow-subtle">
          <div className="flex items-center gap-3">
            <div className="flex items-baseline gap-1.5">
              <span className="font-bold text-sm tracking-tight text-primaryText">VERDICT</span>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-tealVerdict bg-tealSubtle px-1.5 py-0.5 rounded border border-tealBorder">
                Response
              </span>
            </div>
            <span className="hidden lg:inline text-xs text-secondaryText border-l border-border pl-3">
              Geo-Distributed Disaster Data Replication & Decision Gate
            </span>
          </div>

          <div className="flex items-center gap-3">
            {/* Viewing From Region Dropdown */}
            <div className="flex items-center gap-2 bg-slate-50 border border-border rounded-md px-2.5 py-1 text-xs">
              <span className="text-secondaryText text-[11px] font-medium">Region:</span>
              <select
                value={viewingRegion}
                onChange={e => setViewingRegion(e.target.value as Region)}
                className="bg-transparent font-semibold text-primaryText focus:outline-none cursor-pointer"
              >
                <option value="mumbai">Mumbai (Authority)</option>
                <option value="delhi">Delhi</option>
                <option value="bengaluru">Bengaluru</option>
              </select>

              {failoverInfo.isFailover && (
                <span className="ml-1 text-[10px] font-medium text-warning bg-warningSubtle border border-warningBorder px-1.5 py-0.5 rounded">
                  Served by {failoverInfo.activeRegion.toUpperCase()}
                </span>
              )}
            </div>

            {/* Language Switcher */}
            <div className="flex items-center bg-slate-50 border border-border rounded-md p-0.5 text-xs">
              <button
                onClick={() => i18n.changeLanguage('en')}
                className={`px-2 py-0.5 rounded text-[11px] font-medium transition ${
                  i18n.language === 'en'
                    ? 'bg-surface text-primaryText font-semibold shadow-subtle'
                    : 'text-secondaryText hover:text-primaryText'
                }`}
              >
                EN
              </button>
              <button
                onClick={() => i18n.changeLanguage('hi')}
                className={`px-2 py-0.5 rounded text-[11px] font-medium transition ${
                  i18n.language === 'hi'
                    ? 'bg-surface text-primaryText font-semibold shadow-subtle'
                    : 'text-secondaryText hover:text-primaryText'
                }`}
              >
                हिं
              </button>
              <button
                onClick={() => i18n.changeLanguage('mr')}
                className={`px-2 py-0.5 rounded text-[11px] font-medium transition ${
                  i18n.language === 'mr'
                    ? 'bg-surface text-primaryText font-semibold shadow-subtle'
                    : 'text-secondaryText hover:text-primaryText'
                }`}
              >
                मरा
              </button>
            </div>

            {/* 3-Minute Scripted Demo Button */}
            <button
              onClick={runScriptedDemo}
              disabled={demoStep !== null}
              className="px-3 py-1.5 bg-primaryAction hover:bg-primaryActionHover text-white font-medium text-xs rounded-md transition flex items-center gap-1.5 shadow-subtle disabled:opacity-50"
            >
              <Play className="w-3 h-3 fill-current" />
              {demoStep ? `Running Step ${demoStep}...` : 'Run 3-Min Demo'}
            </button>
          </div>
        </header>

        {/* Partition Ribbon (Appears when any link is degraded) */}
        {isDegraded && (
          <div className="h-7 bg-amber-50 border-b border-amber-200 px-4 flex items-center justify-between text-xs text-amber-800 font-medium shrink-0">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-3.5 h-3.5 text-warning shrink-0" />
              <span>{degradedText}</span>
            </div>
            <span className="text-[10px] font-mono font-semibold uppercase bg-amber-100 text-amber-900 px-2 py-0.5 rounded">
              Local Writes Active
            </span>
          </div>
        )}

        {/* Failover Ribbon (Appears when client reroutes to a fallback replica) */}
        {failoverInfo.isFailover && (
          <div className="h-7 bg-blue-50 border-b border-blue-200 px-4 flex items-center justify-between text-xs text-blue-900 font-medium shrink-0">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-primaryAction animate-pulse shrink-0" />
              <span>
                Automatic failover active: Rerouted from {failoverInfo.preferredRegion.toUpperCase()} to {failoverInfo.activeRegion.toUpperCase()} (Reading fallback replica)
              </span>
            </div>
            <span className="text-[10px] font-mono font-semibold uppercase bg-blue-100 text-blue-800 px-2 py-0.5 rounded">
              Replica View
            </span>
          </div>
        )}

        {/* Content View Body + Inspector */}
        <div className="flex-1 flex overflow-hidden min-h-0 bg-background">
          <main className="flex-1 overflow-hidden relative">
            <TabErrorBoundary tabName={activeTab}>
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
            </TabErrorBoundary>
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
        <footer className="h-7 border-t border-border bg-surface px-5 flex items-center justify-between text-xs text-secondaryText shrink-0">
          <div className="flex items-center gap-3">
            <span>Local multi-process simulation · Team print("Winners");</span>
            <span>·</span>
            <span>CodeAstra 2.0 PS #2</span>
          </div>
          <div className="font-mono text-[11px] text-secondaryText flex items-center gap-3">
            {failoverInfo.isFailover ? (
              <span className="text-warning font-medium flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-warning animate-pulse" />
                Active Node: {failoverInfo.activeRegion.toUpperCase()} (Fallback)
              </span>
            ) : (
              <span>Node: {viewingRegion.toUpperCase()} · SHA-256 / Ed25519 Verified</span>
            )}
          </div>
        </footer>
      </div>
    </div>
  );
};
