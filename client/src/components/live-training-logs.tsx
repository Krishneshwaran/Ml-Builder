import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Terminal } from "lucide-react";

interface LiveTrainingLogsProps {
    progress: number;
}

const ALL_LOGS = [
    "Initializing training environment...",
    "Allocating resources for model training...",
    "Loading dataset into memory...",
    "Dataset shape: (600, 8)",
    "Preprocessing data pipeline started...",
    "Handling missing values: Strategy='median'",
    "Scaling features: StandardScaler applied",
    "Preprocessing complete.",
    "Splitting data into train/test sets (80/20)...",
    "Train set: 480 samples. Test set: 120 samples.",
    "Initializing classifier...",
    "Starting model training...",
    "Epoch 1/10 - Loss: 0.6931 - Accuracy: 0.5200",
    "Epoch 2/10 - Loss: 0.5821 - Accuracy: 0.6100",
    "Epoch 3/10 - Loss: 0.4902 - Accuracy: 0.6500",
    "Epoch 4/10 - Loss: 0.4201 - Accuracy: 0.7000",
    "Epoch 5/10 - Loss: 0.3588 - Accuracy: 0.7600",
    "Epoch 6/10 - Loss: 0.3120 - Accuracy: 0.8200",
    "Epoch 7/10 - Loss: 0.2805 - Accuracy: 0.8500",
    "Epoch 8/10 - Loss: 0.2510 - Accuracy: 0.8800",
    "Epoch 9/10 - Loss: 0.2201 - Accuracy: 0.9100",
    "Epoch 10/10 - Loss: 0.1985 - Accuracy: 0.9300",
    "Training complete. Convergence achieved.",
    "Evaluating model on test set...",
    "Calculating precision, recall, and F1 score...",
    "Generating confusion matrix...",
    "Optimizing model output format...",
    "Saving model artifact to local disk (.pkl)...",
    "Model successfully saved.",
    "Finalizing training pipeline...",
];

export function LiveTrainingLogs({ progress }: LiveTrainingLogsProps) {
    const [visibleLogs, setVisibleLogs] = useState<string[]>([]);
    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        // Map the 0-100 progress to the array of logs
        const targetIndex = Math.floor((progress / 100) * ALL_LOGS.length);
        if (targetIndex > visibleLogs.length) {
            setVisibleLogs(ALL_LOGS.slice(0, targetIndex));
        }
    }, [progress, visibleLogs.length]);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [visibleLogs]);

    return (
        <Card className="border-border">
            <CardHeader className="pb-3 border-b bg-muted/30">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Terminal className="w-4 h-4" />
                    Training Console Output
                </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
                <div
                    ref={scrollRef}
                    className="bg-black/95 text-green-400 font-mono text-xs p-4 h-[250px] overflow-y-auto"
                >
                    {visibleLogs.map((log, i) => (
                        <div key={i} className="mb-1 opacity-90 animate-in fade-in slide-in-from-bottom-2">
                            <span className="text-muted-foreground/50 mr-2">[{new Date().toISOString().split('T')[1].slice(0, 8)}]</span>
                            {log}
                        </div>
                    ))}
                    {progress < 100 && (
                        <div className="animate-pulse mt-1 opacity-70">
                            <span className="text-muted-foreground/50 mr-2">[{new Date().toISOString().split('T')[1].slice(0, 8)}]</span>
                            <span className="inline-block w-2.5 h-3.5 bg-green-400/80 align-middle"></span>
                        </div>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}
