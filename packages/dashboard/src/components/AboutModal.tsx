import React from 'react';
import { Info, X, Shield, Cpu, BookOpen, CheckCircle2 } from 'lucide-react';

interface AboutModalProps {
  onClose: () => void;
}

export const AboutModal: React.FC<AboutModalProps> = ({ onClose }) => {
  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-[1100] flex items-center justify-center p-4">
      <div className="bg-[#FFFFFF] border border-[#E2E8F0] rounded-xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-xl overflow-hidden text-[#172033]">
        <div className="p-4 border-b border-[#E2E8F0] flex items-center justify-between bg-[#F8FAFC]">
          <div className="flex items-center gap-2">
            <Info size={18} className="text-[#2563EB]" />
            <h3 className="font-bold text-sm text-[#172033]">System Architecture & Consistency Model</h3>
          </div>
          <button onClick={onClose} className="text-[#64748B] hover:text-[#0F172A] p-1 rounded">
            <X size={16} />
          </button>
        </div>

        <div className="p-5 overflow-y-auto space-y-4 text-xs">
          {/* Consistency Model Defense */}
          <div className="bg-[#F8FAFC] p-4 rounded-lg border border-[#E2E8F0] space-y-2">
            <h4 className="font-bold text-[#172033] text-sm flex items-center gap-2">
              <Shield size={16} className="text-[#2563EB]" />
              Consistency Model: Availability-First (AP) + Deterministic Settlement
            </h4>
            <p className="text-[#475569] leading-relaxed">
              During network partitions, regional services prioritize <strong>Availability (AP)</strong>: accepting and persisting local writes immediately as <strong>Tentative</strong> into a local transactional outbox. Upon reconnection, anti-entropy exchanges missing signed operations in priority lanes. Deterministic conflict policies (v1) and version vectors resolve concurrent facts, while bounded resource claims (e.g. 5 medical kits) are settled in certified rounds with mathematical invariant safety (allocated $\le$ available).
            </p>
          </div>

          {/* Implemented / Simulated / Planned Table */}
          <div className="space-y-2">
            <h4 className="font-bold text-[#172033]">Feature Implementation Matrix</h4>
            <div className="border border-[#E2E8F0] rounded-lg overflow-hidden">
              <table className="w-full text-left">
                <thead className="bg-[#F8FAFC] text-[#64748B] border-b border-[#E2E8F0]">
                  <tr>
                    <th className="p-2.5 font-semibold">Subsystem</th>
                    <th className="p-2.5 font-semibold">Status</th>
                    <th className="p-2.5 font-semibold">Implementation Detail</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E2E8F0] bg-[#FFFFFF]">
                  <tr>
                    <td className="p-2.5 font-medium text-[#172033]">Multi-Region Stores</td>
                    <td className="p-2.5"><span className="px-2 py-0.5 rounded bg-green-50 text-green-700 font-bold border border-green-200">IMPLEMENTED</span></td>
                    <td className="p-2.5 text-[#64748B]">3 distinct regional DBs (mumbai.db, delhi.db, bengaluru.db)</td>
                  </tr>
                  <tr>
                    <td className="p-2.5 font-medium text-[#172033]">Delta Anti-Entropy</td>
                    <td className="p-2.5"><span className="px-2 py-0.5 rounded bg-green-50 text-green-700 font-bold border border-green-200">IMPLEMENTED</span></td>
                    <td className="p-2.5 text-[#64748B]">Version vectors, 4 priority lanes, transactional outbox</td>
                  </tr>
                  <tr>
                    <td className="p-2.5 font-medium text-[#172033]">Cryptographic Envelope</td>
                    <td className="p-2.5"><span className="px-2 py-0.5 rounded bg-green-50 text-green-700 font-bold border border-green-200">IMPLEMENTED</span></td>
                    <td className="p-2.5 text-[#64748B]">SHA-256 canonical hash chains + Ed25519 digital signatures</td>
                  </tr>
                  <tr>
                    <td className="p-2.5 font-medium text-[#172033]">Human Review Resolver</td>
                    <td className="p-2.5"><span className="px-2 py-0.5 rounded bg-green-50 text-green-700 font-bold border border-green-200">IMPLEMENTED</span></td>
                    <td className="p-2.5 text-[#64748B]">Contradictions preserved; signed RESOLVE committed by reviewer</td>
                  </tr>
                  <tr>
                    <td className="p-2.5 font-medium text-[#172033]">Network Partition Simulation</td>
                    <td className="p-2.5"><span className="px-2 py-0.5 rounded bg-amber-50 text-amber-700 font-bold border border-amber-200">SIMULATED</span></td>
                    <td className="p-2.5 text-[#64748B]">LinkController in-process packet drop and latency injection</td>
                  </tr>
                  <tr>
                    <td className="p-2.5 font-medium text-[#172033]">Disaster Scenario Data</td>
                    <td className="p-2.5"><span className="px-2 py-0.5 rounded bg-amber-50 text-amber-700 font-bold border border-amber-200">SIMULATED</span></td>
                    <td className="p-2.5 text-[#64748B]">Synthetic Mumbai monsoon flood landmarks and road blocks</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* AI Disclosure */}
          <div className="p-3 bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg space-y-1">
            <h5 className="font-bold text-[#172033]">AI-Assisted Development Disclosure</h5>
            <p className="text-[#64748B] leading-relaxed text-[11px]">
              Developed for CodeAstra 2.0 with pair-programming assistance from Antigravity. Core cryptographic verification, distributed synchronization protocols, and SQLite outbox engine are executed natively and verified by automated integration tests.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
