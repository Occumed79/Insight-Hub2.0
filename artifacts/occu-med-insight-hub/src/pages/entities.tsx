import { useState, type ElementType, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import {
  Building2,
  CalendarDays,
  ExternalLink,
  MapPin,
  Search,
  Target,
  TrendingUp,
  UserRoundSearch,
  Users,
  X,
} from "lucide-react";
import { HeaderBar } from "@/components/insight/HeaderBar";
import { Sidebar } from "@/components/insight/Sidebar";
import { GlassCard } from "@/components/insight/GlassCard";
import { cn } from "@/lib/utils";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
const api = (path: string) => `${BASE}/api/${path}`;

async function fetchJson<T>(path: string): Promise<T> {
  const response = await fetch(api(path), { cache: "no-store" });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(
      typeof body?.error === "string"
        ? body.error
        : `Request failed with HTTP ${response.status}`,
    );
  }
  return body as T;
}

function parseList(value?: string | null): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }
}

function formatDate(value?: string | null): string {
  if (!value) return "Not reported";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
}

function WorkspaceShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen overflow-x-hidden bg-[#020817] text-white">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_18%_18%,rgba(13,148,136,.38),transparent_34%),radial-gradient(circle_at_52%_48%,rgba(14,165,233,.30),transparent_40%),radial-gradient(circle_at_88%_28%,rgba(79,70,229,.30),transparent_34%),radial-gradient(circle_at_72%_88%,rgba(139,92,246,.25),transparent_38%),linear-gradient(145deg,#020817_8%,#06243b_46%,#071333_70%,#0b0824)]" />
      <div className="pointer-events-none fixed inset-0 opacity-40 [background-image:linear-gradient(rgba(255,255,255,.018)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.018)_1px,transparent_1px)] [background-size:46px_46px]" />
      <Sidebar />
      <main className="relative min-h-screen px-5 py-8 sm:px-8 lg:ml-[210px] lg:px-10 xl:px-14">
        <HeaderBar
          eyebrow="Company Intelligence"
          title="Entities"
          subtitle="Prospect profiles and client records transferred from the procurement hub and owned here in Insight Hub 2."
        />
        {children}
      </main>
    </div>
  );
}

function MetricCard({
  icon: Icon,
  value,
  label,
}: {
  icon: ElementType;
  value: number;
  label: string;
}) {
  return (
    <GlassCard variant="glass" className="flex items-center gap-4 p-5">
      <div className="grid h-11 w-11 place-items-center rounded-2xl border border-cyan-100/12 bg-cyan-300/8 text-cyan-100/75">
        <Icon size={19} />
      </div>
      <div>
        <p className="text-2xl font-black tracking-tight text-white">{value}</p>
        <p className="text-xs text-cyan-100/42">{label}</p>
      </div>
    </GlassCard>
  );
}

function LoadingCard({ label }: { label: string }) {
  return (
    <GlassCard variant="glass" className="p-8 text-sm text-cyan-100/50" role="status" aria-live="polite">
      Loading {label}…
    </GlassCard>
  );
}

function ErrorCard({ error }: { error: unknown }) {
  return (
    <GlassCard variant="glass" className="border-rose-300/20 p-8 text-sm text-rose-100/80" role="alert">
      {error instanceof Error ? error.message : "This workspace could not be loaded."}
    </GlassCard>
  );
}

function EmptyCard({ children }: { children: ReactNode }) {
  return (
    <GlassCard variant="glass" className="p-8 text-sm text-cyan-100/54" role="status">
      {children}
    </GlassCard>
  );
}

