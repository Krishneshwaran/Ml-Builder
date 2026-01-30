import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, boolean, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
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

// Projects Table
export const projects = pgTable("projects", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description"),
  templateId: text("template_id").notNull(),
  status: text("status").notNull().default("draft"), // draft, data-uploaded, training, trained, deployed
  currentStep: integer("current_step").notNull().default(1), // 1-6 for the workflow steps
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertProjectSchema = createInsertSchema(projects).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertProject = z.infer<typeof insertProjectSchema>;
export type Project = typeof projects.$inferSelect;

// Datasets Table
export const datasets = pgTable("datasets", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  fileCount: integer("file_count").notNull().default(0),
  totalSize: integer("total_size").notNull().default(0), // in bytes
  dataType: text("data_type").notNull(), // images, video, audio, text, csv
  labelCount: integer("label_count").notNull().default(0),
  isValidated: boolean("is_validated").notNull().default(false),
  labels: jsonb("labels").$type<string[]>().default([]),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertDatasetSchema = createInsertSchema(datasets).omit({
  id: true,
  createdAt: true,
});

export type InsertDataset = z.infer<typeof insertDatasetSchema>;
export type Dataset = typeof datasets.$inferSelect;

// ML Models Table
export const mlModels = pgTable("ml_models", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  status: text("status").notNull().default("pending"), // pending, training, completed, failed
  accuracy: integer("accuracy"), // percentage 0-100
  precision: integer("precision_score"), // percentage 0-100
  recall: integer("recall_score"), // percentage 0-100
  f1Score: integer("f1_score"), // percentage 0-100
  confidenceThreshold: integer("confidence_threshold").notNull().default(80),
  falsePositiveRate: integer("false_positive_rate"),
  falseNegativeRate: integer("false_negative_rate"),
  trainingProgress: integer("training_progress").notNull().default(0), // 0-100
  trainedAt: timestamp("trained_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertMlModelSchema = createInsertSchema(mlModels).omit({
  id: true,
  createdAt: true,
});

export type InsertMlModel = z.infer<typeof insertMlModelSchema>;
export type MlModel = typeof mlModels.$inferSelect;

// Deployments Table
export const deployments = pgTable("deployments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  modelId: varchar("model_id").notNull().references(() => mlModels.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  type: text("type").notNull(), // cloud-api, edge-device
  status: text("status").notNull().default("pending"), // pending, deploying, active, stopped
  endpoint: text("endpoint"),
  apiKey: text("api_key"),
  requestsToday: integer("requests_today").notNull().default(0),
  totalRequests: integer("total_requests").notNull().default(0),
  avgLatency: integer("avg_latency"), // in ms
  deployedAt: timestamp("deployed_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertDeploymentSchema = createInsertSchema(deployments).omit({
  id: true,
  createdAt: true,
});

export type InsertDeployment = z.infer<typeof insertDeploymentSchema>;
export type Deployment = typeof deployments.$inferSelect;

// Users Table (kept from original)
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

// Pipeline stages type
export type PipelineStage = {
  id: string;
  name: string;
  description: string;
  status: "pending" | "processing" | "completed";
  order: number;
};
