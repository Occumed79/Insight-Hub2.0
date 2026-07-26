from pathlib import Path
import re


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if old not in text:
        raise SystemExit(f"{label} marker not found")
    return text.replace(old, new, 1)


page_path = Path("artifacts/occu-med-insight-hub/src/pages/leadership-map.tsx")
page = page_path.read_text()

page = replace_once(page, "  Filter,\n  GitBranch,", "  Filter,\n  GitBranch,\n  Linkedin,", "LinkedIn import")
page = replace_once(page, "  Loader2,\n  Network,", "  Loader2,\n  Mail,\n  Network,", "Mail import")
page = replace_once(
    page,
    "  getSavedOrganizationalCharts,\n",
    "  getSavedOrganizationalCharts,\n  getLeadershipContactDomain,\n  saveLeadershipContactDomain,\n",
    "contact API imports",
)

helper_marker = """function isHttpUrl(value: string | undefined): boolean {
  return Boolean(value && /^https?:\\/\\//i.test(value));
}
"""
helper_code = helper_marker + r'''
type EmailPatternId = "first.last" | "flast" | "firstlast" | "first";

const EMAIL_PATTERNS: EmailPatternId[] = ["first.last", "flast", "firstlast", "first"];

function normalizeContactDomain(value: string | undefined): string {
  const raw = String(value || "").trim().toLowerCase().replace(/^@/, "");
  if (!raw) return "";
  try {
    const parsed = new URL(raw.includes("://") ? raw : `https://${raw}`);
    const hostname = parsed.hostname.replace(/^www\./, "").replace(/\.$/, "");
    return /^[a-z0-9.-]+\.[a-z]{2,}$/i.test(hostname) ? hostname : "";
  } catch {
    return "";
  }
}

function contactNameParts(name: string): { first: string; last: string } | null {
  const cleaned = name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\([^)]*\)/g, " ")
    .replace(/\b(?:dr|gen|adm|mr|mrs|ms|prof|hon)\.?\s+/gi, "")
    .replace(/\b(?:jr|sr|ii|iii|iv|esq|pe|pmp)\.?$/gi, "")
    .replace(/[^a-z0-9' -]/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  const tokens = cleaned
    .split(" ")
    .map((token) => token.replace(/[^a-z0-9]/gi, "").toLowerCase())
    .filter(Boolean);
  if (tokens.length < 2 || tokens[0].length < 2 || tokens[tokens.length - 1].length < 2) return null;
  return { first: tokens[0], last: tokens[tokens.length - 1] };
}

function localPartForPattern(person: LeadershipPerson, pattern: EmailPatternId): string | null {
  const parts = contactNameParts(person.name);
  if (!parts) return null;
  if (pattern === "first.last") return `${parts.first}.${parts.last}`;
  if (pattern === "flast") return `${parts.first[0]}${parts.last}`;
  if (pattern === "firstlast") return `${parts.first}${parts.last}`;
  return parts.first;
}

function detectEmailPattern(people: LeadershipPerson[], domain: string): EmailPatternId | null {
  const normalizedDomain = normalizeContactDomain(domain);
  if (!normalizedDomain) return null;
  const counts = new Map<EmailPatternId, number>();
  for (const person of people) {
    const email = String(person.workEmail || "").trim().toLowerCase();
    const [local, emailDomain] = email.split("@");
    if (!local || emailDomain !== normalizedDomain) continue;
    for (const pattern of EMAIL_PATTERNS) {
      if (localPartForPattern(person, pattern) === local) counts.set(pattern, (counts.get(pattern) || 0) + 1);
    }
  }
  return [...counts.entries()].sort((left, right) => right[1] - left[1])[0]?.[0] || null;
}

function generatedEmailCandidates(person: LeadershipPerson, domain: string, detectedPattern: EmailPatternId | null): string[] {
  const normalizedDomain = normalizeContactDomain(domain);
  if (!normalizedDomain) return [];
  const ordered = detectedPattern
    ? [detectedPattern, ...EMAIL_PATTERNS.filter((pattern) => pattern !== detectedPattern)]
    : EMAIL_PATTERNS;
  return Array.from(new Set(ordered.flatMap((pattern) => {
    const local = localPartForPattern(person, pattern);
    return local ? [`${local}@${normalizedDomain}`] : [];
  })));
}

function linkedInPeopleSearchUrl(person: LeadershipPerson, companyName: string): string {
  if (isHttpUrl(person.linkedinUrl)) return person.linkedinUrl!;
  return `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent([person.name, companyName, person.title].filter(Boolean).join(" "))}`;
}

function publicWorkEmailSearchUrl(person: LeadershipPerson, companyName: string, candidate?: string): string {
  const query = candidate
    ? `"${candidate}" "${person.name}"`
    : `"${person.name}" "${companyName}" "${person.title}" (email OR contact)`;
  return `https://www.google.com/search?q=${encodeURIComponent(query)}`;
}

function ContactActions({
  person,
  companyName,
  contactDomain,
  allPeople,
  compact = false,
}: {
  person: LeadershipPerson;
  companyName: string;
  contactDomain: string;
  allPeople: LeadershipPerson[];
  compact?: boolean;
}) {
  const directLinkedIn = isHttpUrl(person.linkedinUrl);
  const verifiedEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(person.workEmail || "")) ? person.workEmail! : "";
  const detectedPattern = detectEmailPattern(allPeople, contactDomain);
  const candidate = verifiedEmail || generatedEmailCandidates(person, contactDomain, detectedPattern)[0] || "";
  const emailHref = verifiedEmail ? `mailto:${verifiedEmail}` : publicWorkEmailSearchUrl(person, companyName, candidate || undefined);
  const baseClass = compact
    ? "inline-flex min-h-8 min-w-0 items-center gap-1.5 rounded-xl border px-2.5 text-[9px] font-bold transition"
    : "inline-flex min-h-10 min-w-0 items-center gap-2 rounded-2xl border px-4 text-xs font-bold transition";

  return (
    <div className="flex min-w-0 flex-wrap gap-2">
      <a
        href={linkedInPeopleSearchUrl(person, companyName)}
        target="_blank"
        rel="noreferrer"
        onClick={(event) => event.stopPropagation()}
        className={`${baseClass} border-sky-200/18 bg-sky-300/[0.07] text-sky-100 hover:border-sky-200/34 hover:bg-sky-300/[0.13]`}
        title={directLinkedIn ? "Open the saved LinkedIn profile" : "Search LinkedIn by name, company, and title"}
      >
        <Linkedin className={compact ? "h-3 w-3 shrink-0" : "h-4 w-4 shrink-0"} />
        {compact ? "LinkedIn" : directLinkedIn ? "LinkedIn profile" : "LinkedIn search"}
      </a>
      <a
        href={emailHref}
        target={verifiedEmail ? undefined : "_blank"}
        rel={verifiedEmail ? undefined : "noreferrer"}
        onClick={(event) => event.stopPropagation()}
        className={`${baseClass} max-w-full border-emerald-200/18 bg-emerald-300/[0.07] text-emerald-100 hover:border-emerald-200/34 hover:bg-emerald-300/[0.13]`}
        title={verifiedEmail ? `Email ${verifiedEmail}` : candidate ? `Possible work email — verify before use: ${candidate}` : "Search public sources for a professional work email"}
      >
        <Mail className={compact ? "h-3 w-3 shrink-0" : "h-4 w-4 shrink-0"} />
        <span className="truncate">{verifiedEmail || candidate || (compact ? "Find email" : "Find work email")}</span>
      </a>
    </div>
  );
}

function EmailOptionsPanel({ person, companyName, contactDomain, allPeople }: {
  person: LeadershipPerson;
  companyName: string;
  contactDomain: string;
  allPeople: LeadershipPerson[];
}) {
  const verifiedEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(person.workEmail || "")) ? person.workEmail! : "";
  const detectedPattern = detectEmailPattern(allPeople, contactDomain);
  const candidates = verifiedEmail ? [verifiedEmail] : generatedEmailCandidates(person, contactDomain, detectedPattern);
  return (
    <section className="mt-5 rounded-[22px] border border-cyan-100/11 bg-black/16 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-cyan-100/34">Professional contact options</p>
          <p className="mt-1 text-[11px] leading-5 text-cyan-100/44">
            {verifiedEmail
              ? "This work email is stored as a verified contact."
              : detectedPattern
                ? "The first candidate follows an email pattern already observed for this company. Verify before use."
                : contactDomain
                  ? "These are domain-based possibilities, not verified addresses."
                  : "Set the company email domain to generate possible work-email formats."}
          </p>
        </div>
        <ContactActions person={person} companyName={companyName} contactDomain={contactDomain} allPeople={allPeople} />
      </div>
      {candidates.length > 0 && (
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          {candidates.slice(0, 4).map((email, index) => (
            <a
              key={email}
              href={verifiedEmail ? `mailto:${email}` : publicWorkEmailSearchUrl(person, companyName, email)}
              target={verifiedEmail ? undefined : "_blank"}
              rel={verifiedEmail ? undefined : "noreferrer"}
              className="flex min-w-0 items-center justify-between gap-3 rounded-2xl border border-emerald-100/10 bg-emerald-300/[0.035] px-3 py-2.5 text-xs text-emerald-50 transition hover:border-emerald-200/24 hover:bg-emerald-300/[0.08]"
            >
              <span className="truncate font-semibold">{email}</span>
              <span className="shrink-0 text-[8px] font-bold uppercase tracking-[0.13em] text-emerald-100/48">
                {verifiedEmail ? "Verified" : detectedPattern && index === 0 ? "Pattern match" : "Possible"}
              </span>
            </a>
          ))}
        </div>
      )}
    </section>
  );
}
'''
page = replace_once(page, helper_marker, helper_code, "contact helpers")

