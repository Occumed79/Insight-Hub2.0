import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  ChevronRight,
  Database,
  ExternalLink,
  Filter,
  GitBranch,
  Linkedin,
  Loader2,
  Mail,
  Network,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  UserRound,
  UsersRound,
  X,
} from "lucide-react";
import { HeaderBar } from "@/components/insight/HeaderBar";
import { Sidebar } from "@/components/insight/Sidebar";
import {
  analyzeLeadershipMap,
  getLeadershipContactDomain,
  getSavedOrganizationalChart,
  getSavedOrganizationalCharts,
  saveLeadershipContactDomain,
  type LeadershipConfidence,
  type LeadershipEdge,
  type LeadershipLevel,
  type LeadershipMapResponse,
  type LeadershipPerson,
  type SavedOrganizationalChart,
} from "@/data/leadershipMapApi";

const LEVEL_ORDER: LeadershipLevel[] = [
  "board",
  "executive",
  "senior-leadership",
  "director",
  "manager",
  "individual-contributor",
  "unknown",
];

const LEVEL_LABELS: Record<LeadershipLevel, string> = {
  board: "Board / parent governance",
  executive: "Chief executive",
  "senior-leadership": "C-suite / senior leadership",
  director: "Directors / functional leadership",
  manager: "Managers / operating leads",
  "individual-contributor": "Specialists / staff",
  unknown: "Unplaced",
};

const LEVEL_ACCENT: Record<LeadershipLevel, string> = {
  board: "sky",
  executive: "violet",
  "senior-leadership": "emerald",
  director: "amber",
  manager: "fuchsia",
  "individual-contributor": "cyan",
  unknown: "slate",
};

const SESSION_KEY = "insight-hub.organizational-chart.form";

type WorkspaceMode = "saved" | "new";
type ConfidenceFilter = "all" | LeadershipConfidence;
type NodePosition = { person: LeadershipPerson; x: number; y: number; row: number };

function loadSavedForm() {
  try {
    const parsed = JSON.parse(sessionStorage.getItem(SESSION_KEY) || "null") as Record<string, string> | null;
    return {
      companyName: String(parsed?.companyName || ""),
      primaryUrl: String(parsed?.primaryUrl || ""),
      supportingUrls: String(parsed?.supportingUrls || ""),
    };
  } catch {
    return { companyName: "", primaryUrl: "", supportingUrls: "" };
  }
}

function normalizeDomain(value: string) {
  const raw = value.trim().toLowerCase().replace(/^@/, "");
  if (!raw) return "";
  try {
    const parsed = new URL(raw.includes("://") ? raw : `https://${raw}`);
    const host = parsed.hostname.replace(/^www\./, "").replace(/\.$/, "");
    return /^[a-z0-9.-]+\.[a-z]{2,}$/i.test(host) ? host : "";
  } catch {
    return "";
  }
}

