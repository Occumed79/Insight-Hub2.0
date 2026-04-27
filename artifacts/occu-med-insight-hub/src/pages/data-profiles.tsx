import { useMemo, useState } from "react";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { Building2, FileJson, MapPin, Sparkles, UploadCloud, Users } from "lucide-react";
import { HeaderBar } from "@/components/insight/HeaderBar";
import { MetricCard } from "@/components/insight/MetricCard";
import { ChartBlock } from "@/components/insight/ChartBlock";
import { SectionPanel } from "@/components/insight/SectionPanel";
import { Sidebar } from "@/components/insight/Sidebar";
import { GlassCard } from "@/components/insight/GlassCard";
import { useInsightData, useSelectedCompany } from "@/data/useInsightData";

type UploadedClient = {
  id: string;
  name: string;
  shortName: string;
  sector: string;
  headquarters: string;
  employees: number;
  summary: string;
  tags: string[];
  priority: "High" | "Medium" | "Emerging";
  status: string;
};

const starterClients: UploadedClient[] = [
  {
    id: "sample-defense-client",
    name: "Sample Defense Client",
    shortName: "Defense Client",
    sector: "Defense logistics and mission support",
    headquarters: "United States",
    employees: 7200,
    summary:
      "Starter profile card for a high-complexity client with deployable workforce needs, medical readiness exposure, and recurring coordination requirements.",
    tags: ["Defense", "Deployable workforce", "High coordination"],
    priority: "High",
    status: "Profile shell ready",
  },
  {
    id: "sample-transportation-client",
    name: "Sample Transportation Client",
    shortName: "Transportation",
    sector: "Transportation, safety-sensitive labor, and compliance programs",
    headquarters: "California",
    employees: 1800,
    summary:
      "Placeholder profile for a client where exam volume, regulatory requirements, clinic access, and turnaround times matter most.",
    tags: ["DOT-style workflows", "Regional footprint", "Compliance"],
    priority: "Medium",
    status: "Needs uploaded details",
  },
  {
    id: "sample-public-agency",
    name: "Sample Public Agency",
    shortName: "Public Agency",
    sector: "Government workforce health and occupational screening",
    headquarters: "Western United States",
    employees: 4300,
    summary:
      "Starter agency profile designed for structured notes, renewal signals, service gaps, clinic coverage challenges, and decision-maker mapping.",
    tags: ["Public sector", "Occupational health", "Network planning"],
    priority: "Emerging",
    status: "Discovery profile",
  },
];

const csvHeaders = ["name", "shortName", "sector", "headquarters", "employees", "summary", "tags", "priority", "status"];

function slugify(value: string) {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "client";
}

function parseCsv(text: string): UploadedClient[] {
  const rows = text.split(/\r?\n/).map((row) => row.trim()).filter(Boolean);
  if (rows.length < 2) return [];

  const headers = rows[0].split(",").map((item) => item.trim());
  return rows.slice(1).map((row, index) => {
    const values = row.split(",").map((item) => item.trim());
    const record = headers.reduce<Record<string, string>>((acc, header, valueIndex) => {
      acc[header] = values[valueIndex] || "";
      return acc;
    }, {});
    const name = record.name || `Uploaded Client ${index + 1}`;
    return {
      id: `${slugify(name)}-${index}`,
      name,
      shortName: record.shortName || name,
      sector: record.sector || "Client profile",
      headquarters: record.headquarters || "Not provided",
      employees: Number(record.employees || 0),
      summary: record.summary || "Uploaded client profile awaiting additional notes, metrics, sources, and service details.",
      tags: (record.tags || "Uploaded, Needs review").split(/[|;]/).map((tag) => tag.trim()).filter(Boolean),
      priority: record.priority === "High" || record.priority === "Medium" || record.priority === "Emerging" ? record.priority : "Emerging",
      status: record.status || "Uploaded draft",
    };
  });
}

function normalizeUploadedClients(value: unknown): UploadedClient[] {
  const input = Array.isArray(value) ? value : [value];
  return input.map((item, index) => {
    const record = item as Partial<UploadedClient>;
    const name = record.name || `Uploaded Client ${index + 1}`;
    return {
      id: record.id || `${slugify(name)}-${index}`,
      name,
      shortName: record.shortName || name,
      sector: record.sector || "Client profile",
      headquarters: record.headquarters || "Not provided",
      employees: Number(record.employees || 0),
      summary: record.summary || "Uploaded client profile awaiting additional notes, metrics, sources, and service details.",
      tags: Array.isArray(record.tags) ? record.tags : ["Uploaded", "Needs review"],
      priority: record.priority === "High" || record.priority === "Medium" || record.priority === "Emerging" ? record.priority : "Emerging",
      status: record.status || "Uploaded draft",
    };
  });
}

