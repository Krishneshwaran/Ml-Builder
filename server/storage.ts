import { 
  type User, type InsertUser,
  type Project, type InsertProject,
  type Dataset, type InsertDataset,
  type MlModel, type InsertMlModel,
  type Deployment, type InsertDeployment
} from "@shared/schema";
import { randomUUID } from "crypto";

export interface IStorage {
  // Users
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  // Projects
  getProjects(): Promise<Project[]>;
  getProject(id: string): Promise<Project | undefined>;
  createProject(project: InsertProject): Promise<Project>;
  updateProject(id: string, data: Partial<Project>): Promise<Project | undefined>;
  deleteProject(id: string): Promise<boolean>;
  
  // Datasets
  getDataset(projectId: string): Promise<Dataset | undefined>;
  createDataset(dataset: InsertDataset): Promise<Dataset>;
  updateDataset(id: string, data: Partial<Dataset>): Promise<Dataset | undefined>;
  deleteDataset(id: string): Promise<boolean>;
  
  // ML Models
  getModels(): Promise<MlModel[]>;
  getModel(projectId: string): Promise<MlModel | undefined>;
  getModelById(id: string): Promise<MlModel | undefined>;
  createModel(model: InsertMlModel): Promise<MlModel>;
  updateModel(id: string, data: Partial<MlModel>): Promise<MlModel | undefined>;
  deleteModel(id: string): Promise<boolean>;
  
