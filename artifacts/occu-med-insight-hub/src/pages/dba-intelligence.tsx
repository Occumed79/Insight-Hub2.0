import { useMemo, useState, type ReactNode } from "react";
import { motion } from "framer-motion";
import {
  AlertTriangle,
  BriefcaseBusiness,
  Building2,
  CalendarClock,
  CheckCircle2,
  CircleOff,
  Database,
  ExternalLink,
  FileText,
  Globe2,
  Landmark,
  LineChart as LineChartIcon,
  Loader2,
  MapPinned,
  Radar,
  RefreshCw,
  Scale,
  Search,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { HeaderBar } from "@/components/insight/HeaderBar";
import { Sidebar } from "@/components/insight/Sidebar";
import { GlassCard } from "@/components/insight/GlassCard";
import {
  runDbaIntelligence,
  type DbaCaseRecord,
  type DbaIntelligenceResponse,
  type DbaPerformanceRecord,
  type DbaSourceStatus,
  type DbaWaiverRecord,
} from "@/data/dbaIntelligenceApi";

type WorkspaceTab = "atlas" | "employers" | "carriers" | "waivers" | "law";

const WARNING = "DBA case counts are public OWCP case-system records, not official casualty statistics and not findings about injury causation, claim acceptance, employer fault, carrier conduct, legal liability, safety, compliance, or medical necessity. Small employer cells may be privacy-suppressed and must not be treated as zero.";

const CASE_LABELS = {
  nlt: "No lost time",
  lt03: "Lost time ≤3 days",
  lt4: "Lost time ≥4 days",
  dea: "Death-coded cases",
  cop: "Salary continuation",
  oth: "Other / unknown",
} as const;

const COUNTRY_COORDINATES: Record<string, [number, number]> = {
  Afghanistan: [67.7, 33.9], Albania: [20.0, 41.1], Algeria: [2.6, 28.0], Angola: [17.9, -12.3], Argentina: [-63.6, -38.4], Australia: [133.8, -25.3], Austria: [14.6, 47.5], Bahrain: [50.6, 26.1], Bangladesh: [90.4, 23.7], Belarus: [27.9, 53.7], Belgium: [4.7, 50.8], Bolivia: [-64.7, -16.3], "Bosnia-Herzegovina": [17.7, 44.2], Bosnia: [17.7, 44.2], Brazil: [-51.9, -14.2], Bulgaria: [25.5, 42.7], Cambodia: [104.9, 12.6], Cameroon: [12.4, 7.4], Canada: [-106.3, 56.1], Chad: [18.7, 15.5], Chile: [-71.5, -35.7], China: [104.2, 35.9], Colombia: [-74.3, 4.6], Congo: [15.8, -0.2], "Costa Rica": [-84.0, 9.7], Croatia: [15.2, 45.1], Cyprus: [33.4, 35.1], "Czech Republic": [15.5, 49.8], Denmark: [9.5, 56.3], "Dominican Republic": [-70.2, 18.7], Ecuador: [-78.2, -1.8], Egypt: [30.8, 26.8], "El Salvador": [-88.9, 13.8], Ethiopia: [40.5, 9.1], Fiji: [178.1, -17.7], Finland: [25.7, 61.9], France: [2.2, 46.2], Georgia: [43.4, 42.3], Germany: [10.5, 51.2], Ghana: [-1.0, 7.9], Greece: [21.8, 39.1], Greenland: [-42.6, 71.7], Guam: [144.8, 13.4], Guatemala: [-90.2, 15.8], Haiti: [-72.3, 18.9], Honduras: [-86.2, 15.2], Hungary: [19.5, 47.2], Iceland: [-19.0, 65.0], India: [78.9, 20.6], Indonesia: [113.9, -0.8], Iran: [53.7, 32.4], Iraq: [43.7, 33.2], Ireland: [-8.2, 53.1], Israel: [34.9, 31.0], Italy: [12.6, 41.9], Japan: [138.3, 36.2], Jordan: [36.2, 30.6], Kazakhstan: [66.9, 48.0], Kenya: [37.9, -0.0], Kosovo: [20.9, 42.6], Kuwait: [47.5, 29.3], Kyrgyzstan: [74.8, 41.2], Latvia: [24.6, 57.0], Lebanon: [35.9, 33.9], Liberia: [-9.4, 6.4], Libya: [17.2, 26.3], Lithuania: [23.9, 55.2], Malaysia: [101.9, 4.2], Mali: [-3.9, 17.6], Mexico: [-102.6, 23.6], Moldova: [28.4, 47.4], Mongolia: [103.8, 46.9], Montenegro: [19.4, 42.7], Morocco: [-7.1, 31.8], Mozambique: [35.5, -18.7], Myanmar: [95.9, 21.9], Nepal: [84.1, 28.4], Netherlands: [5.3, 52.1], "New Zealand": [174.9, -40.9], Nicaragua: [-85.2, 12.9], Niger: [8.1, 17.6], Nigeria: [8.7, 9.1], "North Macedonia": [21.7, 41.6], Norway: [8.5, 60.5], Oman: [55.9, 21.5], Pakistan: [69.3, 30.4], Panama: [-80.8, 8.5], Paraguay: [-58.4, -23.4], Peru: [-75.0, -9.2], Philippines: [121.8, 12.9], Poland: [19.1, 51.9], Portugal: [-8.2, 39.4], Qatar: [51.2, 25.4], Romania: [24.9, 45.9], Russia: [105.3, 61.5], Rwanda: [29.9, -1.9], "Saudi Arabia": [45.1, 23.9], Senegal: [-14.5, 14.5], Serbia: [21.0, 44.0], Singapore: [103.8, 1.4], Slovakia: [19.7, 48.7], Somalia: [46.2, 5.2], "South Africa": [22.9, -30.6], "South Korea": [127.8, 36.5], Korea: [127.8, 36.5], Spain: [-3.7, 40.5], "Sri Lanka": [80.8, 7.9], Sudan: [30.2, 12.9], Sweden: [18.6, 60.1], Switzerland: [8.2, 46.8], Syria: [38.9, 34.8], Taiwan: [121.0, 23.7], Tajikistan: [71.3, 38.9], Tanzania: [34.9, -6.4], Thailand: [100.9, 15.9], Tunisia: [9.5, 33.9], Turkey: [35.2, 39.0], Uganda: [32.3, 1.4], Ukraine: [31.2, 48.4], "United Arab Emirates": [53.8, 23.4], "United Kingdom": [-3.4, 55.4], Uruguay: [-55.8, -32.5], USA: [-98.6, 39.8], "United States": [-98.6, 39.8], Uzbekistan: [64.6, 41.4], Venezuela: [-66.6, 6.4], Vietnam: [108.3, 14.1], Yemen: [48.5, 15.6], Zambia: [27.8, -13.1], Zimbabwe: [29.2, -19.0],
};

function formatNumber(value: number | null | undefined): string {
  if (value === null || value === undefined) return "Suppressed / unavailable";
  return value.toLocaleString();
}

function total(record: DbaCaseRecord): number {
  return record.counts.total ?? 0;
}

function sourceTone(state: DbaSourceStatus["state"]): string {
  if (state === "success") return "border-emerald-200/20 bg-emerald-300/10 text-emerald-100";
  if (state === "empty" || state === "partial") return "border-amber-200/20 bg-amber-300/10 text-amber-100";
  if (state === "disabled") return "border-slate-200/10 bg-slate-300/[0.05] text-slate-300";
  return "border-rose-200/20 bg-rose-300/10 text-rose-100";
}

function safeDate(value?: string): string {
  if (!value) return "Not published";
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

export default function DbaIntelligence() {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<DbaIntelligenceResponse | null>(null);
  const [tab, setTab] = useState<WorkspaceTab>("atlas");
  const [selectedCountryId, setSelectedCountryId] = useState<string | null>(null);
  const [selectedCarrier, setSelectedCarrier] = useState<string>("");
  const [waiverStatus, setWaiverStatus] = useState<"all" | "active" | "archived">("active");

  async function runScan(): Promise<void> {
    setLoading(true);
    setError(null);
    try {
      const response = await runDbaIntelligence(query);
      setResult(response);
      setSelectedCountryId(response.caseReports.countries[0]?.id ?? null);
      setSelectedCarrier(response.performance[0]?.carrier ?? response.caseReports.carriers[0]?.name ?? "");
    } catch (runError) {
      setError(runError instanceof Error ? runError.message : "The DBA intelligence scan could not be completed.");
    } finally {
      setLoading(false);
    }
  }

  const countries = result?.caseReports.countries ?? [];
  const selectedCountry = countries.find((country) => country.id === selectedCountryId) ?? countries[0] ?? null;
  const plottedCountries = useMemo(() => countries.filter((country) => COUNTRY_COORDINATES[country.name]), [countries]);
  const maxCountryTotal = Math.max(1, ...plottedCountries.map(total));
  const employerRows = result?.caseReports.queryMatches.length
    ? result.caseReports.queryMatches
    : result?.caseReports.employers.slice(0, 30) ?? [];
  const carrierNames = useMemo(() => Array.from(new Set((result?.performance ?? []).map((record) => record.carrier))).sort(), [result]);
  const carrierPerformance = useMemo(() => {
    if (!result || !selectedCarrier) return [];
    const byYear = new Map<number, Record<string, number | string>>();
    result.performance.filter((record) => record.carrier === selectedCarrier).forEach((record) => {
      const row = byYear.get(record.fiscalYear) ?? { fiscalYear: record.fiscalYear };
      if (record.metric === "first-report") {
        row.reportFast = record.firstThresholdPercent;
        row.report60 = record.sixtyDayPercent;
        row.report90 = record.ninetyDayPercent;
      } else {
        row.paymentFast = record.firstThresholdPercent;
        row.payment60 = record.sixtyDayPercent;
        row.payment90 = record.ninetyDayPercent;
      }
      byYear.set(record.fiscalYear, row);
    });
    return [...byYear.values()].sort((a, b) => Number(a.fiscalYear) - Number(b.fiscalYear));
  }, [result, selectedCarrier]);
  const waiverRows = (result?.waivers ?? [])
    .filter((waiver) => waiverStatus === "all" || waiver.status === waiverStatus)
    .sort((a, b) => (a.expirationDate ?? "9999").localeCompare(b.expirationDate ?? "9999"));

  return (
    <main className="aurora-bg min-h-screen text-white">
      <Sidebar />
      <section className="relative z-10 px-5 py-8 lg:ml-[210px] lg:px-12">
        <HeaderBar
          eyebrow="Global Workforce Intelligence"
          title="Defense Base Act Intelligence"
          subtitle="Manually assemble public DOL employer, carrier, country, waiver, performance, jurisdiction, and adjudication-reference signals into one visual DBA research workspace."
        />

        <GlassCard className="mb-6 border-amber-200/15 p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-300" />
            <p className="text-xs leading-5 text-amber-100/70">{WARNING}</p>
          </div>
        </GlassCard>

        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
          className="relative overflow-hidden rounded-[34px] border border-cyan-100/12 bg-[radial-gradient(circle_at_78%_18%,rgba(56,189,248,.18),transparent_34%),radial-gradient(circle_at_12%_80%,rgba(168,85,247,.15),transparent_38%),rgba(2,8,23,.84)] p-5 shadow-[0_30px_90px_rgba(0,0,0,.38)] backdrop-blur-2xl md:p-8"
        >
          <div className="relative grid gap-7 xl:grid-cols-[1.15fr_.85fr]">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.32em] text-cyan-100/42">Manual official-source scan</p>
              <h1 className="mt-3 max-w-4xl text-3xl font-black tracking-[-0.04em] md:text-5xl">Everything public DBA. One evidence-first command center.</h1>
              <p className="mt-4 max-w-3xl text-sm leading-7 text-cyan-100/55">Search a contractor, legal entity, DBA, division, or alias. The scan reads public DOL data only when you press the button and preserves partial results if one source fails.</p>
              <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  onKeyDown={(event) => { if (event.key === "Enter" && !loading) void runScan(); }}
                  placeholder="Employer, contractor, DBA, division, or alias — optional"
                  className="min-h-12 flex-1 rounded-2xl border border-cyan-100/14 bg-black/20 px-4 text-sm text-white outline-none placeholder:text-cyan-100/28 focus:border-cyan-200/35"
                />
                <button type="button" onClick={() => void runScan()} disabled={loading} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-cyan-100/20 bg-cyan-200/12 px-5 text-sm font-bold text-cyan-50 transition hover:bg-cyan-200/18 disabled:opacity-45">
                  {loading ? <Loader2 size={17} className="animate-spin" /> : result ? <RefreshCw size={17} /> : <Search size={17} />}
                  {loading ? "Scanning DOL sources…" : result ? "Run DBA scan again" : "Run complete DBA scan"}
                </button>
              </div>
              {error && <p className="mt-3 text-sm text-rose-200">{error}</p>}
            </div>
            <div className="grid content-start gap-3 sm:grid-cols-2">
              <HeroPrinciple icon={<Radar size={18} />} label="Trigger" value="Manual only" note="No cron, startup job, timer, or background refresh" />
              <HeroPrinciple icon={<Globe2 size={18} />} label="Geography" value="Global atlas" note="Country cases, waivers, and jurisdiction context" />
              <HeroPrinciple icon={<Building2 size={18} />} label="Entity" value="DBA-aware" note="Legal names, divisions, aliases, and match confidence" />
              <HeroPrinciple icon={<ShieldCheck size={18} />} label="Privacy" value="Public aggregate" note="No private files, claimant PII, or medical information" />
            </div>
          </div>
        </motion.section>

        {!result && !loading && (
          <GlassCard className="mt-6 p-8 text-center">
            <Globe2 className="mx-auto h-10 w-10 text-cyan-200/35" />
            <p className="mt-3 text-sm font-semibold text-cyan-50">Ready for the full DBA public-data scan</p>
            <p className="mx-auto mt-2 max-w-2xl text-xs leading-6 text-cyan-100/45">Leave the search blank for the complete public atlas, or enter a contractor name to prioritize possible employer and DBA matches.</p>
          </GlassCard>
        )}

        {result && (
          <div className="mt-8 space-y-7">
            <RunSummary result={result} />
            <SourceRail sources={result.sources} />
            <TabBar tab={tab} onChange={setTab} />
            {tab === "atlas" && <AtlasPanel countries={countries} plottedCountries={plottedCountries} maxTotal={maxCountryTotal} selected={selectedCountry} onSelect={setSelectedCountryId} waivers={result.waivers} jurisdictions={result.jurisdictions} />}
            {tab === "employers" && <EmployerPanel query={result.query} rows={employerRows} sourcePage={result.caseReports.sourcePage} />}
            {tab === "carriers" && <CarrierPanel carriers={result.caseReports.carriers} carrierNames={carrierNames} selectedCarrier={selectedCarrier} onSelectCarrier={setSelectedCarrier} trend={carrierPerformance} performance={result.performance} />}
            {tab === "waivers" && <WaiverPanel rows={waiverRows} status={waiverStatus} onStatus={setWaiverStatus} />}
            {tab === "law" && <LawPanel result={result} />}
          </div>
        )}
      </section>
    </main>
  );
}

function HeroPrinciple({ icon, label, value, note }: { icon: ReactNode; label: string; value: string; note: string }) {
  return <div className="rounded-2xl border border-white/8 bg-white/[0.035] p-4"><div className="flex items-center gap-2 text-cyan-200/70">{icon}<span className="text-[10px] uppercase tracking-[0.22em]">{label}</span></div><p className="mt-3 text-lg font-bold">{value}</p><p className="mt-1 text-[11px] leading-5 text-cyan-100/42">{note}</p></div>;
}

function RunSummary({ result }: { result: DbaIntelligenceResponse }) {
  const metrics = [
    ["Employer records", result.summary.employerRecords, Building2],
    ["Carrier records", result.summary.carrierRecords, Landmark],
    ["Countries", result.summary.countryRecords, Globe2],
    ["Active waivers", result.summary.activeWaivers, CalendarClock],
    ["Performance points", result.summary.performanceRecords, LineChartIcon],
    ["Source failures", result.summary.failedSources, result.summary.failedSources ? XCircle : CheckCircle2],
  ] as const;
  return <div><div className="mb-3 flex flex-wrap items-center justify-between gap-2"><p className="text-xs uppercase tracking-[0.24em] text-cyan-100/38">Run {result.runId}</p><p className="text-xs text-cyan-100/42">{new Date(result.executedAt).toLocaleString()} · {result.durationMs.toLocaleString()} ms</p></div><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">{metrics.map(([label, value, Icon]) => <GlassCard key={label} className="p-4"><Icon size={17} className="text-cyan-200/65" /><p className="mt-4 text-2xl font-black">{value.toLocaleString()}</p><p className="mt-1 text-[10px] uppercase tracking-[0.18em] text-cyan-100/38">{label}</p></GlassCard>)}</div></div>;
}

function SourceRail({ sources }: { sources: DbaSourceStatus[] }) {
  return <section><p className="mb-3 text-xs uppercase tracking-[0.24em] text-cyan-100/38">Public-source health</p><div className="grid gap-3 lg:grid-cols-3">{sources.map((source) => <GlassCard key={source.source} className="p-4"><div className="flex items-start justify-between gap-3"><div><p className="text-sm font-semibold text-cyan-50">{source.source}</p><p className="mt-1 text-[11px] leading-5 text-cyan-100/42">{source.freshness}</p></div><span className={`rounded-full border px-2 py-1 text-[9px] uppercase tracking-[0.16em] ${sourceTone(source.state)}`}>{source.state}</span></div><div className="mt-4 flex items-center justify-between text-[11px] text-cyan-100/45"><span>{source.recordCount.toLocaleString()} records</span><span>{source.latencyMs.toLocaleString()} ms</span></div>{source.error && <p className="mt-2 text-[11px] text-rose-200/70">{source.error}</p>}<a href={source.sourceUrl} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-1 text-[11px] text-cyan-200/65 hover:text-cyan-100">Official source <ExternalLink size={12} /></a></GlassCard>)}</div></section>;
}

function TabBar({ tab, onChange }: { tab: WorkspaceTab; onChange: (tab: WorkspaceTab) => void }) {
  const tabs: Array<[WorkspaceTab, string, ReactNode]> = [["atlas", "Global atlas", <Globe2 size={15} />], ["employers", "Employers & DBAs", <Building2 size={15} />], ["carriers", "Carrier intelligence", <Landmark size={15} />], ["waivers", "Waiver explorer", <CalendarClock size={15} />], ["law", "Law & sources", <Scale size={15} />]];
  return <div className="flex flex-wrap gap-2">{tabs.map(([id, label, icon]) => <button key={id} onClick={() => onChange(id)} className={`inline-flex items-center gap-2 rounded-2xl border px-4 py-2.5 text-sm transition ${tab === id ? "border-cyan-200/25 bg-cyan-300/14 text-cyan-50 shadow-[0_0_24px_rgba(34,211,238,.1)]" : "border-white/8 bg-white/[0.025] text-cyan-100/45 hover:bg-white/[0.05]"}`}>{icon}{label}</button>)}</div>;
}

function AtlasPanel({ countries, plottedCountries, maxTotal, selected, onSelect, waivers, jurisdictions }: { countries: DbaCaseRecord[]; plottedCountries: DbaCaseRecord[]; maxTotal: number; selected: DbaCaseRecord | null; onSelect: (id: string) => void; waivers: DbaWaiverRecord[]; jurisdictions: DbaIntelligenceResponse["jurisdictions"] }) {
  const activeWaiver = selected ? waivers.find((waiver) => waiver.status === "active" && waiver.location.toLowerCase() === selected.name.toLowerCase()) : undefined;
  const barData = selected ? Object.entries(CASE_LABELS).map(([key, label]) => ({ label, value: selected.counts[key as keyof typeof CASE_LABELS] ?? 0 })) : [];
  return <section className="grid gap-5 2xl:grid-cols-[1.45fr_.55fr]"><GlassCard className="overflow-hidden p-4 md:p-6"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-lg font-bold">Interactive DBA country atlas</p><p className="mt-1 text-xs text-cyan-100/42">Bubble size represents published cumulative case totals. Missing coordinates or suppressed values are not zeros.</p></div><span className="rounded-full border border-cyan-100/12 bg-cyan-200/[0.06] px-3 py-1 text-[10px] text-cyan-100/55">{plottedCountries.length} plotted · {countries.length - plottedCountries.length} list-only</span></div><div className="mt-5 overflow-hidden rounded-[26px] border border-cyan-100/10 bg-[radial-gradient(circle_at_50%_48%,rgba(8,145,178,.09),transparent_55%),rgba(0,0,0,.2)]"><svg viewBox="0 0 1000 500" className="h-auto w-full"><g fill="rgba(148,163,184,.08)" stroke="rgba(165,243,252,.10)" strokeWidth="1"><path d="M70 110 L165 55 L275 75 L325 125 L275 165 L205 155 L155 205 L95 185 Z" /><path d="M245 220 L300 245 L320 325 L285 430 L245 385 L225 300 Z" /><path d="M445 80 L535 60 L615 90 L690 65 L810 95 L900 145 L860 205 L760 215 L705 180 L635 215 L555 175 L500 205 L455 160 Z" /><path d="M485 205 L555 190 L605 245 L570 345 L510 405 L470 320 Z" /><path d="M790 330 L865 305 L920 350 L885 405 L815 395 Z" /><path d="M905 410 L940 400 L950 430 L920 445 Z" /></g>{plottedCountries.map((country) => { const [lon, lat] = COUNTRY_COORDINATES[country.name]; const x = ((lon + 180) / 360) * 1000; const y = ((90 - lat) / 180) * 500; const radius = 4 + Math.sqrt(total(country) / maxTotal) * 18; const isSelected = selected?.id === country.id; return <g key={country.id} onClick={() => onSelect(country.id)} className="cursor-pointer"><circle cx={x} cy={y} r={radius + (isSelected ? 5 : 0)} fill={isSelected ? "rgba(103,232,249,.28)" : "rgba(34,211,238,.12)"} stroke={isSelected ? "rgba(207,250,254,.95)" : "rgba(103,232,249,.55)"} strokeWidth={isSelected ? 2 : 1} /><title>{country.name}: {formatNumber(country.counts.total)} published cases</title></g>; })}</svg></div><div className="mt-4 grid max-h-60 gap-2 overflow-y-auto pr-2 sm:grid-cols-2 lg:grid-cols-3">{countries.slice(0, 120).map((country) => <button key={country.id} onClick={() => onSelect(country.id)} className={`flex items-center justify-between rounded-xl border px-3 py-2 text-left text-xs ${selected?.id === country.id ? "border-cyan-200/25 bg-cyan-300/12 text-cyan-50" : "border-white/7 bg-white/[0.02] text-cyan-100/50 hover:bg-white/[0.05]"}`}><span className="truncate">{country.name}</span><span className="ml-2 font-semibold">{country.counts.total === null ? "—" : country.counts.total.toLocaleString()}</span></button>)}</div></GlassCard><div className="space-y-5">{selected ? <><GlassCard className="p-5"><div className="flex items-start justify-between"><div><p className="text-[10px] uppercase tracking-[0.22em] text-cyan-100/38">Country drilldown</p><h2 className="mt-2 text-2xl font-black">{selected.name}</h2></div><MapPinned className="text-cyan-200/55" /></div><p className="mt-4 text-4xl font-black">{formatNumber(selected.counts.total)}</p><p className="text-xs text-cyan-100/42">Published cumulative case-system records</p>{selected.suppressed && <p className="mt-3 rounded-xl border border-amber-200/15 bg-amber-300/[0.06] p-3 text-[11px] leading-5 text-amber-100/65">At least one case-type cell is privacy-suppressed or unavailable.</p>}<div className="mt-5 h-56"><ResponsiveContainer width="100%" height="100%"><BarChart data={barData} layout="vertical" margin={{ left: 8, right: 12 }}><CartesianGrid strokeDasharray="3 3" opacity={0.1} /><XAxis type="number" tick={{ fill: "rgba(207,250,254,.45)", fontSize: 10 }} /><YAxis type="category" dataKey="label" width={105} tick={{ fill: "rgba(207,250,254,.5)", fontSize: 9 }} /><Tooltip contentStyle={{ background: "#07111f", border: "1px solid rgba(165,243,252,.16)", borderRadius: 12 }} /><Bar dataKey="value" fill="rgba(34,211,238,.55)" radius={[0, 8, 8, 0]} /></BarChart></ResponsiveContainer></div></GlassCard><GlassCard className="p-5"><p className="text-sm font-semibold">Waiver status</p>{activeWaiver ? <div className="mt-3 rounded-2xl border border-emerald-200/18 bg-emerald-300/[0.07] p-4"><p className="text-sm font-bold text-emerald-100">Active public waiver listed</p><p className="mt-2 text-xs text-emerald-100/60">{activeWaiver.waiverNumber} · {activeWaiver.waiverType}</p><p className="mt-1 text-xs text-emerald-100/60">Expires {safeDate(activeWaiver.expirationDate)}</p></div> : <div className="mt-3 rounded-2xl border border-slate-200/10 bg-slate-300/[0.04] p-4"><p className="text-sm text-slate-200">No active waiver matched by exact location name.</p><p className="mt-2 text-[11px] leading-5 text-slate-400">This is not a legal determination. Confirm contract, location, employee class, citizenship/residency, hiring location, and local coverage on the official DOL page.</p></div>}</GlassCard></> : <GlassCard className="p-6 text-center"><CircleOff className="mx-auto text-cyan-100/30" /><p className="mt-3 text-sm text-cyan-100/50">Select a country.</p></GlassCard>}<GlassCard className="p-5"><p className="text-sm font-semibold">Jurisdiction context</p><div className="mt-3 space-y-3">{jurisdictions.map((jurisdiction) => <div key={jurisdiction.office} className="rounded-xl border border-white/7 bg-white/[0.02] p-3"><p className="text-xs font-semibold text-cyan-50">{jurisdiction.office}</p><p className="mt-1 text-[10px] leading-4 text-cyan-100/40">{jurisdiction.boundary}</p></div>)}</div></GlassCard></div></section>;
}

function EmployerPanel({ query, rows, sourcePage }: { query: string; rows: DbaCaseRecord[]; sourcePage: string }) {
  return <section className="grid gap-5 xl:grid-cols-[.8fr_1.2fr]"><GlassCard className="p-6"><p className="text-[10px] uppercase tracking-[0.24em] text-cyan-100/38">Entity relationship lens</p><h2 className="mt-3 text-2xl font-black">{query || "Public employer leaderboard"}</h2><p className="mt-3 text-sm leading-7 text-cyan-100/50">DOL explains that employer names may be entered as corporate names, subdivisions, divisions, DBAs, punctuation variants, or typographical variants. The match score is a name-similarity research aid, not proof of corporate identity.</p>{query && <div className="mt-6 rounded-[24px] border border-cyan-100/12 bg-black/20 p-5"><div className="mx-auto w-fit rounded-2xl border border-cyan-200/25 bg-cyan-300/12 px-5 py-3 text-center text-sm font-bold">{query}</div><div className="mx-auto h-8 w-px bg-cyan-200/20" /><div className="grid gap-2 sm:grid-cols-2">{rows.slice(0, 6).map((row) => <div key={row.id} className="rounded-2xl border border-white/8 bg-white/[0.035] p-3 text-center"><p className="text-xs font-semibold">{row.name}</p><p className="mt-1 text-[10px] text-cyan-100/40">{Math.round((row.matchScore ?? 0) * 100)}% name similarity</p></div>)}</div></div>}<a href={sourcePage} target="_blank" rel="noreferrer" className="mt-5 inline-flex items-center gap-1 text-xs text-cyan-200/65">DOL case-summary reports <ExternalLink size={12} /></a></GlassCard><GlassCard className="p-5"><div className="flex items-center justify-between"><div><p className="text-lg font-bold">{query ? "Possible employer / DBA matches" : "Published employer records"}</p><p className="mt-1 text-xs text-cyan-100/40">Sorted by {query ? "name similarity, then published total" : "published total"}</p></div><BriefcaseBusiness className="text-cyan-200/50" /></div><div className="mt-5 max-h-[720px] space-y-3 overflow-y-auto pr-2">{rows.length ? rows.map((row) => <CaseRecordCard key={row.id} record={row} showMatch={Boolean(query)} />) : <EmptyState text="No employer records matched the search threshold." />}</div></GlassCard></section>;
}

function CaseRecordCard({ record, showMatch }: { record: DbaCaseRecord; showMatch?: boolean }) {
  return <div className="rounded-2xl border border-white/8 bg-white/[0.025] p-4"><div className="flex flex-wrap items-start justify-between gap-2"><div><p className="text-sm font-semibold text-cyan-50">{record.name}</p><p className="mt-1 text-[10px] uppercase tracking-[0.16em] text-cyan-100/32">{record.reportPeriod}</p></div><div className="text-right"><p className="text-xl font-black">{record.counts.total === null ? "—" : record.counts.total.toLocaleString()}</p>{showMatch && <p className="text-[10px] text-cyan-200/55">{Math.round((record.matchScore ?? 0) * 100)}% match</p>}</div></div><div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-6">{Object.entries(CASE_LABELS).map(([key, label]) => <div key={key} title={label} className="rounded-xl border border-white/6 bg-black/15 p-2 text-center"><p className="text-xs font-bold">{record.counts[key as keyof typeof CASE_LABELS] ?? "—"}</p><p className="mt-1 text-[9px] uppercase text-cyan-100/30">{key}</p></div>)}</div>{record.suppressed && <p className="mt-3 text-[10px] text-amber-200/60">Contains privacy-suppressed or unavailable cells.</p>}</div>;
}

function CarrierPanel({ carriers, carrierNames, selectedCarrier, onSelectCarrier, trend, performance }: { carriers: DbaCaseRecord[]; carrierNames: string[]; selectedCarrier: string; onSelectCarrier: (value: string) => void; trend: Array<Record<string, number | string>>; performance: DbaPerformanceRecord[] }) {
  const carrierCase = carriers.find((record) => record.name.toLowerCase().includes(selectedCarrier.toLowerCase()) || selectedCarrier.toLowerCase().includes(record.name.toLowerCase()));
  const latest = performance.filter((record) => record.carrier === selectedCarrier).sort((a, b) => b.fiscalYear - a.fiscalYear)[0];
  return <section className="space-y-5"><div className="grid gap-5 xl:grid-cols-[.35fr_.65fr]"><GlassCard className="p-5"><p className="text-sm font-semibold">Carrier selection</p><select value={selectedCarrier} onChange={(event) => onSelectCarrier(event.target.value)} className="mt-3 min-h-11 w-full rounded-xl border border-cyan-100/12 bg-[#06101d] px-3 text-sm text-cyan-50 outline-none">{carrierNames.map((carrier) => <option key={carrier}>{carrier}</option>)}</select><div className="mt-5 rounded-2xl border border-cyan-100/10 bg-cyan-300/[0.04] p-4"><p className="text-[10px] uppercase tracking-[0.2em] text-cyan-100/35">Cumulative carrier record</p><p className="mt-2 text-3xl font-black">{formatNumber(carrierCase?.counts.total)}</p><p className="mt-1 text-xs text-cyan-100/40">Possible name-linked published cases</p></div>{latest && <div className="mt-3 rounded-2xl border border-white/8 bg-white/[0.025] p-4"><p className="text-[10px] uppercase tracking-[0.2em] text-cyan-100/35">Latest performance point</p><p className="mt-2 text-lg font-bold">FY{latest.fiscalYear} · {latest.metric === "first-report" ? "First report" : "First payment"}</p><p className="mt-1 text-xs text-cyan-100/45">{latest.firstThresholdPercent}% within {latest.firstThresholdDays} days · {latest.ninetyDayPercent}% within 90 days</p></div>}</GlassCard><GlassCard className="p-5"><div><p className="text-lg font-bold">Carrier timeliness trends</p><p className="mt-1 text-xs text-cyan-100/42">DOL-published percentages by fiscal year. Carrier inclusion thresholds and reporting definitions vary by period.</p></div><div className="mt-5 h-[360px]">{trend.length ? <ResponsiveContainer width="100%" height="100%"><LineChart data={trend}><CartesianGrid strokeDasharray="3 3" opacity={0.1} /><XAxis dataKey="fiscalYear" tick={{ fill: "rgba(207,250,254,.45)", fontSize: 10 }} /><YAxis domain={[0, 100]} tick={{ fill: "rgba(207,250,254,.45)", fontSize: 10 }} /><Tooltip contentStyle={{ background: "#07111f", border: "1px solid rgba(165,243,252,.16)", borderRadius: 12 }} /><Legend wrapperStyle={{ fontSize: 11 }} /><Line type="monotone" dataKey="reportFast" name="Reports — first threshold" stroke="#67e8f9" strokeWidth={2} connectNulls /><Line type="monotone" dataKey="report90" name="Reports — 90 days" stroke="#a78bfa" strokeWidth={2} connectNulls /><Line type="monotone" dataKey="paymentFast" name="Payments — first threshold" stroke="#fbbf24" strokeWidth={2} connectNulls /><Line type="monotone" dataKey="payment90" name="Payments — 90 days" stroke="#34d399" strokeWidth={2} connectNulls /></LineChart></ResponsiveContainer> : <EmptyState text="No parsed performance trend is available for this carrier." />}</div></GlassCard></div><GlassCard className="p-5"><p className="text-lg font-bold">Carrier case-summary leaderboard</p><div className="mt-4 grid gap-3 lg:grid-cols-2">{carriers.slice(0, 30).map((carrier) => <CaseRecordCard key={carrier.id} record={carrier} />)}</div></GlassCard></section>;
}

function WaiverPanel({ rows, status, onStatus }: { rows: DbaWaiverRecord[]; status: "all" | "active" | "archived"; onStatus: (status: "all" | "active" | "archived") => void }) {
  return <section className="space-y-5"><GlassCard className="p-5"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-lg font-bold">DBA waiver expiration intelligence</p><p className="mt-1 text-xs text-cyan-100/42">Active and archived public records where the DOL source could be parsed during the manual run.</p></div><div className="flex gap-2">{(["active", "archived", "all"] as const).map((value) => <button key={value} onClick={() => onStatus(value)} className={`rounded-xl border px-3 py-2 text-xs capitalize ${status === value ? "border-cyan-200/25 bg-cyan-300/12 text-cyan-50" : "border-white/8 bg-white/[0.025] text-cyan-100/45"}`}>{value}</button>)}</div></div><div className="mt-5 overflow-x-auto"><div className="min-w-[760px] space-y-2">{rows.length ? rows.map((waiver) => { const expiration = waiver.expirationDate ? new Date(`${waiver.expirationDate}T00:00:00`).getTime() : null; const days = expiration ? Math.ceil((expiration - Date.now()) / 86_400_000) : null; const urgency = days !== null && days <= 180 && days >= 0; return <div key={waiver.id} className="grid grid-cols-[1.3fr_.7fr_.7fr_.8fr_.8fr] items-center gap-3 rounded-2xl border border-white/8 bg-white/[0.025] px-4 py-3"><div><p className="text-sm font-semibold">{waiver.location}</p><p className="mt-1 text-[10px] text-cyan-100/35">{waiver.waiverType || "Type unavailable"}</p></div><p className="text-xs text-cyan-100/55">{waiver.waiverNumber}</p><span className={`w-fit rounded-full border px-2 py-1 text-[9px] uppercase ${waiver.status === "active" ? "border-emerald-200/18 bg-emerald-300/[0.07] text-emerald-100" : "border-slate-200/10 bg-slate-300/[0.05] text-slate-300"}`}>{waiver.status}</span><p className="text-xs text-cyan-100/55">Issued {safeDate(waiver.issuedDate)}</p><p className={`text-xs ${urgency ? "font-semibold text-amber-200" : "text-cyan-100/55"}`}>{waiver.status === "active" ? `Expires ${safeDate(waiver.expirationDate)}` : `Expired ${safeDate(waiver.expirationDate)}`}</p></div>; }) : <EmptyState text="No waiver rows are available for this filter." />}</div></div></GlassCard><GlassCard className="border-amber-200/12 p-5"><p className="text-sm font-semibold text-amber-100">Waiver interpretation boundary</p><p className="mt-2 text-xs leading-6 text-amber-100/55">A location appearing on the waiver list does not by itself determine whether a specific worker, contract, or incident is waived. Applicability can depend on the agency request, contract or geographic scope, employee class, U.S. citizenship or residency, place of hire, and whether alternative local workers’ compensation benefits are actually available.</p></GlassCard></section>;
}

function LawPanel({ result }: { result: DbaIntelligenceResponse }) {
  return <section className="grid gap-5 xl:grid-cols-[.9fr_1.1fr]"><div className="space-y-5"><GlassCard className="p-5"><div className="flex items-center gap-2"><Scale className="text-cyan-200/55" /><p className="text-lg font-bold">Public legal and adjudication references</p></div><div className="mt-4 space-y-3">{result.legalReferences.map((reference) => <a key={reference.title} href={reference.sourceUrl} target="_blank" rel="noreferrer" className="block rounded-2xl border border-white/8 bg-white/[0.025] p-4 transition hover:border-cyan-200/18 hover:bg-cyan-300/[0.05]"><div className="flex items-start justify-between gap-3"><div><p className="text-sm font-semibold text-cyan-50">{reference.title}</p><p className="mt-1 text-[10px] uppercase tracking-[0.16em] text-cyan-100/32">{reference.source}</p></div><ExternalLink size={14} className="text-cyan-200/45" /></div><p className="mt-3 text-xs leading-5 text-cyan-100/45">{reference.note}</p></a>)}</div></GlassCard><GlassCard className="p-5"><div className="flex items-center gap-2"><FileText className="text-cyan-200/55" /><p className="text-lg font-bold">Case type definitions</p></div><div className="mt-4 space-y-2">{Object.entries(CASE_LABELS).map(([code, label]) => <div key={code} className="flex items-center justify-between rounded-xl border border-white/7 bg-white/[0.02] px-3 py-2"><span className="text-xs text-cyan-100/55">{label}</span><span className="rounded-lg border border-cyan-100/10 bg-cyan-300/[0.05] px-2 py-1 text-[10px] font-bold text-cyan-100">{code.toUpperCase()}</span></div>)}</div></GlassCard></div><div className="space-y-5"><GlassCard className="p-5"><div className="flex items-center gap-2"><Database className="text-cyan-200/55" /><p className="text-lg font-bold">Methodology and limitations</p></div><div className="mt-4 space-y-3">{result.warnings.map((warning) => <div key={warning} className="rounded-2xl border border-amber-200/10 bg-amber-300/[0.045] p-4 text-xs leading-6 text-amber-100/58">{warning}</div>)}</div><div className="mt-4 flex flex-wrap gap-3"><a href={result.caseReports.methodologyPage} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-xl border border-cyan-100/12 bg-cyan-300/[0.05] px-3 py-2 text-xs text-cyan-100/65">DOL report methodology <ExternalLink size={12} /></a><a href={result.caseReports.sourcePage} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-xl border border-cyan-100/12 bg-cyan-300/[0.05] px-3 py-2 text-xs text-cyan-100/65">All report workbooks <ExternalLink size={12} /></a></div></GlassCard><GlassCard className="p-5"><p className="text-lg font-bold">Jurisdiction directory</p><div className="mt-4 space-y-3">{result.jurisdictions.map((jurisdiction) => <div key={jurisdiction.office} className="rounded-2xl border border-white/8 bg-white/[0.025] p-4"><div className="flex flex-wrap items-start justify-between gap-2"><div><p className="text-sm font-semibold">{jurisdiction.office}</p><p className="mt-1 text-[10px] text-cyan-100/35">{jurisdiction.location} · {jurisdiction.phone}</p></div><a href={jurisdiction.sourceUrl} target="_blank" rel="noreferrer" className="text-cyan-200/45"><ExternalLink size={14} /></a></div><p className="mt-3 text-xs leading-5 text-cyan-100/45">{jurisdiction.boundary}</p></div>)}</div></GlassCard></div></section>;
}

function EmptyState({ text }: { text: string }) {
  return <div className="flex min-h-36 flex-col items-center justify-center rounded-2xl border border-dashed border-cyan-100/12 bg-white/[0.015] p-6 text-center"><CircleOff className="text-cyan-100/25" /><p className="mt-3 text-sm text-cyan-100/45">{text}</p></div>;
}