person_pattern = re.compile(r"function PersonNode\(\{ person, onOpen \}: \{ person: LeadershipPerson; onOpen: \(\) => void \}\) \{.*?\n\}\n\nfunction HierarchyLayer", re.S)
person_code = r'''function PersonNode({ person, companyName, contactDomain, allPeople, onOpen }: {
  person: LeadershipPerson;
  companyName: string;
  contactDomain: string;
  allPeople: LeadershipPerson[];
  onOpen: () => void;
}) {
  const theme = LEVEL_THEME[person.level];
  return (
    <div className={`group relative flex min-h-[192px] w-full max-w-[282px] flex-col overflow-hidden rounded-[24px] border p-4 text-left backdrop-blur-2xl transition duration-300 hover:-translate-y-1 ${theme.card}`}>
      <div className={`pointer-events-none absolute inset-x-7 top-0 h-px bg-gradient-to-r ${theme.line}`} />
      <button type="button" onClick={onOpen} className="w-full flex-1 text-left">
        <div className="flex items-start justify-between gap-3">
          <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl border backdrop-blur-xl ${theme.icon}`}>
            <UserRound className="h-4 w-4" />
          </div>
          <span className={`rounded-full border px-2 py-1 text-[8px] font-bold uppercase tracking-[0.14em] ${confidenceClass(person.confidence)}`}>
            {CONFIDENCE_LABELS[person.confidence]}
          </span>
        </div>
        <p className="mt-4 text-[9px] font-bold uppercase leading-4 tracking-[0.17em] text-cyan-50/48">{person.title}</p>
        <h3 className="mt-1.5 text-[16px] font-black leading-5 tracking-[-0.015em] text-white">{person.name}</h3>
        <div className="mt-3 flex items-center justify-between gap-3 text-[10px] text-cyan-100/38">
          <span className="truncate">{person.department || person.location || "Organizational role"}</span>
          <ChevronRight className="h-4 w-4 shrink-0 transition group-hover:translate-x-0.5" />
        </div>
      </button>
      <div className="mt-3 border-t border-cyan-100/9 pt-3">
        <ContactActions person={person} companyName={companyName} contactDomain={contactDomain} allPeople={allPeople} compact />
      </div>
    </div>
  );
}

function HierarchyLayer'''
page, count = person_pattern.subn(person_code, page, count=1)
if count != 1:
    raise SystemExit(f"PersonNode replacement count was {count}")

