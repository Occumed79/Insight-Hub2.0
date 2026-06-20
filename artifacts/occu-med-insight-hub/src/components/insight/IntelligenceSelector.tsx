import { useMemo } from "react";
import type { Company } from "@/data/types";
import { buildIntelligenceSelectorOptions, groupSelectorOptions } from "@/company-configs/intelligenceNavigation";

type Props = {
  companies: Company[];
  value: string;
  onChange: (companyId: string) => void;
};

export function IntelligenceSelector({ companies, value, onChange }: Props) {
  const options = useMemo(() => buildIntelligenceSelectorOptions(companies), [companies]);
  const grouped = useMemo(() => groupSelectorOptions(options), [options]);

  return (
    <select
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="rounded-full border border-cyan-100/15 bg-[#07111d] px-4 py-2 text-sm text-cyan-50 outline-none"
    >
      {grouped.map((group) => (
        <optgroup key={group.category} label={group.category}>
          {group.options.map((option) => (
            <option key={option.id} value={option.id}>{option.label}</option>
          ))}
        </optgroup>
      ))}
    </select>
  );
}
