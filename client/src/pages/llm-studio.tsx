import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { ArrowLeft, Bot, BrainCircuit, RefreshCw, Rocket, ShieldCheck, Sparkles, Wand2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LiveTrainingLogs } from "@/components/live-training-logs";
import { WorkflowSteps } from "@/components/workflow-steps";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { loadSettings, SETTINGS_KEY, type AppSettings } from "@/lib/app-settings";
import { apiRequest } from "@/lib/queryClient";
import {
  createEmptyWorkflow,
  loadLlmWorkflows,
  saveLlmWorkflows,
  type LlmWorkflow,
} from "@/lib/llm-workflows";
import type { Dataset, Deployment, MlModel, Project } from "@shared/schema";

type LlmModelSummary = {
  name: string;
  size?: number | null;
  modifiedAt?: string | null;
};

type LlmModelsResponse = {
  provider: string;
  baseUrl: string;
  models: LlmModelSummary[];
};

type AutoBuildResponse = {
  message: string;
  llmWarning?: string | null;
  buildLog?: string[];
  project?: Project | null;
  dataset?: Dataset | null;
  model?: MlModel | null;
  buildPlan?: {
    projectName: string;
    projectDescription: string;
    templateId: string;
    taskType: string;
    desiredLabels: string[];
    searchQueries: string[];
    strictLabelMatch: boolean;
    planningMode: string;
  } | null;
  datasetSelection?: {
    ref: string;
    title?: string | null;
    searchQuery?: string | null;
    voteCount?: number | null;
    downloadCount?: number | null;
    sourceUrl?: string | null;
    labels?: string[];
    matchedLabels?: string[];
  } | null;
  runtime?: {
    torchAvailable?: boolean;
    cudaAvailable?: boolean;
    gpuName?: string | null;
  } | null;
  trainingSettings?: {
    preferGpu: boolean;
    baseModel: string;
    trainingEpochs: number;
    autoAssignedEpochs?: boolean;
    epochReason?: string;
    usePretrainedWeights: boolean;
    useImageAugmentation: boolean;
  } | null;
};

type ResourceUsageResponse = {
  cpu: {
    usagePercent?: number | null;
  };
  memory: {
    usedGb?: number | null;
    totalGb?: number | null;
    usagePercent?: number | null;
  };
  gpus: Array<{
    index?: string | null;
    name?: string | null;
    usagePercent?: number | null;
    memoryTotalGb?: number | null;
    memoryUsedGb?: number | null;
    memoryFreeGb?: number | null;
    memoryUsagePercent?: number | null;
    temperatureC?: number | null;
  }>;
};