function nameParts(name: string) {
  const tokens = name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\([^)]*\)/g, " ")
    .replace(/\b(?:dr|gen|adm|mr|mrs|ms|prof|hon)\.?\s+/gi, "")
    .replace(/\b(?:jr|sr|ii|iii|iv|esq|pe|pmp)\.?$/gi, "")
    .replace(/[^a-z0-9' -]/gi, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .map((token) => token.replace(/[^a-z0-9]/gi, "").toLowerCase())
    .filter(Boolean);
  return tokens.length >= 2 ? { first: tokens[0], last: tokens[tokens.length - 1] } : null;
}

function possibleEmails(person: LeadershipPerson, domain: string) {
  const normalized = normalizeDomain(domain);
  const parts = nameParts(person.name);
  if (!normalized || !parts) return [];
  return Array.from(new Set([
    `${parts.first}.${parts.last}@${normalized}`,
    `${parts.first[0]}${parts.last}@${normalized}`,
    `${parts.first}${parts.last}@${normalized}`,
    `${parts.first}@${normalized}`,
  ]));
}

function linkedInUrl(person: LeadershipPerson, companyName: string) {
  if (person.linkedinUrl && /^https?:\/\//i.test(person.linkedinUrl)) return person.linkedinUrl;
  return `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent([person.name, companyName, person.title].filter(Boolean).join(" "))}`;
}

function confidenceTone(confidence: LeadershipConfidence) {
  if (confidence === "confirmed") return "border-emerald-200/22 bg-emerald-300/10 text-emerald-100";
  if (confidence === "probable") return "border-cyan-200/22 bg-cyan-300/10 text-cyan-100";
  return "border-amber-200/22 bg-amber-300/10 text-amber-100";
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="min-w-[108px] border-r border-white/8 px-4 first:pl-0 last:border-r-0">
      <p className="text-[9px] font-black uppercase tracking-[0.18em] text-cyan-100/34">{label}</p>
      <p className="mt-1 text-xl font-black tracking-[-0.03em] text-white">{value}</p>
    </div>
  );
}

function buildTopology(people: LeadershipPerson[]) {
  const groups = LEVEL_ORDER
    .map((level) => ({ level, people: people.filter((person) => person.level === level) }))
    .filter((group) => group.people.length > 0);
  const maxAcross = Math.max(1, ...groups.map((group) => group.people.length));
  const width = Math.max(1220, maxAcross * 250 + 160);
  const positions = new Map<string, NodePosition>();
  groups.forEach((group, row) => {
    const count = group.people.length;
    const available = width - 200;
    group.people.forEach((person, index) => {
      const x = count === 1 ? width / 2 : 100 + (available * index) / Math.max(1, count - 1);
      const y = 108 + row * 230;
      positions.set(person.id, { person, x, y, row });
    });
  });
  return { groups, positions, width, height: Math.max(650, 210 + groups.length * 230) };
}

function TopologyNode({ position, selected, onSelect }: { position: NodePosition; selected: boolean; onSelect: () => void }) {
  const person = position.person;
  const accent = LEVEL_ACCENT[person.level];
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`group absolute w-[218px] -translate-x-1/2 -translate-y-1/2 text-left transition duration-300 ${selected ? "z-20 scale-[1.035]" : "z-10 hover:z-20 hover:scale-[1.025]"}`}
      style={{ left: position.x, top: position.y }}
    >
      <div className={`relative overflow-hidden rounded-[22px] border bg-[#07111e]/86 p-4 shadow-[0_18px_50px_rgba(0,0,0,.34),inset_0_1px_0_rgba(255,255,255,.08)] backdrop-blur-2xl ${selected ? "border-cyan-200/42 shadow-[0_22px_68px_rgba(34,211,238,.14),inset_0_1px_0_rgba(255,255,255,.13)]" : "border-white/12 hover:border-white/22"}`}>
        <div className={`pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-${accent}-200/55 to-transparent`} />
        <div className="flex items-start justify-between gap-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-2xl border border-white/10 bg-white/[0.035] text-cyan-100/70"><UserRound className="h-4 w-4" /></span>
          <span className={`rounded-full border px-2 py-1 text-[8px] font-black uppercase tracking-[0.13em] ${confidenceTone(person.confidence)}`}>{person.confidence}</span>
        </div>
        <p className="mt-4 line-clamp-2 text-[9px] font-black uppercase leading-4 tracking-[0.13em] text-cyan-100/46">{person.title}</p>
        <h3 className="mt-1.5 line-clamp-2 text-[15px] font-black leading-5 text-white">{person.name}</h3>
        <div className="mt-3 flex items-center justify-between gap-2 border-t border-white/7 pt-3 text-[10px] text-cyan-100/38">
          <span className="truncate">{person.department || person.location || LEVEL_LABELS[person.level]}</span>
          <ChevronRight className="h-3.5 w-3.5 shrink-0 transition group-hover:translate-x-0.5" />
        </div>
      </div>
    </button>
  );
}

