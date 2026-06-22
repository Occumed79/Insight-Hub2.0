import { Router, type IRouter, type Response } from "express";
import {
  fetchOnetJson,
  normalizeSearchResults,
  isConfigured as isOnetConfigured,
  type OnetItem,
} from "../services/onetService";

const router: IRouter = Router();

function missingKeyResponse(res: Response) {
  res.status(500).json({
    ok: false,
    error: "O*NET API key is not configured. Set the ONET_API_KEY environment variable on the server.",
  });
}

router.get("/onet/search", async (req, res) => {
  try {
    const apiKey = isOnetConfigured();
    if (!apiKey) {
      missingKeyResponse(res);
      return;
    }

    const keyword = String(req.query.keyword || "").trim();
    if (!keyword) {
      res.status(400).json({ ok: false, error: "keyword query parameter is required" });
      return;
    }

    const path = `/mnm/search?keyword=${encodeURIComponent(keyword)}`;
    const data = await fetchOnetJson(path);
    const matches = normalizeSearchResults(data);

    res.json({
      ok: true,
      keyword,
      matches,
      count: matches.length,
    });
  } catch (error) {
    console.error("O*NET search error:", error instanceof Error ? error.message : error);
    res.status(502).json({
      ok: false,
      error: error instanceof Error ? error.message : "Failed to search O*NET occupations",
    });
  }
});

router.get("/onet/occupation/:code", async (req, res) => {
  try {
    const apiKey = isOnetConfigured();
    if (!apiKey) {
      missingKeyResponse(res);
      return;
    }

    const code = String(req.params.code || "").trim();
    if (!code) {
      res.status(400).json({ ok: false, error: "O*NET-SOC code is required" });
      return;
    }

    const [summary, details] = await Promise.allSettled([
      fetchOnetJson(`/mnm/occupation/${encodeURIComponent(code)}`),
      fetchOnetJson(`/online/occupation/${encodeURIComponent(code)}/details`),
    ]);

    const summaryData = summary.status === "fulfilled" ? (summary.value as Record<string, unknown>) : {};
    const detailsData = details.status === "fulfilled" ? (details.value as Record<string, unknown>) : {};

    const profile = {
      code,
      title: String(summaryData?.title ?? detailsData?.title ?? ""),
      description: String(summaryData?.description ?? detailsData?.description ?? ""),
      tasks: extractArray(detailsData, "tasks", "task"),
      work_activities: extractArray(detailsData, "work_activities", "work_activity"),
      detailed_work_activities: extractArray(detailsData, "detailed_work_activities", "detailed_work_activity"),
      abilities: extractArray(detailsData, "abilities", "ability"),
      work_context: extractArray(detailsData, "work_context", "work_context"),
      skills: extractArray(detailsData, "skills", "skill"),
      knowledge: extractArray(detailsData, "knowledge", "knowledge"),
      related_occupations: extractArray(detailsData, "related_occupations", "related_occupation"),
      technology_skills: extractArray(detailsData, "technology_skills", "technology_skill"),
      rawSummary: summaryData,
      rawDetails: detailsData,
    };

    res.json({
      ok: true,
      occupation: profile,
      source: "O*NET Web Services",
    });
  } catch (error) {
    console.error("O*NET occupation error:", error instanceof Error ? error.message : error);
    res.status(502).json({
      ok: false,
      error: error instanceof Error ? error.message : "Failed to fetch O*NET occupation profile",
    });
  }
});

function extractArray(data: Record<string, unknown>, key: string, _itemKey: string) {
  const value = data[key];
  if (!Array.isArray(value)) return [];
  return value.map((item) => {
    if (typeof item === "string") return item;
    const record = item as Record<string, unknown>;
    const name = String(record.name ?? record.title ?? record.element_name ?? record.statement ?? "");
    const description = String(record.description ?? "");
    return {
      name,
      description: description && description !== name ? description : undefined,
      value: record.value,
    };
  }).filter((item) => {
    if (typeof item === "string") return item.trim().length > 0;
    return item.name || item.description;
  });
}

