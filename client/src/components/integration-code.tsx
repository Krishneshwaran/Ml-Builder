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

export function IntegrationCode({ deployment }: IntegrationCodeProps) {
  const { toast } = useToast();
  const [copied, setCopied] = useState<string | null>(null);

  const endpoint = deployment.endpoint || "https://api.mlforge.io/v1/predict";
  const apiKey = deployment.apiKey || "your-api-key";

  const fetchCode = `// JavaScript/Node.js
const response = await fetch("${endpoint}", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Authorization": "Bearer ${apiKey}"
  },
  body: JSON.stringify({
    data: base64EncodedImage,
    options: {
      threshold: 0.8,
      return_metadata: true
    }
  })
});

const result = await response.json();
console.log(result.predictions);`;

  const curlCode = `# cURL
curl -X POST "${endpoint}" \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer ${apiKey}" \\
  -d '{
    "data": "base64_encoded_image_or_data",
    "options": {
      "threshold": 0.8,
      "return_metadata": true
    }
  }'`;

  const pythonCode = `# Python
import requests
import base64

with open("image.jpg", "rb") as f:
    image_data = base64.b64encode(f.read()).decode()

response = requests.post(
    "${endpoint}",
    headers={
        "Content-Type": "application/json",
        "Authorization": f"Bearer ${apiKey}"
    },
    json={
        "data": image_data,
        "options": {
            "threshold": 0.8,
            "return_metadata": True
        }
    }
)

result = response.json()
print(result["predictions"])`;

  const responseExample = `// Example Response
{
  "success": true,
  "request_id": "req_abc123",
  "predictions": [
    {
      "label": "verified",
      "confidence": 0.94,
      "metadata": {
        "processing_time_ms": 45,
        "model_version": "1.0.0"
      }
    }
  ],
  "usage": {
    "requests_remaining": 9847,
    "quota_reset": "2024-02-01T00:00:00Z"
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
            <Button variant="outline" className="justify-start gap-2" data-testid="button-export-logs">
              <Download className="w-4 h-4" />
              Export Logs to CSV
            </Button>
            <Button variant="outline" className="justify-start gap-2" data-testid="button-export-sheets">
              <Download className="w-4 h-4" />
              Export to Google Sheets
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