function TopologyCanvas({ result, people, selectedId, onSelect }: { result: LeadershipMapResponse; people: LeadershipPerson[]; selectedId: string | null; onSelect: (id: string) => void }) {
  const topology = useMemo(() => buildTopology(people), [people]);
  const visibleIds = useMemo(() => new Set(people.map((person) => person.id)), [people]);
  const edges = useMemo(() => result.edges.filter((edge) => visibleIds.has(edge.fromId) && visibleIds.has(edge.toId)), [result.edges, visibleIds]);

  return (
    <div className="relative overflow-auto border-y border-white/8 bg-black/14" data-testid="organizational-topology">
      <div className="sticky left-0 top-0 z-30 flex min-w-full items-center justify-between gap-4 border-b border-white/8 bg-[#06101d]/88 px-5 py-3 backdrop-blur-2xl">
        <div className="flex items-center gap-3"><GitBranch className="h-4 w-4 text-cyan-200/68" /><div><p className="text-xs font-black text-white">Live reporting topology</p><p className="text-[9px] text-cyan-100/38">Edges come from saved explicit or inferred reporting relationships.</p></div></div>
        <div className="flex items-center gap-4 text-[9px] font-bold uppercase tracking-[0.12em] text-cyan-100/34"><span>{people.length} visible people</span><span>{edges.length} visible edges</span></div>
      </div>
      <div className="relative" style={{ width: topology.width, height: topology.height }}>
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(148,210,230,.035)_1px,transparent_1px),linear-gradient(90deg,rgba(148,210,230,.035)_1px,transparent_1px)] bg-[size:48px_48px]" />
        <div className="pointer-events-none absolute inset-x-0 top-0 h-full bg-[radial-gradient(circle_at_50%_20%,rgba(34,211,238,.08),transparent_34%),radial-gradient(circle_at_50%_68%,rgba(124,58,237,.055),transparent_38%)]" />

        {topology.groups.map((group, row) => (
          <div key={group.level} className="pointer-events-none absolute left-6 z-10" style={{ top: 58 + row * 230 }}>
            <p className="text-[8px] font-black uppercase tracking-[0.18em] text-cyan-100/28">{String(row + 1).padStart(2, "0")}</p>
            <p className="mt-1 max-w-[112px] text-[9px] font-black uppercase leading-4 tracking-[0.12em] text-cyan-100/48">{LEVEL_LABELS[group.level]}</p>
          </div>
        ))}

        <svg className="pointer-events-none absolute inset-0 h-full w-full overflow-visible" aria-hidden="true">
          <defs>
            <filter id="org-glow"><feGaussianBlur stdDeviation="2.6" result="blur" /><feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
          </defs>
          {edges.map((edge, index) => {
            const from = topology.positions.get(edge.fromId);
            const to = topology.positions.get(edge.toId);
            if (!from || !to) return null;
            const mid = (from.y + to.y) / 2;
            const selected = selectedId === edge.fromId || selectedId === edge.toId;
            return (
              <path
                key={`${edge.fromId}-${edge.toId}-${index}`}
                d={`M ${from.x} ${from.y + 58} C ${from.x} ${mid}, ${to.x} ${mid}, ${to.x} ${to.y - 58}`}
                fill="none"
                stroke={selected ? "rgba(103,232,249,.72)" : edge.confidence === "confirmed" ? "rgba(110,231,183,.42)" : edge.confidence === "probable" ? "rgba(125,211,252,.34)" : "rgba(251,191,36,.28)"}
                strokeWidth={selected ? 2 : 1.1}
                strokeDasharray={edge.relationship === "inferred-title-hierarchy" ? "5 7" : undefined}
                filter={selected ? "url(#org-glow)" : undefined}
              />
            );
          })}
        </svg>

        {[...topology.positions.values()].map((position) => (
          <TopologyNode key={position.person.id} position={position} selected={selectedId === position.person.id} onSelect={() => onSelect(position.person.id)} />
        ))}
      </div>
    </div>
  );
}

