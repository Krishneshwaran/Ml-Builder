import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TemplateCard } from "@/components/template-card";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { systemTemplates, type SystemTemplate, type InsertProject } from "@shared/schema";

export default function NewProject() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [step, setStep] = useState<"template" | "details">("template");
  const [selectedTemplate, setSelectedTemplate] = useState<SystemTemplate | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  const createProject = useMutation({
    mutationFn: async (data: InsertProject) => {
      const res = await apiRequest("POST", "/api/projects", data);
      return res.json();
    },
    onSuccess: (project) => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      toast({
        title: "Project created",
        description: "Your new ML project is ready. Let's add some data!",
      });
      setLocation(`/project/${project.id}`);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to create project. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleTemplateSelect = (template: SystemTemplate) => {
    setSelectedTemplate(template);
    if (!name) {
      setName(`${template.name} Project`);
    }
  };

  const handleContinue = () => {
    if (step === "template" && selectedTemplate) {
      setStep("details");
    } else if (step === "details" && name && selectedTemplate) {
      createProject.mutate({
        name,
        description,
        templateId: selectedTemplate.id,
        status: "draft",
        currentStep: 1,
      });
    }
  };

  const handleBack = () => {
    if (step === "details") {
      setStep("template");
    } else {
      setLocation("/projects");
    }
  };

  return (
    <div className="p-6 max-w-5xl mx-auto" data-testid="new-project-page">
      <div className="mb-6">
        <Button variant="ghost" onClick={handleBack} className="gap-2 mb-4" data-testid="button-back">
          <ArrowLeft className="w-4 h-4" />
          {step === "template" ? "Back to Projects" : "Back to Templates"}
        </Button>
        <h1 className="text-2xl font-bold text-foreground">Create New Project</h1>
        <p className="text-muted-foreground">
          {step === "template"
            ? "Select a system template to define your ML pipeline"
            : "Give your project a name and description"}
        </p>
      </div>

      {step === "template" ? (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {systemTemplates.map((template) => (
              <TemplateCard
                key={template.id}
                template={template}
                selected={selectedTemplate?.id === template.id}
                onClick={() => handleTemplateSelect(template)}
              />
            ))}
          </div>

          <div className="flex justify-end">
            <Button
              onClick={handleContinue}
              disabled={!selectedTemplate}
              data-testid="button-continue"
            >
              Continue
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        </div>
      ) : (
        <Card className="max-w-2xl">
          <CardHeader>
            <CardTitle className="text-lg">Project Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Project Name</Label>
              <Input
                id="name"
                placeholder="Enter project name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                data-testid="input-project-name"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description (optional)</Label>
              <Textarea
                id="description"
                placeholder="Describe your project goals and use case"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
                data-testid="input-project-description"
              />
            </div>

            {selectedTemplate && (
              <div className="p-4 rounded-lg bg-muted/50">
                <p className="text-sm font-medium text-foreground mb-1">Selected Template</p>
                <p className="text-sm text-muted-foreground">{selectedTemplate.name}</p>
              </div>
            )}

            <div className="flex justify-end gap-3 pt-4">
              <Button variant="outline" onClick={handleBack} data-testid="button-back-details">
                Back
              </Button>
              <Button
                onClick={handleContinue}
                disabled={!name || createProject.isPending}
                data-testid="button-create-project"
              >
                {createProject.isPending ? "Creating..." : "Create Project"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
