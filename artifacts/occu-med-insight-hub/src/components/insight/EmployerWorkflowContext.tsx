import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useLocation } from "wouter";
import {
  EMPLOYER_WORKFLOW_STORAGE_KEY,
  EMPTY_EMPLOYER_WORKFLOW_CONTEXT,
  WORKFLOW_STEPS,
  type EmployerWorkflowContext as EmployerContext,
  type WorkflowStep,
  type WorkflowStepId,
} from "@/data/employerWorkflow";

type StoredWorkflow = {
  context: EmployerContext;
  completedStepIds: WorkflowStepId[];
  updatedAt: string;
};

type EmployerWorkflowValue = StoredWorkflow & {
  currentStep: WorkflowStep | null;
  updateContext: (patch: Partial<EmployerContext>) => void;
  replaceContext: (context: EmployerContext) => void;
  markStepComplete: (stepId: WorkflowStepId) => void;
  reopenStep: (stepId: WorkflowStepId) => void;
  clearWorkflow: () => void;
};

const WorkflowContext = createContext<EmployerWorkflowValue | null>(null);

function normalizeContext(value: Partial<EmployerContext> | undefined): EmployerContext {
  return {
    employer: typeof value?.employer === "string" ? value.employer : "",
    legalName: typeof value?.legalName === "string" ? value.legalName : "",
    state: typeof value?.state === "string" ? value.state.toUpperCase() : "",
    jobTitle: typeof value?.jobTitle === "string" ? value.jobTitle : "",
    naics: typeof value?.naics === "string" ? value.naics : "",
    country: typeof value?.country === "string" ? value.country : "",
    notes: typeof value?.notes === "string" ? value.notes : "",
  };
}

function readStoredWorkflow(): StoredWorkflow {
  const fallback: StoredWorkflow = {
    context: { ...EMPTY_EMPLOYER_WORKFLOW_CONTEXT },
    completedStepIds: [],
    updatedAt: new Date().toISOString(),
  };

  if (typeof window === "undefined") return fallback;

  try {
    const raw = window.localStorage.getItem(EMPLOYER_WORKFLOW_STORAGE_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Partial<StoredWorkflow>;
    const validStepIds = new Set(WORKFLOW_STEPS.map((step) => step.id));
    return {
      context: normalizeContext(parsed.context),
      completedStepIds: Array.isArray(parsed.completedStepIds)
        ? parsed.completedStepIds.filter((id): id is WorkflowStepId => validStepIds.has(id as WorkflowStepId))
        : [],
      updatedAt: typeof parsed.updatedAt === "string" ? parsed.updatedAt : fallback.updatedAt,
    };
  } catch {
    return fallback;
  }
}

function queryContext(): Partial<EmployerContext> {
  if (typeof window === "undefined") return {};
  const params = new URLSearchParams(window.location.search);
  const employer = params.get("employer") ?? params.get("company") ?? params.get("companyName") ?? "";
  const jobTitle = params.get("job") ?? params.get("jobTitle") ?? "";
  const state = params.get("state") ?? "";
  const legalName = params.get("legalName") ?? "";
  const naics = params.get("naics") ?? "";
  const country = params.get("country") ?? "";

  return {
    ...(employer.trim() ? { employer } : {}),
    ...(legalName.trim() ? { legalName } : {}),
    ...(state.trim() ? { state: state.toUpperCase() } : {}),
    ...(jobTitle.trim() ? { jobTitle } : {}),
    ...(naics.trim() ? { naics } : {}),
    ...(country.trim() ? { country } : {}),
  };
}

function sameContext(a: EmployerContext, b: EmployerContext): boolean {
  return Object.keys(a).every((key) => a[key as keyof EmployerContext] === b[key as keyof EmployerContext]);
}

export function EmployerWorkflowProvider({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const [workflow, setWorkflow] = useState<StoredWorkflow>(readStoredWorkflow);

  useEffect(() => {
    const patch = queryContext();
    if (Object.keys(patch).length === 0) return;

    setWorkflow((current) => {
      const nextContext = normalizeContext({ ...current.context, ...patch });
      if (sameContext(current.context, nextContext)) return current;
      return { ...current, context: nextContext, updatedAt: new Date().toISOString() };
    });
  }, [location]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(EMPLOYER_WORKFLOW_STORAGE_KEY, JSON.stringify(workflow));
  }, [workflow]);

  const currentPath = location.split("?")[0];
  const currentStep = WORKFLOW_STEPS.find((step) => step.route === currentPath) ?? null;

  const value = useMemo<EmployerWorkflowValue>(() => ({
    ...workflow,
    currentStep,
    updateContext: (patch) => {
      setWorkflow((current) => ({
        ...current,
        context: normalizeContext({ ...current.context, ...patch }),
        updatedAt: new Date().toISOString(),
      }));
    },
    replaceContext: (context) => {
      setWorkflow((current) => ({
        ...current,
        context: normalizeContext(context),
        updatedAt: new Date().toISOString(),
      }));
    },
    markStepComplete: (stepId) => {
      setWorkflow((current) => current.completedStepIds.includes(stepId)
        ? current
        : {
            ...current,
            completedStepIds: [...current.completedStepIds, stepId],
            updatedAt: new Date().toISOString(),
          });
    },
    reopenStep: (stepId) => {
      setWorkflow((current) => ({
        ...current,
        completedStepIds: current.completedStepIds.filter((id) => id !== stepId),
        updatedAt: new Date().toISOString(),
      }));
    },
    clearWorkflow: () => {
      setWorkflow({
        context: { ...EMPTY_EMPLOYER_WORKFLOW_CONTEXT },
        completedStepIds: [],
        updatedAt: new Date().toISOString(),
      });
    },
  }), [currentStep, workflow]);

  return <WorkflowContext.Provider value={value}>{children}</WorkflowContext.Provider>;
}

export function useEmployerWorkflow(): EmployerWorkflowValue {
  const value = useContext(WorkflowContext);
  if (!value) throw new Error("useEmployerWorkflow must be used within EmployerWorkflowProvider");
  return value;
}
