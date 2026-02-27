"""
API routes for the Auto-ML-Builder backend.
Mirrors every endpoint from server/routes.ts.
"""

from __future__ import annotations

import asyncio
import secrets
import uuid
from datetime import datetime

from fastapi import APIRouter, BackgroundTasks, HTTPException

from models import (
    DatasetCreate,
    DatasetUpdate,
    Deployment,
    DeploymentCreate,
    DeploymentUpdate,
    MlModelCreate,
    MlModelUpdate,
    ProjectCreate,
    ProjectUpdate,
)
from storage import storage

router = APIRouter(prefix="/api")


# ═══════════════════════════════════════════════════════════════════════════
#  PROJECTS
# ═══════════════════════════════════════════════════════════════════════════


@router.get("/projects")
def list_projects():
    return storage.get_projects()


@router.get("/projects/{project_id}")
def get_project(project_id: str):
    project = storage.get_project(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return project


@router.post("/projects", status_code=201)
def create_project(body: ProjectCreate):
    return storage.create_project(body)


@router.patch("/projects/{project_id}")
def update_project(project_id: str, body: ProjectUpdate):
    project = storage.update_project(project_id, body)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return project


@router.delete("/projects/{project_id}", status_code=204)
def delete_project(project_id: str):
    deleted = storage.delete_project(project_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Project not found")
    return None


# ═══════════════════════════════════════════════════════════════════════════
#  DATASETS
# ═══════════════════════════════════════════════════════════════════════════


@router.get("/projects/{project_id}/dataset")
def get_dataset(project_id: str):
    dataset = storage.get_dataset(project_id)
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")
    return dataset


@router.post("/projects/{project_id}/dataset", status_code=201)
def create_dataset(project_id: str, body: DatasetCreate):
    return storage.create_dataset(project_id, body)


@router.patch("/datasets/{dataset_id}")
def update_dataset(dataset_id: str, body: DatasetUpdate):
    dataset = storage.update_dataset(dataset_id, body)
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")
    return dataset


@router.delete("/datasets/{dataset_id}", status_code=204)
def delete_dataset(dataset_id: str):
    deleted = storage.delete_dataset(dataset_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Dataset not found")
    return None


# ═══════════════════════════════════════════════════════════════════════════
#  ML MODELS  –  training simulation
# ═══════════════════════════════════════════════════════════════════════════


async def _simulate_training(model_id: str) -> None:
    """Increment training progress every 0.5 s until 100 %."""
    progress = 0
    while progress < 100:
        await asyncio.sleep(0.5)
        progress += 10
        if progress >= 100:
            storage.update_model(
                model_id,
                {
                    "status": "completed",
                    "trainingProgress": 100,
                    "accuracy": 94,
                    "precision": 92,
                    "recall": 91,
                    "f1Score": 92,
                    "falsePositiveRate": 3,
                    "falseNegativeRate": 4,
                    "trainedAt": datetime.utcnow(),
                },
            )
        else:
            storage.update_model(model_id, {"trainingProgress": progress})


@router.get("/projects/{project_id}/model")
def get_model(project_id: str):
    model = storage.get_model(project_id)
    if not model:
        raise HTTPException(status_code=404, detail="Model not found")
    return model


@router.post("/projects/{project_id}/train", status_code=201)
async def start_training(
    project_id: str,
    body: MlModelCreate,
    background_tasks: BackgroundTasks,
):
    # If model already exists for this project, return it
    existing = storage.get_model(project_id)
    if existing:
        return existing

    model = storage.create_model(project_id, body)

    # Kick off simulated training in the background
    background_tasks.add_task(_simulate_training, model.id)

    return model


@router.patch("/models/{model_id}")
def update_model(model_id: str, body: MlModelUpdate):
    update_data = body.model_dump(exclude_unset=True)
    model = storage.update_model(model_id, update_data)
    if not model:
        raise HTTPException(status_code=404, detail="Model not found")
    return model


@router.delete("/models/{model_id}", status_code=204)
def delete_model(model_id: str):
    deleted = storage.delete_model(model_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Model not found")
    return None


# ═══════════════════════════════════════════════════════════════════════════
#  DEPLOYMENTS
# ═══════════════════════════════════════════════════════════════════════════


@router.get("/deployments")
def list_deployments():
    return storage.get_deployments()


@router.get("/projects/{project_id}/deployment")
def get_deployment(project_id: str):
    deployment = storage.get_deployment(project_id)
    if not deployment:
        raise HTTPException(status_code=404, detail="Deployment not found")
    return deployment


@router.post("/projects/{project_id}/deploy", status_code=201)
def deploy_model(project_id: str, body: DeploymentCreate):
    # Check existing
    existing = storage.get_deployment(project_id)
    if existing:
        return existing

    project = storage.get_project(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    model = storage.get_model(project_id)
    if not model or model.status != "completed":
        raise HTTPException(
            status_code=400, detail="Model must be trained before deployment"
        )

    api_key = f"mlf_sk_live_{secrets.token_hex(20)}"
    endpoint = f"https://api.mlforge.io/v1/{project.templateId}/predict"

    deployment = Deployment(
        id=str(uuid.uuid4()),
        projectId=project_id,
        modelId=model.id,
        name=body.name or f"{project.name} API",
        type=body.type or "cloud-api",
        status="active",
        endpoint=endpoint,
        apiKey=api_key,
        requestsToday=0,
        totalRequests=0,
        avgLatency=35,
        deployedAt=datetime.utcnow(),
        createdAt=datetime.utcnow(),
    )
    return storage.create_deployment(deployment)


@router.patch("/deployments/{deployment_id}")
def update_deployment(deployment_id: str, body: DeploymentUpdate):
    deployment = storage.update_deployment(deployment_id, body)
    if not deployment:
        raise HTTPException(status_code=404, detail="Deployment not found")
    return deployment


@router.delete("/deployments/{deployment_id}", status_code=204)
def delete_deployment(deployment_id: str):
    deleted = storage.delete_deployment(deployment_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Deployment not found")
    return None
