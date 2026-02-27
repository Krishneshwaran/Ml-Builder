"""
In-memory storage for the Auto-ML-Builder backend.
Mirrors the MemStorage class from server/storage.ts with the same seed data.
"""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Optional

from models import (
    Dataset,
    DatasetCreate,
    DatasetUpdate,
    Deployment,
    DeploymentCreate,
    DeploymentUpdate,
    MlModel,
    MlModelCreate,
    MlModelUpdate,
    Project,
    ProjectCreate,
    ProjectUpdate,
    User,
    UserCreate,
)


class MemStorage:
    """Thread-safe in-memory storage with demo seed data."""

    def __init__(self) -> None:
        self._users: dict[str, User] = {}
        self._projects: dict[str, Project] = {}
        self._datasets: dict[str, Dataset] = {}
        self._models: dict[str, MlModel] = {}
        self._deployments: dict[str, Deployment] = {}
        self._seed_data()

    # ── Seed data ────────────────────────────────────────────────────────

    def _seed_data(self) -> None:
        demo_projects = [
            Project(
                id="demo-1",
                name="Office Access Control",
                description="Facial recognition system for building entrance security",
                templateId="access-control",
                status="deployed",
                currentStep=6,
                createdAt=datetime(2024, 1, 15),
                updatedAt=datetime(2024, 1, 20),
            ),
            Project(
                id="demo-2",
                name="Campus Exam Monitoring",
                description="Real-time proctoring for online university exams",
                templateId="exam-proctoring",
                status="trained",
                currentStep=5,
                createdAt=datetime(2024, 1, 18),
                updatedAt=datetime(2024, 1, 22),
            ),
            Project(
                id="demo-3",
                name="Smart Recycling Station",
                description="Automated waste sorting for municipal recycling center",
                templateId="waste-sorting",
                status="training",
                currentStep=4,
                createdAt=datetime(2024, 1, 20),
                updatedAt=datetime(2024, 1, 23),
            ),
            Project(
                id="demo-4",
                name="Retail Analytics Platform",
                description="Customer behavior tracking for shopping mall optimization",
                templateId="retail-analytics",
                status="data-uploaded",
                currentStep=3,
                createdAt=datetime(2024, 1, 22),
                updatedAt=datetime(2024, 1, 24),
            ),
        ]
        for p in demo_projects:
            self._projects[p.id] = p

        demo_models = [
            MlModel(
                id="model-1",
                projectId="demo-1",
                name="Access Control v1.0",
                status="completed",
                accuracy=97,
                precision=96,
                recall=95,
                f1Score=96,
                confidenceThreshold=85,
                falsePositiveRate=2,
                falseNegativeRate=3,
                trainingProgress=100,
                trainedAt=datetime(2024, 1, 19),
                createdAt=datetime(2024, 1, 18),
            ),
            MlModel(
                id="model-2",
                projectId="demo-2",
                name="Exam Proctoring v1.0",
                status="completed",
                accuracy=94,
                precision=93,
                recall=92,
                f1Score=93,
                confidenceThreshold=80,
                falsePositiveRate=4,
                falseNegativeRate=5,
                trainingProgress=100,
                trainedAt=datetime(2024, 1, 21),
                createdAt=datetime(2024, 1, 20),
            ),
            MlModel(
                id="model-3",
                projectId="demo-3",
                name="Waste Sorting v0.5",
                status="training",
                accuracy=None,
                precision=None,
                recall=None,
                f1Score=None,
                confidenceThreshold=75,
                falsePositiveRate=None,
                falseNegativeRate=None,
                trainingProgress=67,
                trainedAt=None,
                createdAt=datetime(2024, 1, 23),
            ),
        ]
        for m in demo_models:
            self._models[m.id] = m

        demo_deployments = [
            Deployment(
                id="deploy-1",
                projectId="demo-1",
                modelId="model-1",
                name="Office Access Control API",
                type="cloud-api",
                status="active",
                endpoint="https://api.mlforge.io/v1/access-control/predict",
                apiKey="mlf_sk_live_abc123def456ghi789jkl012mno345",
                requestsToday=1247,
                totalRequests=45892,
                avgLatency=42,
                deployedAt=datetime(2024, 1, 20),
                createdAt=datetime(2024, 1, 20),
            ),
        ]
        for d in demo_deployments:
            self._deployments[d.id] = d

        demo_datasets = [
            Dataset(
                id="dataset-1",
                projectId="demo-1",
                name="Employee Faces Dataset",
                fileCount=2500,
                totalSize=1250000000,
                dataType="images",
                labelCount=150,
                isValidated=True,
                labels=[
                    "employee_john",
                    "employee_sarah",
                    "employee_mike",
                    "visitor",
                    "unknown",
                ],
                createdAt=datetime(2024, 1, 17),
            ),
            Dataset(
                id="dataset-2",
                projectId="demo-2",
                name="Exam Session Recordings",
                fileCount=500,
                totalSize=25000000000,
                dataType="video",
                labelCount=8,
                isValidated=True,
                labels=[
                    "normal",
                    "looking_away",
                    "multiple_faces",
                    "phone_detected",
                    "talking",
                    "absent",
                    "suspicious_audio",
                    "screen_sharing",
                ],
                createdAt=datetime(2024, 1, 19),
            ),
        ]
        for ds in demo_datasets:
            self._datasets[ds.id] = ds

    # ── Users ──────────────────────────────────────────────────────────

    def get_user(self, user_id: str) -> Optional[User]:
        return self._users.get(user_id)

    def get_user_by_username(self, username: str) -> Optional[User]:
        for u in self._users.values():
            if u.username == username:
                return u
        return None

    def create_user(self, data: UserCreate) -> User:
        uid = str(uuid.uuid4())
        user = User(id=uid, username=data.username, password=data.password)
        self._users[uid] = user
        return user

    # ── Projects ───────────────────────────────────────────────────────

    def get_projects(self) -> list[Project]:
        return sorted(
            self._projects.values(),
            key=lambda p: (p.updatedAt or datetime.min),
            reverse=True,
        )

    def get_project(self, project_id: str) -> Optional[Project]:
        return self._projects.get(project_id)

    def create_project(self, data: ProjectCreate) -> Project:
        pid = str(uuid.uuid4())
        now = datetime.utcnow()
        project = Project(
            id=pid,
            name=data.name,
            description=data.description,
            templateId=data.templateId,
            status=data.status,
            currentStep=data.currentStep,
            createdAt=now,
            updatedAt=now,
        )
        self._projects[pid] = project
        return project

    def update_project(self, project_id: str, data: ProjectUpdate) -> Optional[Project]:
        existing = self._projects.get(project_id)
        if not existing:
            return None
        update_dict = data.model_dump(exclude_unset=True)
        update_dict["updatedAt"] = datetime.utcnow()
        updated = existing.model_copy(update=update_dict)
        self._projects[project_id] = updated
        return updated

    def delete_project(self, project_id: str) -> bool:
        return self._projects.pop(project_id, None) is not None

    # ── Datasets ───────────────────────────────────────────────────────

    def get_dataset(self, project_id: str) -> Optional[Dataset]:
        for ds in self._datasets.values():
            if ds.projectId == project_id:
                return ds
        return None

    def create_dataset(self, project_id: str, data: DatasetCreate) -> Dataset:
        did = str(uuid.uuid4())
        dataset = Dataset(
            id=did,
            projectId=project_id,
            name=data.name,
            fileCount=data.fileCount,
            totalSize=data.totalSize,
            dataType=data.dataType,
            labelCount=data.labelCount,
            isValidated=data.isValidated,
            labels=data.labels,
            createdAt=datetime.utcnow(),
        )
        self._datasets[did] = dataset
        return dataset

    def update_dataset(self, dataset_id: str, data: DatasetUpdate) -> Optional[Dataset]:
        existing = self._datasets.get(dataset_id)
        if not existing:
            return None
        updated = existing.model_copy(update=data.model_dump(exclude_unset=True))
        self._datasets[dataset_id] = updated
        return updated

    def delete_dataset(self, dataset_id: str) -> bool:
        return self._datasets.pop(dataset_id, None) is not None

    # ── ML Models ──────────────────────────────────────────────────────

    def get_models(self) -> list[MlModel]:
        return list(self._models.values())

    def get_model(self, project_id: str) -> Optional[MlModel]:
        """Get model by *project* ID."""
        for m in self._models.values():
            if m.projectId == project_id:
                return m
        return None

    def get_model_by_id(self, model_id: str) -> Optional[MlModel]:
        return self._models.get(model_id)

    def create_model(self, project_id: str, data: MlModelCreate) -> MlModel:
        mid = str(uuid.uuid4())
        model = MlModel(
            id=mid,
            projectId=project_id,
            name=data.name,
            status="training",
            confidenceThreshold=80,
            trainingProgress=0,
            createdAt=datetime.utcnow(),
        )
        self._models[mid] = model
        return model

    def update_model(self, model_id: str, data: dict) -> Optional[MlModel]:
        existing = self._models.get(model_id)
        if not existing:
            return None
        updated = existing.model_copy(update=data)
        self._models[model_id] = updated
        return updated

    def delete_model(self, model_id: str) -> bool:
        return self._models.pop(model_id, None) is not None

    # ── Deployments ────────────────────────────────────────────────────

    def get_deployments(self) -> list[Deployment]:
        return list(self._deployments.values())

    def get_deployment(self, project_id: str) -> Optional[Deployment]:
        """Get deployment by *project* ID."""
        for d in self._deployments.values():
            if d.projectId == project_id:
                return d
        return None

    def get_deployment_by_id(self, deployment_id: str) -> Optional[Deployment]:
        return self._deployments.get(deployment_id)

    def create_deployment(self, deployment: Deployment) -> Deployment:
        self._deployments[deployment.id] = deployment
        return deployment

    def update_deployment(
        self, deployment_id: str, data: DeploymentUpdate
    ) -> Optional[Deployment]:
        existing = self._deployments.get(deployment_id)
        if not existing:
            return None
        updated = existing.model_copy(update=data.model_dump(exclude_unset=True))
        self._deployments[deployment_id] = updated
        return updated

    def delete_deployment(self, deployment_id: str) -> bool:
        return self._deployments.pop(deployment_id, None) is not None


# Singleton
storage = MemStorage()