function formatBytes(bytes?: number | null) {
  if (!bytes || bytes <= 0) return "Unknown size";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let value = bytes;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${value.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

function compileWorkflowPrompt(workflow: LlmWorkflow, input: string, context: string) {
  return workflow.userPromptTemplate
    .replaceAll("{{input}}", input)
    .replaceAll("{{context}}", context);
}

export default function LlmStudio() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [settings, setSettings] = useState<AppSettings>(loadSettings);
  const [workflows, setWorkflows] = useState<LlmWorkflow[]>(loadLlmWorkflows);
  const [selectedWorkflowId, setSelectedWorkflowId] = useState<string>(loadLlmWorkflows()[0]?.id || "");
  const [runInput, setRunInput] = useState("");
  const [projectContext, setProjectContext] = useState("");
  const [llmOutput, setLlmOutput] = useState("");
  const [isRunning, setIsRunning] = useState(false);
  const [activeTab, setActiveTab] = useState("models");
  const [autoBuildPrompt, setAutoBuildPrompt] = useState(
    "Train a model to identify which waste is biodegradable and which is not biodegradable.",
  );
  const [autoBuildRequireGpu, setAutoBuildRequireGpu] = useState(loadSettings().alwaysUseGpu);
  const [autoAssignEpochs, setAutoAssignEpochs] = useState(true);
  const [isAutoBuilding, setIsAutoBuilding] = useState(false);
  const [autoBuildResult, setAutoBuildResult] = useState<AutoBuildResponse | null>(null);
  const [autoBuildConsoleLines, setAutoBuildConsoleLines] = useState<string[]>([]);

  const searchParams = new URLSearchParams(window.location.search);
  const attachedProjectId = searchParams.get("projectId") || "";

  const { data: attachedProject } = useQuery<Project>({
    queryKey: ["/api/projects", attachedProjectId],
    enabled: !!attachedProjectId,
  });

  const { data: attachedDataset } = useQuery<Dataset>({
    queryKey: ["/api/projects", attachedProjectId, "dataset"],
    enabled: !!attachedProjectId,
  });

  const { data: attachedModel } = useQuery<MlModel>({
    queryKey: ["/api/projects", attachedProjectId, "model"],
    enabled: !!attachedProjectId,
  });

  const { data: attachedDeployment } = useQuery<Deployment>({
    queryKey: ["/api/projects", attachedProjectId, "deployment"],
    enabled: !!attachedProjectId,
  });

  const {
    data: modelsResponse,
    isLoading: modelsLoading,
    isFetching: modelsFetching,
    refetch: refetchModels,
    error: modelsError,
  } = useQuery<LlmModelsResponse>({
    queryKey: ["/api/system/llm/models", settings.llmProvider, settings.llmBaseUrl],
    enabled: settings.llmProvider === "ollama",
    queryFn: async () => {
      const params = new URLSearchParams({
        provider: settings.llmProvider,
        baseUrl: settings.llmBaseUrl,
      });
      const response = await fetch(`/api/system/llm/models?${params.toString()}`, {
        credentials: "include",
      });
      if (!response.ok) {
        const message = await response.text();
        throw new Error(message || "Unable to load local LLM models");
      }
      return response.json();
    },
  });

  const autoBuiltProjectId = autoBuildResult?.project?.id || "";

  const { data: autoBuiltModel } = useQuery<MlModel>({
    queryKey: ["/api/projects", autoBuiltProjectId, "model"],
    enabled: !!autoBuiltProjectId,
    refetchInterval: (query) => {
      const data = query.state.data as MlModel | undefined;
      return data?.status === "training" ? 1500 : false;
    },
  });

  const { data: autoBuiltTrainingLogs } = useQuery<Array<{ message: string; createdAt: string }>>({
    queryKey: ["/api/projects", autoBuiltProjectId, "training-logs"],
    enabled:
      !!autoBuiltProjectId &&
      !!autoBuiltModel &&
      (autoBuiltModel.status === "training" || autoBuiltModel.status === "completed" || autoBuiltModel.status === "failed"),
    refetchInterval: autoBuiltModel?.status === "training" ? 1500 : false,
  });

  const { data: resourceUsage } = useQuery<ResourceUsageResponse>({
    queryKey: ["/api/system/resource-usage"],
    enabled: activeTab === "auto-build" && (!!autoBuiltProjectId || isAutoBuilding),
    refetchInterval: autoBuiltModel?.status === "training" || isAutoBuilding ? 2000 : false,
  });

  const selectedWorkflow =
    workflows.find((workflow) => workflow.id === selectedWorkflowId) || workflows[0] || createEmptyWorkflow();

  useEffect(() => {
    if (!selectedWorkflowId && workflows[0]) {
      setSelectedWorkflowId(workflows[0].id);
    }
  }, [selectedWorkflowId, workflows]);

  useEffect(() => {
    if (attachedProject) {
      const defaultContext = [
        `Project: ${attachedProject.name}`,
        `Template: ${attachedProject.templateId}`,
        attachedProject.description ? `Description: ${attachedProject.description}` : null,
        `Status: ${attachedProject.status}`,
      ]
        .filter(Boolean)
        .join("\n");
      setProjectContext((current) => current || defaultContext);
      setActiveTab("workflows");
    }
  }, [attachedProject]);

  const persistSettings = (nextSettings: AppSettings) => {
    setSettings(nextSettings);
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(nextSettings));
  };

  const updateWorkflow = (workflowId: string, patch: Partial<LlmWorkflow>) => {
    const next = workflows.map((workflow) =>
      workflow.id === workflowId
        ? {
            ...workflow,
            ...patch,
            updatedAt: new Date().toISOString(),
          }
        : workflow,
    );
    setWorkflows(next);
    saveLlmWorkflows(next);
  };

  const createWorkflow = () => {
    const workflow = createEmptyWorkflow();
    const next = [workflow, ...workflows];
    setWorkflows(next);
    setSelectedWorkflowId(workflow.id);
    saveLlmWorkflows(next);
    setActiveTab("workflows");
  };

  const useModel = (modelName: string) => {
    const nextSettings = { ...settings, llmModel: modelName };
    persistSettings(nextSettings);
    toast({
      title: "Active LLM updated",
      description: `${modelName} is now the selected local model.`,
    });
  };

  const runWorkflow = async () => {
    if (!selectedWorkflow) return;
    if (!runInput.trim()) {
      toast({
        title: "Input required",
        description: "Add a prompt input before running the workflow.",
        variant: "destructive",
      });
      return;
    }

    setIsRunning(true);
    setLlmOutput("");
    try {
      const response = await apiRequest("POST", "/api/system/llm/run", {
        provider: settings.llmProvider,
        baseUrl: settings.llmBaseUrl,
        model: settings.llmModel,
        systemPrompt: selectedWorkflow.systemPrompt,
        prompt: compileWorkflowPrompt(selectedWorkflow, runInput, projectContext),
      });
      const result = await response.json();
      setLlmOutput(result.response || "");
      setActiveTab("workflows");
      toast({
        title: "Workflow complete",
        description: `Ran ${selectedWorkflow.name} with ${settings.llmModel}.`,
      });
    } catch (error) {
      toast({
        title: "Workflow failed",
        description: error instanceof Error ? error.message : "Unable to run the selected workflow.",
        variant: "destructive",
      });
    } finally {
      setIsRunning(false);
    }
  };

  const runAutoBuild = async () => {
    if (!autoBuildPrompt.trim()) {
      toast({
        title: "Prompt required",
        description: "Describe the project you want to build in plain English first.",
        variant: "destructive",
      });
      return;
    }

    setIsAutoBuilding(true);
    setAutoBuildResult(null);
    setAutoBuildConsoleLines([
      `$ prompt: ${autoBuildPrompt.trim()}`,
      `> model: ${settings.llmModel}`,
      `> gpu mode: ${autoBuildRequireGpu ? "required" : "auto-if-available"}`,
      `> epochs: ${autoAssignEpochs ? "auto-assign" : `${settings.imageTrainingEpochs} manual`}`,
      "> status: sending auto-build request...",
    ]);
    try {
      const response = await apiRequest("POST", "/api/system/llm/build-project", {
        prompt: autoBuildPrompt,
        provider: settings.llmProvider,
        baseUrl: settings.llmBaseUrl,
        model: settings.llmModel,
        preferGpu: autoBuildRequireGpu,
        baseModel: settings.imageBaseModel,
        usePretrainedWeights: settings.usePretrainedWeights,
        trainingEpochs: autoAssignEpochs ? 0 : settings.imageTrainingEpochs,
        useImageAugmentation: settings.useImageAugmentation,
      });
      const result = (await response.json()) as AutoBuildResponse;
      setAutoBuildResult(result);
      setAutoBuildConsoleLines(result.buildLog?.length ? result.buildLog : [`$ prompt: ${autoBuildPrompt.trim()}`, "> build complete"]);
      setActiveTab("auto-build");
      toast({
        title: "Project build started",
        description: result.message || "Created a project, imported a dataset, and started local training.",
      });
    } catch (error) {
      setAutoBuildConsoleLines((current) => [
        ...current,
        `! error: ${error instanceof Error ? error.message : "Could not build the project from your request."}`,
      ]);
      toast({
        title: "Auto build failed",
        description: error instanceof Error ? error.message : "Could not build the project from your request.",
        variant: "destructive",
      });
    } finally {
      setIsAutoBuilding(false);
    }
  };

  const projectUseCases = [
    {
      title: "English-to-Training Auto Builder",
      description: "Describe a vision task in plain English and let the app create a project, search Kaggle, import a dataset, and start local training.",
    },
    {
      title: "Failure-to-Training Loop",
      description: "Analyze bad predictions and generate a data-collection plan instead of only showing metrics.",
    },
    {
      title: "Prompt-to-Dataset Builder",
      description: "Turn a vague idea into classes, enrollment prompts, and collection rules for your team.",
    },
    {
      title: "Deployment Safety Reviewer",
      description: "Review whether a trained model is safe for pilot rollout and what guardrails it needs.",
    },
    {
      title: "Edge-Case Recipe Engine",
      description: "A less common use case: the LLM writes exact missing examples to capture, like low light, side angle, occlusion, blur, and background variation.",
    },
  ];

  const showRecognitionPanel =
    !!attachedProject &&
    (
      attachedProject.templateId === "access-control" ||
      attachedDataset?.taskType === "image-classification" ||
      attachedModel?.taskType === "image-classification"
    );

  const recognitionReady =
    attachedModel?.taskType === "image-classification" &&
    attachedModel?.status === "completed" &&
    attachedDeployment?.status === "active";

  const recognitionMessage = !showRecognitionPanel
    ? null
    : !attachedDataset
      ? "No labeled image dataset has been added yet. Start by enrolling labeled images such as Dharshaneshwaran."
      : attachedDataset.taskType !== "image-classification"
        ? "This project is not using an image-classification dataset yet, so person recognition is not available."
          : !attachedModel || attachedModel.status !== "completed"
            ? "Dataset is ready, but the image model still needs to be trained before it can recognize a person later."
            : attachedDeployment?.status !== "active"
              ? "The trained model is ready, but deployment is still needed before live recognition can run."
              : "Person recognition is ready. Upload a fresh image and the model will predict the enrolled person/class.";

  const autoBuildProjectName = autoBuildResult?.project?.name || autoBuildResult?.buildPlan?.projectName || "LLM Auto Build";
  const autoBuildCurrentStep = autoBuiltModel?.status === "completed" ? 4 : autoBuildResult?.project ? 4 : isAutoBuilding ? 2 : 1;
  const autoBuildProgressValue = autoBuiltModel?.trainingProgress ?? (isAutoBuilding ? 5 : 0);
  const autoBuildSubtitle =
    autoBuildResult?.buildPlan?.templateId === "waste-sorting"
      ? "Smart Waste Sorting"
      : autoBuildResult?.buildPlan?.templateId === "access-control"
        ? "Access Control / Identity Verification"
        : "Natural-language auto build";
  const autoBuildStatusLabel =
    autoBuiltModel?.status === "completed"
      ? "Training complete"
      : autoBuiltModel?.status === "failed"
        ? "Training failed"
        : isAutoBuilding
          ? "Preparing project"
          : autoBuiltModel?.status === "training"
            ? "Training in progress"
            : "Ready to build";
  const autoBuildPrimaryAction = autoBuildResult?.project
    ? {
        label: autoBuiltModel?.status === "completed" ? "Open Project" : "View Project",
        onClick: () => setLocation(`/project/${autoBuildResult.project?.id}`),
      }
    : {
        label: isAutoBuilding ? "Building..." : "Start Auto Build",
        onClick: runAutoBuild,
      };
  const showAutoBuildBuilderOnly = !isAutoBuilding && !autoBuildResult?.project;
  const autoBuildChecklist = [
    {
      label: "English request submitted",
      done: !!autoBuildPrompt.trim(),
    },
    {
      label: "Project created",
      done: !!autoBuildResult?.project,
    },
    {
      label: "Dataset imported",
      done: !!autoBuildResult?.datasetSelection?.ref,
    },
    {
      label: "Training started",
      done: isAutoBuilding || autoBuiltModel?.status === "training" || autoBuiltModel?.status === "completed",
    },
  ];

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto" data-testid="llm-studio-page">
      <div className="relative overflow-hidden rounded-3xl border border-card-border bg-card shadow-sm">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(59,130,246,0.14),transparent_35%),linear-gradient(120deg,rgba(15,23,42,0.03),transparent_55%)]" />
        <div className="relative p-6 md:p-8 flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div className="space-y-3">
            <Badge variant="secondary" className="w-fit gap-2">
              <BrainCircuit className="w-3.5 h-3.5" />
              LLM Studio
            </Badge>
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-foreground">Separate local AI workspace for Ollama models</h1>
              <p className="text-muted-foreground max-w-3xl mt-2">
                Manage local LLMs, build reusable prompt workflows, and use them as a project copilot without mixing them into the image-training engine.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button variant="outline" onClick={() => setLocation("/settings")} data-testid="button-open-llm-settings">
              Open LLM Settings
            </Button>
            <Button onClick={createWorkflow} data-testid="button-create-llm-workflow">
              <Sparkles className="w-4 h-4 mr-2" />
              New Workflow
            </Button>
          </div>
        </div>
      </div>

      {attachedProject && (
        <Card className="border-primary/20 bg-primary/5">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Attached Project Context</CardTitle>
            <CardDescription>
              LLM Studio was opened from this project, so your workflows can reason about it directly.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="font-medium text-foreground">{attachedProject.name}</p>
              <p className="text-sm text-muted-foreground">
                Template: {attachedProject.templateId} • Status: {attachedProject.status}
              </p>
            </div>
            <Button variant="outline" onClick={() => setLocation(`/project/${attachedProject.id}`)} data-testid="button-back-to-attached-project">
              Back to Project
            </Button>
          </CardContent>
        </Card>
      )}

      {showRecognitionPanel && (
        <Card className="border-primary/20 bg-primary/5" data-testid="llm-studio-person-id-panel">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-primary" />
              Person ID / Recognition
            </CardTitle>
            <CardDescription>
              This is the actual image-recognition side of the project, shown here so you can see whether it is ready from inside LLM Studio.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">{recognitionMessage}</p>
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary">
                {attachedDataset?.taskType === "image-classification" ? "Dataset Ready" : "Dataset Missing"}
              </Badge>
              <Badge variant="secondary">
                {attachedModel?.status === "completed" ? "Model Trained" : "Model Not Ready"}
              </Badge>
              <Badge variant="secondary">
                {attachedDeployment?.status === "active" ? "Deployment Active" : "Deployment Missing"}
              </Badge>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button
                variant={recognitionReady ? "default" : "outline"}
                onClick={() => {
                  if (recognitionReady) {
                    setLocation(`/project/${attachedProject.id}/run`);
                    return;
                  }
                  if (!attachedDataset || attachedDataset.taskType !== "image-classification") {
                    setLocation(`/project/${attachedProject.id}`);
                    return;
                  }
                  if (!attachedModel || attachedModel.status !== "completed") {
                    setLocation(`/project/${attachedProject.id}`);
                    return;
                  }
                  setLocation(`/project/${attachedProject.id}`);
                }}
                data-testid="button-open-person-id-from-llm-studio"
              >
                <ShieldCheck className="w-4 h-4 mr-2" />
                {recognitionReady ? "Recognize Person" : "Open Project Setup"}
              </Button>
              <Button
                variant="outline"
                onClick={() => setActiveTab("workflows")}
                data-testid="button-use-llm-for-person-id-project"
              >
                Use LLM To Improve Recognition
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="models">Models</TabsTrigger>
          <TabsTrigger value="auto-build">Auto Build</TabsTrigger>
          <TabsTrigger value="workflows">Prompt Workflows</TabsTrigger>
          <TabsTrigger value="use-cases">Use Cases</TabsTrigger>
        </TabsList>

        <TabsContent value="models" className="space-y-4">
          <div className="grid grid-cols-1 xl:grid-cols-[1.3fr_0.9fr] gap-4">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <CardTitle className="text-base">Installed Ollama Models</CardTitle>
                    <CardDescription>
                      Pick which local model powers LLM workflows in the app.
                    </CardDescription>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => refetchModels()}
                    disabled={modelsFetching}
                    data-testid="button-refresh-llm-models"
                  >
                    <RefreshCw className={`w-4 h-4 mr-2 ${modelsFetching ? "animate-spin" : ""}`} />
                    Refresh
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {settings.llmProvider !== "ollama" ? (
                  <p className="text-sm text-muted-foreground">Switch the provider to Ollama in Settings to list local models.</p>
                ) : modelsLoading ? (
                  <p className="text-sm text-muted-foreground">Loading local models...</p>
                ) : modelsError ? (
                  <p className="text-sm text-destructive">
                    {modelsError instanceof Error ? modelsError.message : "Unable to load local models."}
                  </p>
                ) : modelsResponse?.models?.length ? (
                  <div className="space-y-3">
                    {modelsResponse.models.map((model) => {
                      const isActive = settings.llmModel === model.name;
                      return (
                        <div
                          key={model.name}
                          className="rounded-xl border p-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between"
                          data-testid={`llm-model-${model.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}`}
                        >
                          <div className="space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="font-medium text-foreground">{model.name}</p>
                              {isActive && <Badge variant="secondary">Active</Badge>}
                            </div>
                            <p className="text-xs text-muted-foreground">
                              {formatBytes(model.size)} {model.modifiedAt ? `• Updated ${new Date(model.modifiedAt).toLocaleDateString("en-US")}` : ""}
                            </p>
                          </div>
                          <Button
                            variant={isActive ? "secondary" : "outline"}
                            onClick={() => useModel(model.name)}
                            disabled={isActive}
                            data-testid={`button-use-model-${model.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}`}
                          >
                            {isActive ? "In Use" : "Use This Model"}
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No local Ollama models were found yet.</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Current LLM Configuration</CardTitle>
                <CardDescription>These settings are used when workflows run against your local model.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="rounded-lg bg-muted/60 p-4">
                  <p className="text-xs text-muted-foreground mb-1">Provider</p>
                  <p className="font-medium text-foreground">{settings.llmProvider}</p>
                </div>
                <div className="rounded-lg bg-muted/60 p-4">
                  <p className="text-xs text-muted-foreground mb-1">Base URL</p>
                  <p className="font-medium text-foreground">{settings.llmBaseUrl}</p>
                </div>
                <div className="rounded-lg bg-muted/60 p-4">
                  <p className="text-xs text-muted-foreground mb-1">Active Model</p>
                  <p className="font-medium text-foreground">{settings.llmModel}</p>
                </div>
                <div className="rounded-lg border border-dashed p-4">
                  <p className="text-sm font-medium text-foreground mb-1">How to use this wisely</p>
                  <p className="text-sm text-muted-foreground">
                    Let the LLM design prompts, explain failures, and review deployment risk. Keep training itself on local PyTorch for image models and on scikit-learn for tabular models.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="auto-build" className="space-y-6">
          {showAutoBuildBuilderOnly ? (
            <div className="grid grid-cols-1 xl:grid-cols-[1.05fr_0.95fr] gap-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Natural Language Project Builder</CardTitle>
                  <CardDescription>
                    Type what you want in English. LLM Studio will translate it into a supported vision project, search Kaggle, download a dataset, create the project, and start local training.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setAutoBuildPrompt("Train a model to identify which waste is biodegradable and which is not biodegradable.")
                      }
                      data-testid="button-fill-biodegradable-example"
                    >
                      Biodegradable waste example
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setAutoBuildPrompt("Build a model that can recognize employees and visitors from face images.")
                      }
                      data-testid="button-fill-person-id-example"
                    >
                      Person ID example
                    </Button>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">English Request</label>
                    <Textarea
                      value={autoBuildPrompt}
                      onChange={(event) => setAutoBuildPrompt(event.target.value)}
                      rows={7}
                      placeholder="Example: Train a model to identify which waste is biodegradable and which is not biodegradable."
                      data-testid="textarea-llm-auto-build-prompt"
                    />
                    <p className="text-xs text-muted-foreground">
                      Best current fit: image-classification projects that can be trained locally from a public Kaggle dataset.
                    </p>
                  </div>

                  <div className="rounded-xl border bg-muted/40 p-4 space-y-3">
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="secondary">{settings.llmModel}</Badge>
                      <Badge variant="secondary">{settings.imageBaseModel}</Badge>
                      <Badge variant="secondary">{settings.usePretrainedWeights ? "Pretrained On" : "Pretrained Off"}</Badge>
                      <Badge variant="secondary">{settings.useImageAugmentation ? "Augmentation On" : "Augmentation Off"}</Badge>
                      <Badge variant="secondary">{autoAssignEpochs ? "Auto Epochs" : `${settings.imageTrainingEpochs} epochs`}</Badge>
                    </div>
                    <div className="flex items-center justify-between gap-4 rounded-lg border bg-card px-4 py-3">
                      <div>
                        <p className="text-sm font-medium text-foreground">Require GPU</p>
                        <p className="text-xs text-muted-foreground">
                          When enabled, the build will fail fast if CUDA is unavailable instead of falling back.
                        </p>
                      </div>
                      <Switch
                        checked={autoBuildRequireGpu}
                        onCheckedChange={setAutoBuildRequireGpu}
                        data-testid="switch-llm-auto-build-gpu"
                      />
                    </div>
                    <div className="flex items-center justify-between gap-4 rounded-lg border bg-card px-4 py-3">
                      <div>
                        <p className="text-sm font-medium text-foreground">Auto Assign Epochs</p>
                        <p className="text-xs text-muted-foreground">
                          Let the backend choose epochs from the prompt, dataset size, and class count.
                        </p>
                      </div>
                      <Switch
                        checked={autoAssignEpochs}
                        onCheckedChange={setAutoAssignEpochs}
                        data-testid="switch-llm-auto-build-epochs"
                      />
                    </div>
                    <div className="rounded-lg border border-dashed p-4">
                      <p className="text-sm font-medium text-foreground mb-1">Internet dataset source</p>
                      <p className="text-sm text-muted-foreground">
                        Auto build uses Kaggle right now. Set <code>KAGGLE_USERNAME</code> and <code>KAGGLE_KEY</code> in <code>backend/.env</code> if you want dataset download to work from inside the app.
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-3">
                    <Button onClick={runAutoBuild} disabled={isAutoBuilding} data-testid="button-run-llm-auto-build">
                      <Rocket className="w-4 h-4 mr-2" />
                      Create Project + Train
                    </Button>
                    <Button variant="outline" onClick={() => setLocation("/settings")} data-testid="button-open-settings-from-auto-build">
                      Open Settings
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">What This Actually Does</CardTitle>
                  <CardDescription>
                    This turns one English request into an actionable local ML workflow instead of only returning text.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 text-sm text-muted-foreground">
                  <p>1. The local LLM plus a fallback planner decides which supported project template fits your request.</p>
                  <p>2. The backend searches Kaggle for public image datasets that look relevant.</p>
                  <p>3. It downloads the best match, creates a project, stores the dataset, and starts local training.</p>
                  <p>4. Training uses your existing local PyTorch pipeline and will use CUDA automatically when available.</p>
                </CardContent>
              </Card>
            </div>
          ) : (
          <>
          <div className="max-w-6xl mx-auto space-y-6">
            <div className="flex items-center gap-4 mb-2">
              <Button variant="ghost" size="icon" onClick={() => {
                setAutoBuildResult(null);
                setAutoBuildConsoleLines([]);
              }} data-testid="button-back-to-auto-build-builder">
                <ArrowLeft className="w-4 h-4" />
              </Button>
              <div className="flex-1">
                <h2 className="text-xl font-bold text-foreground">{autoBuildProjectName}</h2>
                <p className="text-sm text-muted-foreground">{autoBuildSubtitle}</p>
              </div>
              <Button
                variant={autoBuildResult?.project ? "outline" : "default"}
                onClick={autoBuildPrimaryAction.onClick}
                disabled={isAutoBuilding}
                data-testid="button-auto-build-primary-action"
              >
                {autoBuildResult?.project ? null : <Rocket className="w-4 h-4 mr-2" />}
                {autoBuildPrimaryAction.label}
              </Button>
            </div>

            <WorkflowSteps currentStep={autoBuildCurrentStep} />

            <Card className="border-primary/20 bg-primary/5">
              <CardContent className="py-4 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div className="flex items-start gap-3">
                  <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-primary/15">
                    <BrainCircuit className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium text-foreground">Project AI Assistant</p>
                    <p className="text-sm text-muted-foreground">
                      Write your idea in English and the app will plan the template, search Kaggle, import a dataset, and kick off local training.
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-3">
                  <Button variant="outline" onClick={() => setLocation("/settings")} data-testid="button-open-settings-from-auto-build-header">
                    Open LLM Settings
                  </Button>
                  {!!autoBuildResult?.project && (
                    <Button
                      variant="outline"
                      onClick={() => setLocation(`/llm-studio?projectId=${autoBuildResult.project?.id}`)}
                      data-testid="button-attach-auto-build-project"
                    >
                      Open LLM Studio
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card className="border-primary/20 bg-primary/5">
              <CardContent className="py-5 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-primary" />
                    <p className="font-medium text-foreground">Auto Build Readiness</p>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {autoBuildResult?.project
                      ? "Project created. Training and monitoring continue here with the same feel as the normal project page."
                      : "Your natural-language request has been accepted and the project-style build flow is now in progress."}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {autoBuildChecklist.map((item) => (
                      <div
                        key={item.label}
                        className={`rounded-full px-3 py-1 text-xs font-medium ${
                          item.done ? "bg-chart-2/15 text-chart-2" : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {item.done ? "Done" : "Pending"}: {item.label}
                      </div>
                    ))}
                  </div>
                </div>
                <Button onClick={runAutoBuild} disabled={isAutoBuilding} data-testid="button-run-llm-auto-build-top">
                  <Rocket className="w-4 h-4 mr-2" />
                  {isAutoBuilding ? "Building Project..." : "Create Project + Train"}
                </Button>
              </CardContent>
            </Card>
          </div>
          <div className="max-w-6xl mx-auto space-y-4">
              {(autoBuildResult?.project || isAutoBuilding) && (
                <Card>
                  <CardContent className="py-12 px-6">
                    <div className="max-w-xl mx-auto text-center space-y-5">
                      <div className="flex justify-center">
                        <div className="w-14 h-14 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
                      </div>
                      <div className="space-y-2">
                        <h3 className="text-2xl font-semibold text-foreground">{autoBuildStatusLabel}</h3>
                        <p className="text-muted-foreground">
                          {autoBuiltModel?.status === "completed"
                            ? "Your auto-built project is trained and ready for the next step."
                            : "The model is being prepared and trained locally from your natural-language request."}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Training on: {autoBuiltModel?.trainingDevice || (resourceUsage?.gpus?.length ? resourceUsage.gpus[0].name : "Detecting device...")}
                        </p>
                      </div>
                      <div className="max-w-sm mx-auto space-y-2">
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <span>Progress</span>
                          <span>{autoBuildProgressValue}%</span>
                        </div>
                        <Progress value={autoBuildProgressValue} className="h-2" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {(resourceUsage?.cpu || resourceUsage?.memory || resourceUsage?.gpus?.length) && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">System Resource Usage</CardTitle>
                    <CardDescription>
                      Local training uses CPU and RAM for loading and preprocessing, and uses GPU plus VRAM when CUDA training is active.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="rounded-xl border p-4">
                        <div className="flex items-center justify-between gap-3 mb-2">
                          <p className="text-sm font-medium text-foreground">CPU</p>
                          <span className="text-sm text-muted-foreground">{resourceUsage?.cpu?.usagePercent ?? 0}%</span>
                        </div>
                        <Progress value={resourceUsage?.cpu?.usagePercent ?? 0} className="h-2" />
                      </div>
                      <div className="rounded-xl border p-4">
                        <div className="flex items-center justify-between gap-3 mb-2">
                          <p className="text-sm font-medium text-foreground">RAM</p>
                          <span className="text-sm text-muted-foreground">
                            {resourceUsage?.memory?.usedGb ?? 0} / {resourceUsage?.memory?.totalGb ?? 0} GB
                          </span>
                        </div>
                        <Progress value={resourceUsage?.memory?.usagePercent ?? 0} className="h-2" />
                      </div>
                    </div>
                    {!!resourceUsage?.gpus?.length && (
                      <div className="grid grid-cols-1 gap-3">
                        {resourceUsage.gpus.map((gpu) => (
                          <div key={`${gpu.index}-${gpu.name}`} className="rounded-xl border p-4 space-y-3">
                            <div className="flex flex-wrap items-center justify-between gap-3">
                              <p className="font-medium text-foreground">{gpu.name || `GPU ${gpu.index || ""}`}</p>
                              <Badge variant="secondary">
                                {gpu.temperatureC != null ? `${gpu.temperatureC}°C` : "No temp"}
                              </Badge>
                            </div>
                            <div>
                              <div className="flex items-center justify-between gap-3 mb-2">
                                <p className="text-sm text-muted-foreground">GPU load</p>
                                <span className="text-sm text-muted-foreground">{gpu.usagePercent ?? 0}%</span>
                              </div>
                              <Progress value={gpu.usagePercent ?? 0} className="h-2" />
                            </div>
                            <div>
                              <div className="flex items-center justify-between gap-3 mb-2">
                                <p className="text-sm text-muted-foreground">VRAM</p>
                                <span className="text-sm text-muted-foreground">
                                  {gpu.memoryUsedGb ?? 0} / {gpu.memoryTotalGb ?? 0} GB
                                </span>
                              </div>
                              <Progress value={gpu.memoryUsagePercent ?? 0} className="h-2" />
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Training Console Output</CardTitle>
                  <CardDescription>
                    Terminal-style build steps so you can see what LLM Studio decided and where it failed.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="bg-black/95 text-green-400 font-mono text-xs p-4 h-[220px] overflow-y-auto rounded-xl border border-black/80">
                    {(autoBuildConsoleLines.length ? autoBuildConsoleLines : [
                      "$ waiting for auto-build request...",
                      "> steps will appear here after you click Create Project + Train",
                    ]).map((line, index) => (
                      <div key={`${line}-${index}`} className="whitespace-pre-wrap break-words">
                        {line}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {!!autoBuiltProjectId && !!autoBuiltModel && (
                <LiveTrainingLogs
                  progress={autoBuiltModel.trainingProgress ?? 0}
                  logs={autoBuiltTrainingLogs}
                />
              )}

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Build Result</CardTitle>
                  <CardDescription>
                    After a successful run, you will see the generated plan, the chosen dataset, and a shortcut into the new project.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {autoBuildResult ? (
                    <>
                      <div className="rounded-xl border bg-primary/5 border-primary/20 p-4 space-y-2">
                        <p className="font-medium text-foreground">{autoBuildResult.message}</p>
                        {autoBuildResult.llmWarning && (
                          <p className="text-sm text-muted-foreground">{autoBuildResult.llmWarning}</p>
                        )}
                      </div>

                      {autoBuildResult.project && (
                        <div className="rounded-xl border p-4 space-y-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-medium text-foreground">{autoBuildResult.project.name}</p>
                            <Badge variant="secondary">{autoBuildResult.buildPlan?.templateId || autoBuildResult.project.templateId}</Badge>
                            <Badge variant="secondary">{autoBuildResult.buildPlan?.planningMode || "heuristic"}</Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {autoBuildResult.buildPlan?.projectDescription || autoBuildResult.project.description || "Project created from your English request."}
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {(autoBuildResult.buildPlan?.desiredLabels || []).map((label) => (
                              <Badge key={label} variant="outline">
                                {label}
                              </Badge>
                            ))}
                          </div>
                          <div className="flex flex-wrap gap-3">
                            <Button
                              onClick={() => setLocation(`/project/${autoBuildResult.project?.id}`)}
                              data-testid="button-open-auto-built-project"
                            >
                              Open Project
                            </Button>
                            <Button
                              variant="outline"
                              onClick={() => autoBuildResult.project?.id && setLocation(`/llm-studio?projectId=${autoBuildResult.project.id}`)}
                              data-testid="button-open-auto-built-project-in-llm-studio"
                            >
                              Attach In LLM Studio
                            </Button>
                          </div>
                        </div>
                      )}

                      <div className="rounded-xl border p-4 space-y-3">
                        <div>
                          <p className="text-sm font-medium text-foreground">Chosen Dataset</p>
                          <p className="text-sm text-muted-foreground">
                            {autoBuildResult.datasetSelection?.title || autoBuildResult.datasetSelection?.ref || "Dataset details unavailable"}
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {autoBuildResult.datasetSelection?.ref && <Badge variant="secondary">{autoBuildResult.datasetSelection.ref}</Badge>}
                          {autoBuildResult.datasetSelection?.searchQuery && <Badge variant="outline">{autoBuildResult.datasetSelection.searchQuery}</Badge>}
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {(autoBuildResult.datasetSelection?.labels || []).map((label) => (
                            <Badge key={label} variant="outline">
                              {label}
                            </Badge>
                          ))}
                        </div>
                        {autoBuildResult.datasetSelection?.sourceUrl && (
                          <a
                            href={autoBuildResult.datasetSelection.sourceUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="text-sm text-primary underline-offset-4 hover:underline"
                          >
                            Open Kaggle Dataset
                          </a>
                        )}
                      </div>

                      <div className="rounded-xl border p-4 space-y-2">
                        <p className="text-sm font-medium text-foreground">Training Runtime</p>
                        <p className="text-sm text-muted-foreground">
                          {autoBuildResult.runtime?.cudaAvailable
                            ? `CUDA ready on ${autoBuildResult.runtime.gpuName || "your GPU"}`
                            : "CUDA not reported as available right now"}
                        </p>
                        <div className="flex flex-wrap gap-2">
                          <Badge variant="secondary">{autoBuildResult.trainingSettings?.baseModel || settings.imageBaseModel}</Badge>
                          <Badge variant="secondary">
                            {autoBuildResult.trainingSettings?.preferGpu ? "GPU Required" : "GPU Auto If Available"}
                          </Badge>
                          <Badge variant="secondary">
                            {`${autoBuildResult.trainingSettings?.trainingEpochs || settings.imageTrainingEpochs} epochs`}
                          </Badge>
                        </div>
                        {autoBuildResult.trainingSettings?.epochReason && (
                          <p className="text-sm text-muted-foreground">{autoBuildResult.trainingSettings.epochReason}</p>
                        )}
                      </div>
                    </>
                  ) : (
                    <div className="rounded-xl border bg-muted/40 p-4 min-h-[320px] flex items-center">
                      <p className="text-sm text-muted-foreground">
                        No auto-build has been run yet. Try the biodegradable-waste example to see the full flow from English request to dataset download and local training.
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </>
          )}
        </TabsContent>

        <TabsContent value="workflows" className="space-y-4">
          <div className="grid grid-cols-1 xl:grid-cols-[0.9fr_1.1fr] gap-4">
            <Card className="min-h-[620px]">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Saved Workflows</CardTitle>
                <CardDescription>Reusable LLM tools for projects, operations, and evaluation.</CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[520px] pr-3">
                  <div className="space-y-3">
                    {workflows.map((workflow) => (
                      <button
                        key={workflow.id}
                        type="button"
                        className={`w-full text-left rounded-xl border p-4 transition-colors ${
                          workflow.id === selectedWorkflow.id ? "border-primary bg-primary/5" : "hover:bg-muted/60"
                        }`}
                        onClick={() => setSelectedWorkflowId(workflow.id)}
                        data-testid={`workflow-item-${workflow.id}`}
                      >
                        <div className="flex items-center justify-between gap-3 mb-2">
                          <p className="font-medium text-foreground">{workflow.name}</p>
                          <Badge variant="secondary">{workflow.category}</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">{workflow.description}</p>
                      </button>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>

            <div className="space-y-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Workflow Editor</CardTitle>
                  <CardDescription>Shape how the local model should think and what output format it should return.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">Workflow Name</label>
                    <Input
                      value={selectedWorkflow.name}
                      onChange={(event) => updateWorkflow(selectedWorkflow.id, { name: event.target.value })}
                      data-testid="input-llm-workflow-name"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">Description</label>
                    <Input
                      value={selectedWorkflow.description}
                      onChange={(event) => updateWorkflow(selectedWorkflow.id, { description: event.target.value })}
                      data-testid="input-llm-workflow-description"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">System Prompt</label>
                    <Textarea
                      value={selectedWorkflow.systemPrompt}
                      onChange={(event) => updateWorkflow(selectedWorkflow.id, { systemPrompt: event.target.value })}
                      rows={5}
                      data-testid="textarea-llm-system-prompt"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">Prompt Template</label>
                    <Textarea
                      value={selectedWorkflow.userPromptTemplate}
                      onChange={(event) => updateWorkflow(selectedWorkflow.id, { userPromptTemplate: event.target.value })}
                      rows={6}
                      data-testid="textarea-llm-user-template"
                    />
                    <p className="text-xs text-muted-foreground">
                      Use <code>{"{{input}}"}</code> for the current request and <code>{"{{context}}"}</code> for project notes.
                    </p>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Run Workflow</CardTitle>
                  <CardDescription>Use your saved prompt with the currently selected Ollama model.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">Project Context</label>
                    <Textarea
                      value={projectContext}
                      onChange={(event) => setProjectContext(event.target.value)}
                      rows={4}
                      placeholder="Paste project notes, template details, confusion cases, or deployment constraints."
                      data-testid="textarea-llm-project-context"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">Workflow Input</label>
                    <Textarea
                      value={runInput}
                      onChange={(event) => setRunInput(event.target.value)}
                      rows={5}
                      placeholder="Describe the failure, dataset issue, or question you want the workflow to solve."
                      data-testid="textarea-llm-run-input"
                    />
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <Badge variant="secondary">{settings.llmModel}</Badge>
                    <Button onClick={runWorkflow} disabled={isRunning} data-testid="button-run-llm-workflow">
                      <Wand2 className="w-4 h-4 mr-2" />
                      {isRunning ? "Running..." : "Run Workflow"}
                    </Button>
                  </div>
                  <div className="rounded-xl border bg-muted/40 p-4 min-h-[220px]">
                    {llmOutput ? (
                      <ScrollArea className="h-[220px] pr-3">
                        <pre className="whitespace-pre-wrap text-sm text-foreground font-sans">{llmOutput}</pre>
                      </ScrollArea>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        Workflow output will appear here. A good first test is the Failure-to-Training Loop workflow with a bad prediction example.
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="use-cases" className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Project Uses For LLMs</CardTitle>
              <CardDescription>
                These are the best places to use a local LLM in this product without confusing it with the actual model trainer.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {projectUseCases.map((useCase) => (
                  <div key={useCase.title} className="rounded-2xl border p-5 bg-card">
                    <div className="flex items-center gap-2 mb-3">
                      <Bot className="w-4 h-4 text-primary" />
                      <p className="font-medium text-foreground">{useCase.title}</p>
                    </div>
                    <p className="text-sm text-muted-foreground">{useCase.description}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
