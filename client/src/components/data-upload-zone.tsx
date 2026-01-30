import { useState, useCallback } from "react";
import { Upload, Image, Video, FileAudio, FileText, Table, X, CheckCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

const dataTypeIcons = {
  images: Image,
  video: Video,
  audio: FileAudio,
  text: FileText,
  csv: Table,
  pdf: FileText,
};

interface UploadedFile {
  id: string;
  name: string;
  size: number;
  type: string;
  progress: number;
  status: "uploading" | "completed" | "error";
}

interface DataUploadZoneProps {
  acceptedTypes: readonly string[];
  onFilesUploaded?: (files: UploadedFile[]) => void;
}

export function DataUploadZone({ acceptedTypes, onFilesUploaded }: DataUploadZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [files, setFiles] = useState<UploadedFile[]>([]);

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
    const droppedFiles = Array.from(e.dataTransfer.files);
    processFiles(droppedFiles);
  }, []);

  const processFiles = (newFiles: File[]) => {
    const uploadedFiles: UploadedFile[] = newFiles.map((file, index) => ({
      id: `${Date.now()}-${index}`,
      name: file.name,
      size: file.size,
      type: file.type,
      progress: 0,
      status: "uploading" as const,
    }));

    setFiles((prev) => [...prev, ...uploadedFiles]);

    // Simulate upload progress
    uploadedFiles.forEach((file) => {
      let progress = 0;
      const interval = setInterval(() => {
        progress += Math.random() * 20;
        if (progress >= 100) {
          progress = 100;
          clearInterval(interval);
          setFiles((prev) =>
            prev.map((f) =>
              f.id === file.id ? { ...f, progress: 100, status: "completed" as const } : f
            )
          );
        } else {
          setFiles((prev) =>
            prev.map((f) => (f.id === file.id ? { ...f, progress } : f))
          );
        }
      }, 200);
    });

    onFilesUploaded?.(uploadedFiles);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      processFiles(Array.from(e.target.files));
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
          "border-2 border-dashed transition-colors cursor-pointer",
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
                Drop files here or click to browse
              </p>
              <p className="text-sm text-muted-foreground">
                Supports {acceptedTypes.join(", ")} formats
              </p>
            </div>
            <div className="flex items-center gap-2 flex-wrap justify-center">
              {acceptedTypes.map((type) => {
                const Icon = dataTypeIcons[type as keyof typeof dataTypeIcons] || FileText;
                return (
                  <Badge key={type} variant="secondary" className="gap-1.5">
                    <Icon className="w-3 h-3" />
                    {type}
                  </Badge>
                );
              })}
            </div>
            <input
              type="file"
              multiple
              className="hidden"
              onChange={handleFileSelect}
              data-testid="file-input"
            />
          </label>
        </CardContent>
      </Card>

      {files.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-medium text-foreground">
              Uploaded Files ({files.length})
            </h4>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setFiles([])}
              data-testid="button-clear-files"
            >
              Clear All
            </Button>
          </div>
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
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">
                        {formatFileSize(file.size)}
                      </span>
                      {file.status === "uploading" && (
                        <Progress value={file.progress} className="h-1 flex-1 max-w-32" />
                      )}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeFile(file.id)}
                    data-testid={`button-remove-file-${file.id}`}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
