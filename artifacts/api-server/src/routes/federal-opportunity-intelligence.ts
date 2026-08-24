import { Router, type IRouter } from "express";

const router: IRouter = Router();
const SAM_URL = "https://api.sam.gov/opportunities/v2/search";
const CACHE_MS = 30 * 60_000;
const cache = new Map<string,{ expiresAt:number; value:any }>();

function apiKey() { return process.env.SAM_API_KEY?.trim() || process.env.SAM_GOV_API_KEY?.trim() || ""; }
function clean(value: unknown, max = 1200) { return String(value ?? "").replace(/<[^>]*>/g," ").replace(/\s+/g," ").trim().slice(0,max); }
function mmddyyyy(date: Date) { return `${String(date.getMonth()+1).padStart(2,"0")}/${String(date.getDate()).padStart(2,"0")}/${date.getFullYear()}`; }
function canonical(value: string) {
  if (/defense/i.test(value)) return "Department of Defense";
  if (/homeland security/i.test(value)) return "Department of Homeland Security";
  if (/veterans affairs/i.test(value)) return "Department of Veterans Affairs";
  if (/health and human services/i.test(value)) return "Department of Health and Human Services";
  if (/state department|department of state/i.test(value)) return "Department of State";
  if (/transportation/i.test(value)) return "Department of Transportation";
  if (/labor/i.test(value)) return "Department of Labor";
  if (/energy/i.test(value)) return "Department of Energy";
  if (/justice/i.test(value)) return "Department of Justice";
  if (/agriculture/i.test(value)) return "Department of Agriculture";
  if (/interior/i.test(value)) return "Department of the Interior";
  return value.trim();
}
const SIGNALS: Array<[RegExp,string,number]> = [
  [/occupational\s+(health|medicine|medical)/i,"Occupational health",5],
  [/pre[- ]?(employment|placement)|post[- ]?offer/i,"Pre-employment exams",5],
  [/physical\s+exam|medical\s+exam|medical\s+evaluation/i,"Medical examinations",4],
  [/fitness[- ]?for[- ]?duty|fit[- ]?for[- ]?duty/i,"Fitness for duty",5],
  [/drug\s+(test|screen)|alcohol\s+(test|screen)/i,"Drug / alcohol testing",4],
  [/respirator|respiratory\s+protection|fit\s*test/i,"Respirator / fit testing",4],
  [/audiometr|hearing\s+(test|conservation)/i,"Audiometry / hearing",4],
  [/medical\s+surveillance|health\s+surveillance/i,"Medical surveillance",5],
  [/vaccin|immuniz/i,"Vaccination",3],
  [/laboratory|specimen\s+collection|clinical\s+lab/i,"Laboratory",3],
  [/workers.?\s*comp|return[- ]?to[- ]?work/i,"Workers comp / RTW",4],
  [/travel\s+medicine|deployment\s+medical|overseas\s+medical/i,"Deployment medicine",5],
];
function score(text: string, classificationCode: string) {
  let points = classificationCode.toUpperCase().startsWith("Q") ? 1 : 0;
  const tags:string[]=[];
  for (const [pattern,label,weight] of SIGNALS) if (pattern.test(text)) { points += weight; tags.push(label); }
  return { points, tags:[...new Set(tags)], relevant: points >= 4 };
}
function normalize(row:any) {
  const title = clean(row?.title,600) || "Untitled SAM opportunity";
  const organization = clean(row?.fullParentPathName || row?.organizationName,600);
  const classificationCode = clean(row?.classificationCode,60);
  const signals = score(`${title} ${organization} ${clean(row?.type)} ${clean(row?.baseType)}`, classificationCode);
  const award = row?.award && typeof row.award === "object" ? row.award : null;
  const place = row?.placeOfPerformance || {};
  return {
    noticeId: clean(row?.noticeId,160), title, organization, organizationCode: clean(row?.fullParentPathCode,240),
    solicitationNumber: clean(row?.solicitationNumber,180), postedDate: clean(row?.postedDate,80), responseDeadline: clean(row?.responseDeadLine || row?.responseDeadline,80),
    type: clean(row?.type || row?.baseType,160), baseType: clean(row?.baseType,160), naicsCode: clean(row?.naicsCode,40), classificationCode,
    setAside: clean(row?.typeOfSetAsideDescription || row?.typeOfSetAside,180), active: /yes|true|active/i.test(String(row?.active ?? "")) || row?.active === true,
    award: award ? { amount: Number.isFinite(Number(award?.amount)) ? Number(award.amount) : null, awardee: clean(award?.awardee?.name || award?.awardee,240), date: clean(award?.date,80), number: clean(award?.number,120) } : null,
    placeOfPerformance: { city: clean(place?.city?.name || place?.city,100), state: clean(place?.state?.code || place?.state?.name || place?.state,80), country: clean(place?.country?.code || place?.country?.name || place?.country,80) },
    sourceUrl: clean(row?.uiLink,800) || (row?.noticeId ? `https://sam.gov/opp/${encodeURIComponent(row.noticeId)}/view` : "https://sam.gov/content/opportunities"),
    descriptionUrl: clean(row?.description,800), occuMedScore: signals.points, occuMedTags: signals.tags, occuMedRelevant: signals.relevant,
  };
}
async function request(params: Record<string,string>, key:string) {
  const url = new URL(SAM_URL);
  url.searchParams.set("api_key",key);
  for (const [name,value] of Object.entries(params)) if (value) url.searchParams.set(name,value);
  const response = await fetch(url,{ headers:{ Accept:"application/json", "User-Agent":"Occu-Med Insight Hub/2.0 federal occupational pipeline" } });
  if (response.status === 404) return { status:404, totalRecords:0, rows:[] as any[] };
  const text = await response.text();
  if (!response.ok) throw new Error(`SAM.gov HTTP ${response.status}: ${clean(text,220).replace(/api_key=[^&\s]+/gi,"api_key=[REDACTED]")}`);
  let payload:any; try { payload = JSON.parse(text); } catch { throw new Error("SAM.gov returned invalid JSON."); }
  return { status:response.status, totalRecords:Number(payload?.totalRecords || 0), rows:Array.isArray(payload?.opportunitiesData) ? payload.opportunitiesData : [] };
}

