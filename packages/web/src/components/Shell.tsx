import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { api, Region } from '../api/client.js';
import {
  LayoutDashboard,
  FileText,
  RefreshCw,
  ShieldCheck,
  Server,
  Map,
  Activity,
  Package,
  GitMerge,
  Inbox,
  FileCode,
  FlaskConical,
  Info,
  AlertTriangle,
  Play,
  ChevronDown,
  ChevronUp,
  Settings,
  Layers,
  HelpCircle
} from 'lucide-react';

// Primary Simplified Views
import { OverviewView } from '../views/OverviewView.js';
import { IncidentsView } from '../views/IncidentsView.js';
import { RecoverySyncView } from '../views/RecoverySyncView.js';
import { VerifyView } from '../views/VerifyView.js';
import { ScaleTestView } from '../views/ScaleTestView.js';
import { GuidedDemoModal } from './GuidedDemoModal.js';
import { HowToRunModal } from './HowToRunModal.js';

// Advanced Technical Views (Preserved in Collapsible Technical Details)
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
  const getInitialTab = () => {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      const tabParam = urlParams.get('tab');
      if (tabParam) return tabParam;
      const hash = window.location.hash.replace('#', '');
      if (hash) return hash;
    }
    return 'overview';
  };
  const [activeTab, setActiveTab] = useState<string>(getInitialTab);
  const [viewingRegion, setViewingRegion] = useState<Region>('mumbai');
  const [selectedEntityId, setSelectedEntityId] = useState<string | null>('access-corridor-north');
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [showTechnicalDetails, setShowTechnicalDetails] = useState(false);
  const [guidedDemoOpen, setGuidedDemoOpen] = useState(false);
  const [howToRunOpen, setHowToRunOpen] = useState(false);
  const [autoDemoTrigger, setAutoDemoTrigger] = useState<number | undefined>(undefined);

  // Partition ribbon state
  const [isDegraded, setIsDegraded] = useState(false);
  const [degradedText, setDegradedText] = useState('');

  // Failover state
  const [failoverInfo, setFailoverInfo] = useState(api.failoverState);

  // Gateway Load Balancer state
  const [lbStatus, setLbStatus] = useState<any | null>(null);

  useEffect(() => {
    const fetchLb = async () => {
      const data = await api.getLoadBalancerStatus();
      setLbStatus(data);
    };
    fetchLb();
    const interval = setInterval(fetchLb, 3000);
    return () => clearInterval(interval);
  }, []);

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
        const mapRes = await api.getMap(viewingRegion);
        const downLinks = (mapRes.links || []).filter((l: any) => !l.up);
        if (downLinks.length > 0) {
          setIsDegraded(true);
          const names = downLinks.map((l: any) => `${l.from.toUpperCase()}↔${l.to.toUpperCase()}`).join(', ');
          setDegradedText(`DEGRADED: ${names} link down — local writes OK, escrow-bounded commitments active`);
        } else {
          setIsDegraded(false);
        }
      } catch (err) {
        // Node might be booting
      }
    };

    checkLinks();
    const interval = setInterval(checkLinks, 2500);
    return () => clearInterval(interval);
  }, [viewingRegion]);

  const handleOpenGateWithEntity = (id: string) => {
    setSelectedEntityId(id);
    setActiveTab('gate');
  };

  // Primary 4 Tabs
  const primaryTabs = [
    { id: 'overview', icon: LayoutDashboard, label: 'Overview' },
    { id: 'incidents', icon: FileText, label: 'Incidents' },
    { id: 'recovery', icon: RefreshCw, label: 'Recovery Demo' },
    { id: 'verify', icon: ShieldCheck, label: 'Verification' }
  ];

  // Advanced Technical Views
  const technicalTabs = [
    { id: 'scale-test', icon: Layers, label: 'Scale Test (500)' },
    { id: 'map', icon: Map, label: 'Map View' },
    { id: 'gate', icon: ShieldCheck, label: 'Decision Gate' },
    { id: 'blast-radius', icon: Activity, label: 'Receipts' },
    { id: 'supplies', icon: Package, label: 'Supplies Escrow' },
    { id: 'regions', icon: Server, label: 'Region Topology' },
    { id: 'merge-reports', icon: GitMerge, label: 'Merge Reports' },
    { id: 'review', icon: Inbox, label: 'Review Inbox' },
    { id: 'ledger', icon: FileCode, label: 'Audit Ledger' },
    { id: 'lab', icon: FlaskConical, label: 'Lab Bench' },
    { id: 'about', icon: Info, label: 'Architecture Docs' }
  ];

  return (
    <div className="flex h-screen w-screen bg-background text-primaryText overflow-hidden select-none">
      {/* Guided 3-Minute Presentation Modal */}
      <GuidedDemoModal isOpen={guidedDemoOpen} onClose={() => setGuidedDemoOpen(false)} />

      {/* How to Run Guide Modal */}
      <HowToRunModal
        isOpen={howToRunOpen}
        onClose={() => setHowToRunOpen(false)}
        onStartGuidedDemo={() => {
          setHowToRunOpen(false);
          setGuidedDemoOpen(true);
        }}
      />

      {/* Simplified Left Navigation Rail */}
      <nav aria-label="Main Navigation" className="w-18 border-r border-border bg-surface flex flex-col items-center py-4 gap-2 shrink-0 z-20 shadow-xs">
        {/* App Logo */}
        <div
          onClick={() => setActiveTab('overview')}
          title="VERDICT Response"
          className="w-10 h-10 rounded-xl bg-primaryAction text-white flex items-center justify-center font-black text-base mb-3 shadow-subtle tracking-tight cursor-pointer hover:bg-primaryActionHover transition"
        >
          V
        </div>

        {/* 4 Primary Navigation Items */}
        <div className="flex flex-col gap-1.5 w-full items-center">
          {primaryTabs.map(item => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                title={item.label}
                className={`w-14 h-12 rounded-lg flex flex-col items-center justify-center gap-1 transition ${
                  isActive
                    ? 'bg-blue-50 text-primaryAction font-bold border border-blue-200/80 shadow-subtle'
                    : 'text-secondaryText hover:text-primaryText hover:bg-slate-100'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span className="text-[10px] tracking-tight leading-none text-center">{item.label}</span>
              </button>
            );
          })}
        </div>

        {/* Divider */}
        <div className="w-8 border-t border-border my-2" />

        {/* Collapsible Technical Details Toggle */}
        <button
          onClick={() => setShowTechnicalDetails(!showTechnicalDetails)}
          title="Toggle Technical Details"
          className={`w-16 py-2 px-1 rounded-lg flex flex-col items-center justify-center gap-0.5 transition ${
            showTechnicalDetails || technicalTabs.some(t => t.id === activeTab)
              ? 'bg-slate-100 text-primaryText font-semibold'
              : 'text-secondaryText hover:text-primaryText hover:bg-slate-50'
          }`}
        >
          <Settings className="w-4 h-4" />
          <span className="text-[8px] font-medium tracking-tight text-center leading-tight">Technical Details</span>
          {showTechnicalDetails ? <ChevronUp className="w-3 h-3 text-secondaryText" /> : <ChevronDown className="w-3 h-3 text-secondaryText" />}
        </button>

        {/* Technical Details Flyout / Sub-menu */}
        {showTechnicalDetails && (
          <div className="w-14 flex flex-col gap-1 items-center overflow-y-auto max-h-48 py-1">
            {technicalTabs.map(item => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  title={item.label}
                  className={`w-11 h-9 rounded-md flex flex-col items-center justify-center transition ${
                    isActive
                      ? 'bg-blue-50 text-primaryAction border border-blue-200 font-bold'
                      : 'text-secondaryText hover:text-primaryText hover:bg-slate-100'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span className="text-[8px] truncate max-w-[40px]">{item.label}</span>
                </button>
              );
            })}
          </div>
        )}
      </nav>

      {/* Main Workspace Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Header Bar */}
        <header className="h-14 border-b border-border bg-surface px-6 flex items-center justify-between shrink-0 z-10 shadow-subtle">
          <div className="flex items-center gap-3">
            <div className="flex items-baseline gap-2">
              <span className="font-black text-base tracking-tight text-primaryText">VERDICT</span>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-tealVerdict bg-tealSubtle px-2 py-0.5 rounded border border-tealBorder">
                Response
              </span>
            </div>
            <span className="hidden lg:inline text-xs text-secondaryText border-l border-border pl-3">
              Geo-Distributed Disaster Data Replication with Graceful Degradation
            </span>
          </div>

          <div className="flex items-center gap-3">
            {/* Viewing Region Selector */}
            <div className="flex items-center gap-2 bg-slate-50 border border-border rounded-md px-2.5 py-1 text-xs">
              <span className="text-secondaryText text-[11px] font-medium">Node:</span>
              <select
                value={viewingRegion}
                onChange={e => setViewingRegion(e.target.value as Region)}
                className="bg-transparent font-bold text-primaryText focus:outline-none cursor-pointer"
              >
                <option value="mumbai">Mumbai (Authority)</option>
                <option value="delhi">Delhi</option>
                <option value="bengaluru">Bengaluru</option>
              </select>

              {failoverInfo.isFailover ? (
                <span className="ml-1 text-[10px] font-bold text-warning bg-warningSubtle border border-warningBorder px-1.5 py-0.5 rounded flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-warning animate-pulse" />
                  Degraded Failover: {failoverInfo.activeRegion.toUpperCase()}
                </span>
              ) : (
                <span className="ml-1 text-[10px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  Primary ({viewingRegion.toUpperCase()})
                </span>
              )}
            </div>

            {/* Gateway & Load Balancer Status Badge */}
            {lbStatus && (
              <div
                onClick={() => setActiveTab('recovery')}
                title="Consistency-Aware Gateway (Port 4000). Click to view recovery workspace."
                className="hidden xl:flex items-center gap-1.5 bg-blue-50/80 border border-blue-200/60 rounded-md px-2.5 py-1 text-xs cursor-pointer hover:bg-blue-100/60 transition"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-pulse" />
                <span className="text-secondaryText text-[11px] font-medium">Gateway:</span>
                <span className="text-[11px] font-bold text-blue-700">
                  {lbStatus.healthyCount}/{lbStatus.totalBackends} Healthy
                </span>
              </div>
            )}

            {/* Language Switcher */}
            <div className="flex items-center bg-slate-50 border border-border rounded-md p-0.5 text-xs">
              <button
                onClick={() => i18n.changeLanguage('en')}
                className={`px-2 py-0.5 rounded text-[11px] font-medium transition ${
                  i18n.language === 'en'
                    ? 'bg-surface text-primaryText font-bold shadow-subtle'
                    : 'text-secondaryText hover:text-primaryText'
                }`}
              >
                EN
              </button>
              <button
                onClick={() => i18n.changeLanguage('hi')}
                className={`px-2 py-0.5 rounded text-[11px] font-medium transition ${
                  i18n.language === 'hi'
                    ? 'bg-surface text-primaryText font-bold shadow-subtle'
                    : 'text-secondaryText hover:text-primaryText'
                }`}
              >
                हिं
              </button>
            </div>

            {/* How to Run Guide Button */}
            <button
              onClick={() => setHowToRunOpen(true)}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 font-semibold text-xs rounded-md transition flex items-center gap-1.5 shadow-subtle"
              title="How to Run VERDICT instructions & Docker guide"
            >
              <HelpCircle className="w-3.5 h-3.5 text-blue-600" />
              <span>How to Run</span>
            </button>

            {/* Run Guided Demo Button */}
            <button
              onClick={() => setGuidedDemoOpen(true)}
              className="px-3.5 py-1.5 bg-primaryAction hover:bg-primaryActionHover text-white font-semibold text-xs rounded-md transition flex items-center gap-1.5 shadow-subtle"
            >
              <Play className="w-3.5 h-3.5 fill-white" />
              <span>Guided Demo</span>
            </button>
          </div>
        </header>

        {/* Network Partition Warning Ribbon */}
        {isDegraded && (
          <div className="h-7 bg-amber-50 border-b border-amber-200 px-4 flex items-center justify-between text-xs text-amber-800 font-medium shrink-0">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-3.5 h-3.5 text-warning shrink-0" />
              <span>{degradedText}</span>
            </div>
            <span className="text-[10px] font-mono font-semibold uppercase bg-amber-100 text-amber-900 px-2 py-0.5 rounded">
              Local Autonomy Active
            </span>
          </div>
        )}

        {/* Content View Body */}
        <div className="flex-1 flex overflow-hidden min-h-0 bg-background">
          <main className="flex-1 overflow-hidden relative">
            <TabErrorBoundary tabName={activeTab}>
              {/* Primary 4 Views */}
              {activeTab === 'overview' && (
                <OverviewView
                  onRunGuidedDemo={() => setGuidedDemoOpen(true)}
                  onStartAutoDemo={() => {
                    setActiveTab('recovery');
                    setAutoDemoTrigger(Date.now());
                  }}
                  onOpenHowToRun={() => setHowToRunOpen(true)}
                  onNavigateToIncidents={() => setActiveTab('incidents')}
                  onNavigateToRecovery={() => setActiveTab('recovery')}
                  onNavigateToVerify={() => setActiveTab('verify')}
                  onNavigateToScaleTest={() => setActiveTab('scale-test')}
                />
              )}
              {activeTab === 'incidents' && <IncidentsView currentRegion={viewingRegion} />}
              {activeTab === 'recovery' && (
                <RecoverySyncView
                  currentRegion={viewingRegion}
                  autoDemoTrigger={autoDemoTrigger}
                  onNavigateToVerify={() => setActiveTab('verify')}
                />
              )}
              {activeTab === 'verify' && <VerifyView />}
              {activeTab === 'scale-test' && <ScaleTestView />}

              {/* Advanced Views Preserved in Technical Details */}
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
                  onConflictResolved={() => setActiveTab('incidents')}
                />
              )}
              {activeTab === 'ledger' && <LedgerView viewingRegion={viewingRegion} />}
              {activeTab === 'lab' && <LabView viewingRegion={viewingRegion} />}
              {activeTab === 'about' && <AboutView />}
            </TabErrorBoundary>
          </main>

          {/* Right Inspector Drawer for Map View */}
          {inspectorOpen && selectedEntityId && activeTab === 'map' && (
            <Inspector
              entityId={selectedEntityId}
              region={viewingRegion}
              onClose={() => setInspectorOpen(false)}
              onOpenGateWithEntity={handleOpenGateWithEntity}
            />
          )}
        </div>

        {/* Clean Bottom Footer */}
        <footer className="h-7 border-t border-border bg-surface px-6 flex items-center justify-between text-xs text-secondaryText shrink-0">
          <div className="flex items-center gap-3">
            <span>VERDICT Distributed Response</span>
            <span>·</span>
            <span>CodeAstra 2.0 Team print("Winners");</span>
          </div>
          <div className="font-mono text-[11px] text-secondaryText flex items-center gap-3">
            <span>Active Node: {viewingRegion.toUpperCase()}</span>
            <span>·</span>
            <span>Bit-Level State Digest Parity</span>
          </div>
        </footer>

        {/* Global Modals */}
        <GuidedDemoModal
          isOpen={guidedDemoOpen}
          onClose={() => setGuidedDemoOpen(false)}
        />
        <HowToRunModal
          isOpen={howToRunOpen}
          onClose={() => setHowToRunOpen(false)}
          onStartGuidedDemo={() => {
            setHowToRunOpen(false);
            setGuidedDemoOpen(true);
          }}
        />
      </div>
    </div>
  );
};