export default function DataProfiles() {
  const { dataset } = useInsightData();
  const { companyId, setCompanyId, company } = useSelectedCompany(dataset.companies);
  const [uploadedClients, setUploadedClients] = useState<UploadedClient[]>(starterClients);
  const [selectedClientId, setSelectedClientId] = useState(starterClients[0].id);
  const [uploadMessage, setUploadMessage] = useState("Upload JSON or CSV client information to generate profile cards instantly.");

  const selectedClient = uploadedClients.find((client) => client.id === selectedClientId) || uploadedClients[0];
  const profile = dataset.profiles.find((item) => item.companyId === companyId) || dataset.profiles[0];
  const companyMetrics = dataset.metrics
    .filter((metric) => metric.companyId === companyId || (companyId !== "v2x" && metric.companyId === "v2x"))
    .slice(0, 6);
  const chartData = companyMetrics.map((metric) => ({
    name: metric.label.replace("Estimated annual ", "").slice(0, 16),
    value: metric.unit === "usd" ? metric.value / 1000000 : metric.value,
  }));
  const sources = dataset.sources.filter((source) => source.companyId === companyId || source.companyId === "v2x");

  const clientStats = useMemo(() => {
    const totalEmployees = uploadedClients.reduce((sum, client) => sum + (client.employees || 0), 0);
    const highPriority = uploadedClients.filter((client) => client.priority === "High").length;
    const sectors = new Set(uploadedClients.map((client) => client.sector)).size;
    return [
      { label: "Client profiles", value: uploadedClients.length.toLocaleString(), note: "Cards currently loaded into this portal view." },
      { label: "Estimated workforce", value: totalEmployees ? totalEmployees.toLocaleString() : "TBD", note: "Pulled from uploaded client profile fields." },
      { label: "High priority", value: highPriority.toLocaleString(), note: "Profiles marked as immediate strategic opportunities." },
      { label: "Sector spread", value: sectors.toLocaleString(), note: "Distinct client categories represented." },
    ];
  }, [uploadedClients]);

  const handleUpload = async (file: File | null) => {
    if (!file) return;
    const text = await file.text();
    try {
      const parsed = file.name.toLowerCase().endsWith(".json") ? normalizeUploadedClients(JSON.parse(text)) : parseCsv(text);
      if (!parsed.length) {
        setUploadMessage("I could not read client rows from that file. Try JSON or CSV with the expected fields.");
        return;
      }
      setUploadedClients(parsed);
      setSelectedClientId(parsed[0].id);
      setUploadMessage(`Loaded ${parsed.length} client profile${parsed.length === 1 ? "" : "s"}.`);
    } catch {
      setUploadMessage("Upload failed. Use a JSON array or CSV with headers: " + csvHeaders.join(", "));
    }
  };

  return (
    <main className="aurora-bg min-h-screen text-white">
      <Sidebar />
      <section className="relative z-10 px-5 py-8 lg:ml-[210px] lg:px-12">
        <HeaderBar
          eyebrow="Portal 01"
          title="Data Profiles Portal"
          subtitle="Upload client information and turn each account into an interactive, eye-catching profile card with signals, notes, tags, and source-ready sections."
          actions={
            <select
              value={companyId}
              onChange={(event) => setCompanyId(event.target.value)}
              className="rounded-full border border-cyan-100/15 bg-[#07111d] px-4 py-2 text-sm text-cyan-50 outline-none"
            >
              {dataset.companies.map((item) => (
                <option key={item.id} value={item.id}>{item.name}</option>
              ))}
            </select>
          }
        />

        <GlassCard className="mb-5 overflow-hidden p-0">
          <div className="grid gap-0 xl:grid-cols-[.9fr_1.1fr]">
            <div className="relative border-b border-cyan-100/10 bg-white/[0.03] p-6 xl:border-b-0 xl:border-r">
              <div className="absolute right-6 top-6 rounded-full border border-purple-200/20 bg-purple-400/10 p-3 text-purple-100 shadow-[0_0_42px_rgba(168,85,247,.24)]">
                <UploadCloud className="h-6 w-6" />
              </div>
              <p className="text-xs uppercase tracking-[0.28em] text-emerald-200/70">Client ingestion</p>
              <h2 className="mt-2 max-w-md text-3xl font-black text-white">Drop in client data. Generate visual profiles.</h2>
              <p className="mt-3 max-w-xl text-sm leading-6 text-cyan-100/62">
                This starter supports JSON arrays or simple CSV files. Each row becomes a clickable client card that can later expand into metrics, documents, contacts, service history, and decision-maker intelligence.
              </p>
              <label className="mt-6 flex cursor-pointer flex-col items-center justify-center rounded-3xl border border-dashed border-cyan-100/22 bg-black/20 px-6 py-8 text-center transition hover:border-purple-200/50 hover:bg-purple-400/10">
                <FileJson className="mb-3 h-8 w-8 text-cyan-100/70" />
                <span className="text-sm font-bold text-cyan-50">Upload client JSON or CSV</span>
                <span className="mt-2 text-xs leading-5 text-cyan-100/50">Fields: {csvHeaders.join(", ")}</span>
                <input className="hidden" type="file" accept=".json,.csv,text/csv,application/json" onChange={(event) => handleUpload(event.target.files?.[0] || null)} />
              </label>
              <p className="mt-4 rounded-2xl border border-cyan-100/10 bg-cyan-100/[0.04] px-4 py-3 text-xs leading-5 text-cyan-50/68">{uploadMessage}</p>
            </div>

            <div className="p-6">
              <div className="mb-4 flex items-center justify-between gap-5">
                <div>
                  <p className="text-xs uppercase tracking-[0.28em] text-emerald-200/70">Portal signals</p>
                  <h2 className="mt-2 text-2xl font-black text-white">Profile command view</h2>
                </div>
                <span className="rounded-full border border-cyan-100/18 bg-cyan-200/10 px-4 py-2 text-xs text-cyan-50/75">Interactive starter</span>
              </div>
              <div className="grid gap-3 md:grid-cols-4">
                {clientStats.map((signal) => (
                  <div key={signal.label} className="rounded-2xl border border-cyan-100/12 bg-black/18 p-4 shadow-[inset_0_0_24px_rgba(45,212,191,.06)]">
                    <p className="text-[10px] uppercase tracking-[0.22em] text-cyan-100/42">{signal.label}</p>
                    <p className="mt-2 text-lg font-black text-cyan-50">{signal.value}</p>
                    <p className="mt-2 text-xs leading-5 text-cyan-100/58">{signal.note}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </GlassCard>

        <div className="grid gap-5 xl:grid-cols-[1fr_.92fr]">
          <GlassCard className="p-6">
            <div className="mb-5 flex items-center justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.25em] text-emerald-200/60">Client cards</p>
                <h2 className="mt-2 text-2xl font-black text-white">Choose a profile</h2>
              </div>
              <Sparkles className="h-6 w-6 text-purple-200/80" />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              {uploadedClients.map((client) => {
                const active = selectedClient?.id === client.id;
                return (
                  <button
                    key={client.id}
                    onClick={() => setSelectedClientId(client.id)}
                    className={`group rounded-3xl border p-5 text-left transition duration-300 hover:-translate-y-1 hover:border-purple-200/60 hover:bg-purple-400/10 ${active ? "border-purple-200/60 bg-purple-400/12 shadow-[0_0_45px_rgba(168,85,247,.18)]" : "border-cyan-100/12 bg-white/[0.035]"}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="rounded-2xl border border-cyan-100/15 bg-cyan-100/8 p-3 text-cyan-50 shadow-[0_0_30px_rgba(34,211,238,.12)]">
                        <Building2 className="h-5 w-5" />
                      </div>
                      <span className="rounded-full border border-cyan-100/15 bg-black/20 px-3 py-1 text-[11px] font-bold text-cyan-50/70">{client.priority}</span>
                    </div>
                    <h3 className="mt-4 text-xl font-black text-white">{client.shortName}</h3>
                    <p className="mt-1 text-sm text-cyan-100/50">{client.sector}</p>
                    <p className="mt-4 line-clamp-3 text-sm leading-6 text-cyan-50/62">{client.summary}</p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      {client.tags.slice(0, 3).map((tag) => (
                        <span key={tag} className="rounded-full border border-cyan-100/12 bg-cyan-100/5 px-3 py-1 text-[11px] text-cyan-50/62">{tag}</span>
                      ))}
                    </div>
                  </button>
                );
              })}
            </div>
          </GlassCard>

          <GlassCard className="p-6">
            <p className="text-xs uppercase tracking-[0.25em] text-emerald-200/60">Selected profile</p>
            <h2 className="mt-2 text-3xl font-black text-white">{selectedClient?.name}</h2>
            <p className="mt-3 text-sm leading-6 text-cyan-100/62">{selectedClient?.summary}</p>
            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-cyan-100/10 bg-black/20 p-4">
                <Users className="mb-3 h-5 w-5 text-cyan-100/70" />
                <p className="text-[10px] uppercase tracking-[0.2em] text-cyan-100/42">Employees</p>
                <p className="mt-2 text-lg font-black text-white">{selectedClient?.employees ? selectedClient.employees.toLocaleString() : "TBD"}</p>
              </div>
              <div className="rounded-2xl border border-cyan-100/10 bg-black/20 p-4">
                <MapPin className="mb-3 h-5 w-5 text-cyan-100/70" />
                <p className="text-[10px] uppercase tracking-[0.2em] text-cyan-100/42">HQ</p>
                <p className="mt-2 text-sm font-bold leading-5 text-white">{selectedClient?.headquarters}</p>
              </div>
              <div className="rounded-2xl border border-cyan-100/10 bg-black/20 p-4">
                <Sparkles className="mb-3 h-5 w-5 text-cyan-100/70" />
                <p className="text-[10px] uppercase tracking-[0.2em] text-cyan-100/42">Status</p>
                <p className="mt-2 text-sm font-bold leading-5 text-white">{selectedClient?.status}</p>
              </div>
            </div>
            <div className="mt-5 flex flex-wrap gap-2">
              {selectedClient?.tags.map((tag) => (
                <span key={tag} className="rounded-full border border-purple-200/20 bg-purple-400/10 px-3 py-1 text-xs text-purple-50/80">{tag}</span>
              ))}
            </div>
          </GlassCard>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-3">
          {companyMetrics.slice(0, 6).map((metric) => <MetricCard key={metric.id} metric={metric} />)}
        </div>

        <div className="mt-5 grid gap-5 xl:grid-cols-[1.2fr_.8fr]">
          <ChartBlock title={`${company?.shortName || "Company"} exposure curve`} subtitle="Existing intelligence model retained as the benchmark layer while client profiles are built out.">
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="profileGlow" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="5%" stopColor="#5eead4" stopOpacity={0.45} />
                  <stop offset="95%" stopColor="#5eead4" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="rgba(255,255,255,.08)" />
              <XAxis dataKey="name" stroke="rgba(207,250,254,.45)" tick={{ fontSize: 11 }} />
              <YAxis stroke="rgba(207,250,254,.45)" tick={{ fontSize: 11 }} />
              <Area type="monotone" dataKey="value" stroke="#67e8f9" fill="url(#profileGlow)" strokeWidth={2} />
            </AreaChart>
          </ChartBlock>
          <GlassCard className="p-6">
            <p className="text-xs uppercase tracking-[0.25em] text-emerald-200/60">Company dossier benchmark</p>
            <h2 className="mt-2 text-2xl font-black text-white">{company?.name}</h2>
            <p className="mt-3 text-sm leading-6 text-cyan-100/60">{company?.summary}</p>
            <div className="mt-5 flex flex-wrap gap-2">
              {company?.tags.map((tag) => <span key={tag} className="rounded-full border border-cyan-100/15 bg-cyan-100/5 px-3 py-1 text-xs text-cyan-50/70">{tag}</span>)}
            </div>
          </GlassCard>
        </div>

        <div className="mt-5 space-y-4">
          {profile.sections.map((section, index) => (
            <SectionPanel key={section.id} title={section.title} narrative={section.narrative} defaultOpen={index < 2}>
              <div className="grid gap-4 md:grid-cols-[1fr_.8fr]">
                <ul className="space-y-2 text-sm text-cyan-50/72">
                  {section.bullets.map((bullet) => <li key={bullet} className="rounded-2xl border border-cyan-100/10 bg-white/[0.03] px-4 py-3">{bullet}</li>)}
                </ul>
                <div className="grid gap-3">
                  {section.metrics.map((id) => dataset.metrics.find((metric) => metric.id === id)).filter(Boolean).map((metric) => metric ? <MetricCard key={metric.id} metric={metric} /> : null)}
                </div>
              </div>
            </SectionPanel>
          ))}
        </div>

        <GlassCard className="mt-5 p-6">
          <h3 className="text-lg font-bold text-white">Source Library</h3>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {sources.slice(0, 8).map((source) => (
              <div key={source.id} className="rounded-2xl border border-cyan-100/10 bg-white/[0.03] p-4">
                <p className="text-sm font-semibold text-cyan-50">{source.label}</p>
                <p className="mt-1 text-xs text-cyan-100/52">{source.type}</p>
                <p className="mt-3 text-sm leading-6 text-cyan-100/58">{source.note}</p>
                {source.url ? <a className="mt-3 inline-block text-xs font-semibold text-emerald-200" href={source.url} target="_blank" rel="noreferrer">Open source</a> : null}
              </div>
            ))}
          </div>
        </GlassCard>
      </section>
    </main>
  );
}
