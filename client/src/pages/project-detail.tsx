import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import { ArrowLeft, ArrowRight, Play, Loader2, CheckCircle, BrainCircuit, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { WorkflowSteps } from "@/components/workflow-steps";
import { TemplateCard } from "@/components/template-card";
import { DataUploadZone } from "@/components/data-upload-zone";
import { PipelineBuilder } from "@/components/pipeline-builder";
import { TrainingMetrics } from "@/components/training-metrics";
import { LiveTrainingLogs } from "@/components/live-training-logs";
import { DeploymentPanel } from "@/components/deployment-panel";
import { IntegrationCode } from "@/components/integration-code";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { loadSettings } from "@/lib/app-settings";
import { systemTemplates, type Project, type Dataset, type MlModel, type Deployment, type PipelineStage } from "@shared/schema";

type TrainingLogEntry = {
  message: string;
  createdAt: string;
};

const MAX_VISIBLE_TRAINING_LOGS = 300;

export default function ProjectDetail() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [currentStep, setCurrentStep] = useState(1);
  const [isDatasetUploaded, setIsDatasetUploaded] = useState(false);
  const [deploymentType, setDeploymentType] = useState<"cloud-api" | "edge-device">("cloud-api");
  const [isTrainingBooting, setIsTrainingBooting] = useState(false);
  const [optimisticTrainingModel, setOptimisticTrainingModel] = useState<MlModel | null>(null);
  const [trainingLogs, setTrainingLogs] = useState<TrainingLogEntry[]>([]);

  const {
    data: project,
    isLoading: projectLoading,
    isError: projectError,
    error: projectQueryError,
  } = useQuery<Project>({
    queryKey: ["/api/projects", id],
    enabled: !!id,
  });

  const hasProject = !!project?.id;

  const { data: dataset } = useQuery<Dataset>({
    queryKey: ["/api/projects", id, "dataset"],
    enabled: !!id && hasProject,
  });

  const { data: model } = useQuery<MlModel>({
    queryKey: ["/api/projects", id, "model"],
    enabled: !!id && hasProject,
    refetchInterval: (query) => {
      const data = query.state.data as MlModel | undefined;
      if (data?.status === "training") {
        return 2500;
      }
      return false;
    },
  });
  const effectiveModel = model || optimisticTrainingModel;

  const { data: deployment } = useQuery<Deployment>({
    queryKey: ["/api/projects", id, "deployment"],
    enabled: !!id && hasProject,
  });

  const { data: latestTrainingLogs } = useQuery<TrainingLogEntry[]>({
    queryKey: ["/api/projects", id, "training-logs", "incremental"],
    enabled: !!id && hasProject && (model?.status === "training" || model?.status === "completed" || model?.status === "failed"),
    queryFn: async () => {
      const params = new URLSearchParams({
        limit: trainingLogs.length ? "200" : "120",
      });
      const lastSeenTimestamp = trainingLogs[trainingLogs.length - 1]?.createdAt;
      if (lastSeenTimestamp) {
        params.set("since", lastSeenTimestamp);
      }
      const response = await fetch(`/api/projects/${id}/training-logs?${params.toString()}`, {
        credentials: "include",
      });
      if (!response.ok) {
        const message = await response.text();
        throw new Error(message || "Unable to load training logs");
      }
      return response.json();
    },
    refetchInterval: model?.status === "training" ? 2500 : false,
  });

  useEffect(() => {
    if (!projectError) return;
    const message = projectQueryError instanceof Error ? projectQueryError.message : "";
    if (message.includes("404")) {
      toast({
        title: "Project not found",
        description: "That project link is no longer valid. Please open an existing project or create a new one.",
        variant: "destructive",
      });
      setLocation("/projects");
    }
  }, [projectError, projectQueryError, setLocation, toast]);

  useEffect(() => {
    if (project) {
      setCurrentStep(project.currentStep);
    }
  }, [project]);

  useEffect(() => {
    setTrainingLogs([]);
  }, [id]);

  useEffect(() => {
    if (!latestTrainingLogs?.length) return;
    setTrainingLogs((current) => {
      const seen = new Set(current.map((log) => `${log.createdAt}-${log.message}`));
      const appended = latestTrainingLogs.filter((log) => !seen.has(`${log.createdAt}-${log.message}`));
      if (!appended.length) return current;
      return [...current, ...appended].slice(-MAX_VISIBLE_TRAINING_LOGS);
    });
  }, [latestTrainingLogs]);

  // Auto-advance to deployment step when training completes
  useEffect(() => {
    if (effectiveModel?.status === "completed" && currentStep === 4) {
      // Wait a moment for the user to see the completion state, then suggest moving forward
      const timer = setTimeout(() => {
        toast({
          title: "Training Complete!",
          description: "Your model is ready. Click 'Continue to Deploy' to proceed.",
        });
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [effectiveModel?.status, currentStep, toast]);

  useEffect(() => {
    if (currentStep === 4 && project?.status === "training" && !effectiveModel) {
      setIsTrainingBooting(true);
      return;
    }
    if (effectiveModel?.status === "training" || effectiveModel?.status === "completed" || effectiveModel?.status === "failed") {
      setIsTrainingBooting(false);
    }
  }, [currentStep, project?.status, effectiveModel]);

  useEffect(() => {
    if (model) {
      setOptimisticTrainingModel(null);
    }
  }, [model]);

  const template = systemTemplates.find((t) => t.id === project?.templateId);

  const datasetMetadata = (dataset?.metadata || {}) as Record<string, unknown>;
  const datasetTaskType = dataset?.taskType || "tabular-classification";
  const isImageDataset = datasetTaskType === "image-classification";

  const pipelineStages: PipelineStage[] = (
    isImageDataset
      ? [
          { id: "dataset-validation", name: "dataset validation", description: "Verify the extracted image folders, labels, and file counts before training starts.", status: currentStep >= 3 ? "completed" : "pending", order: 1 },
          { id: "image-preprocessing", name: "image preprocessing", description: "Resize images, normalize pixels, and build training and validation batches.", status: currentStep > 3 ? "completed" : currentStep === 3 ? "processing" : "pending", order: 2 },
          { id: "cnn-training", name: "cnn training", description: "Train a PyTorch convolutional neural network on your local machine and use CUDA when available.", status: currentStep > 3 ? "completed" : currentStep === 3 ? "pending" : "pending", order: 3 },
          { id: "model-evaluation", name: "model evaluation", description: "Measure accuracy, precision, recall, F1, and save the trained model for deployment.", status: currentStep > 3 ? "completed" : currentStep === 3 ? "pending" : "pending", order: 4 },
        ]
      : [
          { id: "schema-validation", name: "schema validation", description: "Read the CSV schema, choose the last column as label, and check rows and feature types.", status: currentStep >= 3 ? "completed" : "pending", order: 1 },
          { id: "feature-preprocessing", name: "feature preprocessing", description: "Impute missing values, scale numeric columns, and one-hot encode categorical features.", status: currentStep > 3 ? "completed" : currentStep === 3 ? "processing" : "pending", order: 2 },
          { id: "model-training", name: "model training", description: "Train the selected scikit-learn classifier using an 80/20 train-test split.", status: currentStep > 3 ? "completed" : currentStep === 3 ? "pending" : "pending", order: 3 },
          { id: "metrics-and-export", name: "metrics and export", description: "Compute evaluation metrics and store the trained pipeline for prediction and deployment.", status: currentStep > 3 ? "completed" : currentStep === 3 ? "pending" : "pending", order: 4 },
        ]
  );

  const pipelineSummary = [
    {
      label: "Dataset Type",
      value: isImageDataset ? "Image classification" : "Tabular classification",
    },
    {
      label: "Source",
      value: dataset?.sourceType === "kaggle" ? "Kaggle import" : dataset?.sourceType === "upload" ? "Direct upload" : "Unknown",
    },
    {
      label: "Labels / Classes",
      value: dataset?.labels?.length ? dataset.labels.join(", ") : "Not detected",
    },
    {
      label: "Samples",
      value: String(
        isImageDataset
          ? dataset?.fileCount || datasetMetadata.imageCount || 0
          : datasetMetadata.rowCount || 0
      ),
    },
    {
      label: "Training Engine",
      value: isImageDataset ? "PyTorch CNN" : "scikit-learn pipeline",
    },
    {
      label: "Compute Target",
      value: isImageDataset ? "Laptop GPU if CUDA is available, otherwise CPU" : "CPU",
    },
  ];

  const liveTrainingDevice =
    trainingLogs
      ?.slice()
      .reverse()
      .find((entry) => entry.message.toLowerCase().includes("training device:"))
      ?.message.replace(/^.*training device:\s*/i, "") || null;
  const isImageCapableTemplate = template?.dataTypes.includes("images") || false;
  const shouldShowRecognitionEntry =
    isImageCapableTemplate ||
    isImageDataset ||
    model?.taskType === "image-classification";
  const isRecognitionReady = model?.taskType === "image-classification" && deployment?.status === "active";
  const recognitionChecklist = [
    {
      label: "Enroll labeled images",
      done: !!dataset && datasetTaskType === "image-classification",
    },
    {
      label: "Train image model",
      done: model?.taskType === "image-classification" && model?.status === "completed",
    },
    {
      label: "Deploy recognition endpoint",
      done: model?.taskType === "image-classification" && deployment?.status === "active",
    },
  ];
  const nextRecognitionMessage = !shouldShowRecognitionEntry
    ? null
    : !dataset
      ? "Upload labeled images first so the system learns who each person is."
      : datasetTaskType !== "image-classification"
        ? "This project needs an image dataset with person labels before recognition can work."
        : !model || model.taskType !== "image-classification" || model.status !== "completed"
          ? "Train the image model first so the app can recognize later photos."
          : deployment?.status !== "active"
            ? "Deploy the trained model to enable live person recognition."
            : "Recognition is ready. Upload a fresh image and the app will predict the enrolled person.";

  const updateProject = useMutation({
    mutationFn: async (data: Partial<Project>) => {
      const res = await apiRequest("PATCH", `/api/projects/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", id] });
    },
  });

  const startTraining = useMutation({
    mutationFn: async () => {
      const settings = loadSettings();
      const res = await apiRequest("POST", `/api/projects/${id}/train`, {
        name: `${project?.name} Model`,
        projectId: id,
        baseModel: settings.imageBaseModel,
        preferGpu: settings.alwaysUseGpu,
        usePretrainedWeights: settings.usePretrainedWeights,
        trainingEpochs: settings.imageTrainingEpochs,
        useImageAugmentation: settings.useImageAugmentation,
      });
      return res.json() as Promise<MlModel>;
    },
    onSuccess: (createdModel) => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", id, "model"] });
      queryClient.invalidateQueries({ queryKey: ["/api/projects", id, "training-logs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/projects", id] });
      setOptimisticTrainingModel(createdModel);
      updateProject.mutate({ currentStep: 4, status: "training" });
      setCurrentStep(4);
      setIsTrainingBooting(true);
      toast({
        title: "Training started",
        description: "Your model is now training. This may take a few minutes.",
      });
    },
  });

  const deployModel = useMutation({
    mutationFn: async (type: "cloud-api" | "edge-device") => {
      const res = await apiRequest("POST", `/api/projects/${id}/deploy`, {
        name: `${project?.name} API`,
        type,
        modelId: model?.id,
        projectId: id,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", id, "deployment"] });
      updateProject.mutate({ currentStep: 6, status: "deployed" });
      setCurrentStep(6);
      toast({
        title: "Deployment successful",
        description: "Your model is now live and ready to receive requests.",
      });
    },
  });

  const handleNextStep = () => {
    if (currentStep === 3) {
      startTraining.mutate();
    } else if (currentStep === 4 && model?.status === "completed") {
      updateProject.mutate({ currentStep: 5 });
      setCurrentStep(5);
    } else if (currentStep < 6) {
      const nextStep = currentStep + 1;
      updateProject.mutate({ currentStep: nextStep });
      setCurrentStep(nextStep);
    }
  };

  const handlePrevStep = () => {
    if (currentStep > 1) {
      const prevStep = currentStep - 1;
      updateProject.mutate({ currentStep: prevStep });
      setCurrentStep(prevStep);
    }
  };

  if (projectLoading) {
    return (
      <div className="p-6 max-w-6xl mx-auto space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="p-6 text-center">
        <p className="text-muted-foreground">Project not found</p>
        <Button onClick={() => setLocation("/projects")} className="mt-4">
          Back to Projects
        </Button>
      </div>
    );
  }

  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Selected Template</CardTitle>
            </CardHeader>
            <CardContent>
              {template && (
                <TemplateCard template={template} selected />
              )}
              <p className="text-sm text-muted-foreground mt-4">
                This template defines the ML pipeline for your project. Continue to the next step to upload your training data.
              </p>
            </CardContent>
          </Card>
        );

      case 2:
        return (
          <div className="space-y-6">
            <DataUploadZone
              projectId={project.id}
              onUploadComplete={(uploadedDataset) => {
                setIsDatasetUploaded(true);
                queryClient.invalidateQueries({ queryKey: ["/api/projects", id, "dataset"] });
                const labelCount = Number(uploadedDataset?.labelCount || 0);
                const isImageClassification = uploadedDataset?.taskType === "image-classification";
                if (isImageClassification && labelCount < 2) {
                  updateProject.mutate({ currentStep: 2, status: project.status === "draft" ? "configuring" : project.status });
                  setCurrentStep(2);
                  toast({
                    title: "Add another label first",
                    description: "Image training needs at least 2 classes/labels. Stay on Data and enroll one more person or category before moving on.",
                    variant: "destructive",
                  });
                  return;
                }
                updateProject.mutate({ currentStep: 3, status: project.status === "draft" ? "configuring" : project.status });
                setCurrentStep(3);
                toast({
                  title: "Dataset ready",
                  description: "Your data was uploaded successfully. Moving to pipeline setup now.",
                });
              }}
            />
          </div>
        );

      case 3:
        return (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Automatic Pipeline Configuration</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  This is the real training plan that will be used for your uploaded dataset.
                  It is generated from the dataset type, labels, and training backend instead of a placeholder flow.
                </p>
                <PipelineBuilder stages={pipelineStages} summaryItems={pipelineSummary} />
              </CardContent>
            </Card>
          </div>
        );

      case 4:
        return (
          <div className="space-y-6">
            {effectiveModel?.status === "training" || isTrainingBooting ? (
              <>
                <Card>
                  <CardContent className="py-12 text-center">
                    <Loader2 className="w-12 h-12 mx-auto mb-4 text-primary animate-spin" />
                    <h3 className="text-lg font-medium text-foreground mb-2">
                      {isTrainingBooting && effectiveModel?.status !== "training" ? "Starting Training" : "Training in Progress"}
                    </h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      {isTrainingBooting && effectiveModel?.status !== "training"
                        ? "The backend is preparing the training job and attaching the live console."
                        : "Your model is being trained. This typically takes 5-15 minutes."}
                    </p>
                    <p className="text-sm text-foreground mb-4">
                      Training on: {liveTrainingDevice || "Detecting device..."}
                    </p>
                    <div className="max-w-xs mx-auto">
                      <div className="flex justify-between text-xs text-muted-foreground mb-1">
                        <span>Progress</span>
                        <span>{effectiveModel?.trainingProgress || (isTrainingBooting ? 5 : 0)}%</span>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary transition-all duration-500"
                          style={{ width: `${effectiveModel?.trainingProgress || (isTrainingBooting ? 5 : 0)}%` }}
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <LiveTrainingLogs
                  progress={effectiveModel?.trainingProgress || (isTrainingBooting ? 5 : 0)}
                  trainingEpochs={effectiveModel?.trainingEpochs}
                  modelCreatedAt={effectiveModel?.createdAt}
                  logs={trainingLogs}
                />
              </>
            ) : effectiveModel?.status === "completed" ? (
              <>
                <Card>
                  <CardContent className="py-6">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <CheckCircle className="w-8 h-8 text-chart-2" />
                        <div>
                          <h3 className="font-medium text-foreground">Training Complete</h3>
                          <p className="text-sm text-muted-foreground">
                            Your model has been trained successfully and is ready for deployment.
                          </p>
                        </div>
                      </div>
                      <Button onClick={handleNextStep} data-testid="button-continue-to-deploy">
                        Continue to Deploy
                        <ArrowRight className="w-4 h-4 ml-2" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
                <TrainingMetrics model={model} />
                {effectiveModel?.taskType === "image-classification" && (
                  <Card className="border-primary/20 bg-primary/5">
                    <CardContent className="py-5 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                      <div>
                        <p className="font-medium text-foreground">Later identity check</p>
                        <p className="text-sm text-muted-foreground">
                          After deployment, upload a fresh image and the app can tell you whether it looks like an enrolled label such as Dharshaneshwaran.
                        </p>
                      </div>
                      <Button
                        variant="outline"
                        onClick={() => setCurrentStep(5)}
                        data-testid="button-go-to-deploy-for-identity-check"
                      >
                        Continue to Deploy
                      </Button>
                    </CardContent>
                  </Card>
                )}
              </>
            ) : (
              <Card>
                <CardContent className="py-12 text-center">
                  <Play className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                  <h3 className="text-lg font-medium text-foreground mb-2">Ready to Train</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Click "Start Training" to begin the training process.
                  </p>
                  <Button onClick={() => startTraining.mutate()} disabled={startTraining.isPending}>
                    {startTraining.isPending ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Starting...
                      </>
                    ) : (
                      <>
                        <Play className="w-4 h-4 mr-2" />
                        Start Training
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        );

      case 5:
        return (
          <DeploymentPanel
            deployment={deployment}
            model={model}
            onDeploymentTypeChange={setDeploymentType}
            onDeploy={() => deployModel.mutate(deploymentType)}
            isDeploying={deployModel.isPending}
          />
        );

      case 6:
        return deployment ? (
          <IntegrationCode
            deployment={{ ...deployment, templateId: project.templateId } as any}
            model={model}
          />
        ) : (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground">No deployment found. Please deploy your model first.</p>
            </CardContent>
          </Card>
        );

      default:
        return null;
    }
  };

  const canProceed = () => {
    switch (currentStep) {
      case 1:
        return true;
      case 2:
        return isDatasetUploaded || dataset;
      case 3:
        return !!dataset;
      case 4:
        return model?.status === "completed";
      case 5:
        return deployment?.status === "active";
      default:
        return false;
    }
  };

  const getNextButtonLabel = () => {
    switch (currentStep) {
      case 2:
        return "Configure Pipeline";
      case 3:
        return "Start Training";
      case 4:
        return "Continue to Deploy";
      case 5:
        return deployment?.status === "active" ? "View Integration" : "Deploy First";
      default:
        return "Continue";
    }
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6" data-testid="project-detail-page">
      <div className="flex items-center gap-4 mb-2">
        <Button variant="ghost" size="icon" onClick={() => setLocation("/projects")} data-testid="button-back-to-projects">
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-foreground">{project.name}</h1>
          <p className="text-sm text-muted-foreground">{project.description || template?.name}</p>
        </div>
        {shouldShowRecognitionEntry && (
          <Button
            onClick={() => {
              if (isRecognitionReady) {
                setLocation(`/project/${project.id}/run`);
                return;
              }
              if (!dataset || datasetTaskType !== "image-classification") {
                setCurrentStep(2);
                return;
              }
              if (!model || model.status !== "completed") {
                setCurrentStep(4);
                return;
              }
              setCurrentStep(5);
            }}
            variant={isRecognitionReady ? "default" : "outline"}
            disabled={!isRecognitionReady && !shouldShowRecognitionEntry}
            data-testid="button-recognize-person"
          >
            <ShieldCheck className="w-4 h-4 mr-2" />
            {isRecognitionReady ? "Recognize Person" : "Prepare Recognition"}
          </Button>
        )}
      </div>

      <WorkflowSteps currentStep={currentStep} />

      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="py-4 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-primary/15">
              <BrainCircuit className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="font-medium text-foreground">Project AI Assistant</p>
              <p className="text-sm text-muted-foreground">
                Open this project inside LLM Studio to design dataset classes, analyze bad predictions, and review deployment safety with your local Ollama model.
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            onClick={() => setLocation(`/llm-studio?projectId=${project.id}`)}
            data-testid="button-open-project-llm-studio"
          >
            Open LLM Studio
          </Button>
        </CardContent>
      </Card>

      {shouldShowRecognitionEntry && nextRecognitionMessage && (
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="py-5 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-primary" />
                <p className="font-medium text-foreground">Person Recognition Readiness</p>
              </div>
              <p className="text-sm text-muted-foreground">{nextRecognitionMessage}</p>
              <div className="flex flex-wrap gap-2">
                {recognitionChecklist.map((item) => (
                  <div
                    key={item.label}
                    className={`rounded-full px-3 py-1 text-xs font-medium ${
                      item.done
                        ? "bg-chart-2/15 text-chart-2"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {item.done ? "Done" : "Pending"}: {item.label}
                  </div>
                ))}
              </div>
            </div>
            <Button
              variant={isRecognitionReady ? "default" : "outline"}
              onClick={() => {
                if (isRecognitionReady) {
                  setLocation(`/project/${project.id}/run`);
                  return;
                }
                if (!dataset || datasetTaskType !== "image-classification") {
                  setCurrentStep(2);
                  return;
                }
                if (!model || model.status !== "completed") {
                  setCurrentStep(4);
                  return;
                }
                setCurrentStep(5);
              }}
              data-testid="button-recognition-readiness-action"
            >
              <ShieldCheck className="w-4 h-4 mr-2" />
              {isRecognitionReady
                ? "Open Recognition"
                : !dataset || datasetTaskType !== "image-classification"
                  ? "Go to Data Upload"
                  : !model || model.status !== "completed"
                    ? "Go to Training"
                    : "Go to Deploy"}
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="min-h-[400px]">
        {renderStepContent()}
      </div>

      <div className="flex items-center justify-between pt-4 border-t">
        <Button
          variant="outline"
          onClick={handlePrevStep}
          disabled={currentStep === 1}
          data-testid="button-prev-step"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Previous
        </Button>
        {currentStep < 6 && (
          <Button
            onClick={handleNextStep}
            disabled={!canProceed() || startTraining.isPending}
            data-testid="button-next-step"
          >
            {getNextButtonLabel()}
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        )}
      </div>
    </div>
  );
}
