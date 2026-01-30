import { useLocation } from "wouter";
import { Clock, ArrowRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import type { Project } from "@shared/schema";

const statusConfig: Record<string, { label: string; color: string }> = {
  draft: { label: "Draft", color: "bg-muted text-muted-foreground" },
  "data-uploaded": { label: "Data Ready", color: "bg-chart-3/20 text-chart-3" },
  training: { label: "Training", color: "bg-chart-1/20 text-chart-1" },
  trained: { label: "Trained", color: "bg-chart-2/20 text-chart-2" },
  deployed: { label: "Deployed", color: "bg-primary/20 text-primary" },
};

interface ProjectCardProps {
  project: Project;
}

export function ProjectCard({ project }: ProjectCardProps) {
  const [, setLocation] = useLocation();
  const status = statusConfig[project.status] || statusConfig.draft;
  const progress = (project.currentStep / 6) * 100;

  const formatDate = (date: Date | null) => {
    if (!date) return "Unknown";
    return new Date(date).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  return (
    <Card className="hover-elevate cursor-pointer group" data-testid={`project-card-${project.id}`}>
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-foreground truncate mb-1">
              {project.name}
            </h3>
            <p className="text-sm text-muted-foreground line-clamp-1">
              {project.description || "No description"}
            </p>
          </div>
          <Badge className={cn("shrink-0", status.color)}>
            {status.label}
          </Badge>
        </div>

        <div className="mb-4">
          <div className="flex items-center justify-between text-xs text-muted-foreground mb-1.5">
            <span>Step {project.currentStep} of 6</span>
            <span>{Math.round(progress)}%</span>
          </div>
          <Progress value={progress} className="h-1.5" />
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Clock className="w-3.5 h-3.5" />
            <span>{formatDate(project.updatedAt)}</span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={() => setLocation(`/project/${project.id}`)}
            data-testid={`button-open-project-${project.id}`}
          >
            Continue
            <ArrowRight className="w-3.5 h-3.5" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
