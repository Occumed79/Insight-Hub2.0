import { useMemo, useState, type CSSProperties } from "react";
import { Activity, Search, Sparkles } from "lucide-react";
import { Sidebar } from "@/components/insight/Sidebar";
import luminousBodyFront from "@/assets/luminous-body-front.webp";
import luminousBodyBack from "@/assets/luminous-body-back.webp";

type Mode = "injury" | "medical";
type BodyView = "front" | "back";
type RegionId =
  | "head"
  | "ear-left"
  | "ear-right"
  | "neck"
  | "chest"
  | "heart"
  | "lung-left"
  | "lung-right"
  | "abdomen"
  | "liver"
  | "shoulder-left"
  | "shoulder-right"
  | "elbow-left"
  | "elbow-right"
  | "wrist-left"
  | "wrist-right"
  | "hand-left"
  | "hand-right"
  | "hip-left"
  | "hip-right"
  | "knee-left"
  | "knee-right"
  | "ankle-left"
  | "ankle-right"
  | "foot-left"
  | "foot-right"
  | "cervical-spine"
  | "thoracic-spine"
  | "lumbar-spine"
  | "kidney-left"
  | "kidney-right";

type Hotspot = {
  id: RegionId;
  label: string;
  view: BodyView;
  x: number;
  y: number;
  width: number;
  height: number;
};

type Condition = {
  id: string;
  label: string;
  category: string;
  terms: string[];
  regions: RegionId[];
  preferredView?: BodyView;
  systemic?: boolean;
};

type OnetPayload = {
  ok?: boolean;
  error?: string;
  profile?: {
    occupation?: {
      code?: string;
      title?: string;
      description?: string;
    };
    serviceMatches?: Array<{ id?: string; label?: string; count?: number; description?: string }>;
  };
};

type OshaItem = {
  name: string;
  code?: string;
  count: number;
  share?: number;
};

type OshaPayload = {
  ok?: boolean;
  configured?: boolean;
  error?: string;
  profile?: {
    occupationTitle?: string;
    selectedYear?: number;
    totalCases?: number;
    totalDaysAway?: number;
    totalRestrictedDays?: number;
    bodyParts?: OshaItem[];
    natures?: OshaItem[];
    events?: OshaItem[];
    sources?: OshaItem[];
    outcomes?: Array<{ name: string; count: number }>;
  };
};

const FRONT_HOTSPOTS: Hotspot[] = [
  { id: "head", label: "Head", view: "front", x: 50, y: 10, width: 17, height: 15 },
  { id: "ear-left", label: "Left ear", view: "front", x: 43, y: 12, width: 7, height: 9 },
  { id: "ear-right", label: "Right ear", view: "front", x: 57, y: 12, width: 7, height: 9 },
  { id: "neck", label: "Neck", view: "front", x: 50, y: 20, width: 16, height: 9 },
  { id: "chest", label: "Chest", view: "front", x: 50, y: 31, width: 30, height: 18 },
  { id: "heart", label: "Heart", view: "front", x: 46, y: 31, width: 13, height: 12 },
  { id: "lung-left", label: "Left lung", view: "front", x: 42, y: 30, width: 14, height: 16 },
  { id: "lung-right", label: "Right lung", view: "front", x: 58, y: 30, width: 14, height: 16 },
  { id: "abdomen", label: "Abdomen", view: "front", x: 50, y: 43, width: 26, height: 18 },
  { id: "liver", label: "Liver region", view: "front", x: 56, y: 40, width: 15, height: 11 },
  { id: "shoulder-left", label: "Left shoulder", view: "front", x: 34, y: 25, width: 13, height: 10 },
  { id: "shoulder-right", label: "Right shoulder", view: "front", x: 66, y: 25, width: 13, height: 10 },
  { id: "elbow-left", label: "Left elbow", view: "front", x: 26, y: 39, width: 10, height: 10 },
  { id: "elbow-right", label: "Right elbow", view: "front", x: 74, y: 39, width: 10, height: 10 },
  { id: "wrist-left", label: "Left wrist", view: "front", x: 21, y: 50, width: 9, height: 8 },
  { id: "wrist-right", label: "Right wrist", view: "front", x: 79, y: 50, width: 9, height: 8 },
  { id: "hand-left", label: "Left hand", view: "front", x: 19, y: 55, width: 10, height: 11 },
  { id: "hand-right", label: "Right hand", view: "front", x: 81, y: 55, width: 10, height: 11 },
  { id: "hip-left", label: "Left hip", view: "front", x: 43, y: 52, width: 13, height: 12 },
  { id: "hip-right", label: "Right hip", view: "front", x: 57, y: 52, width: 13, height: 12 },
  { id: "knee-left", label: "Left knee", view: "front", x: 42, y: 70, width: 11, height: 10 },
  { id: "knee-right", label: "Right knee", view: "front", x: 58, y: 70, width: 11, height: 10 },
  { id: "ankle-left", label: "Left ankle", view: "front", x: 41, y: 90, width: 9, height: 8 },
  { id: "ankle-right", label: "Right ankle", view: "front", x: 59, y: 90, width: 9, height: 8 },
  { id: "foot-left", label: "Left foot", view: "front", x: 38, y: 95, width: 14, height: 8 },
  { id: "foot-right", label: "Right foot", view: "front", x: 63, y: 95, width: 14, height: 8 },
];

