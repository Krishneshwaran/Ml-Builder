import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";
import type { MlModel } from "@shared/schema";

interface TrainingMetricsProps {
  model: MlModel;
  onThresholdChange?: (value: number) => void;
}

export function TrainingMetrics({ model, onThresholdChange }: TrainingMetricsProps) {
  const metrics = [
    { name: "Accuracy", value: model.accuracy ?? 0, color: "bg-chart-1" },
    { name: "Precision", value: model.precisionScore ?? 0, color: "bg-chart-2" },
    { name: "Recall", value: model.recallScore ?? 0, color: "bg-chart-4" },
    { name: "F1 Score", value: model.f1Score ?? 0, color: "bg-chart-3" },
  ];

  return (
    <div className="space-y-6" data-testid="training-metrics">
      <Card>
        <CardHeader className="pb-3 border-b border-border/50 mb-4">
          <div className="flex items-start justify-between">
            <CardTitle className="text-base">Model Performance</CardTitle>
            {model.algorithm && (
              <div className="text-right">
                <p className="text-sm font-medium text-foreground">{model.algorithm}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Trained on {typeof model.datasetSize === "number" ? model.datasetSize.toLocaleString() : "Unknown"} samples
                </p>
                {model.baseModel && (
                  <p className="text-xs text-muted-foreground mt-0.5">Base model: {model.baseModel}</p>
                )}
                {typeof model.useImageAugmentation === "boolean" && (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Image augmentation: {model.useImageAugmentation ? "enabled" : "disabled"}
                  </p>
                )}
                {typeof model.usePretrainedWeights === "boolean" && (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Pretrained weights: {model.usePretrainedWeights ? "enabled" : "disabled"}
                  </p>
                )}
                {typeof model.trainingEpochs === "number" && (
                  <p className="text-xs text-muted-foreground mt-0.5">Epochs: {model.trainingEpochs}</p>
                )}
                {typeof model.artifactSizeMb === "number" && (
                  <p className="text-xs text-muted-foreground mt-0.5">Model size: {model.artifactSizeMb.toFixed(2)} MB</p>
                )}
                {model.trainingDevice && (
                  <p className="text-xs text-muted-foreground mt-0.5">Device: {model.trainingDevice}</p>
                )}
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {metrics.map((metric) => (
            <div key={metric.name} data-testid={`metric-${metric.name.toLowerCase()}`}>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-sm font-medium text-foreground">{metric.name}</span>
                <span className="text-sm font-bold text-foreground">{metric.value}%</span>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className={cn("h-full rounded-full transition-all duration-500", metric.color)}
                  style={{ width: `${metric.value}%` }}
                />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Confidence Threshold</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-muted-foreground">
              Predictions below this threshold will be flagged for manual review
            </span>
            <span className="text-lg font-bold text-foreground">{model.confidenceThreshold}%</span>
          </div>
          <Slider
            defaultValue={[model.confidenceThreshold]}
            max={100}
            min={50}
            step={5}
            onValueChange={(value) => onThresholdChange?.(value[0])}
            data-testid="threshold-slider"
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>50% (More predictions)</span>
            <span>100% (Higher confidence)</span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Error Analysis</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 rounded-lg bg-destructive/10" data-testid="false-positive-rate">
              <p className="text-xs text-muted-foreground mb-1">False Positive Rate</p>
              <p className="text-2xl font-bold text-destructive">
                {model.falsePositiveRate ?? 0}%
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Incorrectly classified as positive
              </p>
            </div>
            <div className="p-4 rounded-lg bg-chart-3/10" data-testid="false-negative-rate">
              <p className="text-xs text-muted-foreground mb-1">False Negative Rate</p>
              <p className="text-2xl font-bold text-chart-3">
                {model.falseNegativeRate ?? 0}%
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Missed positive classifications
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
