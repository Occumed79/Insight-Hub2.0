export type EvidenceGrade = "A" | "B" | "C" | "D" | "Unavailable";

export type IndustryImpactInputs = {
  workforce: number;
  annualHours: number;
  observedCases: number;
  observedDartCases: number;
  observedDaysAwayCases: number;
  eventsAvoided: number;
  directCostPerEvent: number;
  indirectMultiplier: number;
  profitMarginPercent: number;
  trcRate?: number | null;
  dartRate?: number | null;
  daysAwayRate?: number | null;
};

export type IndustryImpactResult = {
  expectedRecordables: number;
  expectedDartCases: number;
  expectedDaysAwayCases: number;
  observedTrir: number;
  observedDartRate: number;
  observedDaysAwayRate: number;
  benchmarkGap: number | null;
  directAvoidedCost: number;
  indirectAvoidedCost: number;
  potentialAvoidedCost: number;
  revenueRequiredToRecover: number;
};

export function safeNumber(value: number, fallback = 0): number {
  return Number.isFinite(value) ? value : fallback;
}

export function clamp(value: number, min = 0, max = 100): number {
  return Math.min(max, Math.max(min, safeNumber(value)));
}

export function calculateIncidentRate(
  cases: number,
  hoursWorked: number,
): number {
  if (hoursWorked <= 0) return 0;
  return safeNumber((Math.max(cases, 0) * 200_000) / hoursWorked);
}

export function expectedCasesFromRate(
  rate: number | null | undefined,
  workforce: number,
): number {
  if (rate === null || rate === undefined || rate < 0 || workforce <= 0)
    return 0;
  return safeNumber((rate * workforce) / 100);
}

export function expectedCasesFromHours(
  rate: number | null | undefined,
  hoursWorked: number,
): number {
  if (rate === null || rate === undefined || rate < 0 || hoursWorked <= 0)
    return 0;
  return safeNumber((rate * hoursWorked) / 200_000);
}

export function calculateIndustryImpact(
  input: IndustryImpactInputs,
): IndustryImpactResult {
  const expectedRecordables = expectedCasesFromHours(
    input.trcRate,
    input.annualHours,
  );
  const expectedDartCases = expectedCasesFromHours(
    input.dartRate,
    input.annualHours,
  );
  const expectedDaysAwayCases = expectedCasesFromHours(
    input.daysAwayRate,
    input.annualHours,
  );
  const observedTrir = calculateIncidentRate(
    input.observedCases,
    input.annualHours,
  );
  const observedDartRate = calculateIncidentRate(
    input.observedDartCases,
    input.annualHours,
  );
  const observedDaysAwayRate = calculateIncidentRate(
    input.observedDaysAwayCases,
    input.annualHours,
  );
  const benchmarkGap =
    input.trcRate === null || input.trcRate === undefined
      ? null
      : observedTrir - input.trcRate;
  const directAvoidedCost =
    Math.max(input.eventsAvoided, 0) * Math.max(input.directCostPerEvent, 0);
  const indirectAvoidedCost =
    directAvoidedCost * Math.max(input.indirectMultiplier, 0);
  const potentialAvoidedCost = directAvoidedCost + indirectAvoidedCost;
  const margin = Math.max(input.profitMarginPercent, 0) / 100;
  const revenueRequiredToRecover =
    margin > 0 ? potentialAvoidedCost / margin : 0;

  return {
    expectedRecordables,
    expectedDartCases,
    expectedDaysAwayCases,
    observedTrir,
    observedDartRate,
    observedDaysAwayRate,
    benchmarkGap,
    directAvoidedCost,
    indirectAvoidedCost,
    potentialAvoidedCost,
    revenueRequiredToRecover,
  };
}

export type WorkersCompCostResult = {
  medical: number;
  wageReplacement: number;
  administration: number;
  indirect: number;
  total: number;
};

export function calculateWorkersCompCost(input: {
  claims: number;
  medicalCostPerClaim: number;
  lostDaysPerClaim: number;
  dailyCompensationCost: number;
  administrativePercent: number;
  indirectMultiplier: number;
}): WorkersCompCostResult {
  const claims = Math.max(input.claims, 0);
  const medical = claims * Math.max(input.medicalCostPerClaim, 0);
  const wageReplacement =
    claims *
    Math.max(input.lostDaysPerClaim, 0) *
    Math.max(input.dailyCompensationCost, 0);
  const administration =
    (medical + wageReplacement) *
    (Math.max(input.administrativePercent, 0) / 100);
  const indirect =
    (medical + wageReplacement + administration) *
    Math.max(input.indirectMultiplier, 0);
  return {
    medical,
    wageReplacement,
    administration,
    indirect,
    total: medical + wageReplacement + administration + indirect,
  };
}