function Drawer({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <DialogPrimitive.Root open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-[1000] bg-black/50 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0" />
        <DialogPrimitive.Content className="fixed inset-y-0 right-0 z-[1001] h-dvh w-full max-w-[520px] overflow-y-auto border-l border-cyan-100/14 bg-[#04101d]/97 p-6 text-white shadow-[-30px_0_90px_rgba(0,0,0,.58)] outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:slide-in-from-right data-[state=closed]:slide-out-to-right">
          <div className="mb-7 flex items-start justify-between gap-5">
            <div>
              <p className="text-xs uppercase tracking-[.24em] text-cyan-100/38">Intelligence Record</p>
              <DialogPrimitive.Title className="mt-2 text-2xl font-black">{title}</DialogPrimitive.Title>
            </div>
            <DialogPrimitive.Close asChild>
              <button
                type="button"
                aria-label="Close details"
                className="rounded-xl border border-white/8 bg-white/[0.035] p-2 text-cyan-100/45 hover:text-white"
              >
                <X size={18} />
              </button>
            </DialogPrimitive.Close>
          </div>
          <div className="space-y-4">{children}</div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

function Info({
  label,
  value,
  link = false,
}: {
  label: string;
  value?: string | null;
  link?: boolean;
}) {
  if (!value) return null;
  return (
    <div className="rounded-2xl border border-white/8 bg-white/[0.025] p-4">
      <p className="text-[10px] uppercase tracking-[.2em] text-cyan-100/34">{label}</p>
      {link ? (
        <a
          href={value}
          target="_blank"
          rel="noreferrer"
          className="mt-2 flex items-center gap-2 break-all text-sm text-cyan-200/75 hover:text-white"
        >
          {value}
          <ExternalLink size={13} />
        </a>
      ) : (
        <p className="mt-2 text-sm text-white/80">{value}</p>
      )}
    </div>
  );
}

function Tags({ title, values }: { title: string; values: string[] }) {
  if (!values.length) return null;
  return (
    <section className="rounded-2xl border border-white/8 bg-white/[0.025] p-4">
      <h3 className="text-sm font-bold">{title}</h3>
      <div className="mt-3 flex flex-wrap gap-2">
        {values.map((value, index) => (
          <span
            key={`${value}-${index}`}
            className="rounded-full border border-cyan-100/10 bg-cyan-300/6 px-3 py-1.5 text-xs text-cyan-100/55"
          >
            {value}
          </span>
        ))}
      </div>
    </section>
  );
}

type Prospect = {
  id: string;
  name: string;
  website?: string | null;
  description?: string | null;
  industry?: string | null;
  headquarters?: string | null;
  employeeCount?: string | null;
  status: string;
  tier: string;
  researchSummary?: string | null;
  opportunitySignals?: string | null;
  lastResearched?: string | null;
};

type Client = {
  id: string;
  name: string;
  website?: string | null;
  industry?: string | null;
  headquarters?: string | null;
  overallHiringTrend?: string | null;
  branches?: Array<{
    id: string;
    name?: string | null;
    city?: string | null;
    state?: string | null;
    country: string;
  }>;
  contacts?: Array<{
    id: string;
    name: string;
    title?: string | null;
    email?: string | null;
  }>;
};

export function EntitiesPage({
  defaultTab = "prospects",
}: {
  defaultTab?: "prospects" | "clients";
}) {
  const [tab, setTab] = useState<"prospects" | "clients">(defaultTab);
  const [query, setQuery] = useState("");
  const [selectedProspect, setSelectedProspect] = useState<Prospect | null>(null);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);

  const prospectsQ = useQuery({
    queryKey: ["core-prospects"],
    queryFn: () => fetchJson<{ prospects: Prospect[] }>("prospects"),
  });
  const clientsQ = useQuery({
    queryKey: ["core-clients"],
    queryFn: () => fetchJson<{ clients: Client[] }>("clients"),
  });

  const prospects = prospectsQ.data?.prospects ?? [];
  const clients = clientsQ.data?.clients ?? [];
  const needle = query.trim().toLowerCase();
  const filteredProspects = prospects.filter(
    (item) =>
      !needle ||
      `${item.name} ${item.industry ?? ""} ${item.headquarters ?? ""}`
        .toLowerCase()
        .includes(needle),
  );
  const filteredClients = clients.filter(
    (item) =>
      !needle ||
      `${item.name} ${item.industry ?? ""} ${item.headquarters ?? ""}`
        .toLowerCase()
        .includes(needle),
  );

  return (
    <WorkspaceShell>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex gap-2 rounded-2xl border border-cyan-100/10 bg-[#071321]/72 p-1.5" role="tablist" aria-label="Entity record type">
          <button
            type="button"
            role="tab"
            aria-selected={tab === "prospects"}
            aria-controls="entities-prospects-panel"
            onClick={() => setTab("prospects")}
            className={cn(
              "rounded-xl px-4 py-2 text-sm",
              tab === "prospects" ? "bg-cyan-300/16 text-white" : "text-cyan-100/45",
            )}
          >
            Prospect Profiles
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === "clients"}
            aria-controls="entities-clients-panel"
            onClick={() => setTab("clients")}
            className={cn(
              "rounded-xl px-4 py-2 text-sm",
              tab === "clients" ? "bg-cyan-300/16 text-white" : "text-cyan-100/45",
            )}
          >
            Client Records
          </button>
        </div>
        <label className="flex w-full min-w-0 items-center gap-2 rounded-2xl border border-cyan-100/12 bg-[#071321]/82 px-4 py-2.5 sm:w-auto sm:min-w-[260px]">
          <span className="sr-only">Search {tab}</span>
          <Search size={16} className="shrink-0 text-cyan-100/45" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="w-full min-w-0 bg-transparent text-sm outline-none placeholder:text-cyan-100/28"
            placeholder={`Search ${tab}…`}
          />
        </label>
      </div>

      {tab === "prospects" ? (
        <div id="entities-prospects-panel" role="tabpanel">
          <div className="mb-6 grid gap-4 md:grid-cols-3">
            <MetricCard icon={Target} value={prospects.length} label="Tracked prospects" />
            <MetricCard
              icon={UserRoundSearch}
              value={prospects.filter((item) => item.lastResearched || item.researchSummary).length}
              label="Researched"
            />
            <MetricCard
              icon={TrendingUp}
              value={prospects.filter((item) => item.opportunitySignals).length}
              label="Opportunity signals"
            />
          </div>
          {prospectsQ.isLoading ? (
            <LoadingCard label="prospects" />
          ) : prospectsQ.error ? (
            <ErrorCard error={prospectsQ.error} />
          ) : prospects.length === 0 ? (
            <EmptyCard>No prospect records are available yet.</EmptyCard>
          ) : filteredProspects.length === 0 ? (
            <EmptyCard>No prospects match “{query.trim()}”.</EmptyCard>
          ) : (
            <div className="grid gap-4 xl:grid-cols-2">
              {filteredProspects.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setSelectedProspect(item)}
                  className="block w-full rounded-[28px] text-left"
                  aria-label={`Open details for ${item.name}`}
                >
                  <GlassCard
                    variant="glass"
                    className="h-full cursor-pointer p-5 transition hover:border-cyan-200/28"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="mb-2 flex gap-2 text-[10px] uppercase tracking-wider text-cyan-100/55">
                          <span>{item.tier}</span><span>·</span><span>{item.status}</span>
                        </div>
                        <h2 className="text-lg font-bold">{item.name}</h2>
                        <p className="mt-1 text-sm text-cyan-100/45">{item.industry || "Industry not reported"}</p>
                      </div>
                      <Target size={20} className="shrink-0 text-cyan-200/50" />
                    </div>
                    <div className="mt-4 flex flex-wrap gap-4 text-xs text-cyan-100/40">
                      {item.headquarters ? <span className="flex items-center gap-1"><MapPin size={13} />{item.headquarters}</span> : null}
                      <span className="flex items-center gap-1"><CalendarDays size={13} />{item.lastResearched ? formatDate(item.lastResearched) : "Not researched"}</span>
                    </div>
                  </GlassCard>
                </button>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div id="entities-clients-panel" role="tabpanel">
          <div className="mb-6 grid gap-4 md:grid-cols-3">
            <MetricCard icon={Building2} value={clients.length} label="Client records" />
            <MetricCard
              icon={MapPin}
              value={clients.reduce((sum, item) => sum + (item.branches?.length ?? 0), 0)}
              label="Known branches"
            />
            <MetricCard
              icon={Users}
              value={clients.reduce((sum, item) => sum + (item.contacts?.length ?? 0), 0)}
              label="Saved contacts"
            />
          </div>
          {clientsQ.isLoading ? (
            <LoadingCard label="clients" />
          ) : clientsQ.error ? (
            <ErrorCard error={clientsQ.error} />
          ) : clients.length === 0 ? (
            <EmptyCard>No client records are available yet.</EmptyCard>
          ) : filteredClients.length === 0 ? (
            <EmptyCard>No clients match “{query.trim()}”.</EmptyCard>
          ) : (
            <div className="grid gap-4 xl:grid-cols-2">
              {filteredClients.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setSelectedClient(item)}
                  className="block w-full rounded-[28px] text-left"
                  aria-label={`Open details for ${item.name}`}
                >
                  <GlassCard
                    variant="glass"
                    className="h-full cursor-pointer p-5 transition hover:border-cyan-200/28"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h2 className="text-lg font-bold">{item.name}</h2>
                        <p className="mt-1 text-sm text-cyan-100/45">{item.industry || "Industry not reported"}</p>
                      </div>
                      <Building2 size={20} className="shrink-0 text-emerald-200/55" />
                    </div>
                    <div className="mt-5 grid grid-cols-1 gap-3 text-center text-xs sm:grid-cols-3">
                      <div className="rounded-xl border border-white/7 p-3"><b className="text-lg">{item.branches?.length ?? 0}</b><p className="text-cyan-100/38">Branches</p></div>
                      <div className="rounded-xl border border-white/7 p-3"><b className="text-lg">{item.contacts?.length ?? 0}</b><p className="text-cyan-100/38">Contacts</p></div>
                      <div className="rounded-xl border border-white/7 p-3"><b className="capitalize">{item.overallHiringTrend || "Unknown"}</b><p className="text-cyan-100/38">Hiring</p></div>
                    </div>
                  </GlassCard>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {selectedProspect ? (
        <Drawer title={selectedProspect.name} onClose={() => setSelectedProspect(null)}>
          <Info label="Industry" value={selectedProspect.industry} />
          <Info label="Headquarters" value={selectedProspect.headquarters} />
          <Info label="Employees" value={selectedProspect.employeeCount} />
          <Info label="Website" value={selectedProspect.website} link />
          <Info label="Research summary" value={selectedProspect.researchSummary || selectedProspect.description} />
          <Tags title="Opportunity signals" values={parseList(selectedProspect.opportunitySignals)} />
        </Drawer>
      ) : null}

      {selectedClient ? (
        <Drawer title={selectedClient.name} onClose={() => setSelectedClient(null)}>
          <Info label="Industry" value={selectedClient.industry} />
          <Info label="Headquarters" value={selectedClient.headquarters} />
          <Info label="Website" value={selectedClient.website} link />
          <Tags
            title="Branches"
            values={(selectedClient.branches ?? []).map((branch) =>
              [branch.name, branch.city, branch.state, branch.country].filter(Boolean).join(" · "),
            )}
          />
          <Tags
            title="Contacts"
            values={(selectedClient.contacts ?? []).map((contact) =>
              [contact.name, contact.title, contact.email].filter(Boolean).join(" · "),
            )}
          />
        </Drawer>
      ) : null}
    </WorkspaceShell>
  );
}
