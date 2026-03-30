import { useState, useCallback } from "react";
import { Upload, FileText, CheckCircle, X, Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

interface UploadedFile {
    id: string;
    name: string;
    size: number;
    type: string;
    progress: number;
    status: "uploading" | "completed" | "error";
    error?: string;
}

interface DataUploadZoneProps {
    projectId: str;
    onUploadComplete?: () => void;
}

export function DataUploadZone({ projectId, onUploadComplete }: DataUploadZoneProps) {
    const { toast } = useToast();
    const [isDragging, setIsDragging] = useState(false);
    const [files, setFiles] = useState<UploadedFile[]>([]);
    const [isUploading, setIsUploading] = useState(false);

    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    }, []);

    const handleDragLeave = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
    }, []);

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        const droppedFiles = Array.from(e.dataTransfer.files).filter(f => f.name.endsWith('.csv'));

        if (droppedFiles.length === 0) {
            toast({ title: "Invalid File", description: "Please upload a valid .csv file", variant: "destructive" });
            return;
        }
        processFiles(droppedFiles.slice(0, 1)); // Accept only 1 file for MVP
    }, []);

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            const selectedFiles = Array.from(e.target.files).filter(f => f.name.endsWith('.csv'));
            if (selectedFiles.length === 0) {
                toast({ title: "Invalid File", description: "Please upload a valid .csv file", variant: "destructive" });
                return;
            }
            processFiles(selectedFiles.slice(0, 1));
        }
    };

    const processFiles = async (newFiles: File[]) => {
        if (newFiles.length === 0) return;
        const file = newFiles[0];

        const fileId = `${Date.now()}`;
        setFiles([{
            id: fileId,
            name: file.name,
            size: file.size,
            type: file.type,
            progress: 0,
            status: "uploading",
        }]);

        setIsUploading(true);

        const formData = new FormData();
        formData.append("file", file);

        try {
            const response = await fetch(`/api/projects/${projectId}/dataset`, {
                method: "POST",
                body: formData,
            });

            if (!response.ok) {
                throw new Error("Upload failed");
            }

            setFiles(prev => prev.map(f => f.id === fileId ? { ...f, progress: 100, status: "completed" } : f));
            toast({ title: "Upload Successful", description: "Dataset has been securely saved." });
            onUploadComplete?.();
        } catch (error) {
            setFiles(prev => prev.map(f => f.id === fileId ? { ...f, status: "error", error: "Upload failed" } : f));
            toast({ title: "Upload Failed", description: "There was an error saving your dataset.", variant: "destructive" });
        } finally {
            setIsUploading(false);
        }
    };

    const removeFile = (id: string) => {
        setFiles((prev) => prev.filter((f) => f.id !== id));
    };

    const formatFileSize = (bytes: number) => {
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    };

    return (
        <div className="space-y-4">
            <Card
                className={cn(
                    "border-2 border-dashed transition-colors",
                    !isUploading && "cursor-pointer",
                    isDragging ? "border-primary bg-primary/5" : "border-border"
                )}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                data-testid="data-upload-zone"
            >
                <CardContent className="p-8">
                    <label className="flex flex-col items-center gap-4 cursor-pointer">
                        <div className={cn(
                            "flex items-center justify-center w-14 h-14 rounded-full transition-colors",
                            isDragging ? "bg-primary/20" : "bg-muted"
                        )}>
                            <Upload className={cn(
                                "w-6 h-6",
                                isDragging ? "text-primary" : "text-muted-foreground"
                            )} />
                        </div>
                        <div className="text-center">
                            <p className="text-base font-medium text-foreground mb-1">
                                Drop your Tabular Dataset (.csv) here
                            </p>
                            <p className="text-sm text-muted-foreground">
                                First row must be headers. The last column will be used as the target label.
                            </p>
                        </div>
                        <input
                            type="file"
                            accept=".csv"
                            className="hidden"
                            onChange={handleFileSelect}
                            disabled={isUploading}
                            data-testid="file-input"
                        />
                    </label>
                </CardContent>
            </Card>

            {files.length > 0 && (
                <div className="space-y-2">
                    <h4 className="text-sm font-medium text-foreground">
                        Processing Dataset
                    </h4>
                    <div className="space-y-2">
                        {files.map((file) => (
                            <Card key={file.id} className="p-3" data-testid={`file-item-${file.id}`}>
                                <div className="flex items-center gap-3">
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-1">
                                            <p className="text-sm font-medium text-foreground truncate">
                                                {file.name}
                                            </p>
                                            {file.status === "completed" && (
                                                <CheckCircle className="w-4 h-4 text-chart-2 shrink-0" />
                                            )}
                                            {file.status === "uploading" && (
                                                <Loader2 className="w-4 h-4 text-primary animate-spin shrink-0" />
                                            )}
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs text-muted-foreground">
                                                {formatFileSize(file.size)}
                                            </span>
                                            {file.status === "uploading" && (
                                                <Progress value={file.progress} className="h-1 flex-1 max-w-32" />
                                            )}
                                            {file.status === "error" && (
                                                <span className="text-xs text-destructive">{file.error}</span>
                                            )}
                                        </div>
                                    </div>
                                    {!isUploading && file.status !== "completed" && (
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => removeFile(file.id)}
                                            data-testid={`button-remove-file-${file.id}`}
                                        >
                                            <X className="w-4 h-4" />
                                        </Button>
                                    )}
                                </div>
                            </Card>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
