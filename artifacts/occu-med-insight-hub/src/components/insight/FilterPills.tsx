import { cn } from "@/lib/utils";

export function FilterPills<T extends string>({ options, value, onChange }: { options: T[]; value: T; onChange: (value: T) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((option) => (
        <button key={option} onClick={() => onChange(option)} className={cn("rounded-full border px-4 py-2 text-xs font-semibold transition", value === option ? "border-cyan-200/50 bg-cyan-200/15 text-cyan-50 shadow-[0_0_24px_rgba(34,211,238,.14)]" : "border-cyan-200/10 bg-white/[0.03] text-cyan-100/55 hover:border-cyan-200/30 hover:text-cyan-50")}>{option}</button>
      ))}
    </div>
  );
}