hierarchy_pattern = re.compile(r"function HierarchyLayer\(\{.*?\n\}\n\nfunction Metric", re.S)
hierarchy_code = r'''function HierarchyLayer({ level, people, index, companyName, contactDomain, allPeople, onOpen }: {
  level: LeadershipLevel;
  people: LeadershipPerson[];
  index: number;
  companyName: string;
  contactDomain: string;
  allPeople: LeadershipPerson[];
  onOpen: (personId: string) => void;
}) {
  const theme = LEVEL_THEME[level];
  return (
    <section className="relative pb-10 last:pb-1">
      {index > 0 && <div className="mx-auto h-9 w-px bg-gradient-to-b from-cyan-100/8 via-cyan-200/30 to-cyan-100/8 shadow-[0_0_14px_rgba(103,232,249,.14)]" />}
      <div className={`mx-auto flex w-fit items-center gap-3 rounded-full border px-4 py-2 backdrop-blur-xl ${theme.badge}`}>
        <span className="h-1.5 w-1.5 rounded-full bg-current shadow-[0_0_12px_currentColor]" />
        <span className="text-[9px] font-black uppercase tracking-[0.2em]">{LEVEL_LABELS[level]}</span>
        <span className="border-l border-current/20 pl-3 text-[10px] font-bold opacity-65">{people.length}</span>
      </div>
      <div className="mx-auto h-5 w-px bg-gradient-to-b from-cyan-100/28 to-transparent" />
      <div className="relative mx-auto max-w-[1260px]">
        {people.length > 1 && <div className={`absolute left-[9%] right-[9%] top-0 hidden h-px bg-gradient-to-r sm:block ${theme.line}`} />}
        <div className="flex flex-wrap justify-center gap-4 pt-5">
          {people.map((person) => (
            <div key={person.id} className="relative flex w-full max-w-[282px] justify-center">
              {people.length > 1 && <div className="absolute -top-5 left-1/2 hidden h-5 w-px bg-cyan-100/18 sm:block" />}
              <PersonNode person={person} companyName={companyName} contactDomain={contactDomain} allPeople={allPeople} onOpen={() => onOpen(person.id)} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Metric'''
