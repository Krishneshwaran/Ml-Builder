import { useLocation, useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { LiveTester } from "@/components/live-tester";
import type { Project, MlModel, Deployment } from "@shared/schema";

export default function RunModel() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();

  const { data: project, isLoading: projectLoading } = useQuery<Project>({
    queryKey: ["/api/projects", id],
    enabled: !!id,
  });

  const { data: model, isLoading: modelLoading } = useQuery<MlModel>({
    queryKey: ["/api/projects", id, "model"],
    enabled: !!id && !!project,
  });

  const { data: deployment, isLoading: deploymentLoading } = useQuery<Deployment>({
    queryKey: ["/api/projects", id, "deployment"],
    enabled: !!id && !!project,
  });

  if (projectLoading || modelLoading || deploymentLoading) {
    return (
      <div className="p-6 max-w-5xl mx-auto space-y-6">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-10 w-80" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (!project || !model || !deployment) {
    return (
      <div className="p-6 max-w-4xl mx-auto space-y-6">
        <Button variant="ghost" onClick={() => setLocation("/projects")} className="gap-2">
          <ArrowLeft className="w-4 h-4" />
          Back to Projects
        </Button>
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Project, trained model, or deployment was not found.
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6" data-testid="run-model-page">
      <Button variant="ghost" onClick={() => setLocation(`/project/${project.id}`)} className="gap-2">
        <ArrowLeft className="w-4 h-4" />
        Back to Project
      </Button>

      <div>
        <h1 className="text-2xl font-bold text-foreground">Run Model</h1>
        <p className="text-muted-foreground">
          Test {project.name} with a fresh {model.taskType === "image-classification" ? "image" : "input sample"}.
        </p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Live Model Details</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2 text-sm text-muted-foreground md:grid-cols-2">
          <p>Prediction source: deployed saved model</p>
          <p>Endpoint: {deployment.endpoint || "Not available"}</p>
          <p>Algorithm: {model.algorithm || "Unknown"}</p>
          <p>Device used in training: {model.trainingDevice || "Unknown"}</p>
          <p>Epochs used: {typeof model.trainingEpochs === "number" ? model.trainingEpochs : "Unknown"}</p>
          <p>Saved model size: {typeof model.artifactSizeMb === "number" ? `${model.artifactSizeMb.toFixed(2)} MB` : "Unknown"}</p>
        </CardContent>
      </Card>

      <LiveTester model={model} deployment={deployment} />
    </div>
  );
}
