import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Activity, ChevronLeft, ChevronRight, CircleHelp, Globe2, HeartPulse, SlidersHorizontal } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

export type AorSidebarTab = "explore" | "health" | "conditions" | "intel" | "info";

type Props = {
  panes: Record<AorSidebarTab, ReactNode>;
  initialTab?: AorSidebarTab;
  contextLabel?: string;
  statusLabel?: string;
};

const AUTO_HIDE_MS = 300_000;

const TABS: Array<{ id: AorSidebarTab; label: string; icon: typeof Globe2 }> = [
  { id: "explore", label: "Explore", icon: Globe2 },
  { id: "health", label: "Health", icon: HeartPulse },
  { id: "conditions", label: "Conditions", icon: SlidersHorizontal },
  { id: "intel", label: "Intel", icon: Activity },
  { id: "info", label: "Info", icon: CircleHelp },
];

export function AorGlassSidebar({ panes, initialTab = "explore", contextLabel = "Global", statusLabel = "AOR Factors" }: Props) {
  const reduceMotion = useReducedMotion();
  const [activeTab, setActiveTab] = useState<AorSidebarTab>(initialTab);
  const [visible, setVisible] = useState(true);
  const hideTimer = useRef<number | null>(null);

  const scheduleHide = useCallback(() => {
    if (hideTimer.current) window.clearTimeout(hideTimer.current);
    hideTimer.current = window.setTimeout(() => setVisible(false), AUTO_HIDE_MS);
  }, []);

  const markActive = useCallback(() => {
    if (!visible) setVisible(true);
    scheduleHide();
  }, [scheduleHide, visible]);

  useEffect(() => {
    scheduleHide();
    return () => {
      if (hideTimer.current) window.clearTimeout(hideTimer.current);
    };
  }, [scheduleHide]);

  return (
    <>
      <AnimatePresence initial={false}>
        {visible ? (
          <motion.aside
            key="aor-sidebar"
            data-testid="aor-glass-sidebar"
            aria-label="AOR Factors controls"
            initial={reduceMotion ? false : { x: -28, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={reduceMotion ? { opacity: 0 } : { x: -34, opacity: 0 }}
            transition={{ duration: reduceMotion ? 0 : 0.24, ease: [0.22, 1, 0.36, 1] }}
            onPointerEnter={markActive}
            onPointerDown={markActive}
            onKeyDown={markActive}
            className="pointer-events-auto absolute left-4 top-4 z-[80] flex h-[min(760px,calc(100%-2rem))] w-[min(430px,calc(100%-2rem))] overflow-hidden rounded-[30px] border border-white/[0.16] bg-black/15 p-[3px] shadow-[0_30px_90px_rgba(0,0,0,.48),0_0_0_1px_rgba(4,12,20,.55)] backdrop-blur-[38px]"
          >
            <div className="flex min-h-0 w-full flex-col overflow-hidden rounded-[26px] border border-white/[0.08] bg-[#07111b]/58 shadow-[inset_0_1px_0_rgba(255,255,255,.07),inset_0_-1px_0_rgba(0,0,0,.28)] backdrop-blur-3xl">
              <div className="flex shrink-0 items-start justify-between gap-3 px-4 pb-3 pt-4">
                <div className="min-w-0">
                  <p className="text-[9px] font-black uppercase tracking-[.2em] text-cyan-100/38">{statusLabel}</p>
                  <h2 className="mt-1 truncate text-[17px] font-semibold tracking-[-.02em] text-white/92">{contextLabel}</h2>
                </div>
                <button
                  type="button"
                  aria-label="Hide AOR sidebar"
                  onClick={() => setVisible(false)}
                  className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-white/10 bg-white/[.045] text-white/48 transition hover:bg-white/[.09] hover:text-white"
                >
                  <ChevronLeft size={14} />
                </button>
              </div>

              <div role="tablist" aria-label="AOR tool groups" className="mx-3 grid shrink-0 grid-cols-5 gap-1 rounded-[18px] border border-white/[.07] bg-black/20 p-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,.04)]">
                {TABS.map(({ id, label, icon: Icon }) => {
                  const active = activeTab === id;
                  return (
                    <button
                      key={id}
                      type="button"
                      role="tab"
                      aria-selected={active}
                      aria-controls={`aor-tab-${id}`}
                      onClick={() => { setActiveTab(id); markActive(); }}
                      className={`flex min-h-12 flex-col items-center justify-center gap-1 rounded-[13px] border px-1 text-[8px] font-bold transition ${active ? "border-white/13 bg-white/[.095] text-white shadow-[inset_0_1px_0_rgba(255,255,255,.08),0_6px_18px_rgba(0,0,0,.16)]" : "border-transparent text-slate-400 hover:bg-white/[.045] hover:text-slate-100"}`}
                    >
                      <Icon size={14} strokeWidth={1.8} />
                      <span>{label}</span>
                    </button>
                  );
                })}
              </div>

              <div
                id={`aor-tab-${activeTab}`}
                role="tabpanel"
                className="mt-2 min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-5 pt-3 [scrollbar-color:rgba(255,255,255,.16)_transparent] [scrollbar-width:thin]"
              >
                {panes[activeTab]}
              </div>
            </div>
          </motion.aside>
        ) : null}
      </AnimatePresence>

      {!visible ? (
        <motion.button
          data-testid="aor-sidebar-handle"
          type="button"
          aria-label="Show AOR sidebar"
          onClick={() => { setVisible(true); scheduleHide(); }}
          initial={reduceMotion ? false : { x: -12, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          className="pointer-events-auto absolute left-0 top-1/2 z-[85] flex h-20 w-7 -translate-y-1/2 items-center justify-center rounded-r-[18px] border border-l-0 border-white/[0.16] bg-[#07111b]/52 text-white/55 shadow-[0_14px_34px_rgba(0,0,0,.38),inset_0_1px_0_rgba(255,255,255,.08)] backdrop-blur-3xl hover:w-8 hover:text-white"
        >
          <ChevronRight size={15} />
        </motion.button>
      ) : null}
    </>
  );
}

export default AorGlassSidebar;
