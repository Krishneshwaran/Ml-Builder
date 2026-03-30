import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Play, Activity } from "lucide-react";
import type { MlModel, Deployment } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";

interface LiveTesterProps {
    model: MlModel;
    deployment: Deployment;
}

export function LiveTester({ model, deployment }: LiveTesterProps) {
    const { toast } = useToast();
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<{
        prediction: string;
        probability?: Record<string, number>;
        latency_ms: number;
    } | null>(null);

    // Initialize feature values to 0 by default
    const features = model.featureNames || [];
    const [values, setValues] = useState<Record<string, string>>(
        features.reduce((acc, f) => ({ ...acc, [f]: "0" }), {})
    );

    const handleTest = async () => {
        if (!deployment.endpoint) {
            toast({
                title: "Error",
                description: "Deployment endpoint is not available",
                variant: "destructive",
            });
            return;
        }

        setLoading(true);
        setResult(null);

        try {
            // Convert string inputs to numbers
            const numericFeatures = Object.fromEntries(
                Object.entries(values).map(([k, v]) => [k, parseFloat(v) || 0])
            );

            // Use the local API proxy path instead of absolute URL if it exists
            const endpoint = deployment.endpoint.replace("http://localhost:8000", "");

            const res = await fetch(endpoint, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${deployment.apiKey}`,
                },
                body: JSON.stringify({ features: numericFeatures }),
            });

            if (!res.ok) {
                throw new Error("Prediction failed");
            }

            const data = await res.json();
            setResult(data);
        } catch (error) {
            toast({
                title: "Prediction Failed",
                description: error instanceof Error ? error.message : "Unknown error",
                variant: "destructive",
            });
        } finally {
            setLoading(false);
        }
    };

    if (!features.length) {
        return null;
    }

    return (
        <Card className="mt-6 border-primary/20 bg-primary/5">
            <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2 text-primary">
                    <Activity className="w-5 h-5" />
                    Live Prediction Tester
                </CardTitle>
                <CardDescription>
                    Test your deployed endpoint in real-time. Enter feature values below.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
                    {features.map((feature) => (
                        <div key={feature} className="space-y-1.5">
                            <Label htmlFor={`feature-${feature}`} className="text-xs truncate" title={feature}>
                                {feature}
                            </Label>
                            <Input
                                id={`feature-${feature}`}
                                type="number"
                                step="0.01"
                                value={values[feature]}
                                onChange={(e) => setValues({ ...values, [feature]: e.target.value })}
                                className="h-8 text-sm"
                            />
                        </div>
                    ))}
                </div>

                <div className="flex flex-col md:flex-row gap-6 items-start">
                    <Button
                        onClick={handleTest}
                        disabled={loading}
                        className="w-full md:w-auto min-w-[140px]"
                    >
                        {loading ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Testing...
                            </>
                        ) : (
                            <>
                                <Play className="mr-2 h-4 w-4 fill-current" />
                                Run Prediction
                            </>
                        )}
                    </Button>

                    {result && (
                        <div className="flex-1 bg-background border p-4 rounded-lg w-full">
                            <div className="flex items-center justify-between mb-3 border-b pb-2">
                                <span className="text-sm font-medium text-muted-foreground">Prediction Result</span>
                                <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
                                    {result.latency_ms}ms
                                </span>
                            </div>

                            <div className="text-2xl font-bold mb-4 capitalize">
                                {result.prediction}
                            </div>

                            {result.probability && (
                                <div className="space-y-2">
                                    <span className="text-xs font-medium text-muted-foreground">Class Probabilities</span>
                                    <div className="grid grid-cols-2 gap-2 mt-1">
                                        {Object.entries(result.probability).map(([cls, prob]) => (
                                            <div key={cls} className="flex justify-between text-sm">
                                                <span className="capitalize">{cls}</span>
                                                <span className="font-mono">{(prob * 100).toFixed(1)}%</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}
