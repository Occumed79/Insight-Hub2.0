import { useMemo, useState } from "react";
import { ChevronsUpDown } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { cn } from "@/lib/utils";
import type { Company } from "@/data/types";
import {
  buildIntelligenceSelectorOptions,
  getIntelligenceCategory,
  groupSelectorOptions,
} from "@/company-configs/intelligenceNavigation";
import { getCompanyConfigOrDefault } from "@/company-configs";

type Props = {
  companies: Company[];
  value: string;
  onChange: (companyId: string) => void;
  className?: string;
};

export function IntelligenceSelector({ companies, value, onChange, className }: Props) {
  const [open, setOpen] = useState(false);
  const options = useMemo(() => buildIntelligenceSelectorOptions(companies), [companies]);
  const grouped = useMemo(() => groupSelectorOptions(options), [options]);
  const selected = options.find((option) => option.id === value);
  const selectedConfig = getCompanyConfigOrDefault(value);
  const category = getIntelligenceCategory(value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-expanded={open}
          className={cn(
            "flex min-w-[280px] max-w-[420px] items-center justify-between gap-3 rounded-full border border-cyan-100/15 bg-[#07111d] px-4 py-2 text-left text-sm text-cyan-50 outline-none transition hover:border-cyan-100/25 hover:bg-[#081522]",
            className,
          )}
        >
          <span className="min-w-0">
            <span className="block truncate font-medium">{selected?.label ?? selectedConfig.displayName}</span>
            <span className="block truncate text-[10px] uppercase tracking-[0.22em] text-cyan-100/42">{category}</span>
          </span>
          <ChevronsUpDown className="h-4 w-4 shrink-0 text-cyan-100/45" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="w-[min(420px,calc(100vw-2rem))] border border-cyan-100/15 bg-[#07111d] p-0 text-cyan-50 shadow-[0_24px_80px_rgba(0,0,0,.45)]"
      >
        <Command className="bg-transparent text-cyan-50">
          <CommandInput placeholder="Search intelligence profiles..." className="text-cyan-50 placeholder:text-cyan-100/40" />
          <CommandList className="max-h-[360px]">
            <CommandEmpty className="py-6 text-center text-sm text-cyan-100/50">No intelligence profile found.</CommandEmpty>
            {grouped.map((group) => (
              <CommandGroup
                key={group.category}
                heading={group.category}
                className="[&_[cmdk-group-heading]]:text-[10px] [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-[0.22em] [&_[cmdk-group-heading]]:text-cyan-100/40"
              >
                {group.options.map((option) => (
                  <CommandItem
                    key={option.id}
                    value={`${option.label} ${option.searchText}`}
                    onSelect={() => {
                      onChange(option.id);
                      setOpen(false);
                    }}
                    className="cursor-pointer rounded-xl aria-selected:bg-cyan-200/10 aria-selected:text-cyan-50"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{option.label}</p>
                      <p className="truncate text-[10px] uppercase tracking-[0.18em] text-cyan-100/42">{option.sourceStatus}</p>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