const BACK_HOTSPOTS: Hotspot[] = [
  { id: "head", label: "Head", view: "back", x: 50, y: 9, width: 17, height: 15 },
  { id: "ear-left", label: "Left ear", view: "back", x: 43, y: 11, width: 7, height: 9 },
  { id: "ear-right", label: "Right ear", view: "back", x: 57, y: 11, width: 7, height: 9 },
  { id: "cervical-spine", label: "Cervical spine", view: "back", x: 50, y: 20, width: 14, height: 11 },
  { id: "thoracic-spine", label: "Thoracic spine", view: "back", x: 50, y: 34, width: 15, height: 24 },
  { id: "lumbar-spine", label: "Lumbar spine", view: "back", x: 50, y: 47, width: 18, height: 17 },
  { id: "kidney-left", label: "Left kidney region", view: "back", x: 44, y: 43, width: 11, height: 11 },
  { id: "kidney-right", label: "Right kidney region", view: "back", x: 56, y: 43, width: 11, height: 11 },
  { id: "shoulder-left", label: "Left shoulder", view: "back", x: 35, y: 25, width: 14, height: 11 },
  { id: "shoulder-right", label: "Right shoulder", view: "back", x: 65, y: 25, width: 14, height: 11 },
  { id: "elbow-left", label: "Left elbow", view: "back", x: 27, y: 40, width: 10, height: 10 },
  { id: "elbow-right", label: "Right elbow", view: "back", x: 73, y: 40, width: 10, height: 10 },
  { id: "wrist-left", label: "Left wrist", view: "back", x: 22, y: 50, width: 9, height: 8 },
  { id: "wrist-right", label: "Right wrist", view: "back", x: 78, y: 50, width: 9, height: 8 },
  { id: "hand-left", label: "Left hand", view: "back", x: 19, y: 55, width: 10, height: 11 },
  { id: "hand-right", label: "Right hand", view: "back", x: 81, y: 55, width: 10, height: 11 },
  { id: "hip-left", label: "Left hip", view: "back", x: 43, y: 53, width: 13, height: 12 },
  { id: "hip-right", label: "Right hip", view: "back", x: 57, y: 53, width: 13, height: 12 },
  { id: "knee-left", label: "Left knee", view: "back", x: 42, y: 70, width: 11, height: 10 },
  { id: "knee-right", label: "Right knee", view: "back", x: 58, y: 70, width: 11, height: 10 },
  { id: "ankle-left", label: "Left ankle", view: "back", x: 41, y: 90, width: 9, height: 8 },
  { id: "ankle-right", label: "Right ankle", view: "back", x: 59, y: 90, width: 9, height: 8 },
  { id: "foot-left", label: "Left foot", view: "back", x: 39, y: 95, width: 14, height: 8 },
  { id: "foot-right", label: "Right foot", view: "back", x: 61, y: 95, width: 14, height: 8 },
];

