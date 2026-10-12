// Country relevance for command news — only where the item's own words support it.
//
// An item is tagged with a country only when that country's registry name (or alias) appears, as a whole word, in the item's title, its
// description or a category the source attached to it, AND the country belongs to the item's own command. Nothing is inferred from the
// command, the publication type or the surrounding story: an item with no such mention stays command-wide. Ambiguous names (a US state or a
// common word) are never matched.

import { buildAorDirectory } from "../directory";
import type { CommandId } from "../command-policy/assignments-rows";

export interface CountryTag { id: string; name: string; iso2: string | null; mentionedIn: Array<"title" | "summary" | "category"> }

const AMBIGUOUS = new Set(["georgia", "jordan", "chad", "guinea", "niger", "turkey", "reunion", "samoa", "us", "usa", "america", "united states"]);

type Matcher = { id: string; name: string; iso2: string | null; command: CommandId; pattern: RegExp };
let cached: Matcher[] | null = null;

const escape = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const fold = (value: string) => value.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

function matchers(): Matcher[] {
  if (cached) return cached;
  const out: Matcher[] = [];
  for (const location of buildAorDirectory().locations) {
    if (location.splitParent) continue;
    const names = [location.name, ...location.aliases].map(fold).filter((name) => name.length >= 4 && !AMBIGUOUS.has(name));
    for (const name of new Set(names)) out.push({ id: location.id, name: location.name, iso2: location.iso2, command: location.command, pattern: new RegExp(`(?<![\\p{L}\\p{N}])${escape(name)}(?![\\p{L}\\p{N}])`, "u") });
  }
  // Longest names first, so a longer name ("South Sudan") is matched and consumed before a shorter one it contains ("Sudan").
  cached = out.sort((a, b) => b.pattern.source.length - a.pattern.source.length);
  return cached;
}

export function countryTags(command: CommandId, parts: { title: string; summary: string; categories: string[] }): CountryTag[] {
  const fields: Array<["title" | "summary" | "category", string]> = [["title", fold(parts.title)], ["summary", fold(parts.summary)], ["category", fold(parts.categories.join(" | "))]];
  const found = new Map<string, CountryTag>();
  for (const matcher of matchers()) {
    for (const entry of fields) {
      const global = new RegExp(matcher.pattern.source, "gu");
      if (!global.test(entry[1])) continue;
      // The matched words are consumed whatever command the place belongs to, so "South Sudan" is never also read as "Sudan".
      entry[1] = entry[1].replace(new RegExp(matcher.pattern.source, "gu"), " ".repeat(8));
      if (matcher.command !== command) continue;
      const tag = found.get(matcher.id) ?? { id: matcher.id, name: matcher.name, iso2: matcher.iso2, mentionedIn: [] };
      if (!tag.mentionedIn.includes(entry[0])) tag.mentionedIn.push(entry[0]);
      found.set(matcher.id, tag);
    }
  }
  return [...found.values()].sort((a, b) => a.name.localeCompare(b.name));
}
