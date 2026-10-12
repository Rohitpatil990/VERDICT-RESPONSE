import React from 'react';
import { useTranslation } from 'react-i18next';
import { ShieldCheck, BookOpen, Layers, Info } from 'lucide-react';

export const AboutView: React.FC = () => {
  const { t } = useTranslation();

  return (
    <div className="h-full overflow-y-auto p-8 max-w-5xl mx-auto space-y-8">
      {/* Title */}
      <div>
        <span className="text-xs font-mono uppercase tracking-widest text-tealVerdict">
          CodeAstra 2.0 Final · Problem Statement #2
        </span>
        <h1 className="text-2xl font-black text-slate-100 mt-1">
          VERDICT — Verifiable Settlement for Multi-Region Data
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          Observe anywhere. Commit safely. Decide with eyes open.
        </p>
      </div>

      {/* Consistency Model Defense */}
      <div className="p-5 bg-surface border border-border rounded-lg space-y-3">
        <h2 className="text-xs font-bold uppercase text-slate-200 tracking-wider flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-tealVerdict" />
          The Consistency Model (Our Defense in 5 Lines)
        </h2>
        <ul className="space-y-1.5 text-xs text-slate-300 leading-relaxed list-disc list-inside">
          <li><strong>Observations (AP):</strong> Availability-first offline writes; causal ordering via version vectors and Ed25519 hash chains; conflicts are surfaced side-by-side, never silently overwritten with Last-Write-Wins.</li>
          <li><strong>Commitments:</strong> Safe-by-construction during network partitions; divisible scarce resources use escrow shares (bounded counters), indivisible resources use home-region single-writer ownership.</li>
          <li><strong>Decisions:</strong> Every operational action passes through the pure, deterministic Decision Gate (GO · CAUTION · HOLD).</li>
          <li><strong>Convergence:</strong> Deterministic causal anti-entropy guarantees replicas exchanging identical operation logs reach identical settled states.</li>
          <li><strong>Honesty:</strong> No global consensus or linearizability is claimed; GO means consistency invariants are satisfied, not that the physical disaster ground truth is predicted.</li>
        </ul>
      </div>

      {/* Honest Operational Costs */}
      <div className="p-5 bg-surface border border-border rounded-lg space-y-3">
        <h2 className="text-xs font-bold uppercase text-amberVerdict tracking-wider flex items-center gap-2">
          <Info className="w-4 h-4 text-amberVerdict" />
          Honest Architectural Costs & Trade-Offs
        </h2>
        <div className="grid grid-cols-3 gap-4 text-xs text-slate-300">
          <div className="p-3 bg-background rounded border border-border">
            <strong className="text-slate-100">Stranded Escrow Quotas:</strong>
            <p className="text-slate-400 mt-1 text-[11px]">
              Escrow rights can be stranded in an unreachable region; a legitimate request in Delhi may be queued as unmet while unused stock exists in Mumbai.
            </p>
          </div>
          <div className="p-3 bg-background rounded border border-border">
            <strong className="text-slate-100">Queued Ownership:</strong>
            <p className="text-slate-400 mt-1 text-[11px]">
              Single-writer resources queue when the owning home region is partitioned, avoiding double-booking at the expense of write latency.
            </p>
          </div>
          <div className="p-3 bg-background rounded border border-border">
            <strong className="text-slate-100">Conservative HOLDs:</strong>
            <p className="text-slate-400 mt-1 text-[11px]">
              The Decision Gate may return HOLD or CAUTION when an action in the real world might actually have been physically fine.
            </p>
          </div>
        </div>
      </div>

      {/* Implemented / Simulated / Planned Matrix */}
      <div className="p-5 bg-surface border border-border rounded-lg space-y-4">
        <h2 className="text-xs font-bold uppercase text-slate-200 tracking-wider">
          Feature Status Matrix: Implemented vs Simulated vs Planned
        </h2>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left border-collapse">
            <thead>
              <tr className="border-b border-border text-slate-400 uppercase text-[10px]">
                <th className="py-2 px-3">Subsystem</th>
                <th className="py-2 px-3">Status</th>
                <th className="py-2 px-3">Description</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border text-slate-300">
              <tr>
                <td className="py-2.5 px-3 font-semibold">Decision Gate</td>
                <td className="py-2.5 px-3"><span className="text-[10px] font-bold font-mono px-2 py-0.5 rounded bg-tealVerdict/15 text-tealVerdict">IMPLEMENTED</span></td>
                <td className="py-2.5 px-3">Pure deterministic evaluator, 7 invariant checks, GO/CAUTION/HOLD, what-would-change remedies.</td>
              </tr>
              <tr>
                <td className="py-2.5 px-3 font-semibold">Decision Receipts & Blast Radius</td>
                <td className="py-2.5 px-3"><span className="text-[10px] font-bold font-mono px-2 py-0.5 rounded bg-tealVerdict/15 text-tealVerdict">IMPLEMENTED</span></td>
                <td className="py-2.5 px-3">Signed DECISION ops, reevaluation against merged state, then-vs-now diffs, STILL_VALID/NEEDS_RECHECK/INVALIDATED.</td>
              </tr>
              <tr>
                <td className="py-2.5 px-3 font-semibold">Fog of Information</td>
                <td className="py-2.5 px-3"><span className="text-[10px] font-bold font-mono px-2 py-0.5 rounded bg-tealVerdict/15 text-tealVerdict">IMPLEMENTED</span></td>
                <td className="py-2.5 px-3">Leaflet hatch pattern veil over unreachable territories with elapsed time ramp and honest disclaimer.</td>
              </tr>
              <tr>
                <td className="py-2.5 px-3 font-semibold">Escrow Bounded Counters</td>
                <td className="py-2.5 px-3"><span className="text-[10px] font-bold font-mono px-2 py-0.5 rounded bg-tealVerdict/15 text-tealVerdict">IMPLEMENTED</span></td>
                <td className="py-2.5 px-3">Strict mathematical invariant Σ spent ≤ T; in-flight transfer safety; unmet demand queue.</td>
              </tr>
              <tr>
                <td className="py-2.5 px-3 font-semibold">PR-Style Merge Reports</td>
                <td className="py-2.5 px-3"><span className="text-[10px] font-bold font-mono px-2 py-0.5 rounded bg-tealVerdict/15 text-tealVerdict">IMPLEMENTED</span></td>
                <td className="py-2.5 px-3">Episode diffing, real countable categories, affected decisions tally, delta vs full-state efficiency.</td>
              </tr>
              <tr>
                <td className="py-2.5 px-3 font-semibold">Multi-Region Local Services</td>
                <td className="py-2.5 px-3"><span className="text-[10px] font-bold font-mono px-2 py-0.5 rounded bg-tealVerdict/15 text-tealVerdict">IMPLEMENTED</span></td>
                <td className="py-2.5 px-3">3 separate Fastify node processes (4001, 4002, 4003) with separate JSON/WAL disk databases.</td>
              </tr>
              <tr>
                <td className="py-2.5 px-3 font-semibold">In-Process Link Controller</td>
                <td className="py-2.5 px-3"><span className="text-[10px] font-bold font-mono px-2 py-0.5 rounded bg-tealVerdict/15 text-tealVerdict">SIMULATED</span></td>
                <td className="py-2.5 px-3">Deterministic software link gate for partition cuts, latency and bandwidth throttling.</td>
              </tr>
              <tr>
                <td className="py-2.5 px-3 font-semibold">Quorum State Certificates</td>
                <td className="py-2.5 px-3"><span className="text-[10px] font-bold font-mono px-2 py-0.5 rounded bg-slate-700 text-slate-400">PLANNED (P2)</span></td>
                <td className="py-2.5 px-3">Multi-party threshold signatures (k of n) over epoch roots for cross-organization auditing.</td>
              </tr>
              <tr>
                <td className="py-2.5 px-3 font-semibold">Multi-Hop RelayMesh</td>
                <td className="py-2.5 px-3"><span className="text-[10px] font-bold font-mono px-2 py-0.5 rounded bg-slate-700 text-slate-400">PLANNED (P2)</span></td>
                <td className="py-2.5 px-3">DTN custody transfer over physical courier nodes.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Prior Art */}
      <div className="p-5 bg-surface border border-border rounded-lg space-y-2 text-xs text-slate-300 leading-relaxed">
        <h2 className="font-bold uppercase text-slate-200 tracking-wider">Prior Art (Stated Honestly)</h2>
        <p>
          VERDICT builds on foundational distributed systems research: Bayou (tentative and committed writes, Terry et al.),
          bounded counters and escrow transactions (Balegas et al.), coordination avoidance and invariant confluence (Bailis et al.),
          Conflict-free Replicated Data Types (Shapiro et al.), Delay-Tolerant Networking custody transfers, and Git branch/merge metaphors.
          Our contribution is the <strong>decision-aware integration</strong>: turning replica state into operational verdicts with receipts,
          blast radius re-evaluation, and visual fog of information.
        </p>
      </div>

      {/* AI Disclosure */}
      <div className="p-5 bg-surface border border-border rounded-lg space-y-2 text-xs text-slate-400 leading-relaxed">
        <h2 className="font-bold uppercase text-slate-300 tracking-wider">AI-Assisted Development Disclosure</h2>
        <p>
          In accordance with competition rules: Antigravity IDE and generative AI tooling were used for boilerplate scaffolding,
          TypeScript type signatures, UI layout, translation dictionary generation, and test generation. All architectural design,
          invariant proofs, protocol state machines, and operational policies were designed and guided by Team print("Winners");.
        </p>
      </div>
    </div>
  );
};