page, count = hierarchy_pattern.subn(hierarchy_code, page, count=1)
if count != 1:
    raise SystemExit(f"HierarchyLayer replacement count was {count}")

state_marker = "  const [selectedPersonId, setSelectedPersonId] = useState<string | null>(null);\n"
state_addition = state_marker + """  const [contactDomain, setContactDomain] = useState("");
  const [domainInput, setDomainInput] = useState("");
  const [domainLoading, setDomainLoading] = useState(false);
  const [domainSaving, setDomainSaving] = useState(false);
"""
page = replace_once(page, state_marker, state_addition, "contact state")

saved_effect_marker = "  useEffect(() => {\n    void loadSavedList();\n  }, [loadSavedList]);\n"
saved_effect_addition = saved_effect_marker + r'''
  useEffect(() => {
    let active = true;
    if (!result?.entityId) {
      setContactDomain("");
      setDomainInput("");
      return () => { active = false; };
    }
    setDomainLoading(true);
    getLeadershipContactDomain(result.entityId)
      .then((response) => {
        if (!active) return;
        const domain = normalizeContactDomain(response.domain || "");
        setContactDomain(domain);
        setDomainInput(domain);
      })
      .catch(() => {
        if (!active) return;
        setContactDomain("");
        setDomainInput("");
      })
      .finally(() => { if (active) setDomainLoading(false); });
    return () => { active = false; };
  }, [result?.entityId]);
'''
page = replace_once(page, saved_effect_marker, saved_effect_addition, "saved list effect")
page = replace_once(
    page,
    "[person.name, person.title, person.department, person.location]",
    "[person.name, person.title, person.department, person.location, person.workEmail]",
    "person filter",
)