router.get("/onet/job-context", async (req, res) => {
  try {
    const apiKey = isOnetConfigured();
    if (!apiKey) {
      missingKeyResponse(res);
      return;
    }

    const keyword = String(req.query.keyword || "").trim();
    if (!keyword) {
      res.status(400).json({ ok: false, error: "keyword query parameter is required" });
      return;
    }

    const searchPath = `/mnm/search?keyword=${encodeURIComponent(keyword)}`;
    const searchData = await fetchOnetJson(searchPath);
    const matches = normalizeSearchResults(searchData);

    if (matches.length === 0) {
      res.json({
        ok: true,
        keyword,
        matches: [],
        context: null,
        message: "No matching O*NET occupations found.",
      });
      return;
    }

    const topMatch = matches[0];
    const [summary, details] = await Promise.allSettled([
      fetchOnetJson(`/mnm/occupation/${encodeURIComponent(topMatch.code)}`),
      fetchOnetJson(`/online/occupation/${encodeURIComponent(topMatch.code)}/details`),
    ]);

    const summaryData = summary.status === "fulfilled" ? (summary.value as Record<string, unknown>) : {};
    const detailsData = details.status === "fulfilled" ? (details.value as Record<string, unknown>) : {};

    const tasks = extractArray(detailsData, "tasks", "task");
    const workContext = extractArray(detailsData, "work_context", "work_context");
    const abilities = extractArray(detailsData, "abilities", "ability");
    const workActivities = extractArray(detailsData, "work_activities", "work_activity");
    const detailedWorkActivities = extractArray(detailsData, "detailed_work_activities", "detailed_work_activity");

    const context = {
      occupation: {
        code: topMatch.code,
        title: String(summaryData?.title ?? topMatch.title ?? ""),
        score: topMatch.score,
        description: String(summaryData?.description ?? detailsData?.description ?? ""),
      },
      matches,
      physical_demands: extractPhysicalDemands(workContext, abilities, workActivities, detailedWorkActivities),
      cognitive_demands: extractCognitiveDemands(abilities, workActivities, workContext),
      safety_sensitive_indicators: extractSafetyIndicators(workContext, workActivities, tasks, abilities),
      environmental_indicators: extractEnvironmentalIndicators(workContext),
      essential_function_suggestions: suggestEssentialFunctions(tasks, workActivities, abilities),
      raw: {
        tasks: tasks.slice(0, 20),
        work_context: workContext.slice(0, 30),
        abilities: abilities.slice(0, 20),
        work_activities: workActivities.slice(0, 20),
      },
    };

    res.json({
      ok: true,
      keyword,
      context,
      source: "O*NET Web Services",
    });
  } catch (error) {
    console.error("O*NET job context error:", error instanceof Error ? error.message : error);
    res.status(502).json({
      ok: false,
      error: error instanceof Error ? error.message : "Failed to generate O*NET job context",
    });
  }
});

