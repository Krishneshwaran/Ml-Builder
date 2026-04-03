import { useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Terminal } from "lucide-react";

interface LiveTrainingLogsProps {
    progress: number;
    logs?: Array<{
        message: string;
        createdAt: string;
    }>;
}
export function LiveTrainingLogs({ progress, logs = [] }: LiveTrainingLogsProps) {
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