const CONDITIONS: Condition[] = [
  { id: "diabetes", label: "Diabetes Mellitus", category: "Metabolic", terms: ["diabetes", "diabetic", "a1c", "glucose"], regions: ["abdomen"], preferredView: "front" },
  { id: "osa", label: "Obstructive Sleep Apnea", category: "Sleep", terms: ["osa", "sleep apnea", "apnea", "cpap"], regions: ["head", "neck"], preferredView: "front" },
  { id: "sleep-other", label: "Other Sleep Disorders", category: "Sleep", terms: ["insomnia", "narcolepsy", "sleep disorder", "hypersomnia"], regions: ["head"], preferredView: "front" },
  { id: "hypertension", label: "Hypertension", category: "Cardiovascular", terms: ["hypertension", "high blood pressure", "blood pressure"], regions: ["heart"], preferredView: "front" },
  { id: "coronary", label: "Coronary Artery Disease", category: "Cardiovascular", terms: ["coronary", "cad", "ischemia", "angina"], regions: ["heart"], preferredView: "front" },
  { id: "arrhythmia", label: "Arrhythmia", category: "Cardiovascular", terms: ["arrhythmia", "atrial fibrillation", "afib", "rhythm"], regions: ["heart"], preferredView: "front" },
  { id: "heart-failure", label: "Heart Failure / Cardiomyopathy", category: "Cardiovascular", terms: ["heart failure", "cardiomyopathy"], regions: ["heart"], preferredView: "front" },
  { id: "syncope", label: "Syncope / Presyncope", category: "Neurologic / Cardiovascular", terms: ["syncope", "fainting", "presyncope"], regions: ["head", "heart"], preferredView: "front" },
  { id: "asthma", label: "Asthma", category: "Respiratory", terms: ["asthma", "bronchospasm", "inhaler"], regions: ["lung-left", "lung-right"], preferredView: "front" },
  { id: "copd", label: "COPD", category: "Respiratory", terms: ["copd", "emphysema", "chronic bronchitis"], regions: ["lung-left", "lung-right"], preferredView: "front" },
  { id: "seizure", label: "Seizure Disorder", category: "Neurologic", terms: ["seizure", "epilepsy"], regions: ["head"], preferredView: "front" },
  { id: "migraine", label: "Migraine / Recurrent Headache", category: "Neurologic", terms: ["migraine", "headache"], regions: ["head"], preferredView: "front" },
  { id: "tbi", label: "Traumatic Brain Injury", category: "Neurologic", terms: ["tbi", "traumatic brain injury", "concussion"], regions: ["head"], preferredView: "front" },
  { id: "behavioral", label: "Behavioral Health", category: "Behavioral", terms: ["behavioral health", "mental health", "depression", "anxiety", "ptsd"], regions: ["head"], preferredView: "front" },
  { id: "adhd", label: "ADHD", category: "Neurologic / Behavioral", terms: ["adhd", "attention deficit"], regions: ["head"], preferredView: "front" },
  { id: "substance", label: "Substance Use", category: "Systemic", terms: ["substance use", "alcohol", "opioid", "stimulant misuse"], regions: [], systemic: true },
  { id: "musculoskeletal", label: "Musculoskeletal Condition", category: "Musculoskeletal", terms: ["musculoskeletal", "strain", "sprain", "joint pain"], regions: ["shoulder-left", "shoulder-right", "elbow-left", "elbow-right", "hip-left", "hip-right", "knee-left", "knee-right"], preferredView: "front" },
  { id: "spine", label: "Spine / Back Condition", category: "Musculoskeletal", terms: ["spine", "back pain", "lumbar", "cervical", "thoracic"], regions: ["cervical-spine", "thoracic-spine", "lumbar-spine"], preferredView: "back" },
  { id: "arthritis", label: "Arthritis", category: "Musculoskeletal", terms: ["arthritis", "osteoarthritis", "rheumatoid"], regions: ["shoulder-left", "shoulder-right", "elbow-left", "elbow-right", "hand-left", "hand-right", "hip-left", "hip-right", "knee-left", "knee-right"], preferredView: "front" },
  { id: "renal", label: "Renal / Kidney Disease", category: "Renal", terms: ["renal", "kidney", "ckd"], regions: ["kidney-left", "kidney-right"], preferredView: "back" },
  { id: "thyroid", label: "Thyroid Disorder", category: "Endocrine", terms: ["thyroid", "hypothyroid", "hyperthyroid"], regions: ["neck"], preferredView: "front" },
  { id: "obesity", label: "Obesity / Weight-Related Context", category: "Systemic", terms: ["obesity", "bmi", "body mass"], regions: [], systemic: true },
  { id: "vision", label: "Vision Disorder", category: "Sensory", terms: ["vision", "visual", "eyesight", "glaucoma", "cataract"], regions: ["head"], preferredView: "front" },
  { id: "hearing", label: "Hearing Loss / Tinnitus", category: "Sensory", terms: ["hearing", "hearing loss", "tinnitus", "audiogram"], regions: ["ear-left", "ear-right"], preferredView: "front" },
  { id: "liver", label: "Liver Disease", category: "Hepatic", terms: ["liver", "hepatic", "cirrhosis", "hepatitis"], regions: ["liver"], preferredView: "front" },
  { id: "bleeding", label: "Bleeding / Clotting Disorder", category: "Systemic", terms: ["bleeding", "clotting", "anticoagulation", "anticoagulant"], regions: [], systemic: true },
];

