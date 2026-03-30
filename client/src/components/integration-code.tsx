import { useState } from "react";
import { Check, Copy, Download } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import type { Deployment } from "@shared/schema";

interface IntegrationCodeProps {
  deployment: Deployment;
}

// Template-specific sample payloads
const templatePayloads: Record<string, { features: Record<string, unknown>; description: string }> = {
  "access-control": {
    features: {
      face_embedding_similarity: 0.87,
      face_width: 142,
      face_height: 168,
      brightness: 0.72,
      blur_score: 0.15,
      eye_open_ratio: 0.85,
      head_pose_yaw: 5.2,
      head_pose_pitch: -3.1,
    },
    description: "face verification features",
  },
  "exam-proctoring": {
    features: {
      gaze_deviation_x: 0.12,
      gaze_deviation_y: -0.08,
      head_movement_speed: 1.5,
      face_visible_ratio: 0.95,
      audio_volume_db: 35,
      person_count: 1,
      tab_switch_count: 0,
      mouse_idle_seconds: 3.2,
    },
    description: "proctoring sensor data",
  },
  "waste-sorting": {
    features: {
      color_r_mean: 180,
      color_g_mean: 160,
      color_b_mean: 140,
      texture_entropy: 5.3,
      object_area: 2500,
      aspect_ratio: 1.2,
      edge_density: 0.45,
      reflectivity: 0.72,
    },
    description: "material properties",
  },
  "retail-analytics": {
    features: {
      dwell_time_seconds: 45.5,
      visit_frequency: 3,
      path_length_meters: 28.7,
      items_touched: 5,
      time_of_day_hour: 14,
      day_of_week: 3,
      store_section_count: 4,
      near_checkout_time: 120.0,
    },
    description: "customer behavior data",
  },
  "document-processing": {
    features: {
      word_count: 1250,
      has_header: 1,
      has_table: 1,
      has_signature: 0,
      image_count: 2,
      font_size_avg: 11.5,
      line_spacing: 1.5,
      numeric_ratio: 0.32,
    },
    description: "document features",
  },
  "crowd-monitoring": {
    features: {
      person_count: 35,
      avg_speed: 1.8,
      density_per_sqm: 2.5,
      flow_direction_variance: 0.8,
      time_of_day: 18,
      temperature_c: 28.5,
      is_weekend: 0,
      event_nearby: 1,
    },
    description: "crowd sensor data",
  },
};

