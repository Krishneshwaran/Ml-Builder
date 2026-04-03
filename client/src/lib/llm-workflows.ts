export const LLM_WORKFLOWS_KEY = "AutoML_llm_workflows";

export interface LlmWorkflow {
  id: string;
  name: string;
  description: string;
  category: "project-assistant" | "operations" | "evaluation";
  systemPrompt: string;
  userPromptTemplate: string;
  createdAt: string;
  updatedAt: string;
}

function createWorkflowId() {
  return `llm-workflow-${Math.random().toString(36).slice(2, 10)}`;
}

export const defaultLlmWorkflows: LlmWorkflow[] = [
  {
    id: "failure-to-training-loop",
    name: "Failure-to-Training Loop",
    description: "Turn bad predictions, low confidence, and user corrections into a concrete data-collection plan.",
    category: "project-assistant",
    systemPrompt:
      "You are an ML operations copilot. Your job is to analyze model failures and turn them into a short, practical retraining plan. Be concrete, data-focused, and action-oriented.",
    userPromptTemplate:
      "Project context:\n{{context}}\n\nModel issue:\n{{input}}\n\nReturn:\n1. likely failure causes\n2. missing data patterns\n3. exact new examples to collect\n4. whether to relabel, split, or merge classes\n5. one next experiment to run",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "prompt-to-dataset-builder",
    name: "Prompt-to-Dataset Builder",
    description: "Convert a natural-language idea into dataset classes, enrollment prompts, and collection guidance.",
    category: "project-assistant",
    systemPrompt:
      "You are a dataset design assistant for local ML systems. Create clear class definitions, naming rules, and collection advice from plain language requirements.",
    userPromptTemplate:
      "User idea:\n{{input}}\n\nOptional project context:\n{{context}}\n\nReturn:\n1. suggested classes\n2. naming rules\n3. what images/examples to collect per class\n4. common confusions to avoid\n5. a short enrollment prompt for each class",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "deployment-safety-reviewer",
    name: "Deployment Safety Reviewer",
    description: "Review whether a model is safe enough to deploy and what operational guardrails it needs.",
    category: "operations",
    systemPrompt:
      "You are an AI safety and deployment reviewer for applied ML. Focus on operational risk, monitoring, fallback behavior, and business safety.",
    userPromptTemplate:
      "Project context:\n{{context}}\n\nSystem details:\n{{input}}\n\nReturn:\n1. deployment risks\n2. recommended guardrails\n3. monitoring signals to track\n4. human-review triggers\n5. whether this is safe for pilot, limited rollout, or not ready",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

export function loadLlmWorkflows(): LlmWorkflow[] {
  try {
    const raw = localStorage.getItem(LLM_WORKFLOWS_KEY);
    if (!raw) {
      return defaultLlmWorkflows;
    }
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed;
    }
  } catch {}
  return defaultLlmWorkflows;
}

export function saveLlmWorkflows(workflows: LlmWorkflow[]) {
  localStorage.setItem(LLM_WORKFLOWS_KEY, JSON.stringify(workflows));
}

export function createEmptyWorkflow(): LlmWorkflow {
  const now = new Date().toISOString();
  return {
    id: createWorkflowId(),
    name: "New Workflow",
    description: "Describe what this workflow helps with.",
    category: "project-assistant",
    systemPrompt: "You are a helpful local AI assistant for ML projects.",
    userPromptTemplate: "{{input}}",
    createdAt: now,
    updatedAt: now,
  };
}