const REGION_LABELS = new Map<RegionId, string>(
  [...FRONT_HOTSPOTS, ...BACK_HOTSPOTS].map((hotspot) => [hotspot.id, hotspot.label]),
);

const UPPER_EXTREMITY_REGIONS: RegionId[] = [
  "shoulder-left",
  "shoulder-right",
  "elbow-left",
  "elbow-right",
  "wrist-left",
  "wrist-right",
  "hand-left",
  "hand-right",
];

const LOWER_EXTREMITY_REGIONS: RegionId[] = [
  "hip-left",
  "hip-right",
  "knee-left",
  "knee-right",
  "ankle-left",
  "ankle-right",
  "foot-left",
  "foot-right",
];

function mapOshaBodyPart(name: string): { regions: RegionId[]; view: BodyView; systemic?: boolean } {
  const value = name.toLowerCase();
  if (/back|spine|vertebra|lumbar|thoracic/.test(value)) {
    return { regions: ["thoracic-spine", "lumbar-spine"], view: "back" };
  }
  if (/upper extrem|arm|shoulder|elbow|wrist|hand|finger/.test(value)) {
    return { regions: UPPER_EXTREMITY_REGIONS, view: "front" };
  }
  if (/lower extrem|leg|hip|knee|ankle|foot|feet|toe/.test(value)) {
    return { regions: LOWER_EXTREMITY_REGIONS, view: "front" };
  }
  if (/head|brain|face|eye/.test(value)) return { regions: ["head"], view: "front" };
  if (/ear|hearing/.test(value)) return { regions: ["ear-left", "ear-right"], view: "front" };
  if (/neck/.test(value)) return { regions: ["neck", "cervical-spine"], view: "front" };
  if (/chest|thorax/.test(value)) return { regions: ["chest"], view: "front" };
  if (/abdomen|stomach/.test(value)) return { regions: ["abdomen"], view: "front" };
  if (/trunk|multiple|body system|whole body/.test(value)) return { regions: [], view: "front", systemic: true };
  return { regions: [], view: "front", systemic: true };
}

async function readJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  const payload = (await response.json()) as T & { error?: string };
  if (!response.ok) throw new Error(payload.error || "Request failed.");
  return payload;
}