function PersonInspector({ person, result, edges, domain, onClose }: { person: LeadershipPerson | null; result: LeadershipMapResponse; edges: LeadershipEdge[]; domain: string; onClose: () => void }) {
  if (!person) {
    return (
      <aside className="sticky top-4 min-h-[520px] border-l border-white/8 pl-5">
        <div className="grid min-h-[420px] place-items-center text-center"><div><Network className="mx-auto h-8 w-8 text-cyan-100/26" /><h3 className="mt-4 text-lg font-black text-white">Select a person</h3><p className="mt-2 max-w-[260px] text-xs leading-6 text-cyan-100/42">The inspector will show reporting relationships, evidence, location, contact paths, and confidence.</p></div></div>
      </aside>
    );
  }
  const verifiedEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(person.workEmail || "")) ? person.workEmail! : "";
  const candidates = verifiedEmail ? [verifiedEmail] : possibleEmails(person, domain);
  const related = edges.map((edge) => ({ edge, other: result.people.find((candidate) => candidate.id === (edge.fromId === person.id ? edge.toId : edge.fromId)) })).filter((item) => item.other);

  return (
    <aside className="sticky top-4 max-h-[calc(100vh-32px)] overflow-y-auto border-l border-white/8 pl-5 pr-1">
      <div className="flex items-start justify-between gap-4"><div><p className="text-[9px] font-black uppercase tracking-[0.18em] text-cyan-100/36">Selected node</p><h2 className="mt-2 text-2xl font-black tracking-[-0.03em] text-white">{person.name}</h2><p className="mt-1 text-sm leading-6 text-cyan-100/58">{person.title}</p></div><button onClick={onClose} className="rounded-xl border border-white/10 p-2 text-cyan-100/44 hover:text-white"><X className="h-4 w-4" /></button></div>

      <div className="mt-4 flex flex-wrap gap-2"><span className={`rounded-full border px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.1em] ${confidenceTone(person.confidence)}`}>{person.confidence}</span><span className="rounded-full border border-white/10 px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.1em] text-cyan-100/48">{LEVEL_LABELS[person.level]}</span></div>

      <div className="mt-5 divide-y divide-white/7 border-y border-white/7 text-xs">
        <div className="grid grid-cols-[92px_1fr] gap-3 py-3"><span className="text-cyan-100/34">Department</span><strong className="text-cyan-50/78">{person.department || "Not resolved"}</strong></div>
        <div className="grid grid-cols-[92px_1fr] gap-3 py-3"><span className="text-cyan-100/34">Location</span><strong className="text-cyan-50/78">{person.location || "Not resolved"}</strong></div>
        <div className="grid grid-cols-[92px_1fr] gap-3 py-3"><span className="text-cyan-100/34">Evidence</span><strong className="text-cyan-50/78">{person.evidence.length} records</strong></div>
      </div>

      <section className="mt-6"><p className="text-[9px] font-black uppercase tracking-[0.18em] text-cyan-100/34">Reporting relationships</p><div className="mt-3 space-y-2">{related.length ? related.map(({ edge, other }) => <div key={`${edge.fromId}-${edge.toId}`} className="border-l border-cyan-200/18 pl-3"><p className="text-xs font-bold text-white">{other!.name}</p><p className="mt-1 text-[10px] leading-5 text-cyan-100/42">{edge.fromId === person.id ? "Reports toward" : "Reports from"} · {edge.relationship.replaceAll("-", " ")} · {edge.confidence}</p>{edge.note ? <p className="mt-1 text-[10px] leading-5 text-cyan-100/35">{edge.note}</p> : null}</div>) : <p className="text-xs leading-5 text-cyan-100/42">No reporting edge is stored for this person.</p>}</div></section>

      <section className="mt-6"><p className="text-[9px] font-black uppercase tracking-[0.18em] text-cyan-100/34">Professional contact</p><div className="mt-3 flex flex-wrap gap-2"><a href={linkedInUrl(person, result.companyName)} target="_blank" rel="noreferrer" className="inline-flex min-h-9 items-center gap-2 rounded-xl border border-sky-200/16 bg-sky-300/[0.06] px-3 text-[10px] font-bold text-sky-100"><Linkedin className="h-3.5 w-3.5" />LinkedIn</a>{verifiedEmail ? <a href={`mailto:${verifiedEmail}`} className="inline-flex min-h-9 items-center gap-2 rounded-xl border border-emerald-200/16 bg-emerald-300/[0.06] px-3 text-[10px] font-bold text-emerald-100"><Mail className="h-3.5 w-3.5" />{verifiedEmail}</a> : null}</div>{!verifiedEmail && candidates.length ? <div className="mt-3 space-y-2">{candidates.slice(0, 4).map((email) => <a key={email} href={`https://www.google.com/search?q=${encodeURIComponent(`\"${email}\" \"${person.name}\"`)}`} target="_blank" rel="noreferrer" className="flex items-center justify-between gap-3 border-b border-white/7 py-2 text-[10px] text-emerald-100/68"><span className="truncate">{email}</span><span className="shrink-0 text-[8px] font-black uppercase tracking-[0.1em] text-amber-100/50">Possible · verify</span></a>)}</div> : null}</section>

      <section className="mt-6"><div className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-emerald-200/58" /><p className="text-[9px] font-black uppercase tracking-[0.18em] text-cyan-100/34">Evidence</p></div><div className="mt-3 divide-y divide-white/7">{person.evidence.length ? person.evidence.map((evidence, index) => <a key={`${evidence.url}-${index}`} href={evidence.url} target="_blank" rel="noreferrer" className="block py-3"><div className="flex items-start justify-between gap-3"><div><p className="text-[11px] font-bold text-white">{evidence.label}</p><p className="mt-1 text-[9px] uppercase tracking-[0.1em] text-cyan-100/32">{evidence.sourceType}</p></div><ExternalLink className="h-3 w-3 text-cyan-100/30" /></div>{evidence.snippet ? <p className="mt-2 line-clamp-3 text-[10px] leading-5 text-cyan-100/42">{evidence.snippet}</p> : null}</a>) : <p className="text-xs text-cyan-100/42">No person-level evidence records were stored.</p>}</div></section>
    </aside>
  );
}

export default function LeadershipMap() {
  const savedForm = useMemo(loadSavedForm, []);
  const [mode, setMode] = useState<WorkspaceMode>("saved");
  const [companyName, setCompanyName] = useState(savedForm.companyName);
  const [primaryUrl, setPrimaryUrl] = useState(savedForm.primaryUrl);
  const [supportingUrls, setSupportingUrls] = useState(savedForm.supportingUrls);
  const [savedCharts, setSavedCharts] = useState<SavedOrganizationalChart[]>([]);
  const [savedSelection, setSavedSelection] = useState("");
  const [loadingSaved, setLoadingSaved] = useState(true);
  const [result, setResult] = useState<LeadershipMapResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [query, setQuery] = useState("");
  const [confidenceFilter, setConfidenceFilter] = useState<ConfidenceFilter>("all");
  const [selectedPersonId, setSelectedPersonId] = useState<string | null>(null);
  const [contactDomain, setContactDomain] = useState("");
  const [domainInput, setDomainInput] = useState("");
  const [domainSaving, setDomainSaving] = useState(false);

  const loadSavedList = useCallback(async () => {
    setLoadingSaved(true);
    try {
      const response = await getSavedOrganizationalCharts();
      setSavedCharts(response.companies);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Saved organizational charts could not be loaded.");
    } finally {
      setLoadingSaved(false);
    }
  }, []);

  useEffect(() => { void loadSavedList(); }, [loadSavedList]);

  useEffect(() => {
    let active = true;
    if (!result?.entityId) {
      setContactDomain("");
      setDomainInput("");
      return () => { active = false; };
    }
    getLeadershipContactDomain(result.entityId).then((response) => {
      if (!active) return;
      const domain = normalizeDomain(response.domain || "");
      setContactDomain(domain);
      setDomainInput(domain);
    }).catch(() => undefined);
    return () => { active = false; };
  }, [result?.entityId]);

  const visiblePeople = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return (result?.people || []).filter((person) => {
      if (confidenceFilter !== "all" && person.confidence !== confidenceFilter) return false;
      if (!needle) return true;
      return [person.name, person.title, person.department, person.location, person.workEmail]
        .some((value) => String(value || "").toLowerCase().includes(needle));
    });
  }, [confidenceFilter, query, result]);

  const selectedPerson = useMemo(() => result?.people.find((person) => person.id === selectedPersonId) || null, [result, selectedPersonId]);
  const selectedEdges = useMemo(() => selectedPerson ? (result?.edges || []).filter((edge) => edge.fromId === selectedPerson.id || edge.toId === selectedPerson.id) : [], [result, selectedPerson]);

  async function loadSavedChart(entityIdText: string) {
    setSavedSelection(entityIdText);
    if (!entityIdText) return;
    setLoading(true);
    setError("");
    setNotice("");
    try {
      const response = await getSavedOrganizationalChart(Number(entityIdText));
      setResult(response);
      setCompanyName(response.companyName);
      setSelectedPersonId(response.people[0]?.id || null);
      setMode("saved");
      setNotice(`${response.companyName} loaded from Neon.`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Saved organizational chart could not be loaded.");
    } finally {
      setLoading(false);
    }
  }

  async function runAnalysis(refresh = false) {
    const company = companyName.trim();
    if (!company) { setError("Enter a company name."); return; }
    sessionStorage.setItem(SESSION_KEY, JSON.stringify({ companyName, primaryUrl, supportingUrls }));
    setLoading(true);
    setError("");
    setNotice("");
    try {
      const response = await analyzeLeadershipMap({
        companyName: company,
        primaryUrl: primaryUrl.trim() || undefined,
        supportingUrls: supportingUrls.split(/\n+/).map((value) => value.trim()).filter(Boolean),
        refresh,
      });
      setResult(response);
      setSelectedPersonId(response.people[0]?.id || null);
      await loadSavedList();
      if (response.entityId) setSavedSelection(String(response.entityId));
      setMode("saved");
      setNotice(response.cacheHit ? `${response.companyName} opened from its saved Neon chart.` : `${response.companyName} researched, saved, and opened.`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Organizational chart analysis failed.");
    } finally {
      setLoading(false);
    }
  }

  async function saveDomain() {
    if (!result?.entityId) return;
    const domain = normalizeDomain(domainInput);
    if (!domain) { setError("Enter a valid company email domain, such as company.com."); return; }
    setDomainSaving(true);
    setError("");
    try {
      const response = await saveLeadershipContactDomain(result.entityId, domain);
      setContactDomain(response.domain);
      setDomainInput(response.domain);
      setNotice(`Email domain saved as ${response.domain}.`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Email domain could not be saved.");
    } finally {
      setDomainSaving(false);
    }
  }

  function startNew() {
    setMode("new");
    setCompanyName("");
    setPrimaryUrl("");
    setSupportingUrls("");
    setResult(null);
    setSavedSelection("");
    setSelectedPersonId(null);
    setError("");
    setNotice("");
  }

  return (
    <main className="reviewer-native-page min-h-screen pb-16 text-white">
      <Sidebar />
      <section className="relative z-10 px-5 py-8 pt-24 lg:ml-[210px] lg:px-10 lg:pt-8">
        <HeaderBar eyebrow="Organizational Intelligence" title="Organizational Chart" subtitle="A live topology workspace: reporting edges, people, evidence, hierarchy gaps, and contact paths occupy one connected surface." />

        <div className="border-y border-white/8 bg-black/10 py-4">
          <div className="flex flex-col gap-3 2xl:flex-row 2xl:items-end">
            <div className="flex gap-2">
              <button onClick={() => setMode("saved")} className={`inline-flex min-h-10 items-center gap-2 rounded-xl border px-3 text-xs font-bold ${mode === "saved" ? "border-cyan-200/24 bg-cyan-300/10 text-white" : "border-white/8 text-cyan-100/46"}`}><Database className="h-3.5 w-3.5" />Saved</button>
              <button onClick={startNew} className={`inline-flex min-h-10 items-center gap-2 rounded-xl border px-3 text-xs font-bold ${mode === "new" ? "border-violet-200/24 bg-violet-300/10 text-white" : "border-white/8 text-cyan-100/46"}`}><Plus className="h-3.5 w-3.5" />New company</button>
            </div>

            {mode === "saved" ? (
              <label className="min-w-[260px] flex-1"><span className="text-[9px] font-black uppercase tracking-[0.16em] text-cyan-100/34">Company</span><div className="mt-1.5 flex min-h-11 items-center gap-3 rounded-xl border border-white/10 bg-black/20 px-3">{loadingSaved ? <Loader2 className="h-4 w-4 animate-spin text-cyan-100/40" /> : <Building2 className="h-4 w-4 text-cyan-100/40" />}<select value={savedSelection} onChange={(event) => void loadSavedChart(event.target.value)} className="min-w-0 flex-1 appearance-none bg-transparent text-sm font-semibold outline-none"><option value="" className="bg-[#07101d]">Select saved company</option>{savedCharts.map((chart) => <option key={chart.id} value={chart.id} className="bg-[#07101d]">{chart.companyName} · {chart.people} people</option>)}</select></div></label>
            ) : (
              <>
                <label className="min-w-[220px] flex-1"><span className="text-[9px] font-black uppercase tracking-[0.16em] text-violet-100/40">Company name</span><input value={companyName} onChange={(event) => setCompanyName(event.target.value)} onKeyDown={(event) => event.key === "Enter" && void runAnalysis(false)} placeholder="Company name" className="mt-1.5 min-h-11 w-full rounded-xl border border-white/10 bg-black/20 px-3 text-sm outline-none focus:border-violet-200/28" /></label>
                <label className="min-w-[220px] flex-1"><span className="text-[9px] font-black uppercase tracking-[0.16em] text-violet-100/40">Official website</span><input value={primaryUrl} onChange={(event) => setPrimaryUrl(event.target.value)} placeholder="https://company.com" className="mt-1.5 min-h-11 w-full rounded-xl border border-white/10 bg-black/20 px-3 text-sm outline-none focus:border-violet-200/28" /></label>
                <button onClick={() => void runAnalysis(false)} disabled={loading || !companyName.trim()} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-violet-200/22 bg-violet-300/12 px-4 text-xs font-black text-violet-50 disabled:opacity-40">{loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}Build topology</button>
              </>
            )}
          </div>
          {mode === "new" ? <textarea value={supportingUrls} onChange={(event) => setSupportingUrls(event.target.value)} rows={2} placeholder="Optional supporting public URLs — one per line" className="mt-3 w-full rounded-xl border border-white/8 bg-black/16 px-3 py-2 text-xs leading-5 outline-none" /> : null}
          {(error || notice) ? <div className={`mt-3 flex items-start gap-2 border-l-2 pl-3 text-xs leading-5 ${error ? "border-rose-300/50 text-rose-100/76" : "border-emerald-300/50 text-emerald-100/70"}`}>{error ? <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> : <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />}{error || notice}</div> : null}
        </div>

        {result ? (
          <>
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/8 py-4">
              <div className="flex flex-wrap"><Metric label="People" value={result.summary.people} /><Metric label="Confirmed" value={result.summary.confirmed} /><Metric label="Probable" value={result.summary.probable} /><Metric label="Sources" value={result.summary.sourcesAnalyzed} /><Metric label="Gaps" value={result.summary.gaps} /></div>
              <div className="flex flex-wrap items-center gap-2"><button onClick={() => void runAnalysis(true)} disabled={loading} className="inline-flex min-h-9 items-center gap-2 rounded-xl border border-amber-200/14 px-3 text-[10px] font-black text-amber-100/70"><RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />Refresh public sources</button><span className="text-[9px] uppercase tracking-[0.14em] text-cyan-100/30">{result.cacheHit ? "Neon saved chart" : "Fresh build saved to Neon"}</span></div>
            </div>

            <div className="mt-4 grid gap-4 2xl:grid-cols-[minmax(0,1fr)_360px]">
              <div className="min-w-0">
                <div className="mb-3 flex flex-col gap-3 xl:flex-row xl:items-center">
                  <div className="flex min-h-11 min-w-0 flex-1 items-center gap-3 rounded-xl border border-white/9 bg-black/16 px-3"><Search className="h-4 w-4 text-cyan-100/34" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Filter people, title, department, location" className="min-w-0 flex-1 bg-transparent text-sm outline-none" /></div>
                  <div className="flex flex-wrap items-center gap-2"><Filter className="h-4 w-4 text-cyan-100/30" />{(["all", "confirmed", "probable", "inferred"] as ConfidenceFilter[]).map((value) => <button key={value} onClick={() => setConfidenceFilter(value)} className={`rounded-xl border px-3 py-2 text-[10px] font-black uppercase tracking-[0.08em] ${confidenceFilter === value ? "border-cyan-200/22 bg-cyan-300/10 text-white" : "border-white/8 text-cyan-100/40"}`}>{value}</button>)}</div>
                </div>

                <TopologyCanvas result={result} people={visiblePeople} selectedId={selectedPersonId} onSelect={setSelectedPersonId} />

                <div className="mt-4 grid gap-4 lg:grid-cols-2">
                  <section className="border-t border-amber-200/12 pt-4"><div className="flex items-center gap-2"><UsersRound className="h-4 w-4 text-amber-200/60" /><h3 className="text-sm font-black">Hierarchy gaps</h3></div><div className="mt-3 divide-y divide-white/7">{result.gaps.length ? result.gaps.map((gap) => <div key={`${gap.level}-${gap.label}`} className="py-3"><p className="text-xs font-bold text-amber-100/80">{gap.label}</p><p className="mt-1 text-[10px] leading-5 text-cyan-100/42">{gap.reason}</p></div>) : <p className="py-3 text-xs text-cyan-100/42">No standard hierarchy layer is completely absent.</p>}</div></section>
                  <section className="border-t border-emerald-200/12 pt-4"><div className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-emerald-200/60" /><h3 className="text-sm font-black">Evidence inventory</h3></div><div className="mt-3 divide-y divide-white/7">{result.sources.slice(0, 12).map((source) => <a key={`${source.url}-${source.label}`} href={/^https?:\/\//i.test(source.url) ? source.url : undefined} target="_blank" rel="noreferrer" className="flex items-start justify-between gap-3 py-3"><div><p className="text-xs font-bold text-cyan-50/78">{source.label}</p><p className="mt-1 text-[9px] uppercase tracking-[0.11em] text-cyan-100/30">{source.sourceType} · {source.status}</p></div>{/^https?:\/\//i.test(source.url) ? <ExternalLink className="h-3 w-3 text-cyan-100/28" /> : null}</a>)}</div></section>
                </div>
              </div>

              <div>
                <section className="mb-4 border-l border-emerald-200/12 pl-5"><div className="flex items-end gap-2"><label className="min-w-0 flex-1"><span className="text-[9px] font-black uppercase tracking-[0.16em] text-emerald-100/38">Company email domain</span><div className="mt-1.5 flex min-h-10 items-center gap-2 rounded-xl border border-white/9 bg-black/16 px-3"><span className="text-emerald-100/50">@</span><input value={domainInput} onChange={(event) => setDomainInput(event.target.value)} placeholder="company.com" className="min-w-0 flex-1 bg-transparent text-xs outline-none" /></div></label><button onClick={() => void saveDomain()} disabled={domainSaving || !result.entityId} className="min-h-10 rounded-xl border border-emerald-200/15 px-3 text-[10px] font-black text-emerald-100/70">{domainSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Save"}</button></div><p className="mt-2 text-[9px] leading-4 text-cyan-100/30">Generated email possibilities are explicitly marked unverified until public evidence confirms them.</p></section>
                <PersonInspector person={selectedPerson} result={result} edges={selectedEdges} domain={contactDomain} onClose={() => setSelectedPersonId(null)} />
              </div>
            </div>
          </>
        ) : (
          <div className="grid min-h-[540px] place-items-center border-b border-white/8 text-center"><div><Network className="mx-auto h-12 w-12 text-cyan-100/18" /><h2 className="mt-5 text-2xl font-black tracking-[-0.03em] text-white">Open a company to enter its topology.</h2><p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-cyan-100/42">The chart no longer starts as a wall of leadership cards. Once loaded, people become nodes, reporting relationships become edges, and the selected person becomes the persistent inspection context.</p></div></div>
        )}
      </section>
    </main>
  );
}
