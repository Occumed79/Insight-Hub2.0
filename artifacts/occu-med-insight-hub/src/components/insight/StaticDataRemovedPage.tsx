import { ArrowRight, DatabaseZap } from "lucide-react";
import { Link } from "wouter";
import { Sidebar } from "@/components/insight/Sidebar";
import { GlassCard } from "@/components/insight/GlassCard";

export function StaticDataRemovedPage({ title }: { title: string }) {
  return (
    <main className="aurora-bg min-h-screen text-white">
      <Sidebar />
      <section className="relative z-10 flex min-h-screen items-center px-4 py-10 lg:ml-[210px] lg:px-10">
        <GlassCard className="mx-auto w-full max-w-3xl p-8 md:p-12">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-cyan-100/16 bg-cyan-200/[0.07]">
            <DatabaseZap className="h-6 w-6 text-cyan-100" />
          </div>
          <p className="mt-7 text-[10px] font-bold uppercase tracking-[0.24em] text-cyan-100/48">Runtime-only workspace</p>
          <h1 className="mt-3 text-4xl font-black tracking-[-0.045em] text-white md:text-5xl">{title}</h1>
          <p className="mt-5 max-w-2xl text-sm leading-7 text-slate-200/62">
            Committed static employer data has been removed. Employer-specific intelligence now appears only after an explicit manual public-source research action.
          </p>
          <Link
            href="/employer-workflow"
            className="mt-8 inline-flex min-h-11 items-center gap-2 rounded-2xl border border-cyan-200/22 bg-cyan-300/12 px-5 text-sm font-bold text-cyan-50 transition hover:bg-cyan-300/18"
          >
            Open Employer Intelligence
            <ArrowRight className="h-4 w-4" />
          </Link>
        </GlassCard>
      </section>
    </main>
  );
}