router.get("/core-intelligence/federal-occupational-pipeline", async (req,res) => {
  const agency = canonical(clean(req.query.agency,180) || "Department of Defense");
  const days = Math.max(30,Math.min(365,Number(req.query.days) || 365));
  const key = apiKey();
  res.setHeader("Cache-Control","no-store");
  if (!key) return res.status(503).json({ ok:false, configured:false, agency, opportunities:[], error:"SAM_API_KEY is not configured on the API service." });
  const cacheKey = `${agency}|${days}`.toLowerCase();
  const hit = cache.get(cacheKey); if (hit && hit.expiresAt > Date.now()) return res.json({ ...hit.value, cacheState:"fresh" });
  const postedTo = new Date(); const postedFrom = new Date(postedTo.getTime()-days*86400000);
  const common = { postedFrom:mmddyyyy(postedFrom), postedTo:mmddyyyy(postedTo), limit:"1000", offset:"0", organizationName:agency };
  try {
    const calls = [
      { name:"agency", promise:request(common,key) },
      { name:"medical-title", promise:request({ ...common, title:"medical" },key) },
      { name:"medical-services-psc", promise:request({ ...common, ccode:"Q" },key) },
    ];
    const settled = await Promise.all(calls.map(async (call) => ({ name:call.name, result:await call.promise })));
    const seen = new Set<string>(); const merged:any[]=[];
    for (const call of settled) for (const row of call.result.rows) { const id=clean(row?.noticeId,160)||`${clean(row?.solicitationNumber)}|${clean(row?.title)}`; if (!id || seen.has(id)) continue; seen.add(id); merged.push(row); }
    const normalized = merged.map(normalize).sort((a,b) => String(b.postedDate).localeCompare(String(a.postedDate)));
    const relevant = normalized.filter((item) => item.occuMedRelevant);
    const value = { ok:true, configured:true, agency, retrievedAt:new Date().toISOString(), source:"SAM.gov Get Opportunities Public API v2", sourceUrl:"https://sam.gov/content/opportunities", opportunities:normalized, relevant, returned:normalized.length, relevantCount:relevant.length, diagnostics:{ postedFrom:mmddyyyy(postedFrom), postedTo:mmddyyyy(postedTo), pageLimit:1000, requestCount:settled.length, searches:settled.map((call) => ({ mode:call.name, httpStatus:call.result.status, totalRecords:call.result.totalRecords, returned:call.result.rows.length })), relevanceMethod:"Title + organization + notice type + PSC; SAM description is a URL and is not misrepresented as description text." }, limitation:"The public SAM response exposes a description URL rather than inline synopsis text. Relevance is intentionally conservative until source detail is opened." };
    cache.set(cacheKey,{ expiresAt:Date.now()+CACHE_MS,value });
    return res.json({ ...value, cacheState:"refreshed" });
  } catch (error) {
    return res.status(502).json({ ok:false, configured:true, agency, opportunities:[], relevant:[], returned:0, relevantCount:0, error:error instanceof Error ? error.message : "SAM.gov request failed.", diagnostics:{ postedFrom:mmddyyyy(postedFrom), postedTo:mmddyyyy(postedTo), pageLimit:1000 } });
  }
});

export default router;