export function calculateLostTime(input: {
  cases: number;
  daysAway: number;
  restrictedDays: number;
  hourlyCompensation: number;
  overtimePercent: number;
}) {
  const cases = Math.max(input.cases, 0);
  const awayHours = cases * Math.max(input.daysAway, 0) * 8;
  const restrictedHours = cases * Math.max(input.restrictedDays, 0) * 8;
  const productiveHoursLost = awayHours + restrictedHours * 0.5;
  const baseExposure =
    productiveHoursLost * Math.max(input.hourlyCompensation, 0);
  const overtimeExposure =
    awayHours *
    Math.max(input.hourlyCompensation, 0) *
    (Math.max(input.overtimePercent, 0) / 100);
  return {
    awayHours,
    restrictedHours,
    productiveHoursLost,
    baseExposure,
    overtimeExposure,
    total: baseExposure + overtimeExposure,
  };
}

export function calculateReturnToWork(input: {
  workers: number;
  fullDutyDays: number;
  modifiedDutyDays: number;
  dailyCompensationCost: number;
  modifiedProductivityPercent: number;
}) {
  const workers = Math.max(input.workers, 0);
  const daily = Math.max(input.dailyCompensationCost, 0);
  const withoutModifiedDuty = workers * Math.max(input.fullDutyDays, 0) * daily;
  const modifiedProductivityLoss =
    1 - clamp(input.modifiedProductivityPercent, 0, 100) / 100;
  const withModifiedDuty =
    workers *
    Math.max(input.modifiedDutyDays, 0) *
    daily *
    modifiedProductivityLoss;
  return {
    withoutModifiedDuty,
    withModifiedDuty,
    potentialDifference: Math.max(withoutModifiedDuty - withModifiedDuty, 0),
    daysRecovered: Math.max(
      (input.fullDutyDays - input.modifiedDutyDays) * workers,
      0,
    ),
  };
}

export function calculateFatigueIndex(input: {
  shiftHours: number;
  weeklyHours: number;
  consecutiveShifts: number;
  nightWorkPercent: number;
  drivingPercent: number;
  physicalDemandPercent: number;
}) {
  const shift = clamp(((input.shiftHours - 8) / 8) * 25, 0, 25);
  const weekly = clamp(((input.weeklyHours - 40) / 30) * 25, 0, 25);
  const consecutive = clamp(((input.consecutiveShifts - 4) / 6) * 15, 0, 15);
  const night = clamp(input.nightWorkPercent, 0, 100) * 0.15;
  const driving = clamp(input.drivingPercent, 0, 100) * 0.1;
  const physical = clamp(input.physicalDemandPercent, 0, 100) * 0.1;
  const score = clamp(
    shift + weekly + consecutive + night + driving + physical,
  );
  return {
    score,
    band:
      score >= 70
        ? "Critical"
        : score >= 50
          ? "High"
          : score >= 30
            ? "Elevated"
            : "Lower",
    components: { shift, weekly, consecutive, night, driving, physical },
  };
}

export function calculateReadinessIndex(input: {
  demandCompatibility: number;
  healthResilience: number;
  fatigueControl: number;
  surveillanceCoverage: number;
  modifiedDutyCapacity: number;
  environmentalControls: number;
}) {
  const dimensions = {
    demandCompatibility: clamp(input.demandCompatibility),
    healthResilience: clamp(input.healthResilience),
    fatigueControl: clamp(input.fatigueControl),
    surveillanceCoverage: clamp(input.surveillanceCoverage),
    modifiedDutyCapacity: clamp(input.modifiedDutyCapacity),
    environmentalControls: clamp(input.environmentalControls),
  };
  const score =
    Object.values(dimensions).reduce((sum, value) => sum + value, 0) /
    Object.keys(dimensions).length;
  return {
    score,
    band:
      score >= 80
        ? "Strong"
        : score >= 65
          ? "Stable"
          : score >= 45
            ? "Watch"
            : "Vulnerable",
    dimensions,
  };
}

export function calculateBreakEven(input: {
  programCost: number;
  costPerEvent: number;
  effectivenessPercent: number;
  population: number;
  baselineEventsPerHundred: number;
}) {
  const expectedEvents = expectedCasesFromRate(
    input.baselineEventsPerHundred,
    input.population,
  );
  const avoidedEvents =
    expectedEvents * (clamp(input.effectivenessPercent) / 100);
  const potentialBenefit = avoidedEvents * Math.max(input.costPerEvent, 0);
  const netImpact = potentialBenefit - Math.max(input.programCost, 0);
  const eventsToBreakEven =
    input.costPerEvent > 0
      ? Math.max(input.programCost, 0) / input.costPerEvent
      : 0;
  return {
    expectedEvents,
    avoidedEvents,
    potentialBenefit,
    netImpact,
    eventsToBreakEven,
  };
}
