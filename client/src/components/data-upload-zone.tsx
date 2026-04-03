import { useState, useCallback } from "react";
import { Upload, FileText, CheckCircle, X, Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import type { Dataset } from "@shared/schema";

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
    projectId: string;
    onUploadComplete?: (dataset?: Dataset) => void;
}

export function DataUploadZone({ projectId, onUploadComplete }: DataUploadZoneProps) {
    const { toast } = useToast();
    const [isDragging, setIsDragging] = useState(false);
    const [files, setFiles] = useState<UploadedFile[]>([]);
    const [isUploading, setIsUploading] = useState(false);
    const [kaggleUrl, setKaggleUrl] = useState("");
    const [isImportingKaggle, setIsImportingKaggle] = useState(false);
    const [enrollmentPrompt, setEnrollmentPrompt] = useState("");
    const [enrollmentFiles, setEnrollmentFiles] = useState<File[]>([]);
    const [isEnrollingImages, setIsEnrollingImages] = useState(false);
    const supportedEnrollmentExtensions = [".jpg", ".jpeg", ".png", ".bmp", ".gif", ".webp"];

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
        const droppedFiles = Array.from(e.dataTransfer.files).filter(
            f => f.name.toLowerCase().endsWith('.csv') || f.name.toLowerCase().endsWith('.zip')
        );

        if (droppedFiles.length === 0) {
            toast({ title: "Invalid File", description: "Please upload a valid .csv or .zip file", variant: "destructive" });
            return;
        }
        processFiles(droppedFiles.slice(0, 1)); // Accept only 1 file for MVP
    }, []);

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            const selectedFiles = Array.from(e.target.files).filter(
                f => f.name.toLowerCase().endsWith('.csv') || f.name.toLowerCase().endsWith('.zip')
            );
            if (selectedFiles.length === 0) {
                toast({ title: "Invalid File", description: "Please upload a valid .csv or .zip file", variant: "destructive" });
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

            const result = await response.json();
            setFiles(prev => prev.map(f => f.id === fileId ? { ...f, progress: 100, status: "completed" } : f));
            toast({ title: "Upload Successful", description: "Dataset has been securely saved." });
            onUploadComplete?.(result);
        } catch (error) {
            setFiles(prev => prev.map(f => f.id === fileId ? { ...f, status: "error", error: "Upload failed" } : f));
            toast({ title: "Upload Failed", description: "There was an error saving your dataset.", variant: "destructive" });
        } finally {
            setIsUploading(false);
        }
    };

    const processKaggleImport = async () => {
        const trimmedUrl = kaggleUrl.trim();
        if (!trimmedUrl) {
            toast({ title: "Kaggle URL Required", description: "Paste a Kaggle dataset link first.", variant: "destructive" });
            return;
        }

        setIsImportingKaggle(true);
        try {
            const formData = new FormData();
            formData.append("kaggle_url", trimmedUrl);

            const response = await fetch(`/api/projects/${projectId}/dataset`, {
                method: "POST",
                body: formData,
            });

            if (!response.ok) {
                const message = await response.text();
                throw new Error(message || "Kaggle import failed");
            }

            const result = await response.json();
            setKaggleUrl("");
            toast({ title: "Kaggle Import Complete", description: "The image dataset is ready for training." });
            onUploadComplete?.(result);
        } catch (error) {
            toast({
                title: "Kaggle Import Failed",
                description: error instanceof Error ? error.message : "Unable to import the Kaggle dataset.",
                variant: "destructive",
            });
        } finally {
            setIsImportingKaggle(false);
        }
    };

    const processPromptEnrollment = async () => {
        const trimmedPrompt = enrollmentPrompt.trim();
        if (!trimmedPrompt) {
            toast({
                title: "Prompt Required",
                description: "Describe the identity or class, for example: This is Dharshaneshwaran.",
                variant: "destructive",
            });
            return;
        }

        if (enrollmentFiles.length === 0) {
            toast({
                title: "Images Required",
                description: "Choose one or more images to enroll for this prompt label.",
                variant: "destructive",
            });
            return;
        }

        const invalidEnrollmentFiles = enrollmentFiles.filter((file) => {
            const lowerName = file.name.toLowerCase();
            return !supportedEnrollmentExtensions.some((extension) => lowerName.endsWith(extension));
        });

        if (invalidEnrollmentFiles.length > 0) {
            toast({
                title: "Unsupported image format",
                description: `Prompt enrollment supports JPG, JPEG, PNG, BMP, GIF, and WEBP only. Please convert ${invalidEnrollmentFiles[0].name} before uploading.`,
                variant: "destructive",
            });
            return;
        }

        setIsEnrollingImages(true);
        try {
            const formData = new FormData();
            formData.append("prompt", trimmedPrompt);
            enrollmentFiles.forEach((file) => formData.append("files", file));

            const response = await fetch(`/api/projects/${projectId}/dataset/enroll`, {
                method: "POST",
                body: formData,
            });

            if (!response.ok) {
                const message = await response.text();
                throw new Error(message || "Image enrollment failed");
            }

            const result = await response.json();
            setEnrollmentPrompt("");
            setEnrollmentFiles([]);
            toast({
                title: "Images enrolled",
                description: result.message || `Saved images under ${result.enrolledLabel}.`,
            });
            onUploadComplete?.(result);
        } catch (error) {
            toast({
                title: "Enrollment Failed",
                description: error instanceof Error ? error.message : "Unable to save labeled images.",
                variant: "destructive",
            });
        } finally {
            setIsEnrollingImages(false);
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
                                Drop your Dataset (.csv or .zip) here
                            </p>
                            <p className="text-sm text-muted-foreground">
                                CSV uses the last column as the label. ZIP works for image-classification folders downloaded from Kaggle.
                            </p>
                        </div>
                        <input
                            type="file"
                            accept=".csv,.zip"
                            className="hidden"
                            onChange={handleFileSelect}
                            disabled={isUploading}
                            data-testid="file-input"
                        />
                    </label>
                    <div className="mt-6 border-t pt-4">
                        <p className="text-sm font-medium text-foreground mb-2">
                            Or import an image-classification dataset from Kaggle
                        </p>
                        <div className="flex flex-col sm:flex-row gap-3">
                            <Input
                                value={kaggleUrl}
                                onChange={(e) => setKaggleUrl(e.target.value)}
                                placeholder="https://www.kaggle.com/datasets/owner/dataset"
                                disabled={isUploading || isImportingKaggle}
                                data-testid="input-kaggle-url"
                            />
                            <Button
                                type="button"
                                onClick={processKaggleImport}
                                disabled={isUploading || isImportingKaggle}
                                data-testid="button-import-kaggle"
                            >
                                {isImportingKaggle ? (
                                    <>
                                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                        Importing...
                                    </>
                                ) : (
                                    "Import Kaggle Link"
                                )}
                            </Button>
                        </div>
                    </div>
                    <div className="mt-6 border-t pt-4 space-y-3">
                        <p className="text-sm font-medium text-foreground">
                            Or enroll images from a prompt
                        </p>
                        <p className="text-sm text-muted-foreground">
                            Example: upload a few photos and write "This is Dharshaneshwaran". The app will save them locally as one class for later GPU training. Add at least two different labels before starting image training.
                        </p>
                        <Textarea
                            value={enrollmentPrompt}
                            onChange={(e) => setEnrollmentPrompt(e.target.value)}
                            placeholder="This is Dharshaneshwaran"
                            disabled={isUploading || isEnrollingImages}
                            data-testid="textarea-enrollment-prompt"
                        />
                        <Input
                            type="file"
                            accept=".jpg,.jpeg,.png,.bmp,.gif,.webp,image/jpeg,image/png,image/bmp,image/gif,image/webp"
                            multiple
                            disabled={isUploading || isEnrollingImages}
                            onChange={(e) => {
                                const nextFiles = Array.from(e.target.files || []);
                                const invalidFiles = nextFiles.filter((file) => {
                                    const lowerName = file.name.toLowerCase();
                                    return !supportedEnrollmentExtensions.some((extension) => lowerName.endsWith(extension));
                                });

                                if (invalidFiles.length > 0) {
                                    toast({
                                        title: "Unsupported image format",
                                        description: `Prompt enrollment supports JPG, JPEG, PNG, BMP, GIF, and WEBP only. ${invalidFiles[0].name} cannot be used directly.`,
                                        variant: "destructive",
                                    });
                                }

                                setEnrollmentFiles(
                                    nextFiles.filter((file) => {
                                        const lowerName = file.name.toLowerCase();
                                        return supportedEnrollmentExtensions.some((extension) => lowerName.endsWith(extension));
                                    })
                                );
                            }}
                            data-testid="input-enrollment-images"
                        />
                        {enrollmentFiles.length > 0 && (
                            <p className="text-xs text-muted-foreground">
                                {enrollmentFiles.length} image(s) selected: {enrollmentFiles.map((file) => file.name).join(", ")}
                            </p>
                        )}
                        <Button
                            type="button"
                            onClick={processPromptEnrollment}
                            disabled={isUploading || isEnrollingImages}
                            data-testid="button-enroll-images"
                        >
                            {isEnrollingImages ? (
                                <>
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                    Saving Images...
                                </>
                            ) : (
                                "Enroll Labeled Images"
                            )}
                        </Button>
                    </div>
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
