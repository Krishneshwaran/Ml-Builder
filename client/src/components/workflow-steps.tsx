import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

const steps = [
  { id: 1, name: "Template", short: "Template" },
  { id: 2, name: "Data", short: "Data" },
  { id: 3, name: "Pipeline", short: "Pipeline" },
  { id: 4, name: "Train", short: "Train" },
  { id: 5, name: "Deploy", short: "Deploy" },
  { id: 6, name: "Integrate", short: "Integrate" },
];

interface WorkflowStepsProps {
  currentStep: number;
  className?: string;
}

export function WorkflowSteps({ currentStep, className }: WorkflowStepsProps) {
  return (
    <nav className={cn("flex items-center", className)} data-testid="workflow-steps">
      {steps.map((step, index) => (
        <div key={step.id} className="flex items-center">
          <div className="flex items-center gap-2">
            <div
              className={cn(
                "flex items-center justify-center w-7 h-7 rounded-full text-xs font-medium transition-colors",
                step.id < currentStep
                  ? "bg-primary text-primary-foreground"
                  : step.id === currentStep
                  ? "bg-primary text-primary-foreground ring-2 ring-primary/30 ring-offset-2 ring-offset-background"
                  : "bg-muted text-muted-foreground"
              )}
              data-testid={`step-indicator-${step.id}`}
            >
              {step.id < currentStep ? (
                <Check className="w-3.5 h-3.5" />
              ) : (
                step.id
              )}
            </div>
            <span
              className={cn(
                "text-sm font-medium hidden sm:inline",
                step.id === currentStep
                  ? "text-foreground"
                  : step.id < currentStep
                  ? "text-muted-foreground"
                  : "text-muted-foreground/70"
              )}
            >
              {step.name}
            </span>
          </div>
          {index < steps.length - 1 && (
            <div
              className={cn(
                "w-8 md:w-12 h-0.5 mx-2",
                step.id < currentStep ? "bg-primary" : "bg-border"
              )}
            />
          )}
        </div>
      ))}
    </nav>
  );
}