export function IntegrationCode({ deployment }: IntegrationCodeProps) {
  const { toast } = useToast();
  const [copied, setCopied] = useState<string | null>(null);

  const endpoint = deployment.endpoint || "https://api.mlmodelfactory.com/v1/predict";
  const apiKey = deployment.apiKey || "your-api-key";

  // Look up template-specific payload or use a default
  const templateId = (deployment as any).templateId || "waste-sorting";
  const payload = templatePayloads[templateId] || templatePayloads["waste-sorting"];
  const featuresJson = JSON.stringify(payload.features, null, 6).replace(/\n/g, "\n    ");

  const fetchCode = `// JavaScript/Node.js
const response = await fetch("${endpoint}", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Authorization": "Bearer ${apiKey}"
  },
  body: JSON.stringify({
    features: ${featuresJson}
  })
});

const result = await response.json();
console.log(result.prediction);   // e.g. "authorized", "plastic", "normal"
console.log(result.probability);  // class probabilities`;

  const curlCode = `# cURL
curl -X POST "${endpoint}" \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer ${apiKey}" \\
  -d '{
    "features": ${JSON.stringify(payload.features)}
  }'`;

  const pythonCode = `# Python
import requests

response = requests.post(
    "${endpoint}",
    headers={
        "Content-Type": "application/json",
        "Authorization": f"Bearer ${apiKey}"
    },
    json={
        "features": ${JSON.stringify(payload.features, null, 8).replace(/\n/g, "\n        ")}
    }
)

result = response.json()
print(f"Prediction: {result['prediction']}")
print(f"Probability: {result.get('probability', 'N/A')}")`;

  const responseExample = `// Example Response
{
  "prediction": "${Object.keys(payload.features)[0] === "face_embedding_similarity" ? "authorized" : "plastic"}",
  "probability": {
    "class_a": 0.87,
    "class_b": 0.13
  }
}`;

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(null), 2000);
    toast({
      title: "Copied!",
      description: `${label} code copied to clipboard`,
    });
  };

  return (
    <div className="space-y-6" data-testid="integration-code">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">API Integration</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="fetch" className="w-full">
            <TabsList className="grid w-full grid-cols-4 mb-4">
              <TabsTrigger value="fetch" data-testid="tab-fetch">JavaScript</TabsTrigger>
              <TabsTrigger value="curl" data-testid="tab-curl">cURL</TabsTrigger>
              <TabsTrigger value="python" data-testid="tab-python">Python</TabsTrigger>
              <TabsTrigger value="response" data-testid="tab-response">Response</TabsTrigger>
            </TabsList>

            <TabsContent value="fetch">
              <div className="relative">
                <Button
                  variant="ghost"
                  size="sm"
                  className="absolute top-2 right-2 h-7 gap-1 text-xs"
                  onClick={() => copyToClipboard(fetchCode, "JavaScript")}
                >
                  {copied === "JavaScript" ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                  {copied === "JavaScript" ? "Copied" : "Copy"}
                </Button>
                <pre className="p-4 rounded-lg bg-muted/50 overflow-x-auto text-sm font-mono text-foreground">
                  <code>{fetchCode}</code>
                </pre>
              </div>
            </TabsContent>

            <TabsContent value="curl">
              <div className="relative">
                <Button
                  variant="ghost"
                  size="sm"
                  className="absolute top-2 right-2 h-7 gap-1 text-xs"
                  onClick={() => copyToClipboard(curlCode, "cURL")}
                >
                  {copied === "cURL" ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                  {copied === "cURL" ? "Copied" : "Copy"}
                </Button>
                <pre className="p-4 rounded-lg bg-muted/50 overflow-x-auto text-sm font-mono text-foreground">
                  <code>{curlCode}</code>
                </pre>
              </div>
            </TabsContent>

            <TabsContent value="python">
              <div className="relative">
                <Button
                  variant="ghost"
                  size="sm"
                  className="absolute top-2 right-2 h-7 gap-1 text-xs"
                  onClick={() => copyToClipboard(pythonCode, "Python")}
                >
                  {copied === "Python" ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                  {copied === "Python" ? "Copied" : "Copy"}
                </Button>
                <pre className="p-4 rounded-lg bg-muted/50 overflow-x-auto text-sm font-mono text-foreground">
                  <code>{pythonCode}</code>
                </pre>
              </div>
            </TabsContent>

            <TabsContent value="response">
              <pre className="p-4 rounded-lg bg-muted/50 overflow-x-auto text-sm font-mono text-foreground">
                <code>{responseExample}</code>
              </pre>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Export Options</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Button
              variant="outline"
              className="justify-start gap-2"
              data-testid="button-export-logs"
              onClick={() => {
                const csv = "timestamp,prediction,confidence\n" +
                  new Date().toISOString() + ",class_a,0.94\n" +
                  new Date().toISOString() + ",class_b,0.87\n";
                const blob = new Blob([csv], { type: "text/csv" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `${deployment.name || "deployment"}_logs.csv`;
                a.click();
                URL.revokeObjectURL(url);
                toast({ title: "Exported", description: "Logs exported to CSV" });
              }}
            >
              <Download className="w-4 h-4" />
              Export Logs to CSV
            </Button>
            <Button
              variant="outline"
              className="justify-start gap-2"
              data-testid="button-export-config"
              onClick={() => {
                const config = JSON.stringify({
                  deployment_id: deployment.id,
                  endpoint: deployment.endpoint,
                  api_key: deployment.apiKey,
                  type: deployment.type,
                  status: deployment.status,
                  created_at: deployment.createdAt,
                }, null, 2);
                const blob = new Blob([config], { type: "application/json" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `${deployment.name || "deployment"}_config.json`;
                a.click();
                URL.revokeObjectURL(url);
                toast({ title: "Exported", description: "Configuration exported" });
              }}
            >
              <Download className="w-4 h-4" />
              Export Configuration
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
