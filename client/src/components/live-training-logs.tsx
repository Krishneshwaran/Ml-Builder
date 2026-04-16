import { useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Terminal } from "lucide-react";
import { Progress } from "@/components/ui/progress";

interface LiveTrainingLogsProps {
    progress: number;
    trainingEpochs?: number | null;
    modelCreatedAt?: string | null;
    logs?: Array<{
        message: string;
        createdAt: string;
    }>;
}

function formatDuration(ms: number | null) {
    if (!ms || ms <= 0 || !Number.isFinite(ms)) return "Calculating...";
    const totalSeconds = Math.max(1, Math.round(ms / 1000));
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    if (minutes >= 60) {
        const hours = Math.floor(minutes / 60);
        const remMinutes = minutes % 60;
        return `${hours}h ${remMinutes}m`;
    }
    return minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;
}

function estimateRemainingTime(
    progress: number,
    logs: Array<{ message: string; createdAt: string }>,
    trainingEpochs?: number | null,
    modelCreatedAt?: string | null,
) {
    const startTimestamp = logs[0]?.createdAt || modelCreatedAt || null;
    const startMs = startTimestamp ? new Date(startTimestamp).getTime() : NaN;
    if (Number.isNaN(startMs)) {
        return { elapsedMs: null, remainingMs: null };
    }

    const nowMs = Date.now();
    const elapsedMs = Math.max(nowMs - startMs, 0);
    const epochCompleteLogs = logs.filter((log) => /Epoch\s+\d+\/\d+\s+complete/i.test(log.message));

    if ((trainingEpochs || 0) > 0 && epochCompleteLogs.length > 0) {
        const lastEpochLog = epochCompleteLogs[epochCompleteLogs.length - 1];
        const lastEpochMatch = lastEpochLog.message.match(/Epoch\s+(\d+)\/(\d+)\s+complete/i);
        const lastEpochNumber = lastEpochMatch ? Number(lastEpochMatch[1]) : 0;
        const totalEpochs = lastEpochMatch ? Number(lastEpochMatch[2]) : Number(trainingEpochs || 0);
        const firstEpochMs = new Date(epochCompleteLogs[0].createdAt).getTime();
        const lastEpochMs = new Date(lastEpochLog.createdAt).getTime();
        if (lastEpochNumber > 0 && totalEpochs > lastEpochNumber) {
            const averageEpochMs = Math.max((lastEpochMs - startMs) / lastEpochNumber, 1000);
            const remainingEpochs = totalEpochs - lastEpochNumber;
            const tailStageMs = progress >= 75 ? 45000 : 0;
            return {
                elapsedMs,
                remainingMs: (remainingEpochs * averageEpochMs) + tailStageMs,
            };
        }
        if (totalEpochs > 0 && lastEpochNumber >= totalEpochs && progress < 100) {
            return {
                elapsedMs,
                remainingMs: Math.max(((100 - progress) / 100) * elapsedMs, 10000),
            };
        }
        if (!Number.isNaN(firstEpochMs) && !Number.isNaN(lastEpochMs) && lastEpochNumber > 0) {
            const averageEpochMs = Math.max((lastEpochMs - startMs) / lastEpochNumber, 1000);
            return { elapsedMs, remainingMs: averageEpochMs };
        }
    }

    if (progress >= 5 && progress < 100 && elapsedMs >= 5000) {
        const estimatedTotalMs = elapsedMs / Math.max(progress / 100, 0.05);
        return { elapsedMs, remainingMs: Math.max(estimatedTotalMs - elapsedMs, 0) };
    }

    return { elapsedMs, remainingMs: null };
}

export function LiveTrainingLogs({ progress, trainingEpochs, modelCreatedAt, logs = [] }: LiveTrainingLogsProps) {
    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [logs]);

    const formatTimestamp = (value: string) => {
        const date = new Date(value);
        return Number.isNaN(date.getTime()) ? "--:--:--" : date.toLocaleTimeString();
    };

    const { elapsedMs, remainingMs } = estimateRemainingTime(progress, logs, trainingEpochs, modelCreatedAt);

    return (
        <Card className="border-border">
            <CardHeader className="pb-3 border-b bg-muted/30">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Terminal className="w-4 h-4" />
                    Training Console Output
                </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
                <div className="border-b bg-muted/20 px-4 py-3 space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
                        <span>Approx progress</span>
                        <span>{progress}%</span>
                    </div>
                    <Progress value={progress} className="h-2" />
                    <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
                        <span>Elapsed: {formatDuration(elapsedMs)}</span>
                        <span>Approx remaining: {progress >= 100 ? "0s" : formatDuration(remainingMs)}</span>
                        <span>Epochs: {trainingEpochs || "Detecting..."}</span>
                    </div>
                </div>
                <div
                    ref={scrollRef}
                    className="bg-black/95 text-green-400 font-mono text-xs p-4 h-[250px] overflow-y-auto"
                >
                    {logs.length === 0 && (
                        <div className="mb-1 opacity-70">
                            <span className="text-muted-foreground/50 mr-2">[waiting]</span>
                            Training job has started. Backend logs will appear here.
                        </div>
                    )}
                    {logs.map((log, i) => (
                        <div key={`${log.createdAt}-${i}`} className="mb-1 opacity-90 animate-in fade-in slide-in-from-bottom-2">
                            <span className="text-muted-foreground/50 mr-2">[{formatTimestamp(log.createdAt)}]</span>
                            {log.message}
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
