import { useState } from "react";
import { Cloud, Cpu, Check, Copy, ExternalLink, Activity, Clock, Zap } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import type { Deployment } from "@shared/schema";

interface DeploymentPanelProps {
  deployment?: Deployment;
  onDeploymentTypeChange?: (type: "cloud-api" | "edge-device") => void;
  onDeploy?: () => void;
  isDeploying?: boolean;
}

export function DeploymentPanel({
  deployment,
  onDeploymentTypeChange,
  onDeploy,
  isDeploying,
}: DeploymentPanelProps) {
  const { toast } = useToast();
  const [selectedType, setSelectedType] = useState<"cloud-api" | "edge-device">("cloud-api");
  const [copied, setCopied] = useState<string | null>(null);

  const handleTypeChange = (type: "cloud-api" | "edge-device") => {
    setSelectedType(type);
    onDeploymentTypeChange?.(type);
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(null), 2000);
    toast({
      title: "Copied!",
      description: `${label} copied to clipboard`,
    });
  };

  return (
    <div className="space-y-6" data-testid="deployment-panel">
      {!deployment?.status || deployment.status === "pending" ? (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Deployment Options</CardTitle>
          </CardHeader>
          <CardContent>
            <RadioGroup
              defaultValue={selectedType}
              onValueChange={(value) => handleTypeChange(value as "cloud-api" | "edge-device")}
              className="grid grid-cols-1 md:grid-cols-2 gap-4"
            >
              <Label
                htmlFor="cloud-api"
                className={cn(
                  "flex items-start gap-4 p-4 rounded-lg border-2 cursor-pointer transition-colors hover-elevate",
                  selectedType === "cloud-api"
                    ? "border-primary bg-primary/5"
                    : "border-border"
                )}
              >
                <RadioGroupItem value="cloud-api" id="cloud-api" className="mt-1" />
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <Cloud className="w-5 h-5 text-primary" />
                    <span className="font-medium text-foreground">Cloud REST API</span>
                  </div>
                  <p className="text-sm text-muted-foreground mb-3">
                    Deploy as a scalable cloud API endpoint with automatic load balancing and high availability.
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    <Badge variant="secondary" className="text-xs">Auto-scaling</Badge>
                    <Badge variant="secondary" className="text-xs">99.9% SLA</Badge>
                    <Badge variant="secondary" className="text-xs">HTTPS</Badge>
                  </div>
                </div>
              </Label>

              <Label
                htmlFor="edge-device"
                className={cn(
                  "flex items-start gap-4 p-4 rounded-lg border-2 cursor-pointer transition-colors hover-elevate",
                  selectedType === "edge-device"
                    ? "border-primary bg-primary/5"
                    : "border-border"
                )}
              >
                <RadioGroupItem value="edge-device" id="edge-device" className="mt-1" />
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <Cpu className="w-5 h-5 text-chart-4" />
                    <span className="font-medium text-foreground">Edge Device</span>
                  </div>
                  <p className="text-sm text-muted-foreground mb-3">
                    Export optimized model for on-device inference with minimal latency.
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    <Badge variant="secondary" className="text-xs">Offline capable</Badge>
                    <Badge variant="secondary" className="text-xs">Low latency</Badge>
                    <Badge variant="secondary" className="text-xs">Privacy</Badge>
                  </div>
                </div>
              </Label>
            </RadioGroup>

            <Button
              className="w-full mt-6"
              onClick={onDeploy}
              disabled={isDeploying}
              data-testid="button-deploy"
            >
              {isDeploying ? (
                <>
                  <Activity className="w-4 h-4 mr-2 animate-pulse" />
                  Deploying...
                </>
              ) : (
                <>
                  <Zap className="w-4 h-4 mr-2" />
                  Deploy Model
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-3">
                <CardTitle className="text-base">Deployment Status</CardTitle>
                <Badge
                  className={cn(
                    deployment.status === "active"
                      ? "bg-chart-2/20 text-chart-2"
                      : deployment.status === "deploying"
                      ? "bg-chart-3/20 text-chart-3"
                      : "bg-muted text-muted-foreground"
                  )}
                >
                  {deployment.status === "active" ? "Active" : deployment.status === "deploying" ? "Deploying..." : "Stopped"}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div className="p-4 rounded-lg bg-muted/50" data-testid="stat-requests-today">
                  <p className="text-xs text-muted-foreground mb-1">Requests Today</p>
                  <p className="text-2xl font-bold text-foreground">{deployment.requestsToday?.toLocaleString() ?? 0}</p>
                </div>
                <div className="p-4 rounded-lg bg-muted/50" data-testid="stat-total-requests">
                  <p className="text-xs text-muted-foreground mb-1">Total Requests</p>
                  <p className="text-2xl font-bold text-foreground">{deployment.totalRequests?.toLocaleString() ?? 0}</p>
                </div>
                <div className="p-4 rounded-lg bg-muted/50" data-testid="stat-avg-latency">
                  <p className="text-xs text-muted-foreground mb-1">Avg. Latency</p>
                  <p className="text-2xl font-bold text-foreground">{deployment.avgLatency ?? 0}ms</p>
                </div>
              </div>

              {deployment.endpoint && (
                <div className="space-y-3">
                  <div className="p-3 rounded-lg bg-muted/50">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="text-xs font-medium text-muted-foreground">API Endpoint</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 gap-1 text-xs"
                        onClick={() => copyToClipboard(deployment.endpoint!, "Endpoint")}
                      >
                        {copied === "Endpoint" ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                        {copied === "Endpoint" ? "Copied" : "Copy"}
                      </Button>
                    </div>
                    <code className="text-sm font-mono text-foreground break-all">
                      {deployment.endpoint}
                    </code>
                  </div>

                  {deployment.apiKey && (
                    <div className="p-3 rounded-lg bg-muted/50">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className="text-xs font-medium text-muted-foreground">API Key</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 gap-1 text-xs"
                          onClick={() => copyToClipboard(deployment.apiKey!, "API Key")}
                        >
                          {copied === "API Key" ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                          {copied === "API Key" ? "Copied" : "Copy"}
                        </Button>
                      </div>
                      <code className="text-sm font-mono text-foreground">
                        {deployment.apiKey.slice(0, 20)}...
                      </code>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Clock className="w-3.5 h-3.5" />
            <span>
              Deployed {deployment.deployedAt ? new Date(deployment.deployedAt).toLocaleString() : "N/A"}
            </span>
          </div>
        </>
      )}
    </div>
  );
}