function extractPhysicalDemands(
  workContext: unknown[],
  abilities: unknown[],
  workActivities: unknown[],
  detailedWorkActivities: unknown[],
) {
  const physicalElementNames = new Set([
    "static strength", "dynamic strength", "trunk strength", "explosive strength",
    "extent flexibility", "dynamic flexibility", "gross body coordination", "gross body equilibrium",
    " stamina", "manual dexterity", "finger dexterity", "arm-hand steadiness", "multi-limb coordination",
    "response orientation", "rate control", "reaction time", "wrist-finger speed", "speed of limb movement",
  ]);

  const physicalAbilities = (abilities as OnetItem[]).filter((a) => {
    const name = String(a.name ?? "").toLowerCase();
    return physicalElementNames.has(name) || physicalElementNames.has(name.replace(/\s+/g, " "));
  });

  const physicalActivities = (workActivities as OnetItem[]).filter((a) => {
    const name = String(a.name ?? "").toLowerCase();
    return /physical|lift|carry|climb|bend|kneel|crouch|reach|stand|walk|run|push|pull|balance|coordination|strength|stamina|dexterity|endurance/.test(name);
  });

  const detailed = (detailedWorkActivities as OnetItem[]).filter((a) => {
    const name = String(a.name ?? "").toLowerCase();
    return /lift|carry|move|load|unload|climb|stand|walk|operate|drive|inspect.*physical|repair|install|maintain|construction|equipment/.test(name);
  });

  const workContextItems = (workContext as OnetItem[]).filter((a) => {
    const name = String(a.name ?? "").toLowerCase();
    return /spend time standing|spend time walking|running|kneeling|crouching|crawling|keeping or regaining balance|outdoors|exposed to weather|spend time bending|spend time making repetitive motions|spend time using hands/.test(name);
  });

  return {
    summary: buildDemandSummary(physicalAbilities, physicalActivities, workContextItems),
    abilities: physicalAbilities.slice(0, 10),
    work_activities: physicalActivities.slice(0, 10),
    detailed_work_activities: detailed.slice(0, 10),
    work_context: workContextItems.slice(0, 10),
  };
}

function extractCognitiveDemands(abilities: unknown[], workActivities: unknown[], workContext: unknown[]) {
  const cognitiveAbilities = (abilities as OnetItem[]).filter((a) => {
    const name = String(a.name ?? "").toLowerCase();
    return /oral comprehension|written comprehension|oral expression|written expression|fluency of ideas|originality|memorization|problem sensitivity|deductive reasoning|inductive reasoning|information ordering|category flexibility|mathematical reasoning|number facility|speed of closure|flexibility of closure|perceptual speed|spatial orientation|visualization|selective attention|time sharing|sustained attention/.test(name);
  });

  const cognitiveActivities = (workActivities as OnetItem[]).filter((a) => {
    const name = String(a.name ?? "").toLowerCase();
    return /thinking|reasoning|decision|judgment|analyzing|evaluating|processing|information|planning|scheduling|estimating|problem|creative|monitoring|interpreting/.test(name);
  });

  const contextItems = (workContext as OnetItem[]).filter((a) => {
    const name = String(a.name ?? "").toLowerCase();
    return /level of competition|time pressure|importance of being exact or accurate|face-to-face discussions|freedom to make decisions|structured vs unstructured work|pace determined by speed of equipment/.test(name);
  });

  return {
    summary: buildDemandSummary(cognitiveAbilities, cognitiveActivities, contextItems),
    abilities: cognitiveAbilities.slice(0, 10),
    work_activities: cognitiveActivities.slice(0, 10),
    work_context: contextItems.slice(0, 10),
  };
}

