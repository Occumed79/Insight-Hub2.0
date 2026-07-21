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
  LEGACY_EMPLOYER_WORKFLOW_STORAGE_KEY,
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
  };
}

function emptyWorkflow(): StoredWorkflow {
  return {
    context: { ...EMPTY_EMPLOYER_WORKFLOW_CONTEXT },
    completedStepIds: [],
    updatedAt: new Date().toISOString(),
  };
}

function readStoredWorkflow(): StoredWorkflow {
  const fallback = emptyWorkflow();
  if (typeof window === "undefined") return fallback;

  try {
    // Remove the prior persistent workflow record so legacy notes or employer
    // values cannot remain in long-lived browser storage.
    window.localStorage.removeItem(LEGACY_EMPLOYER_WORKFLOW_STORAGE_KEY);

    const raw = window.sessionStorage.getItem(EMPLOYER_WORKFLOW_STORAGE_KEY);
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

export function EmployerWorkflowProvider({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const [workflow, setWorkflow] = useState<StoredWorkflow>(readStoredWorkflow);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.sessionStorage.setItem(EMPLOYER_WORKFLOW_STORAGE_KEY, JSON.stringify(workflow));
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
      const next = emptyWorkflow();
      if (typeof window !== "undefined") {
        window.sessionStorage.removeItem(EMPLOYER_WORKFLOW_STORAGE_KEY);
        window.localStorage.removeItem(LEGACY_EMPLOYER_WORKFLOW_STORAGE_KEY);
      }
      setWorkflow(next);
    },
  }), [currentStep, workflow]);

  return <WorkflowContext.Provider value={value}>{children}</WorkflowContext.Provider>;
}

export function useEmployerWorkflow(): EmployerWorkflowValue {
  const value = useContext(WorkflowContext);
  if (!value) throw new Error("useEmployerWorkflow must be used within EmployerWorkflowProvider");
  return value;
}