  // Deployments
  getDeployments(): Promise<Deployment[]>;
  getDeployment(projectId: string): Promise<Deployment | undefined>;
  getDeploymentById(id: string): Promise<Deployment | undefined>;
  createDeployment(deployment: InsertDeployment): Promise<Deployment>;
  updateDeployment(id: string, data: Partial<Deployment>): Promise<Deployment | undefined>;
  deleteDeployment(id: string): Promise<boolean>;
}

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private projects: Map<string, Project>;
  private datasets: Map<string, Dataset>;
  private models: Map<string, MlModel>;
  private deployments: Map<string, Deployment>;

  constructor() {
    this.users = new Map();
    this.projects = new Map();
    this.datasets = new Map();
    this.models = new Map();
    this.deployments = new Map();
    
    // Seed some demo data
    this.seedData();
  }

  private seedData() {
    // Create demo projects
    const demoProjects: Project[] = [
      {
        id: "demo-1",
        name: "Office Access Control",
        description: "Facial recognition system for building entrance security",
        templateId: "access-control",
        status: "deployed",
        currentStep: 6,
        createdAt: new Date("2024-01-15"),
        updatedAt: new Date("2024-01-20"),
      },
      {
        id: "demo-2",
        name: "Campus Exam Monitoring",
        description: "Real-time proctoring for online university exams",
        templateId: "exam-proctoring",
        status: "trained",
        currentStep: 5,
        createdAt: new Date("2024-01-18"),
        updatedAt: new Date("2024-01-22"),
      },
      {
        id: "demo-3",
        name: "Smart Recycling Station",
        description: "Automated waste sorting for municipal recycling center",
        templateId: "waste-sorting",
        status: "training",
        currentStep: 4,
        createdAt: new Date("2024-01-20"),
        updatedAt: new Date("2024-01-23"),
      },
      {
        id: "demo-4",
        name: "Retail Analytics Platform",
        description: "Customer behavior tracking for shopping mall optimization",
        templateId: "retail-analytics",
        status: "data-uploaded",
        currentStep: 3,
        createdAt: new Date("2024-01-22"),
        updatedAt: new Date("2024-01-24"),
      },
    ];

    demoProjects.forEach((project) => {
      this.projects.set(project.id, project);
    });

    // Create demo deployments
    const demoDeployments: Deployment[] = [
      {
        id: "deploy-1",
        projectId: "demo-1",
        modelId: "model-1",
        name: "Office Access Control API",
        type: "cloud-api",
        status: "active",
        endpoint: "https://api.mlforge.io/v1/access-control/predict",
        apiKey: "mlf_sk_live_abc123def456ghi789jkl012mno345",
        requestsToday: 1247,
        totalRequests: 45892,
        avgLatency: 42,
        deployedAt: new Date("2024-01-20"),
        createdAt: new Date("2024-01-20"),
      },
    ];

    demoDeployments.forEach((deployment) => {
      this.deployments.set(deployment.id, deployment);
    });

    // Create demo models
    const demoModels: MlModel[] = [
      {
        id: "model-1",
        projectId: "demo-1",
        name: "Access Control v1.0",
        status: "completed",
        accuracy: 97,
        precision: 96,
        recall: 95,
        f1Score: 96,
        confidenceThreshold: 85,
        falsePositiveRate: 2,
        falseNegativeRate: 3,
        trainingProgress: 100,
        trainedAt: new Date("2024-01-19"),
        createdAt: new Date("2024-01-18"),
      },
      {
        id: "model-2",
        projectId: "demo-2",
        name: "Exam Proctoring v1.0",
        status: "completed",
        accuracy: 94,
        precision: 93,
        recall: 92,
        f1Score: 93,
        confidenceThreshold: 80,
        falsePositiveRate: 4,
        falseNegativeRate: 5,
        trainingProgress: 100,
        trainedAt: new Date("2024-01-21"),
        createdAt: new Date("2024-01-20"),
      },
      {
        id: "model-3",
        projectId: "demo-3",
        name: "Waste Sorting v0.5",
        status: "training",
        accuracy: null,
        precision: null,
        recall: null,
        f1Score: null,
        confidenceThreshold: 75,
        falsePositiveRate: null,
        falseNegativeRate: null,
        trainingProgress: 67,
        trainedAt: null,
        createdAt: new Date("2024-01-23"),
      },
    ];

    demoModels.forEach((model) => {
      this.models.set(model.id, model);
    });

    // Create demo datasets
    const demoDatasets: Dataset[] = [
      {
        id: "dataset-1",
        projectId: "demo-1",
        name: "Employee Faces Dataset",
        fileCount: 2500,
        totalSize: 1250000000,
        dataType: "images",
        labelCount: 150,
        isValidated: true,
        labels: ["employee_john", "employee_sarah", "employee_mike", "visitor", "unknown"],
        createdAt: new Date("2024-01-17"),
      },
      {
        id: "dataset-2",
        projectId: "demo-2",
        name: "Exam Session Recordings",
        fileCount: 500,
        totalSize: 25000000000,
        dataType: "video",
        labelCount: 8,
        isValidated: true,
        labels: ["normal", "looking_away", "multiple_faces", "phone_detected", "talking", "absent", "suspicious_audio", "screen_sharing"],
        createdAt: new Date("2024-01-19"),
      },
    ];

    demoDatasets.forEach((dataset) => {
      this.datasets.set(dataset.id, dataset);
    });
  }

  // Users
  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }

  // Projects
  async getProjects(): Promise<Project[]> {
    return Array.from(this.projects.values()).sort((a, b) => {
      const dateA = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
      const dateB = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
      return dateB - dateA;
    });
  }

  async getProject(id: string): Promise<Project | undefined> {
    return this.projects.get(id);
  }

  async createProject(insertProject: InsertProject): Promise<Project> {
    const id = randomUUID();
    const now = new Date();
    const project: Project = {
      ...insertProject,
      id,
      createdAt: now,
      updatedAt: now,
    };
    this.projects.set(id, project);
    return project;
  }

  async updateProject(id: string, data: Partial<Project>): Promise<Project | undefined> {
    const existing = this.projects.get(id);
    if (!existing) return undefined;
    
    const updated: Project = {
      ...existing,
      ...data,
      updatedAt: new Date(),
    };
    this.projects.set(id, updated);
    return updated;
  }

  async deleteProject(id: string): Promise<boolean> {
    return this.projects.delete(id);
  }

  // Datasets
  async getDataset(projectId: string): Promise<Dataset | undefined> {
    return Array.from(this.datasets.values()).find(
      (dataset) => dataset.projectId === projectId
    );
  }

  async createDataset(insertDataset: InsertDataset): Promise<Dataset> {
    const id = randomUUID();
    const dataset: Dataset = {
      ...insertDataset,
      id,
      createdAt: new Date(),
    };
    this.datasets.set(id, dataset);
    return dataset;
  }

  async updateDataset(id: string, data: Partial<Dataset>): Promise<Dataset | undefined> {
    const existing = this.datasets.get(id);
    if (!existing) return undefined;
    
    const updated: Dataset = {
      ...existing,
      ...data,
    };
    this.datasets.set(id, updated);
    return updated;
  }

  async deleteDataset(id: string): Promise<boolean> {
    return this.datasets.delete(id);
  }

  // ML Models
  async getModels(): Promise<MlModel[]> {
    return Array.from(this.models.values());
  }

  async getModel(projectId: string): Promise<MlModel | undefined> {
    return Array.from(this.models.values()).find(
      (model) => model.projectId === projectId
    );
  }

  async getModelById(id: string): Promise<MlModel | undefined> {
    return this.models.get(id);
  }

  async createModel(insertModel: InsertMlModel): Promise<MlModel> {
    const id = randomUUID();
    const model: MlModel = {
      ...insertModel,
      id,
      createdAt: new Date(),
    };
    this.models.set(id, model);
    return model;
  }

  async updateModel(id: string, data: Partial<MlModel>): Promise<MlModel | undefined> {
    const existing = this.models.get(id);
    if (!existing) return undefined;
    
    const updated: MlModel = {
      ...existing,
      ...data,
    };
    this.models.set(id, updated);
    return updated;
  }

  async deleteModel(id: string): Promise<boolean> {
    return this.models.delete(id);
  }

  // Deployments
  async getDeployments(): Promise<Deployment[]> {
    return Array.from(this.deployments.values());
  }

  async getDeployment(projectId: string): Promise<Deployment | undefined> {
    return Array.from(this.deployments.values()).find(
      (deployment) => deployment.projectId === projectId
    );
  }

  async getDeploymentById(id: string): Promise<Deployment | undefined> {
    return this.deployments.get(id);
  }

  async createDeployment(insertDeployment: InsertDeployment): Promise<Deployment> {
    const id = randomUUID();
    const deployment: Deployment = {
      ...insertDeployment,
      id,
      createdAt: new Date(),
    };
    this.deployments.set(id, deployment);
    return deployment;
  }

  async updateDeployment(id: string, data: Partial<Deployment>): Promise<Deployment | undefined> {
    const existing = this.deployments.get(id);
    if (!existing) return undefined;
    
    const updated: Deployment = {
      ...existing,
      ...data,
    };
    this.deployments.set(id, updated);
    return updated;
  }

  async deleteDeployment(id: string): Promise<boolean> {
    return this.deployments.delete(id);
  }
}

export const storage = new MemStorage();
