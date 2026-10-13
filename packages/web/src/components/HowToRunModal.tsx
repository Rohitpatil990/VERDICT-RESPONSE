import React, { useState, useEffect } from 'react';
import { api, Region } from '../api/client.js';
import {
  HelpCircle,
  Copy,
  Check,
  ExternalLink,
  Terminal,
  Server,
  Play,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  X,
  CheckCircle2,
  RefreshCw,
  Info
} from 'lucide-react';

interface HowToRunModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStartGuidedDemo: () => void;
}

export const HowToRunModal: React.FC<HowToRunModalProps> = ({
  isOpen,
  onClose,
  onStartGuidedDemo
}) => {
  const [copiedCmd, setCopiedCmd] = useState<string | null>(null);
  const [showTroubleshooting, setShowTroubleshooting] = useState(false);

  // Live health statuses for the 3 regions
  const [regionHealth, setRegionHealth] = useState<Record<Region, boolean | null>>({
    mumbai: null,
    delhi: null,
    bengaluru: null
  });
  const [checkingHealth, setCheckingHealth] = useState(false);

  const checkLiveHealth = async () => {
    setCheckingHealth(true);
    const results: Record<Region, boolean | null> = { mumbai: null, delhi: null, bengaluru: null };
    try {
      const [m, d, b] = await Promise.allSettled([
        api.getStatus('mumbai'),
        api.getStatus('delhi'),
        api.getStatus('bengaluru')
      ]);
      results.mumbai = m.status === 'fulfilled';
      results.delhi = d.status === 'fulfilled';
      results.bengaluru = b.status === 'fulfilled';
    } finally {
      setRegionHealth(results);
      setCheckingHealth(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      checkLiveHealth();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCmd(id);
    setTimeout(() => setCopiedCmd(null), 2500);
  };

  const dashboardUrl = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
      <div className="bg-surface border border-border rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden">
        {/* Modal Header */}
        <div className="p-5 border-b border-border flex items-center justify-between bg-slate-50 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-50 border border-blue-200 text-primaryAction flex items-center justify-center">
              <HelpCircle className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-primaryText">How to Run VERDICT</h2>
              <p className="text-xs text-secondaryText mt-0.5">
                Start the system, explore the three regions, and run the disaster-recovery demo.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-secondaryText hover:text-primaryText hover:bg-slate-200/60 rounded-md transition"
            title="Close Guide"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body: 5 Numbered Steps + Troubleshooting */}
        <div className="p-6 overflow-y-auto space-y-6 text-xs text-primaryText">
          {/* STEP 1: Start VERDICT */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-primaryAction text-white flex items-center justify-center font-bold text-[11px] shrink-0">
                1
              </span>
              <h3 className="text-sm font-bold text-primaryText">Start VERDICT</h3>
            </div>
            <p className="text-secondaryText pl-7 leading-relaxed">
              Run this command from the project root in a terminal with Docker installed and running.
              This starts the Web Dashboard and all three regional service containers with persistent volumes.
            </p>

            <div className="ml-7 p-3 bg-slate-900 rounded-lg text-slate-100 font-mono text-[11px] flex items-center justify-between shadow-xs">
              <code>docker compose up --build</code>
              <button
                onClick={() => copyToClipboard('docker compose up --build', 'cmd1')}
                className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded border border-slate-700 flex items-center gap-1.5 transition text-[10px]"
              >
                {copiedCmd === 'cmd1' ? (
                  <>
                    <Check className="w-3 h-3 text-emerald-400" />
                    <span className="text-emerald-400 font-bold">Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3 h-3" />
                    <span>Copy Command</span>
                  </>
                )}
              </button>
            </div>

            <div className="ml-7 text-[11px] text-secondaryText flex items-center gap-1.5 pt-0.5">
              <Info className="w-3.5 h-3.5 text-blue-500 shrink-0" />
              <span>Alternative without Docker: run <code className="bg-slate-100 px-1 py-0.5 rounded font-mono text-primaryText">node scripts/dev-local.js</code> in PowerShell.</span>
            </div>
          </div>

          {/* STEP 2: Open Dashboard */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-primaryAction text-white flex items-center justify-center font-bold text-[11px] shrink-0">
                2
              </span>
              <h3 className="text-sm font-bold text-primaryText">Open the Dashboard</h3>
            </div>
            <p className="text-secondaryText pl-7 leading-relaxed">
              The web operations console runs on host port 3000, connecting to the regional services.
            </p>

            <div className="ml-7 flex items-center gap-3 pt-1">
              <div className="px-3 py-1.5 bg-slate-50 border border-border rounded font-mono text-xs text-primaryText font-semibold">
                {dashboardUrl}
              </div>
              <a
                href={dashboardUrl}
                target="_blank"
                rel="noreferrer"
                className="px-3 py-1.5 bg-surface hover:bg-slate-50 border border-border text-primaryText rounded font-semibold text-xs flex items-center gap-1.5 shadow-subtle transition"
              >
                <span>Open Dashboard</span>
                <ExternalLink className="w-3.5 h-3.5 text-secondaryText" />
              </a>
            </div>
          </div>

          {/* STEP 3: Check the Three Regions */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-primaryAction text-white flex items-center justify-center font-bold text-[11px] shrink-0">
                  3
                </span>
                <h3 className="text-sm font-bold text-primaryText">Check the Three Regions</h3>
              </div>
              <button
                onClick={checkLiveHealth}
                disabled={checkingHealth}
                className="text-[11px] text-primaryAction hover:underline flex items-center gap-1"
              >
                <RefreshCw className={`w-3 h-3 ${checkingHealth ? 'animate-spin' : ''}`} />
                <span>Re-check Live APIs</span>
              </button>
            </div>
            <p className="text-secondaryText pl-7 leading-relaxed">
              Each regional service operates independently on its dedicated loopback port with separate persistent storage:
            </p>

            <div className="ml-7 grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
              {/* Mumbai */}
              <div className="p-2.5 bg-slate-50 border border-border rounded-lg space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-primaryText">Mumbai</span>
                  <span className="flex items-center gap-1 text-[10px] font-semibold">
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        regionHealth.mumbai === true ? 'bg-emerald-500' : regionHealth.mumbai === false ? 'bg-red-500' : 'bg-slate-400'
                      }`}
                    />
                    {regionHealth.mumbai === true ? 'Online' : regionHealth.mumbai === false ? 'Offline' : 'Probing...'}
                  </span>
                </div>
                <div className="text-[11px] text-secondaryText font-mono">Port 4001 · Primary Authority</div>
              </div>

              {/* Delhi */}
              <div className="p-2.5 bg-slate-50 border border-border rounded-lg space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-primaryText">Delhi</span>
                  <span className="flex items-center gap-1 text-[10px] font-semibold">
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        regionHealth.delhi === true ? 'bg-emerald-500' : regionHealth.delhi === false ? 'bg-red-500' : 'bg-slate-400'
                      }`}
                    />
                    {regionHealth.delhi === true ? 'Online' : regionHealth.delhi === false ? 'Offline' : 'Probing...'}
                  </span>
                </div>
                <div className="text-[11px] text-secondaryText font-mono">Port 4002 · Autonomous Replica</div>
              </div>

              {/* Bengaluru */}
              <div className="p-2.5 bg-slate-50 border border-border rounded-lg space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-primaryText">Bengaluru</span>
                  <span className="flex items-center gap-1 text-[10px] font-semibold">
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        regionHealth.bengaluru === true ? 'bg-emerald-500' : regionHealth.bengaluru === false ? 'bg-red-500' : 'bg-slate-400'
                      }`}
                    />
                    {regionHealth.bengaluru === true ? 'Online' : regionHealth.bengaluru === false ? 'Offline' : 'Probing...'}
                  </span>
                </div>
                <div className="text-[11px] text-secondaryText font-mono">Port 4003 · Autonomous Replica</div>
              </div>
            </div>
          </div>

          {/* STEP 4: Run the Guided Demo */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-primaryAction text-white flex items-center justify-center font-bold text-[11px] shrink-0">
                4
              </span>
              <h3 className="text-sm font-bold text-primaryText">Run the Guided Demo (2–3 Min)</h3>
            </div>
            <p className="text-secondaryText pl-7 leading-relaxed">
              Experience the complete disaster recovery sequence step-by-step:
            </p>

            <div className="ml-7 p-3 bg-blue-50/70 border border-blue-200/80 rounded-lg space-y-2">
              <ol className="list-decimal list-inside space-y-1 text-slate-700 leading-relaxed font-medium">
                <li>Create an incident report and save it locally in Mumbai.</li>
                <li>Simulate a network partition (cut Mumbai ↔ Delhi fiber link).</li>
                <li>Submit an eligible local update during the partition without distributed locks.</li>
                <li>Restore connectivity between regions.</li>
                <li>Synchronize outboxes and preserve competing concurrent claims.</li>
                <li>Verify cluster-wide canonical state hash consensus.</li>
              </ol>

              <div className="pt-2">
                <button
                  onClick={onStartGuidedDemo}
                  className="px-4 py-2 bg-primaryAction hover:bg-primaryActionHover text-white font-semibold rounded-md flex items-center gap-2 shadow-subtle transition"
                >
                  <Play className="w-3.5 h-3.5 fill-white" />
                  <span>Start Guided Demo Modal Now</span>
                </button>
              </div>
            </div>
          </div>

          {/* STEP 5: Stop the System Safely */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-primaryAction text-white flex items-center justify-center font-bold text-[11px] shrink-0">
                5
              </span>
              <h3 className="text-sm font-bold text-primaryText">Stop the System Safely</h3>
            </div>
            <p className="text-secondaryText pl-7 leading-relaxed">
              Use standard shutdown to preserve regional database files in named volumes:
            </p>

            <div className="ml-7 p-3 bg-slate-900 rounded-lg text-slate-100 font-mono text-[11px] flex items-center justify-between shadow-xs">
              <code>docker compose down</code>
              <button
                onClick={() => copyToClipboard('docker compose down', 'cmd2')}
                className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded border border-slate-700 flex items-center gap-1.5 transition text-[10px]"
              >
                {copiedCmd === 'cmd2' ? (
                  <>
                    <Check className="w-3 h-3 text-emerald-400" />
                    <span className="text-emerald-400 font-bold">Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3 h-3" />
                    <span>Copy</span>
                  </>
                )}
              </button>
            </div>

            {/* Volume Warning */}
            <div className="ml-7 p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-2.5 text-amber-900">
              <AlertTriangle className="w-4 h-4 text-warning shrink-0 mt-0.5" />
              <div className="space-y-0.5 leading-relaxed">
                <strong className="block font-bold">Important: Do not use `docker compose down -v` casually!</strong>
                <span>
                  Adding the <code className="font-mono font-bold bg-amber-100 px-1 py-0.5 rounded">-v</code> flag deletes all named persistent volumes (<code className="font-mono">mumbai_data</code>, etc.) and purges all committed incident logs.
                </span>
              </div>
            </div>
          </div>

          {/* Collapsible Troubleshooting Section */}
          <div className="border-t border-border pt-4">
            <button
              onClick={() => setShowTroubleshooting(!showTroubleshooting)}
              className="w-full flex items-center justify-between text-left p-2.5 bg-slate-50 hover:bg-slate-100 rounded-lg border border-border transition"
            >
              <div className="flex items-center gap-2 font-bold text-primaryText">
                <Terminal className="w-4 h-4 text-primaryAction" />
                <span>Troubleshooting Common Scenarios</span>
              </div>
              {showTroubleshooting ? <ChevronUp className="w-4 h-4 text-secondaryText" /> : <ChevronDown className="w-4 h-4 text-secondaryText" />}
            </button>

            {showTroubleshooting && (
              <div className="mt-3 p-4 bg-slate-50/70 border border-border rounded-lg space-y-3.5 text-xs text-secondaryText leading-relaxed">
                <div>
                  <strong className="text-primaryText block font-bold mb-0.5">1. Docker daemon is not running:</strong>
                  <span>Ensure Docker Desktop is started and shows green in your taskbar before running <code className="font-mono bg-white px-1 py-0.5 rounded border border-border">docker compose up</code>.</span>
                </div>

                <div>
                  <strong className="text-primaryText block font-bold mb-0.5">2. Port already in use (3000, 4001, 4002, 4003):</strong>
                  <span>Check which process is listening on the port using PowerShell:</span>
                  <code className="block font-mono bg-slate-900 text-slate-100 p-2 rounded mt-1 text-[11px]">
                    netstat -ano | findstr "3000 4001 4002 4003"
                  </code>
                </div>

                <div>
                  <strong className="text-primaryText block font-bold mb-0.5">3. Inspect live container logs:</strong>
                  <span>Stream real-time output across all regional services:</span>
                  <code className="block font-mono bg-slate-900 text-slate-100 p-2 rounded mt-1 text-[11px]">
                    docker compose logs --tail=100 -f
                  </code>
                </div>

                <div>
                  <strong className="text-primaryText block font-bold mb-0.5">4. Check container health status:</strong>
                  <span>Inspect whether health checks have reached healthy state:</span>
                  <code className="block font-mono bg-slate-900 text-slate-100 p-2 rounded mt-1 text-[11px]">
                    docker compose ps
                  </code>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-border bg-slate-50 flex items-center justify-between shrink-0">
          <span className="text-[11px] text-secondaryText">
            VERDICT · Geo-Distributed Disaster Data Replication
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-primaryAction hover:bg-primaryActionHover text-white font-semibold rounded-md shadow-subtle transition text-xs"
          >
            Close Guide
          </button>
        </div>
      </div>
    </div>
  );
};
