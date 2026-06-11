import type { ReactNode } from "react";
import { Link } from "wouter";
import {
  prospectActiveHiring,
  prospectCoverage,
  prospectFacilityLeaders,
  prospectSourceNotes,
  prospectSummary,
  prospectTheaterMix,
  prospectTotalPostings,
} from "@/data/prospectPipeline";

function maxOf<T>(rows: T[], key: keyof T) {
  return Math.max(...rows.map((row) => Number(row[key]) || 0), 1);
}

function BarRow({ label, value, max, color = "#22d3ee" }: { label: string; value: number; max: number; color?: string }) {
  return (
    <div className="grid grid-cols-[180px_1fr_80px] items-center gap-3 text-sm">
      <div className="truncate text-cyan-50/70">{label}</div>
      <div className="h-3 overflow-hidden rounded-full bg-white/10">
        <div className="h-full rounded-full" style={{ width: `${Math.max((value / max) * 100, 1)}%`, background: color }} />
      </div>
      <div className="text-right font-mono text-cyan-50/70">{value.toLocaleString()}</div>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-[28px] border border-white/10 bg-slate-950/60 p-5 shadow-[0_22px_70px_rgba(0,0,0,.42)]">
      <h2 className="mb-5 text-xl font-black tracking-[-0.03em] text-white">{title}</h2>
      {children}
    </section>
  );
}

export default function ProspectIntelligence() {
  const maxCoverage = maxOf(prospectCoverage.map((row) => ({ total: row.served + row.newMarkets })), "total");
  const maxActive = maxOf(prospectActiveHiring, "active");
  const maxPosting = maxOf(prospectTotalPostings, "postings");
  const maxFacility = maxOf(prospectFacilityLeaders, "locations");

  return (
    <main className="aurora-bg min-h-screen px-6 py-8 text-white">
      <div className="mx-auto max-w-[1280px]">
        <Link href="/" className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-100/55 hover:text-cyan-100">
          ← Insight Hub
        </Link>

        <header className="mt-4 mb-7">
          <h1 className="text-5xl font-black tracking-[-0.06em] text-white md:text-6xl">Prospect Intelligence</h1>
          <p className="mt-4 max-w-[820px] text-base leading-8 text-cyan-50/68">
            Prospect coverage, facility footprint, and hiring signal dashboard built from the uploaded prospect site file and prospect pipeline visuals.
          </p>
        </header>

        <section className="grid gap-4 md:grid-cols-4">
          {prospectSummary.map((metric) => (
            <div key={metric.label} className="rounded-3xl border border-cyan-100/15 bg-white/[0.035] p-5">
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-100/50">{metric.label}</div>
              <div className="mt-3 text-3xl font-black text-white">{metric.value}</div>
              <div className="mt-2 text-sm leading-6 text-cyan-50/65">{metric.note}</div>
            </div>
          ))}
        </section>

        <section className="mt-6 grid gap-6 xl:grid-cols-2">
          <Panel title="Coverage: already served vs. new markets">
            <div className="space-y-3">
              {prospectCoverage.map((row) => (
                <div key={row.name}>
                  <div className="mb-1 flex justify-between text-xs text-cyan-50/65">
                    <span>{row.name}</span>
                    <span>{row.served} served · {row.newMarkets} new</span>
                  </div>
                  <div className="flex h-4 overflow-hidden rounded-full bg-white/10">
                    <div style={{ width: `${(row.served / maxCoverage) * 100}%` }} className="bg-[#2f9bff]" />
                    <div style={{ width: `${(row.newMarkets / maxCoverage) * 100}%` }} className="bg-slate-300/75" />
                  </div>
                </div>
              ))}
            </div>
          </Panel>

          <Panel title="Facility record leaders">
            <div className="space-y-3">
              {prospectFacilityLeaders.slice(0, 15).map((row) => (
                <BarRow key={row.name} label={row.name} value={row.locations} max={maxFacility} />
              ))}
            </div>
          </Panel>
        </section>

        <section className="mt-6 grid gap-6 xl:grid-cols-2">
          <Panel title="Active hiring signal">
            <div className="space-y-3">
              {prospectActiveHiring.map((row) => (
                <BarRow key={row.name} label={row.name} value={row.active} max={maxActive} color="#22c1d6" />
              ))}
            </div>
          </Panel>

          <Panel title="Total posting signal">
            <div className="space-y-3">
              {prospectTotalPostings.slice(0, 12).map((row) => (
                <BarRow key={row.name} label={row.name} value={row.postings} max={maxPosting} color="#22c55e" />
              ))}
            </div>
          </Panel>
        </section>

        <section className="mt-6 grid gap-6 xl:grid-cols-2">
          <Panel title="Theater split">
            <div className="space-y-3">
              {prospectTheaterMix.map((row) => (
                <BarRow key={row.name} label={row.name} value={row.locations} max={maxOf(prospectTheaterMix, "locations")} color="#8b5cf6" />
              ))}
            </div>
          </Panel>

          <Panel title="Source notes">
            <div className="space-y-3">
              {prospectSourceNotes.map((note) => (
                <div key={note} className="rounded-2xl border border-cyan-100/12 bg-white/[0.035] p-4 text-sm leading-7 text-cyan-50/70">
                  {note}
                </div>
              ))}
            </div>
          </Panel>
        </section>
      </div>
    </main>
  );
}
