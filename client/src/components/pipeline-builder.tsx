import { ArrowDown, CheckCircle, Clock, Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { PipelineStage } from "@shared/schema";

interface PipelineBuilderProps {
  stages: PipelineStage[];
  className?: string;
}

const stageDescriptions: Record<string, string> = {
  "face-detection": "Detect and localize faces in input images using deep learning",
  "feature-extraction": "Extract facial embeddings and biometric features",
  "identity-matching": "Compare extracted features against enrolled identities",
  "confidence-scoring": "Calculate match confidence and generate verification result",
  "face-tracking": "Track face position and orientation across video frames",
  "gaze-detection": "Analyze eye gaze direction and screen attention",
  "audio-analysis": "Process audio for voice detection and anomaly patterns",
  "anomaly-detection": "Identify suspicious behavior patterns in real-time",
  "object-detection": "Detect and classify waste items in images",
  "material-classification": "Identify material composition (plastic, glass, metal, etc.)",
  "sorting-decision": "Generate optimal sorting instructions based on classification",
  "bin-assignment": "Assign detected items to appropriate recycling bins",
  "person-detection": "Detect and track individuals in retail environment",
  "trajectory-tracking": "Analyze customer movement patterns and paths",
  "dwell-analysis": "Measure time spent in different store areas",
  "heatmap-generation": "Generate spatial activity heatmaps and reports",
  "ocr-extraction": "Extract text from document images using OCR",
  "text-parsing": "Parse and structure extracted text content",
  "entity-recognition": "Identify named entities and key information",
  "document-classification": "Categorize documents by type and content",
  "person-counting": "Count individuals in crowd scenes",
  "density-estimation": "Estimate crowd density levels",
  "flow-analysis": "Analyze movement patterns and traffic flow",
  "alert-generation": "Generate alerts for capacity or safety thresholds",
};

export function PipelineBuilder({ stages, className }: PipelineBuilderProps) {
  return (
    <div className={cn("space-y-3", className)} data-testid="pipeline-builder">
      {stages.map((stage, index) => (
        <div key={stage.id}>
          <Card
            className={cn(
              "transition-all",
              stage.status === "processing" && "ring-2 ring-primary ring-offset-2 ring-offset-background"
            )}
            data-testid={`pipeline-stage-${stage.id}`}
          >
            <CardContent className="p-4">
              <div className="flex items-start gap-4">
                <div className={cn(
                  "flex items-center justify-center w-9 h-9 rounded-full shrink-0",
                  stage.status === "completed"
                    ? "bg-chart-2/20"
                    : stage.status === "processing"
                    ? "bg-primary/20"
                    : "bg-muted"
                )}>
                  {stage.status === "completed" ? (
                    <CheckCircle className="w-4 h-4 text-chart-2" />
                  ) : stage.status === "processing" ? (
                    <Loader2 className="w-4 h-4 text-primary animate-spin" />
                  ) : (
                    <Clock className="w-4 h-4 text-muted-foreground" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <h4 className="font-medium text-foreground capitalize">
                      {stage.name.replace(/-/g, " ")}
                    </h4>
                    <Badge
                      variant="secondary"
                      className={cn(
                        "text-xs",
                        stage.status === "completed" && "bg-chart-2/20 text-chart-2",
                        stage.status === "processing" && "bg-primary/20 text-primary"
                      )}
                    >
                      {stage.status === "completed" ? "Complete" : stage.status === "processing" ? "Processing" : "Pending"}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {stageDescriptions[stage.id] || stage.description}
                  </p>
                </div>
                <div className="text-xs text-muted-foreground shrink-0">
                  Stage {stage.order}
                </div>
              </div>
            </CardContent>
          </Card>
          {index < stages.length - 1 && (
            <div className="flex justify-center py-1">
              <ArrowDown className="w-4 h-4 text-muted-foreground" />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
