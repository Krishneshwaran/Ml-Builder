import { z } from "zod";

// System Templates - predefined ML pipeline templates
export const systemTemplates = [
  {
    id: "access-control",
    name: "Access Control / Identity Verification",
    description: "Facial recognition and identity verification for secure access systems",
    icon: "Shield",
    category: "Security",
    dataTypes: ["images"],
    pipelineStages: ["face-detection", "feature-extraction", "identity-matching", "confidence-scoring"]
  },
  {
    id: "exam-proctoring",
    name: "Exam Proctoring",
    description: "Real-time monitoring for online examinations with anomaly detection",
    icon: "Eye",
    category: "Education",
    dataTypes: ["video", "audio"],
    pipelineStages: ["face-tracking", "gaze-detection", "audio-analysis", "anomaly-detection"]
  },
  {
    id: "waste-sorting",
    name: "Smart Waste Sorting",
    description: "Automated waste classification for recycling optimization",
    icon: "Recycle",
    category: "Environment",
    dataTypes: ["images"],
    pipelineStages: ["object-detection", "material-classification", "sorting-decision", "bin-assignment"]
  },
  {
    id: "retail-analytics",
    name: "Retail Behavior Analytics",
    description: "Customer behavior analysis for retail optimization",
    icon: "ShoppingCart",
    category: "Retail",
    dataTypes: ["video", "images"],
    pipelineStages: ["person-detection", "trajectory-tracking", "dwell-analysis", "heatmap-generation"]
  },
  {
    id: "document-processing",
    name: "Document Processing & Classification",
    description: "Intelligent document processing and categorization",
    icon: "FileText",
    category: "Business",
    dataTypes: ["images", "text", "pdf"],
    pipelineStages: ["ocr-extraction", "text-parsing", "entity-recognition", "document-classification"]
  },
  {
    id: "crowd-monitoring",
    name: "Crowd & Traffic Monitoring",
    description: "Real-time crowd density and traffic flow analysis",
    icon: "Users",
    category: "Smart City",
    dataTypes: ["video"],
    pipelineStages: ["person-counting", "density-estimation", "flow-analysis", "alert-generation"]
  }
] as const;

export type SystemTemplate = typeof systemTemplates[number];

// ── TypeScript types (matching Prisma schema) ───────────────────────────

export interface Project {
  id: string;
  name: string;
  description: string | null;
  templateId: string;
  status: string;
  currentStep: number;
  createdAt: string;
  updatedAt: string;
}

export const insertProjectSchema = z.object({
  name: z.string().min(1),
  description: z.string().nullable().optional(),
  templateId: z.string().min(1),
  status: z.string().default("draft"),
  currentStep: z.number().default(1),
});

export type InsertProject = z.infer<typeof insertProjectSchema>;

export interface Dataset {
  id: string;
  projectId: string;
  name: string;
  fileCount: number;
  totalSize: number;
  dataType: string;
  labelCount: number;
  isValidated: boolean;
  labels: string[];
  sourceType?: string | null;
  sourceUrl?: string | null;
  localPath?: string | null;
  taskType?: string | null;
  metadata?: Record<string, unknown> | null;
  createdAt: string;
}

export const insertDatasetSchema = z.object({
  projectId: z.string(),
  name: z.string(),
  fileCount: z.number().default(0),
  totalSize: z.number().default(0),
  dataType: z.string(),
  labelCount: z.number().default(0),
  isValidated: z.boolean().default(false),
  labels: z.array(z.string()).default([]),
});

export type InsertDataset = z.infer<typeof insertDatasetSchema>;

export interface MlModel {
  id: string;
  projectId: string;
  name: string;
  status: string;
  accuracy: number | null;
  precisionScore: number | null;
  recallScore: number | null;
  f1Score: number | null;
  confidenceThreshold: number;
  falsePositiveRate: number | null;
  falseNegativeRate: number | null;
  trainingProgress: number;
  trainedAt: string | null;
  algorithm?: string | null;
  datasetSize?: number | null;
  featureNames?: string[] | null;
  trainingDevice?: string | null;
  modelFormat?: string | null;
  classNames?: string[] | null;
  taskType?: string | null;
  baseModel?: string | null;
  preferGpu?: boolean | null;
  usePretrainedWeights?: boolean | null;
  trainingEpochs?: number | null;
  artifactSizeMb?: number | null;
  useImageAugmentation?: boolean | null;
  createdAt: string;
}

export const insertMlModelSchema = z.object({
  projectId: z.string(),
  name: z.string(),
  status: z.string().default("pending"),
  confidenceThreshold: z.number().default(80),
  trainingProgress: z.number().default(0),
});

export type InsertMlModel = z.infer<typeof insertMlModelSchema>;

export interface Deployment {
  id: string;
  projectId: string;
  modelId: string;
  name: string;
  type: string;
  status: string;
  endpoint: string | null;
  apiKey: string | null;
  requestsToday: number;
  totalRequests: number;
  avgLatency: number | null;
  deployedAt: string | null;
  createdAt: string;
}

export const insertDeploymentSchema = z.object({
  projectId: z.string(),
  modelId: z.string(),
  name: z.string(),
  type: z.string(),
});

export type InsertDeployment = z.infer<typeof insertDeploymentSchema>;

// Pipeline stages type
export type PipelineStage = {
  id: string;
  name: string;
  description: string;
  status: "pending" | "processing" | "completed";
  order: number;
};
