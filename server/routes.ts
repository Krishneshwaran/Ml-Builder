import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertProjectSchema, insertDatasetSchema, insertMlModelSchema, insertDeploymentSchema } from "@shared/schema";
import { z } from "zod";
import { randomBytes } from "crypto";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  
  // Projects
  app.get("/api/projects", async (req, res) => {
    try {
      const projects = await storage.getProjects();
      res.json(projects);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch projects" });
    }
  });

  app.get("/api/projects/:id", async (req, res) => {
    try {
      const project = await storage.getProject(req.params.id);
      if (!project) {
        return res.status(404).json({ error: "Project not found" });
      }
      res.json(project);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch project" });
    }
  });

  app.post("/api/projects", async (req, res) => {
    try {
      const data = insertProjectSchema.parse(req.body);
      const project = await storage.createProject(data);
      res.status(201).json(project);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid project data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to create project" });
    }
  });

  app.patch("/api/projects/:id", async (req, res) => {
    try {
      const project = await storage.updateProject(req.params.id, req.body);
      if (!project) {
        return res.status(404).json({ error: "Project not found" });
      }
      res.json(project);
    } catch (error) {
      res.status(500).json({ error: "Failed to update project" });
    }
  });

  app.delete("/api/projects/:id", async (req, res) => {
    try {
      const deleted = await storage.deleteProject(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Project not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete project" });
    }
  });

  // Datasets
  app.get("/api/projects/:id/dataset", async (req, res) => {
    try {
      const dataset = await storage.getDataset(req.params.id);
      if (!dataset) {
        return res.status(404).json({ error: "Dataset not found" });
      }
      res.json(dataset);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch dataset" });
    }
  });

  app.post("/api/projects/:id/dataset", async (req, res) => {
    try {
      const data = insertDatasetSchema.parse({
        ...req.body,
        projectId: req.params.id,
      });
      const dataset = await storage.createDataset(data);
      res.status(201).json(dataset);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid dataset data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to create dataset" });
    }
  });

  app.patch("/api/datasets/:id", async (req, res) => {
    try {
      const dataset = await storage.updateDataset(req.params.id, req.body);
      if (!dataset) {
        return res.status(404).json({ error: "Dataset not found" });
      }
      res.json(dataset);
    } catch (error) {
      res.status(500).json({ error: "Failed to update dataset" });
    }
  });

  app.delete("/api/datasets/:id", async (req, res) => {
    try {
      const deleted = await storage.deleteDataset(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Dataset not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete dataset" });
    }
  });

  // Models
  app.get("/api/projects/:id/model", async (req, res) => {
    try {
      const model = await storage.getModel(req.params.id);
      if (!model) {
        return res.status(404).json({ error: "Model not found" });
      }
      res.json(model);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch model" });
    }
  });

  app.post("/api/projects/:id/train", async (req, res) => {
    try {
      // Check if model already exists
      const existingModel = await storage.getModel(req.params.id);
      if (existingModel) {
        return res.json(existingModel);
      }

      // Create model in training state
      const modelData = insertMlModelSchema.parse({
        projectId: req.params.id,
        name: req.body.name || "ML Model",
        status: "training",
        confidenceThreshold: 80,
        trainingProgress: 0,
      });

      const model = await storage.createModel(modelData);

      // Simulate training progress with deterministic metrics
      let progress = 0;
      const interval = setInterval(async () => {
        progress += 10;
        if (progress >= 100) {
          clearInterval(interval);
          await storage.updateModel(model.id, {
            status: "completed",
            trainingProgress: 100,
            accuracy: 94,
            precision: 92,
            recall: 91,
            f1Score: 92,
            falsePositiveRate: 3,
            falseNegativeRate: 4,
            trainedAt: new Date(),
          });
        } else {
          await storage.updateModel(model.id, {
            trainingProgress: progress,
          });
        }
      }, 500);

      res.status(201).json(model);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid model data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to start training" });
    }
  });

  app.patch("/api/models/:id", async (req, res) => {
    try {
      const model = await storage.updateModel(req.params.id, req.body);
      if (!model) {
        return res.status(404).json({ error: "Model not found" });
      }
      res.json(model);
    } catch (error) {
      res.status(500).json({ error: "Failed to update model" });
    }
  });

  app.delete("/api/models/:id", async (req, res) => {
    try {
      const deleted = await storage.deleteModel(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Model not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete model" });
    }
  });

  // Deployments
  app.get("/api/deployments", async (req, res) => {
    try {
      const deployments = await storage.getDeployments();
      res.json(deployments);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch deployments" });
    }
  });

  app.get("/api/projects/:id/deployment", async (req, res) => {
    try {
      const deployment = await storage.getDeployment(req.params.id);
      if (!deployment) {
        return res.status(404).json({ error: "Deployment not found" });
      }
      res.json(deployment);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch deployment" });
    }
  });

  app.post("/api/projects/:id/deploy", async (req, res) => {
    try {
      // Check if deployment already exists
      const existingDeployment = await storage.getDeployment(req.params.id);
      if (existingDeployment) {
        return res.json(existingDeployment);
      }

      const project = await storage.getProject(req.params.id);
      if (!project) {
        return res.status(404).json({ error: "Project not found" });
      }

      const model = await storage.getModel(req.params.id);
      if (!model || model.status !== "completed") {
        return res.status(400).json({ error: "Model must be trained before deployment" });
      }

      const apiKey = `mlf_sk_live_${randomBytes(32).toString('hex').slice(0, 40)}`;
      const endpoint = `https://api.mlforge.io/v1/${project.templateId}/predict`;

      const deploymentData = insertDeploymentSchema.parse({
        projectId: req.params.id,
        modelId: model.id,
        name: req.body.name || `${project.name} API`,
        type: req.body.type || "cloud-api",
        status: "active",
        endpoint,
        apiKey,
        requestsToday: 0,
        totalRequests: 0,
        avgLatency: 35,
        deployedAt: new Date(),
      });

      const deployment = await storage.createDeployment(deploymentData);
      res.status(201).json(deployment);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid deployment data", details: error.errors });
      }
      console.error("Deploy error:", error);
      res.status(500).json({ error: "Failed to create deployment" });
    }
  });

  app.patch("/api/deployments/:id", async (req, res) => {
    try {
      const deployment = await storage.updateDeployment(req.params.id, req.body);
      if (!deployment) {
        return res.status(404).json({ error: "Deployment not found" });
      }
      res.json(deployment);
    } catch (error) {
      res.status(500).json({ error: "Failed to update deployment" });
    }
  });

  app.delete("/api/deployments/:id", async (req, res) => {
    try {
      const deleted = await storage.deleteDeployment(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Deployment not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete deployment" });
    }
  });

  return httpServer;
}