function BodyStage({
  view,
  onViewChange,
  activeRegions,
  systemic,
  onRegionClick,
}: {
  view: BodyView;
  onViewChange: (view: BodyView) => void;
  activeRegions: RegionId[];
  systemic: boolean;
  onRegionClick: (region: RegionId, view: BodyView) => void;
}) {
  const hotspots = view === "front" ? FRONT_HOTSPOTS : BACK_HOTSPOTS;
  const active = new Set(activeRegions);
  const imageStyle: CSSProperties = systemic
    ? { filter: "drop-shadow(0 0 13px rgba(41, 224, 255, .75)) drop-shadow(0 0 34px rgba(51, 92, 255, .45))" }
    : { filter: "drop-shadow(0 0 9px rgba(25, 215, 255, .28))" };

  return (
    <section className="relative min-h-[680px] overflow-hidden border-x border-white/[0.08] bg-black/55" data-testid="luminous-body-stage">
      <div className="absolute left-5 top-5 z-30 flex items-center gap-1 rounded-full border border-white/10 bg-black/70 p-1 backdrop-blur-xl">
        <button
          type="button"
          aria-label="Front view"
          aria-pressed={view === "front"}
          onClick={() => onViewChange("front")}
          className={`rounded-full px-4 py-2 text-[11px] font-semibold tracking-[0.16em] transition ${
            view === "front" ? "bg-white text-black" : "text-white/55 hover:text-white"
          }`}
        >
          FRONT
        </button>
        <button
          type="button"
          aria-label="Back view"
          aria-pressed={view === "back"}
          onClick={() => onViewChange("back")}
          className={`rounded-full px-4 py-2 text-[11px] font-semibold tracking-[0.16em] transition ${
            view === "back" ? "bg-white text-black" : "text-white/55 hover:text-white"
          }`}
        >
          BACK
        </button>
      </div>

      <div className="pointer-events-none absolute inset-x-0 top-5 z-20 flex justify-center">
        <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.22em] text-cyan-100/45">
          <Sparkles size={13} />
          Live anatomical context
        </div>
      </div>

      <div className="absolute inset-0 flex items-center justify-center px-8 pb-12 pt-20">
        <div className="relative aspect-[2/3] h-[min(76vh,720px)] max-h-[720px] w-auto max-w-full">
          <img
            src={view === "front" ? luminousBodyFront : luminousBodyBack}
            alt={view === "front" ? "Luminous human body, front view" : "Luminous human body, back view"}
            data-testid={view === "front" ? "luminous-body-front" : "luminous-body-back"}
            className="h-full w-full select-none object-contain"
            draggable={false}
            style={imageStyle}
          />

          {hotspots.map((hotspot) => {
            const isActive = active.has(hotspot.id);
            const style: CSSProperties = {
              left: `${hotspot.x}%`,
              top: `${hotspot.y}%`,
              width: `${hotspot.width}%`,
              height: `${hotspot.height}%`,
              transform: "translate(-50%, -50%)",
              border: isActive ? "1px solid rgba(124, 246, 255, .96)" : "1px solid transparent",
              background: isActive
                ? "radial-gradient(circle, rgba(111, 241, 255, .34) 0%, rgba(41, 135, 255, .15) 44%, rgba(255, 56, 226, .08) 68%, transparent 76%)"
                : "transparent",
              boxShadow: isActive
                ? "0 0 12px rgba(102, 238, 255, .95), 0 0 32px rgba(57, 129, 255, .72), 0 0 52px rgba(255, 42, 220, .36)"
                : undefined,
            };
            return (
              <button
                key={`${view}-${hotspot.id}`}
                type="button"
                aria-label={`${hotspot.label} body region`}
                data-testid={`body-hotspot-${hotspot.id}`}
                data-active={isActive ? "true" : "false"}
                onClick={() => onRegionClick(hotspot.id, view)}
                className={`absolute z-20 rounded-full transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/80 ${
                  isActive ? "opacity-100" : "opacity-0 hover:opacity-30 focus-visible:opacity-60"
                }`}
                style={style}
              >
                {isActive ? <span className="absolute inset-0 animate-ping rounded-full border border-cyan-200/50" /> : null}
              </button>
            );
          })}
        </div>
      </div>

      <div className="absolute inset-x-5 bottom-5 z-30 flex flex-wrap items-center justify-center gap-2">
        {systemic ? (
          <span className="rounded-full border border-cyan-200/20 bg-cyan-200/[0.07] px-3 py-1.5 text-[11px] text-cyan-50/75">
            Systemic — no single localized region
          </span>
        ) : activeRegions.length ? (
          activeRegions.map((region) => (
            <span
              key={region}
              className="rounded-full border border-cyan-200/20 bg-cyan-200/[0.07] px-3 py-1.5 text-[11px] text-cyan-50/75"
            >
              {REGION_LABELS.get(region) || region}
            </span>
          ))
        ) : (
          <span className="text-[11px] tracking-[0.14em] text-white/30">SELECT EVIDENCE OR A CONDITION TO ILLUMINATE THE BODY</span>
        )}
      </div>
    </section>
  );
}

