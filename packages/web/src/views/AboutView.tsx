import React from 'react';
import { useTranslation } from 'react-i18next';
import { ShieldCheck, Info } from 'lucide-react';

export const AboutView: React.FC = () => {
  const { t } = useTranslation();

  return (
    <div className="h-full overflow-y-auto p-8 max-w-4xl mx-auto space-y-6 bg-background">
      {/* Title */}
      <div>
        <span className="text-[11px] font-mono uppercase tracking-widest text-primaryAction font-semibold">
          CodeAstra 2.0 Final · Problem Statement #2
        </span>
        <h1 className="text-xl font-bold text-primaryText mt-0.5">
          VERDICT — Verifiable Settlement for Multi-Region Data
        </h1>
        <p className="text-xs text-secondaryText mt-0.5">
          Observe anywhere · Commit safely · Decide with eyes open.
        </p>
      </div>

      {/* Consistency Model Defense */}
      <div className="p-5 bg-surface border border-border rounded-lg space-y-3 shadow-subtle">
        <h2 className="text-xs font-semibold uppercase text-primaryText tracking-wider flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-primaryAction" />
          The Consistency Model (Our Defense in 5 Lines)
        </h2>
        <ul className="space-y-1.5 text-xs text-primaryText leading-relaxed list-disc list-inside">
          <li><strong>Observations (AP):</strong> Availability-first offline writes; causal ordering via version vectors and Ed25519 hash chains; conflicts are surfaced side-by-side, never silently overwritten with Last-Write-Wins.</li>
          <li><strong>Commitments:</strong> Safe-by-construction during network partitions; divisible scarce resources use escrow shares (bounded counters), indivisible resources use home-region single-writer ownership.</li>
          <li><strong>Decisions:</strong> Every operational action passes through the pure, deterministic Decision Gate (GO · CAUTION · HOLD).</li>
          <li><strong>Convergence:</strong> Deterministic causal anti-entropy guarantees replicas exchanging identical operation logs reach identical settled states.</li>
          <li><strong>Honesty:</strong> No global consensus or linearizability is claimed; GO means consistency invariants are satisfied, not that physical disaster ground truth is predicted.</li>
        </ul>
      </div>

      {/* Honest Operational Costs */}
      <div className="p-5 bg-surface border border-border rounded-lg space-y-3 shadow-subtle">
        <h2 className="text-xs font-semibold uppercase text-warning tracking-wider flex items-center gap-2">
          <Info className="w-4 h-4 text-warning" />
          Honest Architectural Costs & Trade-Offs
        </h2>
        <div className="grid grid-cols-3 gap-3 text-xs">
          <div className="p-3 bg-slate-50 rounded-md border border-border">
            <strong className="text-primaryText font-semibold">Stranded Escrow Quotas:</strong>
            <p className="text-secondaryText mt-1 text-[11px] leading-relaxed">
              Escrow rights can be stranded in an unreachable region; a legitimate request in Delhi may be queued as unmet while unused stock exists in Mumbai.
            </p>
          </div>
          <div className="p-3 bg-slate-50 rounded-md border border-border">
            <strong className="text-primaryText font-semibold">Queued Ownership:</strong>
            <p className="text-secondaryText mt-1 text-[11px] leading-relaxed">
              Single-writer resources queue when the owning home region is partitioned, avoiding double-booking at the expense of write latency.
            </p>
          </div>
          <div className="p-3 bg-slate-50 rounded-md border border-border">
            <strong className="text-primaryText font-semibold">Conservative HOLDs:</strong>
            <p className="text-secondaryText mt-1 text-[11px] leading-relaxed">
              The Decision Gate may return HOLD or CAUTION when an action in the real world might actually have been physically fine.
            </p>
          </div>
        </div>
      </div>

      {/* Feature Status Matrix */}
      <div className="p-5 bg-surface border border-border rounded-lg space-y-3.5 shadow-subtle">
        <h2 className="text-xs font-semibold uppercase text-primaryText tracking-wider">
          Feature Status Matrix: Implemented vs Simulated vs Planned
        </h2>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left border-collapse">
            <thead>
              <tr className="border-b border-border text-secondaryText uppercase text-[10px] font-semibold">
                <th className="py-2 px-3">Subsystem</th>
                <th className="py-2 px-3">Status</th>
                <th className="py-2 px-3">Description</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border text-primaryText">
              <tr>
                <td className="py-2.5 px-3 font-semibold">Decision Gate</td>
                <td className="py-2.5 px-3"><span className="text-[10px] font-bold font-mono px-2 py-0.5 rounded bg-green-100 text-success">IMPLEMENTED</span></td>
                <td className="py-2.5 px-3 text-secondaryText">Pure deterministic evaluator, 7 invariant checks, GO/CAUTION/HOLD.</td>
              </tr>
              <tr>
                <td className="py-2.5 px-3 font-semibold">Decision Receipts & Blast Radius</td>
                <td className="py-2.5 px-3"><span className="text-[10px] font-bold font-mono px-2 py-0.5 rounded bg-green-100 text-success">IMPLEMENTED</span></td>
                <td className="py-2.5 px-3 text-secondaryText">Signed DECISION ops, reevaluation against merged state, then-vs-now diffs.</td>
              </tr>
              <tr>
                <td className="py-2.5 px-3 font-semibold">Fog of Information</td>
                <td className="py-2.5 px-3"><span className="text-[10px] font-bold font-mono px-2 py-0.5 rounded bg-green-100 text-success">IMPLEMENTED</span></td>
                <td className="py-2.5 px-3 text-secondaryText">Leaflet hatch pattern veil over unreachable territories with elapsed time ramp.</td>
              </tr>
              <tr>
                <td className="py-2.5 px-3 font-semibold">Escrow Bounded Counters</td>
                <td className="py-2.5 px-3"><span className="text-[10px] font-bold font-mono px-2 py-0.5 rounded bg-green-100 text-success">IMPLEMENTED</span></td>
                <td className="py-2.5 px-3 text-secondaryText">Strict mathematical invariant Σ spent ≤ T; in-flight transfer safety.</td>
              </tr>
              <tr>
                <td className="py-2.5 px-3 font-semibold">PR-Style Merge Reports</td>
                <td className="py-2.5 px-3"><span className="text-[10px] font-bold font-mono px-2 py-0.5 rounded bg-green-100 text-success">IMPLEMENTED</span></td>
                <td className="py-2.5 px-3 text-secondaryText">Episode diffing, real countable categories, delta vs full-state efficiency.</td>
              </tr>
              <tr>
                <td className="py-2.5 px-3 font-semibold">Multi-Region Local Services</td>
                <td className="py-2.5 px-3"><span className="text-[10px] font-bold font-mono px-2 py-0.5 rounded bg-green-100 text-success">IMPLEMENTED</span></td>
                <td className="py-2.5 px-3 text-secondaryText">3 separate Fastify node processes (4001, 4002, 4003) with separate JSON disk storage.</td>
              </tr>
              <tr>
                <td className="py-2.5 px-3 font-semibold">Client-Side Regional Failover</td>
                <td className="py-2.5 px-3"><span className="text-[10px] font-bold font-mono px-2 py-0.5 rounded bg-green-100 text-success">IMPLEMENTED</span></td>
                <td className="py-2.5 px-3 text-secondaryText">Deterministic fallback ring, idempotency deduplication, replica labeling.</td>
              </tr>
              <tr>
                <td className="py-2.5 px-3 font-semibold">In-Process Link Controller</td>
                <td className="py-2.5 px-3"><span className="text-[10px] font-bold font-mono px-2 py-0.5 rounded bg-blue-100 text-primaryAction">SIMULATED</span></td>
                <td className="py-2.5 px-3 text-secondaryText">Deterministic software link gate for partition cuts, latency and bandwidth throttling.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Prior Art */}
      <div className="p-4 bg-slate-50 border border-border rounded-lg space-y-1.5 text-xs text-secondaryText leading-relaxed">
        <h2 className="font-semibold uppercase text-primaryText text-[11px] tracking-wider">Research Foundations</h2>
        <p>
          VERDICT builds on Bayou (tentative and committed writes, Terry et al.), bounded counters and escrow transactions (Balegas et al.), coordination avoidance (Bailis et al.), CRDTs (Shapiro et al.), Delay-Tolerant Networking, and Git branch/merge metaphors.
        </p>
      </div>
    </div>
  );
};