clear_marker = "  function clearWorkspace() {\n"
save_handler = r'''  async function saveContactDomain() {
    if (!result?.entityId) return;
    const domain = normalizeContactDomain(domainInput);
    if (!domain) {
      setError("Enter a valid company email domain, such as company.com.");
      return;
    }
    setDomainSaving(true);
    setError(null);
    try {
      const response = await saveLeadershipContactDomain(result.entityId, domain);
      setContactDomain(response.domain);
      setDomainInput(response.domain);
      setNotice(`Email domain saved as ${response.domain}. Possible work-email formats are now available for this chart.`);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "The company email domain could not be saved.");
    } finally {
      setDomainSaving(false);
    }
  }

  function clearWorkspace() {
'''
page = replace_once(page, clear_marker, save_handler, "save domain handler")

hierarchy_usage_marker = """                          people={group.people}
                          index={groupIndex}
                          onOpen={setSelectedPersonId}
"""
hierarchy_usage_new = """                          people={group.people}
                          index={groupIndex}
                          companyName={result.companyName}
                          contactDomain={contactDomain}
                          allPeople={result.people}
                          onOpen={setSelectedPersonId}
"""
page = replace_once(page, hierarchy_usage_marker, hierarchy_usage_new, "hierarchy usage")

summary_marker = """            </div>

            {result.providerDiagnostics && result.providerDiagnostics.length > 0 && (
"""
domain_panel = r'''            </div>

            <GlassCard variant="glass" className="mt-4 rounded-[24px] border border-emerald-100/13 bg-[#06101d]/58 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,.08)]">
              <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
                <label className="min-w-0 flex-1">
                  <span className="flex items-center gap-2 text-[9px] font-bold uppercase tracking-[0.19em] text-emerald-100/42"><Mail className="h-3.5 w-3.5" />Company email domain</span>
                  <div className="mt-2 flex min-h-11 items-center gap-3 rounded-2xl border border-emerald-100/13 bg-black/18 px-4 focus-within:border-emerald-200/28">
                    {domainLoading ? <Loader2 className="h-4 w-4 animate-spin text-emerald-200/52" /> : <span className="text-sm font-black text-emerald-100/52">@</span>}
                    <input value={domainInput} onChange={(event) => setDomainInput(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void saveContactDomain(); }} placeholder="company.com" className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-emerald-100/24" />
                  </div>
                </label>
                <button type="button" onClick={() => void saveContactDomain()} disabled={domainSaving || !result.entityId} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-emerald-200/20 bg-emerald-300/[0.09] px-4 text-xs font-bold text-emerald-100 transition hover:bg-emerald-300/[0.14] disabled:opacity-45">
                  {domainSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                  Save domain
                </button>
              </div>
              <p className="mt-2 text-[10px] leading-5 text-emerald-100/36">A stored domain generates possible work-email formats from each person’s name. Candidates remain labeled as possible until public evidence confirms them.</p>
            </GlassCard>

            {result.providerDiagnostics && result.providerDiagnostics.length > 0 && (
'''
page = replace_once(page, summary_marker, domain_panel, "domain panel")

drawer_marker = "            {selectedPerson.bio && (\n"
drawer_new = "            <EmailOptionsPanel person={selectedPerson} companyName={result?.companyName || companyName} contactDomain={contactDomain} allPeople={result?.people || []} />\n\n" + drawer_marker
page = replace_once(page, drawer_marker, drawer_new, "email drawer")
page_path.write_text(page)

api_path = Path("artifacts/occu-med-insight-hub/src/data/leadershipMapApi.ts")
api = api_path.read_text()
api = replace_once(
    api,
    "  bio?: string;\n  confidence: LeadershipConfidence;",
    "  bio?: string;\n  linkedinUrl?: string;\n  workEmail?: string;\n  emailSourceUrl?: string;\n  confidence: LeadershipConfidence;",
    "LeadershipPerson contact fields",
)
api_end = """export async function getSavedOrganizationalChart(entityId: number): Promise<LeadershipMapResponse> {
  const response = await fetch(`/api/leadership-map/saved/${entityId}`);
  return readJson<LeadershipMapResponse>(response);
}
"""
api_new = api_end + r'''

export async function getLeadershipContactDomain(entityId: number): Promise<{ ok: true; domain: string | null; source: "saved" | "derived" | "none" }> {
  const response = await fetch(`/api/leadership-map/contact-domain/${entityId}`);
  return readJson<{ ok: true; domain: string | null; source: "saved" | "derived" | "none" }>(response);
}

export async function saveLeadershipContactDomain(entityId: number, domain: string): Promise<{ ok: true; domain: string; source: "saved" }> {
  const response = await fetch(`/api/leadership-map/contact-domain/${entityId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ domain }),
  });
  return readJson<{ ok: true; domain: string; source: "saved" }>(response);
}
'''
api = replace_once(api, api_end, api_new, "contact API functions")
api_path.write_text(api)

