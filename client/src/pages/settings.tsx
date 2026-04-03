import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { SETTINGS_KEY, loadSettings, type AppSettings } from "@/lib/app-settings";

export default function Settings() {
  const { toast } = useToast();
  const [settings, setSettings] = useState<AppSettings>(loadSettings);
  const [isTestingLlm, setIsTestingLlm] = useState(false);
  const [llmStatus, setLlmStatus] = useState<{
    reachable: boolean;
    modelAvailable: boolean;
    availableModels: string[];
    message: string;
  } | null>(null);
  const { data: capabilities } = useQuery<{
    cudaAvailable: boolean;
    gpuName?: string | null;
    torchAvailable: boolean;
    availableImageBackbones: string[];
    llmProviders: string[];
    torchError?: string;
  }>({
    queryKey: ["/api/system/capabilities"],
  });

  const updateSetting = <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  const saveSettings = () => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    toast({
      title: "Settings saved",
      description: "Your preferences have been updated successfully.",
    });
  };

  const applyInstalledModel = (modelName: string) => {
    const nextSettings = { ...settings, llmModel: modelName };
    setSettings(nextSettings);
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(nextSettings));
    setLlmStatus((prev) =>
      prev
        ? {
            ...prev,
            modelAvailable: true,
            message: `Using installed Ollama model ${modelName}.`,
          }
        : prev,
    );
    toast({
      title: "Model updated",
      description: `${modelName} is now selected for local LLM usage.`,
    });
  };

  const testLlmConnection = async () => {
    setIsTestingLlm(true);
    setLlmStatus(null);
    try {
      const response = await apiRequest("POST", "/api/system/llm/check", {
        provider: settings.llmProvider,
        baseUrl: settings.llmBaseUrl,
        model: settings.llmModel,
        apiKey: settings.llmApiKey,
      });
      const result = await response.json();
      setLlmStatus(result);
      toast({
        title: result.modelAvailable ? "LLM ready" : "LLM connected",
        description: result.modelAvailable
          ? `${settings.llmModel} is available on this machine.`
          : `${settings.llmModel} was not found in the installed Ollama models.`,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to reach the configured LLM endpoint.";
      setLlmStatus({
        reachable: false,
        modelAvailable: false,
        availableModels: [],
        message,
      });
      toast({
        title: "LLM check failed",
        description: message,
        variant: "destructive",
      });
    } finally {
      setIsTestingLlm(false);
    }
  };

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6" data-testid="settings-page">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Settings</h1>
        <p className="text-muted-foreground">
          Manage your account and platform preferences
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Organization</CardTitle>
          <CardDescription>Manage your organization details</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="org-name">Organization Name</Label>
            <Input
              id="org-name"
              value={settings.orgName}
              onChange={(e) => updateSetting("orgName", e.target.value)}
              data-testid="input-org-name"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="org-email">Contact Email</Label>
            <Input
              id="org-email"
              type="email"
              value={settings.orgEmail}
              onChange={(e) => updateSetting("orgEmail", e.target.value)}
              data-testid="input-org-email"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Training Models</CardTitle>
          <CardDescription>Choose which free image backbone to use for image-classification training</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="image-base-model">Image Base Model</Label>
            <Select
              value={settings.imageBaseModel}
              onValueChange={(value) => updateSetting("imageBaseModel", value as AppSettings["imageBaseModel"])}
            >
              <SelectTrigger id="image-base-model" data-testid="select-image-base-model">
                <SelectValue placeholder="Select image base model" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="custom-cnn">Custom CNN</SelectItem>
                <SelectItem value="resnet18">ResNet18</SelectItem>
                <SelectItem value="mobilenet_v3_small">MobileNetV3 Small</SelectItem>
                <SelectItem value="efficientnet_b0">EfficientNet-B0</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              This affects image-classification projects. DeepSeek-R1 is not listed because it is a language model, not an image backbone.
            </p>
          </div>
          <Separator />
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="font-medium text-foreground text-sm">Use Pretrained Weights</p>
              <p className="text-xs text-muted-foreground">
                Start from free torchvision pretrained weights when available. The first use may download weights.
              </p>
            </div>
            <Switch
              checked={settings.usePretrainedWeights}
              onCheckedChange={(v) => updateSetting("usePretrainedWeights", v)}
              data-testid="switch-use-pretrained-weights"
            />
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-foreground text-sm">Use Image Augmentation</p>
              <p className="text-xs text-muted-foreground">
                Apply real training-time flips, rotations, and color jitter to help image models generalize better.
              </p>
            </div>
            <Switch
              checked={settings.useImageAugmentation}
              onCheckedChange={(v) => updateSetting("useImageAugmentation", v)}
              data-testid="switch-use-image-augmentation"
            />
          </div>
          <Separator />
          <div className="space-y-2">
            <Label htmlFor="image-training-epochs">Image Training Epochs</Label>
            <Input
              id="image-training-epochs"
              type="number"
              min={1}
              max={50}
              value={settings.imageTrainingEpochs}
              onChange={(e) => {
                const parsed = Number.parseInt(e.target.value, 10);
                updateSetting("imageTrainingEpochs", Number.isFinite(parsed) ? Math.min(50, Math.max(1, parsed)) : 6);
              }}
              data-testid="input-image-training-epochs"
            />
            <p className="text-xs text-muted-foreground">
              Real image training will use this many epochs. More epochs usually train longer and may improve accuracy.
            </p>
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-foreground text-sm">Always Use GPU</p>
              <p className="text-xs text-muted-foreground">
                If enabled, training will fail unless CUDA is available. This is mainly for image-classification training.
              </p>
            </div>
            <Switch
              checked={settings.alwaysUseGpu}
              onCheckedChange={(v) => updateSetting("alwaysUseGpu", v)}
              data-testid="switch-always-use-gpu"
            />
          </div>
          <Separator />
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <p className="font-medium text-foreground text-sm">GPU Capability</p>
              <Badge variant="secondary" data-testid="badge-gpu-capability">
                {capabilities?.cudaAvailable ? "CUDA Ready" : "CPU Only"}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              {capabilities?.cudaAvailable
                ? `Detected GPU: ${capabilities.gpuName}`
                : capabilities?.torchAvailable
                ? "CUDA is not currently available."
                : capabilities?.torchError || "PyTorch capability check unavailable."}
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">LLM Integration</CardTitle>
          <CardDescription>Prepare future DeepSeek/Ollama style reasoning features without affecting image training</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg border p-4 space-y-3" data-testid="ollama-setup-guide">
            <div>
              <p className="font-medium text-foreground text-sm">Ollama Setup Guide</p>
              <p className="text-xs text-muted-foreground">
                Ollama must be installed on this machine before local LLM features can work.
              </p>
            </div>
            <div className="space-y-2 text-sm">
              <p className="text-foreground">
                1. Install Ollama from <span className="font-mono">https://ollama.com/download</span>
              </p>
              <p className="text-foreground">
                2. In a terminal, verify the install:
              </p>
              <div className="rounded-md bg-muted px-3 py-2 font-mono text-xs text-foreground">
                ollama --version
              </div>
              <p className="text-foreground">
                3. Download the model you want to use locally:
              </p>
              <div className="rounded-md bg-muted px-3 py-2 font-mono text-xs text-foreground">
                ollama pull deepseek-r1:1.5b
              </div>
              <p className="text-foreground">
                4. Keep Ollama running on <span className="font-mono">http://localhost:11434</span>, then use the fields below and click <span className="font-medium">Test Connection</span>.
              </p>
            </div>
            <p className="text-xs text-muted-foreground">
              Note: Ollama is for the local LLM part. Image training still runs separately with local PyTorch and uses GPU only when CUDA is available.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="llm-provider">LLM Provider</Label>
            <Select
              value={settings.llmProvider}
              onValueChange={(value) => updateSetting("llmProvider", value as AppSettings["llmProvider"])}
            >
              <SelectTrigger id="llm-provider" data-testid="select-llm-provider">
                <SelectValue placeholder="Select LLM provider" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ollama">Ollama</SelectItem>
                <SelectItem value="openai-compatible">OpenAI-Compatible</SelectItem>
                <SelectItem value="disabled">Disabled</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="llm-base-url">Base URL</Label>
            <Input
              id="llm-base-url"
              value={settings.llmBaseUrl}
              onChange={(e) => updateSetting("llmBaseUrl", e.target.value)}
              data-testid="input-llm-base-url"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="llm-model">Model Name</Label>
            <Input
              id="llm-model"
              value={settings.llmModel}
              onChange={(e) => updateSetting("llmModel", e.target.value)}
              data-testid="input-llm-model"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="llm-api-key">API Key (optional)</Label>
            <Input
              id="llm-api-key"
              type="password"
              value={settings.llmApiKey}
              onChange={(e) => updateSetting("llmApiKey", e.target.value)}
              data-testid="input-llm-api-key"
            />
          </div>
          <p className="text-xs text-muted-foreground">
            For DeepSeek-R1 with Ollama, a common local setup is provider `Ollama`, base URL `http://localhost:11434`, and model like `deepseek-r1:1.5b` or another installed Ollama tag.
          </p>
          <div className="flex items-center justify-between gap-4 rounded-lg border p-4">
            <div>
              <p className="font-medium text-foreground text-sm">Test Local LLM Connection</p>
              <p className="text-xs text-muted-foreground">
                Checks whether Ollama is reachable and whether the configured model tag is installed locally.
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={testLlmConnection}
              disabled={isTestingLlm}
              data-testid="button-test-llm-connection"
            >
              {isTestingLlm ? "Checking..." : "Test Connection"}
            </Button>
          </div>
          {llmStatus && (
            <div className="rounded-lg border p-4 space-y-2" data-testid="llm-connection-status">
              <div className="flex items-center gap-2">
                <Badge variant="secondary">
                  {llmStatus.reachable ? "Reachable" : "Unavailable"}
                </Badge>
                <Badge variant="secondary">
                  {llmStatus.modelAvailable ? "Model Installed" : "Model Missing"}
                </Badge>
              </div>
              <p className="text-sm text-foreground">{llmStatus.message}</p>
              {llmStatus.availableModels.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  Installed Ollama models: {llmStatus.availableModels.join(", ")}
                </p>
              )}
              {!llmStatus.modelAvailable && llmStatus.availableModels.length > 0 && (
                <div className="flex flex-wrap gap-2 pt-2">
                  {llmStatus.availableModels.map((modelName) => (
                    <Button
                      key={modelName}
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => applyInstalledModel(modelName)}
                      data-testid={`button-use-installed-model-${modelName.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}`}
                    >
                      Use {modelName}
                    </Button>
                  ))}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">API Configuration</CardTitle>
          <CardDescription>Configure API rate limits and authentication</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-foreground text-sm">Enable Rate Limiting</p>
              <p className="text-xs text-muted-foreground">Limit API requests to prevent abuse</p>
            </div>
            <Switch
              checked={settings.rateLimiting}
              onCheckedChange={(v) => updateSetting("rateLimiting", v)}
              data-testid="switch-rate-limiting"
            />
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-foreground text-sm">Require API Key</p>
              <p className="text-xs text-muted-foreground">All requests must include valid API key</p>
            </div>
            <Switch
              checked={settings.requireApiKey}
              onCheckedChange={(v) => updateSetting("requireApiKey", v)}
              data-testid="switch-require-api-key"
            />
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-foreground text-sm">Enable Logging</p>
              <p className="text-xs text-muted-foreground">Log all API requests for debugging</p>
            </div>
            <Switch
              checked={settings.enableLogging}
              onCheckedChange={(v) => updateSetting("enableLogging", v)}
              data-testid="switch-enable-logging"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Notifications</CardTitle>
          <CardDescription>Configure notification preferences</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-foreground text-sm">Training Complete</p>
              <p className="text-xs text-muted-foreground">Notify when model training finishes</p>
            </div>
            <Switch
              checked={settings.notifyTraining}
              onCheckedChange={(v) => updateSetting("notifyTraining", v)}
              data-testid="switch-notify-training"
            />
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-foreground text-sm">Deployment Alerts</p>
              <p className="text-xs text-muted-foreground">Notify on deployment status changes</p>
            </div>
            <Switch
              checked={settings.notifyDeployment}
              onCheckedChange={(v) => updateSetting("notifyDeployment", v)}
              data-testid="switch-notify-deployment"
            />
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-foreground text-sm">Usage Alerts</p>
              <p className="text-xs text-muted-foreground">Notify when approaching quota limits</p>
            </div>
            <Switch
              checked={settings.notifyUsage}
              onCheckedChange={(v) => updateSetting("notifyUsage", v)}
              data-testid="switch-notify-usage"
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={saveSettings} data-testid="button-save-settings">Save Changes</Button>
      </div>
    </div>
  );
}