export default function ReviewerInjuriesMedical() {
  const [mode, setMode] = useState<Mode>("injury");
  const [view, setView] = useState<BodyView>("front");
  const [activeRegions, setActiveRegions] = useState<RegionId[]>([]);
  const [systemic, setSystemic] = useState(false);
  const [activeSignal, setActiveSignal] = useState<string>("");

  const [occupation, setOccupation] = useState("");
  const [onet, setOnet] = useState<OnetPayload | null>(null);
  const [osha, setOsha] = useState<OshaPayload | null>(null);
  const [occupationLoading, setOccupationLoading] = useState(false);
  const [occupationError, setOccupationError] = useState("");

  const [conditionQuery, setConditionQuery] = useState("");
  const [selectedConditionId, setSelectedConditionId] = useState<string | null>(null);

  const selectedCondition = CONDITIONS.find((condition) => condition.id === selectedConditionId) || null;
  const filteredConditions = useMemo(() => {
    const query = conditionQuery.trim().toLowerCase();
    if (!query) return CONDITIONS;
    return CONDITIONS.filter((condition) => {
      const haystack = [condition.label, condition.category, ...condition.terms].join(" ").toLowerCase();
      return haystack.includes(query);
    });
  }, [conditionQuery]);

  function illuminate(regions: RegionId[], nextView: BodyView, label: string, isSystemic = false) {
    setActiveRegions(regions);
    setSystemic(isSystemic);
    setActiveSignal(label);
    setView(nextView);
  }

  function chooseOshaBodyPart(item: OshaItem) {
    const mapping = mapOshaBodyPart(item.name);
    illuminate(mapping.regions, mapping.view, item.name, Boolean(mapping.systemic));
  }

  function chooseCondition(condition: Condition) {
    setSelectedConditionId(condition.id);
    illuminate(condition.regions, condition.preferredView || "front", condition.label, Boolean(condition.systemic));
  }

  async function buildInjuryProfile() {
    const keyword = occupation.trim();
    if (!keyword) return;
    setOccupationLoading(true);
    setOccupationError("");
    setOnet(null);
    setOsha(null);
    setActiveRegions([]);
    setSystemic(false);
    setActiveSignal("");
    try {
      const onetPayload = await readJson<OnetPayload>(
        `/api/occupational-discovery/onet/profile?keyword=${encodeURIComponent(keyword)}`,
      );
      setOnet(onetPayload);
      const resolved = onetPayload.profile?.occupation;
      if (resolved?.code || resolved?.title) {
        const params = new URLSearchParams();
        if (resolved.code) params.set("soc", resolved.code);
        if (resolved.title) params.set("title", resolved.title);
        const oshaPayload = await readJson<OshaPayload>(
          `/api/occupational-discovery/osha-occupation-profile?${params.toString()}`,
        );
        setOsha(oshaPayload);
        const leadingBodyPart = oshaPayload.profile?.bodyParts?.[0];
        if (leadingBodyPart) chooseOshaBodyPart(leadingBodyPart);
      }
    } catch (reason) {
      setOccupationError(reason instanceof Error ? reason.message : "Unable to build the injury profile.");
    } finally {
      setOccupationLoading(false);
    }
  }

  function setNextMode(nextMode: Mode) {
    setMode(nextMode);
    setActiveRegions([]);
    setSystemic(false);
    setActiveSignal("");
    if (nextMode === "medical" && selectedCondition) {
      illuminate(
        selectedCondition.regions,
        selectedCondition.preferredView || "front",
        selectedCondition.label,
        Boolean(selectedCondition.systemic),
      );
    }
  }

  return (
    <div className="min-h-screen bg-[#030509] text-white" data-page-identity="injuries-medical-conditions">
      <Sidebar />
      <main className="min-h-screen lg:ml-[210px]">
        <header className="border-b border-white/[0.08] px-6 pb-5 pt-7 lg:px-8">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <div className="mb-2 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.24em] text-cyan-100/45">
                <Activity size={13} />
                Occupational evidence workspace
              </div>
              <h1 className="text-3xl font-semibold tracking-[-0.045em] text-white lg:text-[38px]">
                Injuries & Medical Conditions
              </h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-white/48">
                Map source evidence and condition context onto the body without converting either into an individual injury probability or fitness decision.
              </p>
            </div>

            <div role="tablist" aria-label="Workspace mode" className="inline-flex w-fit rounded-full border border-white/10 bg-white/[0.035] p-1">
              <button
                type="button"
                role="tab"
                aria-selected={mode === "injury"}
                onClick={() => setNextMode("injury")}
                className={`rounded-full px-4 py-2 text-xs font-semibold transition ${
                  mode === "injury" ? "bg-white text-black" : "text-white/50 hover:text-white"
                }`}
              >
                Injury Intelligence
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={mode === "medical"}
                onClick={() => setNextMode("medical")}
                className={`rounded-full px-4 py-2 text-xs font-semibold transition ${
                  mode === "medical" ? "bg-white text-black" : "text-white/50 hover:text-white"
                }`}
              >
                Medical Conditions
              </button>
            </div>
          </div>
        </header>

        <div className="grid min-h-[calc(100vh-148px)] xl:grid-cols-[minmax(275px,0.8fr)_minmax(430px,1.15fr)_minmax(300px,0.85fr)]">
          <aside className="border-b border-white/[0.08] bg-black/25 p-6 xl:border-b-0 xl:border-r xl:p-7">
            {mode === "injury" ? (
              <>
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/35">Occupation</p>
                <div className="relative mt-3">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" size={16} />
                  <input
                    value={occupation}
                    onChange={(event) => setOccupation(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") void buildInjuryProfile();
                    }}
                    placeholder="Firefighter, electrician, truck driver…"
                    className="h-11 w-full rounded-xl border border-white/10 bg-white/[0.04] pl-10 pr-3 text-sm text-white outline-none transition placeholder:text-white/25 focus:border-cyan-200/35"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => void buildInjuryProfile()}
                  disabled={occupationLoading || !occupation.trim()}
                  className="mt-3 h-10 w-full rounded-xl bg-white text-sm font-semibold text-black transition hover:bg-cyan-50 disabled:cursor-not-allowed disabled:opacity-35"
                >
                  {occupationLoading ? "Building profile…" : "Build injury profile"}
                </button>

                {occupationError ? (
                  <p className="mt-4 rounded-xl border border-rose-300/20 bg-rose-300/[0.06] p-3 text-xs leading-5 text-rose-100/75">
                    {occupationError}
                  </p>
                ) : null}

                {onet?.profile?.occupation ? (
                  <div className="mt-7 border-t border-white/[0.08] pt-5">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-cyan-100/40">Resolved occupation</p>
                    <h2 className="mt-2 text-xl font-semibold tracking-[-0.03em]">{onet.profile.occupation.title}</h2>
                    {onet.profile.occupation.code ? (
                      <p className="mt-1 font-mono text-[11px] text-white/35">{onet.profile.occupation.code}</p>
                    ) : null}
                    {onet.profile.occupation.description ? (
                      <p className="mt-4 text-xs leading-5 text-white/46">{onet.profile.occupation.description}</p>
                    ) : null}
                  </div>
                ) : (
                  <div className="mt-8 border-t border-white/[0.08] pt-5 text-sm leading-6 text-white/35">
                    Resolve an occupation first. OSHA case characteristics are then mapped to the supplied luminous body as navigable evidence.
                  </div>
                )}
              </>
            ) : (
              <>
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/35">Condition library</p>
                <div className="relative mt-3">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" size={16} />
                  <input
                    value={conditionQuery}
                    onChange={(event) => setConditionQuery(event.target.value)}
                    placeholder="Search diabetes, migraine, hearing, anticoagulation…"
                    className="h-11 w-full rounded-xl border border-white/10 bg-white/[0.04] pl-10 pr-3 text-sm text-white outline-none transition placeholder:text-white/25 focus:border-cyan-200/35"
                  />
                </div>
                <div className="mt-4 max-h-[620px] space-y-1 overflow-y-auto pr-1">
                  {filteredConditions.map((condition) => (
                    <button
                      key={condition.id}
                      type="button"
                      aria-label={condition.label}
                      onClick={() => chooseCondition(condition)}
                      className={`w-full rounded-xl border px-3.5 py-3 text-left transition ${
                        selectedConditionId === condition.id
                          ? "border-cyan-200/30 bg-cyan-200/[0.08]"
                          : "border-transparent bg-transparent hover:border-white/10 hover:bg-white/[0.035]"
                      }`}
                    >
                      <span className="block text-sm font-medium text-white/85">{condition.label}</span>
                      <span className="mt-1 block text-[10px] uppercase tracking-[0.16em] text-white/28">{condition.category}</span>
                    </button>
                  ))}
                  {filteredConditions.length === 0 ? (
                    <p className="px-2 py-5 text-sm text-white/35">No matching condition in the preserved reference set.</p>
                  ) : null}
                </div>
              </>
            )}
          </aside>

          <BodyStage
            view={view}
            onViewChange={setView}
            activeRegions={activeRegions}
            systemic={systemic}
            onRegionClick={(region, regionView) => illuminate([region], regionView, REGION_LABELS.get(region) || region)}
          />

          <aside className="border-t border-white/[0.08] bg-black/25 p-6 xl:border-l xl:border-t-0 xl:p-7">
            <div className="mb-6">
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/35">
                {mode === "injury" ? "Evidence mapping" : "Condition mapping"}
              </p>
              <div className="mt-3 h-px bg-white/[0.08]" />
            </div>

            {mode === "injury" ? (
              osha?.profile ? (
                <div>
                  <h2 className="text-xl font-semibold tracking-[-0.03em]">
                    {osha.profile.occupationTitle || onet?.profile?.occupation?.title || "Occupation"}
                  </h2>
                  <p className="mt-1 text-sm text-cyan-50/58">
                    {typeof osha.profile.totalCases === "number" ? `${osha.profile.totalCases.toLocaleString()} reported cases` : "Reported case profile"}
                    {osha.profile.selectedYear ? ` · ${osha.profile.selectedYear}` : ""}
                  </p>

                  <div className="mt-6">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/35">Reported body part</p>
                    <div className="mt-2 space-y-2">
                      {(osha.profile.bodyParts || []).slice(0, 6).map((item) => (
                        <button
                          key={`${item.code || item.name}-${item.name}`}
                          type="button"
                          aria-label={`${item.name} ${typeof item.share === "number" ? `${item.share.toFixed(1)}%` : `${item.count} cases`}`}
                          onClick={() => chooseOshaBodyPart(item)}
                          className={`flex w-full items-center justify-between rounded-xl border px-3.5 py-3 text-left transition ${
                            activeSignal === item.name
                              ? "border-cyan-200/30 bg-cyan-200/[0.08]"
                              : "border-white/[0.07] bg-white/[0.025] hover:border-white/15"
                          }`}
                        >
                          <span className="text-sm text-white/78">{item.name}</span>
                          <span className="font-mono text-xs text-cyan-100/50">
                            {typeof item.share === "number" ? `${item.share.toFixed(1)}%` : item.count.toLocaleString()}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {(osha.profile.events || []).length ? (
                    <div className="mt-6 border-t border-white/[0.08] pt-5">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/35">Leading event / exposure</p>
                      <p className="mt-2 text-sm leading-5 text-white/65">{osha.profile.events?.[0]?.name}</p>
                    </div>
                  ) : null}

                  {(osha.profile.natures || []).length ? (
                    <div className="mt-5">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/35">Leading nature</p>
                      <p className="mt-2 text-sm leading-5 text-white/65">{osha.profile.natures?.[0]?.name}</p>
                    </div>
                  ) : null}

                  <p className="mt-7 border-t border-white/[0.08] pt-5 text-xs leading-5 text-white/36">
                    OSHA case characteristics describe reported cases for the resolved occupation. They are evidence distributions, not an individual worker's injury probability.
                  </p>
                </div>
              ) : (
                <div className="text-sm leading-6 text-white/35">
                  The evidence rail will populate after an occupation resolves and imported OSHA case characteristics are available.
                </div>
              )
            ) : selectedCondition ? (
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-cyan-100/40">{selectedCondition.category}</p>
                <h2 className="mt-2 text-xl font-semibold tracking-[-0.03em]">{selectedCondition.label}</h2>
                <div className="mt-6">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/35">Visual context</p>
                  {selectedCondition.systemic ? (
                    <p className="mt-2 text-sm leading-6 text-white/62">Systemic context — no single body region is asserted.</p>
                  ) : (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {selectedCondition.regions.map((region) => (
                        <button
                          key={region}
                          type="button"
                          onClick={() =>
                            illuminate(
                              [region],
                              BACK_HOTSPOTS.some((hotspot) => hotspot.id === region) &&
                                !FRONT_HOTSPOTS.some((hotspot) => hotspot.id === region)
                                ? "back"
                                : selectedCondition.preferredView || "front",
                              selectedCondition.label,
                            )
                          }
                          className="rounded-full border border-cyan-200/20 bg-cyan-200/[0.06] px-3 py-1.5 text-xs text-cyan-50/68 transition hover:border-cyan-200/40 hover:text-white"
                        >
                          {REGION_LABELS.get(region) || region}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <p className="mt-7 border-t border-white/[0.08] pt-5 text-xs leading-5 text-white/42">
                  Contextual body mapping only — not a diagnosis or fitness decision.
                </p>
              </div>
            ) : (
              <div className="text-sm leading-6 text-white/35">
                Select a condition. Related anatomical context will illuminate on the supplied body image; systemic conditions remain deliberately unlocalized.
              </div>
            )}
          </aside>
        </div>
      </main>
    </div>
  );
}
