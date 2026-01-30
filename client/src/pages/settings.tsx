import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";

export default function Settings() {
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
            <Input id="org-name" defaultValue="MLForge Enterprise" data-testid="input-org-name" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="org-email">Contact Email</Label>
            <Input id="org-email" type="email" defaultValue="admin@mlforge.io" data-testid="input-org-email" />
          </div>
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
            <Switch defaultChecked data-testid="switch-rate-limiting" />
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-foreground text-sm">Require API Key</p>
              <p className="text-xs text-muted-foreground">All requests must include valid API key</p>
            </div>
            <Switch defaultChecked data-testid="switch-require-api-key" />
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-foreground text-sm">Enable Logging</p>
              <p className="text-xs text-muted-foreground">Log all API requests for debugging</p>
            </div>
            <Switch defaultChecked data-testid="switch-enable-logging" />
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
            <Switch defaultChecked data-testid="switch-notify-training" />
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-foreground text-sm">Deployment Alerts</p>
              <p className="text-xs text-muted-foreground">Notify on deployment status changes</p>
            </div>
            <Switch defaultChecked data-testid="switch-notify-deployment" />
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-foreground text-sm">Usage Alerts</p>
              <p className="text-xs text-muted-foreground">Notify when approaching quota limits</p>
            </div>
            <Switch data-testid="switch-notify-usage" />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button data-testid="button-save-settings">Save Changes</Button>
      </div>
    </div>
  );
}
