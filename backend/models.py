"""
Pydantic models for the Auto-ML-Builder backend.
Mirrors the TypeScript schema from shared/schema.ts
"""

from __future__ import annotations

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


# ── System Templates (read-only constants) ──────────────────────────────────

SYSTEM_TEMPLATES = [
    {
        "id": "access-control",
        "name": "Access Control / Identity Verification",
        "description": "Facial recognition and identity verification for secure access systems",
        "icon": "Shield",
        "category": "Security",
        "dataTypes": ["images"],
        "pipelineStages": ["face-detection", "feature-extraction", "identity-matching", "confidence-scoring"],
    },
    {
        "id": "exam-proctoring",
        "name": "Exam Proctoring",
        "description": "Real-time monitoring for online examinations with anomaly detection",
        "icon": "Eye",
        "category": "Education",
        "dataTypes": ["video", "audio"],
        "pipelineStages": ["face-tracking", "gaze-detection", "audio-analysis", "anomaly-detection"],
    },
    {
        "id": "waste-sorting",
        "name": "Smart Waste Sorting",
        "description": "Automated waste classification for recycling optimization",
        "icon": "Recycle",
        "category": "Environment",
        "dataTypes": ["images"],
        "pipelineStages": ["object-detection", "material-classification", "sorting-decision", "bin-assignment"],
    },
    {
        "id": "retail-analytics",
        "name": "Retail Behavior Analytics",
        "description": "Customer behavior analysis for retail optimization",
        "icon": "ShoppingCart",
        "category": "Retail",
        "dataTypes": ["video", "images"],
        "pipelineStages": ["person-detection", "trajectory-tracking", "dwell-analysis", "heatmap-generation"],
    },
    {
        "id": "document-processing",
        "name": "Document Processing & Classification",
        "description": "Intelligent document processing and categorization",
        "icon": "FileText",
        "category": "Business",
        "dataTypes": ["images", "text", "pdf"],
        "pipelineStages": ["ocr-extraction", "text-parsing", "entity-recognition", "document-classification"],
    },
    {
        "id": "crowd-monitoring",
        "name": "Crowd & Traffic Monitoring",
        "description": "Real-time crowd density and traffic flow analysis",
        "icon": "Users",
        "category": "Smart City",
        "dataTypes": ["video"],
        "pipelineStages": ["person-counting", "density-estimation", "flow-analysis", "alert-generation"],
    },
]


# ── Project ──────────────────────────────────────────────────────────────────

class ProjectBase(BaseModel):
    name: str
    description: Optional[str] = None
    templateId: str
    status: str = "draft"
    currentStep: int = 1


class ProjectCreate(ProjectBase):
    """Request body for POST /api/projects"""
    pass


class ProjectUpdate(BaseModel):
    """Request body for PATCH /api/projects/:id"""
    name: Optional[str] = None
    description: Optional[str] = None
    templateId: Optional[str] = None
    status: Optional[str] = None
    currentStep: Optional[int] = None


class Project(ProjectBase):
    id: str
    createdAt: Optional[datetime] = None
    updatedAt: Optional[datetime] = None

    class Config:
        from_attributes = True


# ── Dataset ──────────────────────────────────────────────────────────────────

class DatasetBase(BaseModel):
    projectId: str
    name: str
    fileCount: int = 0
    totalSize: int = 0
    dataType: str
    labelCount: int = 0
    isValidated: bool = False
    labels: list[str] = Field(default_factory=list)


class DatasetCreate(BaseModel):
    """Request body for POST /api/projects/:id/dataset (projectId comes from path)"""
    name: str
    fileCount: int = 0
    totalSize: int = 0
    dataType: str
    labelCount: int = 0
    isValidated: bool = False
    labels: list[str] = Field(default_factory=list)
    projectId: Optional[str] = None  # Will be overridden by path param


class DatasetUpdate(BaseModel):
    name: Optional[str] = None
    fileCount: Optional[int] = None
    totalSize: Optional[int] = None
    dataType: Optional[str] = None
    labelCount: Optional[int] = None
    isValidated: Optional[bool] = None
    labels: Optional[list[str]] = None


class Dataset(DatasetBase):
    id: str
    createdAt: Optional[datetime] = None

    class Config:
        from_attributes = True


# ── ML Model ────────────────────────────────────────────────────────────────

class MlModelBase(BaseModel):
    projectId: str
    name: str
    status: str = "pending"
    accuracy: Optional[int] = None
    precision: Optional[int] = Field(default=None, alias="precision_score")
    recall: Optional[int] = Field(default=None, alias="recall_score")
    f1Score: Optional[int] = None
    confidenceThreshold: int = 80
    falsePositiveRate: Optional[int] = None
    falseNegativeRate: Optional[int] = None
    trainingProgress: int = 0


class MlModelCreate(BaseModel):
    """Request body for POST /api/projects/:id/train"""
    name: str = "ML Model"
    projectId: Optional[str] = None


class MlModelUpdate(BaseModel):
    name: Optional[str] = None
    status: Optional[str] = None
    accuracy: Optional[int] = None
    precision: Optional[int] = None
    recall: Optional[int] = None
    f1Score: Optional[int] = None
    confidenceThreshold: Optional[int] = None
    falsePositiveRate: Optional[int] = None
    falseNegativeRate: Optional[int] = None
    trainingProgress: Optional[int] = None
    trainedAt: Optional[datetime] = None


class MlModel(BaseModel):
    id: str
    projectId: str
    name: str
    status: str = "pending"
    accuracy: Optional[int] = None
    precision: Optional[int] = None
    recall: Optional[int] = None
    f1Score: Optional[int] = None
    confidenceThreshold: int = 80
    falsePositiveRate: Optional[int] = None
    falseNegativeRate: Optional[int] = None
    trainingProgress: int = 0
    trainedAt: Optional[datetime] = None
    createdAt: Optional[datetime] = None

    class Config:
        from_attributes = True


# ── Deployment ───────────────────────────────────────────────────────────────

class DeploymentBase(BaseModel):
    projectId: str
    modelId: str
    name: str
    type: str  # cloud-api, edge-device
    status: str = "pending"
    endpoint: Optional[str] = None
    apiKey: Optional[str] = None
    requestsToday: int = 0
    totalRequests: int = 0
    avgLatency: Optional[int] = None


class DeploymentCreate(BaseModel):
    """Request body for POST /api/projects/:id/deploy"""
    name: Optional[str] = None
    type: str = "cloud-api"
    modelId: Optional[str] = None
    projectId: Optional[str] = None


class DeploymentUpdate(BaseModel):
    name: Optional[str] = None
    type: Optional[str] = None
    status: Optional[str] = None
    endpoint: Optional[str] = None
    apiKey: Optional[str] = None
    requestsToday: Optional[int] = None
    totalRequests: Optional[int] = None
    avgLatency: Optional[int] = None
    deployedAt: Optional[datetime] = None


class Deployment(DeploymentBase):
    id: str
    deployedAt: Optional[datetime] = None
    createdAt: Optional[datetime] = None

    class Config:
        from_attributes = True


# ── User ─────────────────────────────────────────────────────────────────────

class UserBase(BaseModel):
    username: str


class UserCreate(UserBase):
    password: str


class User(UserBase):
    id: str
    password: str

    class Config:
        from_attributes = True