function extractSafetyIndicators(workContext: unknown[], workActivities: unknown[], tasks: unknown[], abilities: unknown[]) {
  const safetyContext = (workContext as OnetItem[]).filter((a) => {
    const name = String(a.name ?? "").toLowerCase();
    return /exposed to contaminants|exposed to disease|exposed to infection|exposed to hazardous conditions|exposed to hazardous equipment|exposed to minor burns|cuts|bites|stings|wear common protective|wear specialized protective|responsible for others' safety|high places|confined spaces|deal with physically aggressive|exposed to radiation|exposed to loud noises|exposed to whole body vibration|exposed to very hot|very cold|extremely bright|in an enclosed vehicle|operate vehicles|deal with unpleasant/.test(name);
  });

  const safetyActivities = (workActivities as OnetItem[]).filter((a) => {
    const name = String(a.name ?? "").toLowerCase();
    return /safety|inspect|monitor|protect|hazard|risk|emergency|danger|accident|equipment|vehicle|machinery/.test(name);
  });

  const safetyTasks = (tasks as OnetItem[]).filter((t) => {
    const name = String(t.name ?? "").toLowerCase();
    return /safety|inspect|hazard|protect|equipment|emergency|accident|risk|danger|secure|lockout|tagout|ppe|respirator|fall protection|confined space|lockout/.test(name);
  });

  const safetyAbilities = (abilities as OnetItem[]).filter((a) => {
    const name = String(a.name ?? "").toLowerCase();
    return /near vision|far vision|visual color discrimination|night vision|peripheral vision|depth perception|glare sensitivity|auditory attention|sound localization|hearing sensitivity|speech clarity|speech recognition|reaction time|response orientation/.test(name);
  });

  const indicators: string[] = [];
  if (safetyContext.length > 0) indicators.push("Work context includes exposure to hazardous conditions, equipment, or protective-equipment requirements.");
  if (safetyActivities.length > 0) indicators.push("Work activities include safety monitoring, inspection, or hazard identification.");
  if (safetyTasks.length > 0) indicators.push("Task statements reference safety, inspection, or hazard control.");
  if (safetyAbilities.length > 0) indicators.push("Sensory/perceptual abilities are relevant for safety-critical vigilance.");
  if (indicators.length === 0) indicators.push("No strong safety-sensitive indicators found in O*NET data for this occupation.");

  return {
    safety_sensitive: indicators.length > 1,
    indicators,
    work_context: safetyContext.slice(0, 10),
    work_activities: safetyActivities.slice(0, 10),
    tasks: safetyTasks.slice(0, 10),
  };
}

function extractEnvironmentalIndicators(workContext: unknown[]) {
  const environmental = (workContext as OnetItem[]).filter((a) => {
    const name = String(a.name ?? "").toLowerCase();
    return /outdoors|indoors|exposed to weather|exposed to hot|exposed to cold|exposed to contaminants|exposed to disease|exposed to infection|exposed to hazardous conditions|exposed to hazardous equipment|exposed to high places|exposed to cramped|exposed to whole body vibration|exposed to loud noises|exposed to very bright|exposed to dim|wet|humid|noisy|quiet/.test(name);
  });

  return {
    summary: environmental.length > 0
      ? `${environmental.length} O*NET work-context element(s) describe environmental or exposure conditions.`
      : "No explicit environmental or exposure indicators found.",
    work_context: environmental.slice(0, 15),
  };
}

function suggestEssentialFunctions(tasks: unknown[], workActivities: unknown[], abilities: unknown[]) {
  const suggestions: string[] = [];

  for (const task of tasks.slice(0, 8) as OnetItem[]) {
    const name = String(task.name ?? "").trim();
    if (name) suggestions.push(`Perform essential job task: ${name}`);
  }

  for (const activity of workActivities.slice(0, 5) as OnetItem[]) {
    const name = String(activity.name ?? "").trim();
    if (name) suggestions.push(`Perform core work activity: ${name}`);
  }

  const criticalAbilities = (abilities as OnetItem[]).filter((a) => {
    const n = String(a.name ?? "").toLowerCase();
    return /oral comprehension|written comprehension|near vision|problem sensitivity|deductive reasoning|manual dexterity|multi-limb coordination|speech clarity|speech recognition/.test(n);
  });

  for (const ability of criticalAbilities.slice(0, 3)) {
    const name = String(ability.name ?? "").trim();
    if (name) suggestions.push(`Demonstrate required ability: ${name}`);
  }

  return Array.from(new Set(suggestions)).slice(0, 12);
}

function buildDemandSummary(abilities: unknown[], activities: unknown[], context: unknown[]) {
  const parts: string[] = [];
  if (abilities.length > 0) parts.push(`${abilities.length} related ability element(s)`);
  if (activities.length > 0) parts.push(`${activities.length} related work activity/ies`);
  if (context.length > 0) parts.push(`${context.length} related work-context element(s)`);
  return parts.length > 0
    ? `O*NET data contains ${parts.join(", ")} for this demand category.`
    : "No explicit O*NET indicators found for this demand category.";
}

export default router;
