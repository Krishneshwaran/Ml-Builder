import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import { ArrowLeft, ArrowRight, Play, Loader2, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { WorkflowSteps } from "@/components/workflow-steps";
import { TemplateCard } from "@/components/template-card";
import { DataUploadZone } from "@/components/data-upload-zone";
import { LabelEditor } from "@/components/label-editor";
import { PipelineBuilder } from "@/components/pipeline-builder";
import { TrainingMetrics } from "@/components/training-metrics";
import { DeploymentPanel } from "@/components/deployment-panel";
import { IntegrationCode } from "@/components/integration-code";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { systemTemplates, type Project, type Dataset, type MlModel, type Deployment, type PipelineStage } from "@shared/schema";

export default function ProjectDetail() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [labels, setLabels] = useState<string[]>([]);
  const [currentStep, setCurrentStep] = useState(1);

  const { data: project, isLoading: projectLoading } = useQuery<Project>({
    queryKey: ["/api/projects", id],
    enabled: !!id,
  });

  const { data: dataset } = useQuery<Dataset>({
    queryKey: ["/api/projects", id, "dataset"],
    enabled: !!id,
  });

  const { data: model } = useQuery<MlModel>({
    queryKey: ["/api/projects", id, "model"],
    enabled: !!id,
    refetchInterval: (query) => {
      const data = query.state.data as MlModel | undefined;
      if (data?.status === "training") {
        return 1000;
      }
      return false;
    },
  });

  const { data: deployment } = useQuery<Deployment>({
    queryKey: ["/api/projects", id, "deployment"],
    enabled: !!id,
  });

  useEffect(() => {
    if (project) {
      setCurrentStep(project.currentStep);
    }
  }, [project]);

  const template = systemTemplates.find((t) => t.id === project?.templateId);

  const pipelineStages: PipelineStage[] = template?.pipelineStages.map((stage, index) => ({
    id: stage,
    name: stage,
    description: "",
    status: currentStep > 3 ? "completed" : currentStep === 3 && index === 0 ? "processing" : "pending",
    order: index + 1,
  })) || [];

  const updateProject = useMutation({
    mutationFn: async (data: Partial<Project>) => {
      const res = await apiRequest("PATCH", `/api/projects/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", id] });
    },
  });

  const createDataset = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/projects/${id}/dataset`, {
        name: `${project?.name} Dataset`,
        fileCount: 250,
        totalSize: 52428800,
        dataType: template?.dataTypes[0] || "images",
        labelCount: labels.length,
        isValidated: true,
        labels,
        projectId: id,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", id, "dataset"] });
      updateProject.mutate({ currentStep: 3, status: "data-uploaded" });
      setCurrentStep(3);
      toast({
        title: "Dataset uploaded",
        description: "Your data has been validated and is ready for training.",
      });
    },
  });

  const startTraining = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/projects/${id}/train`, {
        name: `${project?.name} Model`,
        projectId: id,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", id, "model"] });
      updateProject.mutate({ currentStep: 4, status: "training" });
      setCurrentStep(4);
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
    if (currentStep === 2) {
      createDataset.mutate();
    } else if (currentStep === 3) {
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
            <DataUploadZone acceptedTypes={template?.dataTypes || ["images"]} />
            <LabelEditor labels={labels} onLabelsChange={setLabels} />
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
                  The ML pipeline has been automatically configured based on your selected template.
                  Each stage processes your data sequentially to produce accurate predictions.
                </p>
                <PipelineBuilder stages={pipelineStages} />
              </CardContent>
            </Card>
          </div>
        );

      case 4:
        return (
          <div className="space-y-6">
            {model?.status === "training" ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <Loader2 className="w-12 h-12 mx-auto mb-4 text-primary animate-spin" />
                  <h3 className="text-lg font-medium text-foreground mb-2">Training in Progress</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Your model is being trained. This typically takes 5-15 minutes.
                  </p>
                  <div className="max-w-xs mx-auto">
                    <div className="flex justify-between text-xs text-muted-foreground mb-1">
                      <span>Progress</span>
                      <span>{model.trainingProgress || 0}%</span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary transition-all duration-500"
                        style={{ width: `${model.trainingProgress || 0}%` }}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ) : model?.status === "completed" ? (
              <>
                <Card>
                  <CardContent className="py-6">
                    <div className="flex items-center gap-3">
                      <CheckCircle className="w-8 h-8 text-chart-2" />
                      <div>
                        <h3 className="font-medium text-foreground">Training Complete</h3>
                        <p className="text-sm text-muted-foreground">
                          Your model has been trained successfully and is ready for evaluation.
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <TrainingMetrics model={model} />
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
            onDeploy={() => deployModel.mutate("cloud-api")}
            isDeploying={deployModel.isPending}
          />
        );

      case 6:
        return deployment ? (
          <IntegrationCode deployment={deployment} />
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
        return labels.length > 0;
      case 3:
        return true;
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
        return createDataset.isPending ? "Uploading..." : "Upload & Validate";
      case 3:
        return "Configure Pipeline";
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
      </div>

      <WorkflowSteps currentStep={currentStep} />

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
            disabled={!canProceed() || createDataset.isPending || startTraining.isPending}
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