route_path = Path("artifacts/api-server/src/routes/leadership-map-manual-snapshots.ts")
route = route_path.read_text()
manual_helper = """function isManualSnapshot(snapshot: SavedSnapshot): boolean {
  const sourceInputs = objectMetadata(snapshot.sourceInputs);
  return typeof sourceInputs.manualFile === "string"
    || sourceInputs.manualSimpleImport === true;
}
"""
route_helpers = manual_helper + r'''

function domainFromValue(value: unknown): string | null {
  const raw = String(value || "").trim().toLowerCase().replace(/^@/, "");
  if (!raw) return null;
  try {
    const url = new URL(raw.includes("://") ? raw : `https://${raw}`);
    const hostname = url.hostname.replace(/^www\./, "").replace(/\.$/, "");
    return /^[a-z0-9.-]+\.[a-z]{2,}$/i.test(hostname) ? hostname : null;
  } catch {
    return null;
  }
}

function contactDomainFromMetadata(metadata: Record<string, unknown>): { domain: string | null; source: "saved" | "derived" | "none" } {
  const saved = domainFromValue(metadata.organizationalContactDomain);
  if (saved) return { domain: saved, source: "saved" };
  const chart = objectMetadata(metadata[SNAPSHOT_KEY] || metadata.organizational_chart);
  const sourceInputs = objectMetadata(chart.sourceInputs);
  for (const candidate of [sourceInputs.primaryUrl, metadata.officialWebsite, metadata.website, metadata.domain]) {
    const domain = domainFromValue(candidate);
    if (domain) return { domain, source: "derived" };
  }
  const result = objectMetadata(chart.result);
  const sources = Array.isArray(result.sources) ? result.sources : [];
  for (const source of sources) {
    const row = objectMetadata(source);
    if (String(row.sourceType || "") !== "official") continue;
    const domain = domainFromValue(row.url);
    if (domain) return { domain, source: "derived" };
  }
  return { domain: null, source: "none" };
}
'''
route = replace_once(route, manual_helper, route_helpers, "contact domain helpers")
route_end = "\nexport default router;\n"
contact_routes = r'''

router.get("/leadership-map/contact-domain/:entityId", async (req: Request, res: Response) => {
  const entityId = Number(req.params.entityId);
  if (!Number.isInteger(entityId)) {
    res.status(400).json({ error: "A valid company ID is required." });
    return;
  }
  try {
    const [entity] = await db.select().from(entitiesTable).where(eq(entitiesTable.id, entityId)).limit(1);
    if (!entity) {
      res.status(404).json({ error: "The saved company was not found." });
      return;
    }
    res.json({ ok: true, ...contactDomainFromMetadata(objectMetadata(entity.metadata)) });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "The company email domain could not be loaded." });
  }
});

router.put("/leadership-map/contact-domain/:entityId", async (req: Request, res: Response) => {
  const entityId = Number(req.params.entityId);
  const domain = domainFromValue(req.body?.domain);
  if (!Number.isInteger(entityId) || !domain) {
    res.status(400).json({ error: "A valid company ID and email domain are required." });
    return;
  }
  try {
    const [entity] = await db.select().from(entitiesTable).where(eq(entitiesTable.id, entityId)).limit(1);
    if (!entity) {
      res.status(404).json({ error: "The saved company was not found." });
      return;
    }
    await db.update(entitiesTable).set({
      metadata: { ...objectMetadata(entity.metadata), organizationalContactDomain: domain },
      updatedAt: new Date(),
    }).where(eq(entitiesTable.id, entityId));
    res.json({ ok: true, domain, source: "saved" });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "The company email domain could not be saved." });
  }
});
'''
route = replace_once(route, route_end, contact_routes + route_end, "contact routes")
route_path.write_text(route)
