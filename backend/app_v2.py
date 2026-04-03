from __future__ import annotations

import csv
import copy
import io
import json
import logging
import os
import re
import shutil
import sqlite3
import time
import uuid
import zipfile
from datetime import datetime, timezone
from pathlib import Path
from threading import Thread
from typing import Any, Optional
from urllib import error as urllib_error
from urllib import parse as urllib_parse
from urllib import request as urllib_request

import joblib
import numpy as np
import pandas as pd
from fastapi import FastAPI, File, Form, Header, HTTPException, Request, Response, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import GradientBoostingClassifier, RandomForestClassifier
from sklearn.impute import SimpleImputer
from sklearn.metrics import accuracy_score, f1_score, precision_score, recall_score
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import LabelEncoder, OneHotEncoder, StandardScaler

logger = logging.getLogger("AutoML")

BASE_DIR = Path(__file__).resolve().parent
MODELS_DIR = BASE_DIR / "storage" / "models"
DATASETS_DIR = BASE_DIR / "storage" / "datasets"
KAGGLE_DIR = DATASETS_DIR / "kaggle"
UPLOADS_DIR = DATASETS_DIR / "uploads"
PROMPT_DATASETS_DIR = UPLOADS_DIR / "prompt_enrollments"
DB_PATH = BASE_DIR / "mlforge.db"
ACTIVE_DB_PATH = DB_PATH.with_name("mlforge_runtime.db")

for directory in (MODELS_DIR, DATASETS_DIR, KAGGLE_DIR, UPLOADS_DIR, PROMPT_DATASETS_DIR):
    directory.mkdir(parents=True, exist_ok=True)

IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".bmp", ".gif", ".webp"}


class DatasetImportRequest(BaseModel):
    kaggleUrl: str


def get_conn():
    conn = sqlite3.connect(ACTIVE_DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def backup_corrupt_database() -> None:
    global ACTIVE_DB_PATH
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S")
    if DB_PATH.exists():
        backup_path = DB_PATH.with_name(f"{DB_PATH.stem}.corrupt-{timestamp}{DB_PATH.suffix}")
        try:
            shutil.move(str(DB_PATH), str(backup_path))
            ACTIVE_DB_PATH = DB_PATH
        except PermissionError:
            ACTIVE_DB_PATH = DB_PATH.with_name("mlforge_runtime.db")
    for suffix in ("-journal", "-wal", "-shm"):
        sidecar = Path(f"{DB_PATH}{suffix}")
        if sidecar.exists():
            try:
                sidecar.unlink()
            except PermissionError:
                pass


def ensure_database_ready() -> None:
    global ACTIVE_DB_PATH
    try:
        conn = sqlite3.connect(ACTIVE_DB_PATH)
        conn.execute("PRAGMA quick_check").fetchone()
        conn.close()
    except sqlite3.Error:
        logger.warning("SQLite database appears unhealthy, backing it up and recreating it at %s", ACTIVE_DB_PATH)
        try:
            conn.close()
        except Exception:
            pass
        if ACTIVE_DB_PATH == DB_PATH:
            backup_corrupt_database()
        else:
            ACTIVE_DB_PATH = DB_PATH.with_name(f"mlforge_runtime_{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')}.db")


def ensure_column(conn: sqlite3.Connection, table: str, column: str, definition: str) -> None:
    existing = {row[1] for row in conn.execute(f"PRAGMA table_info({table})").fetchall()}
    if column not in existing:
        conn.execute(f"ALTER TABLE {table} ADD COLUMN {column} {definition}")
        conn.commit()


def init_db() -> None:
    ensure_database_ready()
    conn = get_conn()
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS projects (
            id TEXT PRIMARY KEY,
            name TEXT,
            description TEXT,
            template_id TEXT,
            status TEXT,
            current_step INTEGER,
            created_at TEXT,
            updated_at TEXT
        )
        """
    )
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS datasets (
            id TEXT PRIMARY KEY,
            project_id TEXT,
            name TEXT,
            file_count INTEGER,
            total_size INTEGER,
            data_type TEXT,
            label_count INTEGER,
            is_validated INTEGER,
            labels TEXT,
            created_at TEXT,
            source_type TEXT,
            source_url TEXT,
            local_path TEXT,
            task_type TEXT,
            metadata_json TEXT,
            FOREIGN KEY (project_id) REFERENCES projects(id)
        )
        """
    )
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS ml_models (
            id TEXT PRIMARY KEY,
            project_id TEXT,
            name TEXT,
            status TEXT,
            confidence_threshold REAL,
            training_progress INTEGER,
            accuracy REAL,
            precision_score REAL,
            recall_score REAL,
            f1_score REAL,
            algorithm TEXT,
            dataset_size INTEGER,
            feature_names TEXT,
            model_id TEXT,
            created_at TEXT,
            trained_at TEXT,
            false_positive_rate REAL,
            false_negative_rate REAL,
            training_device TEXT,
            model_format TEXT,
            class_names TEXT,
            task_type TEXT,
            base_model TEXT,
            prefer_gpu INTEGER,
            use_pretrained_weights INTEGER,
            training_epochs INTEGER,
            artifact_size_mb REAL,
            use_image_augmentation INTEGER,
            FOREIGN KEY (project_id) REFERENCES projects(id)
        )
        """
    )
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS deployments (
            id TEXT PRIMARY KEY,
            project_id TEXT,
            model_id TEXT,
            name TEXT,
            type TEXT,
            status TEXT,
            endpoint TEXT,
            api_key TEXT,
            requests_today INTEGER,
            total_requests INTEGER,
            avg_latency REAL,
            deployed_at TEXT,
            created_at TEXT,
            FOREIGN KEY (project_id) REFERENCES projects(id)
        )
        """
    )
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS prediction_logs (
            id TEXT PRIMARY KEY,
            deployment_id TEXT,
            model_id TEXT,
            prediction TEXT,
            confidence REAL,
            latency_ms REAL,
            created_at TEXT,
            FOREIGN KEY (deployment_id) REFERENCES deployments(id)
        )
        """
    )
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS training_logs (
            id TEXT PRIMARY KEY,
            project_id TEXT,
            model_id TEXT,
            message TEXT,
            created_at TEXT,
            FOREIGN KEY (project_id) REFERENCES projects(id),
            FOREIGN KEY (model_id) REFERENCES ml_models(id)
        )
        """
    )
    ensure_column(conn, "datasets", "source_type", "TEXT")
    ensure_column(conn, "datasets", "source_url", "TEXT")
    ensure_column(conn, "datasets", "local_path", "TEXT")
    ensure_column(conn, "datasets", "task_type", "TEXT")
    ensure_column(conn, "datasets", "metadata_json", "TEXT")
    ensure_column(conn, "ml_models", "false_positive_rate", "REAL")
    ensure_column(conn, "ml_models", "false_negative_rate", "REAL")
    ensure_column(conn, "ml_models", "training_device", "TEXT")
    ensure_column(conn, "ml_models", "model_format", "TEXT")
    ensure_column(conn, "ml_models", "class_names", "TEXT")
    ensure_column(conn, "ml_models", "task_type", "TEXT")
    ensure_column(conn, "ml_models", "base_model", "TEXT")
    ensure_column(conn, "ml_models", "prefer_gpu", "INTEGER")
    ensure_column(conn, "ml_models", "use_pretrained_weights", "INTEGER")
    ensure_column(conn, "ml_models", "training_epochs", "INTEGER")
    ensure_column(conn, "ml_models", "artifact_size_mb", "REAL")
    ensure_column(conn, "ml_models", "use_image_augmentation", "INTEGER")
    conn.close()


def parse_json_list(value: Any) -> list[Any]:
    if value is None:
        return []
    if isinstance(value, list):
        return value
    if isinstance(value, str):
        try:
            parsed = json.loads(value)
        except json.JSONDecodeError:
            return []
        return parsed if isinstance(parsed, list) else []
    return []


def parse_json_dict(value: Any) -> dict[str, Any]:
    if value is None:
        return {}
    if isinstance(value, dict):
        return value
    if isinstance(value, str):
        try:
            parsed = json.loads(value)
        except json.JSONDecodeError:
            return {}
        return parsed if isinstance(parsed, dict) else {}
    return {}


def row_to_dict(row: sqlite3.Row | None) -> dict[str, Any] | None:
    return dict(row) if row is not None else None


def serialize_row(row: dict[str, Any] | None) -> dict[str, Any] | None:
    if row is None:
        return None
    return {
        "id": row.get("id"),
        "name": row.get("name"),
        "description": row.get("description"),
        "templateId": row.get("template_id"),
        "status": row.get("status"),
        "currentStep": row.get("current_step"),
        "createdAt": row.get("created_at"),
        "updatedAt": row.get("updated_at"),
        "projectId": row.get("project_id"),
        "fileCount": row.get("file_count"),
        "totalSize": row.get("total_size"),
        "dataType": row.get("data_type"),
        "labelCount": row.get("label_count"),
        "isValidated": bool(row.get("is_validated")) if row.get("is_validated") is not None else None,
        "labels": parse_json_list(row.get("labels")),
        "sourceType": row.get("source_type"),
        "sourceUrl": row.get("source_url"),
        "localPath": row.get("local_path"),
        "taskType": row.get("task_type"),
        "metadata": parse_json_dict(row.get("metadata_json")),
        "accuracy": row.get("accuracy"),
        "precisionScore": row.get("precision_score"),
        "recallScore": row.get("recall_score"),
        "f1Score": row.get("f1_score"),
        "confidenceThreshold": row.get("confidence_threshold"),
        "falsePositiveRate": row.get("false_positive_rate"),
        "falseNegativeRate": row.get("false_negative_rate"),
        "trainingProgress": row.get("training_progress"),
        "trainedAt": row.get("trained_at"),
        "algorithm": row.get("algorithm"),
        "datasetSize": row.get("dataset_size"),
        "featureNames": parse_json_list(row.get("feature_names")),
        "modelId": row.get("model_id"),
        "trainingDevice": row.get("training_device"),
        "modelFormat": row.get("model_format"),
        "classNames": parse_json_list(row.get("class_names")),
        "baseModel": row.get("base_model"),
        "preferGpu": bool(row.get("prefer_gpu")) if row.get("prefer_gpu") is not None else None,
        "usePretrainedWeights": bool(row.get("use_pretrained_weights")) if row.get("use_pretrained_weights") is not None else None,
        "trainingEpochs": row.get("training_epochs"),
        "artifactSizeMb": row.get("artifact_size_mb"),
        "useImageAugmentation": bool(row.get("use_image_augmentation")) if row.get("use_image_augmentation") is not None else None,
        "type": row.get("type"),
        "endpoint": row.get("endpoint"),
        "apiKey": row.get("api_key"),
        "requestsToday": row.get("requests_today"),
        "totalRequests": row.get("total_requests"),
        "avgLatency": row.get("avg_latency"),
        "deployedAt": row.get("deployed_at"),
    }


def clean_dict(payload: dict[str, Any] | None) -> dict[str, Any] | None:
    if payload is None:
        return None
    return {key: value for key, value in payload.items() if value is not None}


def enrich_model_runtime_metadata(row: dict[str, Any] | None) -> dict[str, Any] | None:
    if row is None:
        return None
    model_id = row.get("id")
    if not model_id:
        return row

    if row.get("artifact_size_mb") is None:
        candidate_paths = [MODELS_DIR / f"{model_id}.pt", MODELS_DIR / f"{model_id}.pkl"]
        for candidate_path in candidate_paths:
            if candidate_path.exists():
                row["artifact_size_mb"] = round(candidate_path.stat().st_size / (1024 * 1024), 2)
                break

    if row.get("training_epochs") is None:
        conn = get_conn()
        try:
            logs = conn.execute(
                """
                SELECT message
                FROM training_logs
                WHERE model_id = ?
                ORDER BY created_at ASC
                """,
                (model_id,),
            ).fetchall()
        finally:
            conn.close()
        for log in reversed(logs):
            match = re.search(r"Epoch\s+\d+/(\d+)", log["message"])
            if match:
                row["training_epochs"] = int(match.group(1))
                break
    return row


def project_exists(project_id: str) -> None:
    conn = get_conn()
    row = conn.execute("SELECT 1 FROM projects WHERE id = ?", (project_id,)).fetchone()
    conn.close()
    if row is None:
        raise HTTPException(404, "Project not found")


def parse_csv_dataset(file_path: Path) -> tuple[pd.DataFrame, dict[str, Any]]:
    df = pd.read_csv(file_path)
    if df.empty:
        raise HTTPException(400, "CSV dataset is empty")
    if len(df.columns) < 2:
        raise HTTPException(400, "CSV dataset needs at least one feature column and one label column")
    label_column = str(df.columns[-1])
    labels = sorted(df[label_column].dropna().astype(str).unique().tolist())
    return df, {
        "file_count": 1,
        "total_size": file_path.stat().st_size,
        "data_type": "csv",
        "label_count": len(labels),
        "labels": labels,
        "task_type": "tabular-classification",
        "metadata": {
            "labelColumn": label_column,
            "columns": [str(col) for col in df.columns],
            "rowCount": int(len(df)),
            "columnCount": int(len(df.columns)),
        },
    }


def parse_kaggle_ref(kaggle_url: str) -> str:
    match = re.search(r"kaggle\.com/datasets/([^/]+/[^/?#]+)", kaggle_url)
    if not match:
        raise HTTPException(400, "Kaggle URL must look like https://www.kaggle.com/datasets/<owner>/<dataset>")
    return match.group(1)


def contains_class_subdirs(directory: Path) -> tuple[bool, list[str]]:
    class_names = []
    for child in directory.iterdir():
        if child.is_dir():
            has_images = any(path.is_file() and path.suffix.lower() in IMAGE_EXTENSIONS for path in child.rglob("*"))
            if has_images:
                class_names.append(child.name)
    return len(class_names) >= 2, sorted(class_names)


def resolve_image_dataset(base_dir: Path) -> dict[str, Any]:
    split_names = {"train": ["train", "training"], "val": ["val", "valid", "validation"], "test": ["test", "testing"]}
    train_dir: Optional[Path] = None
    val_dir: Optional[Path] = None
    test_dir: Optional[Path] = None
    class_names: list[str] = []

    search_roots = [base_dir] + [child for child in base_dir.iterdir() if child.is_dir()]
    for root in search_roots:
        children = {child.name.lower(): child for child in root.iterdir() if child.is_dir()}
        for candidate in split_names["train"]:
            if candidate in children:
                ok, labels = contains_class_subdirs(children[candidate])
                if ok:
                    train_dir = children[candidate]
                    class_names = labels
                    for val_name in split_names["val"]:
                        if val_name in children:
                            val_dir = children[val_name]
                            break
                    for test_name in split_names["test"]:
                        if test_name in children:
                            test_dir = children[test_name]
                            break
                    break
        if train_dir is not None:
            break

    if train_dir is None:
        ok, labels = contains_class_subdirs(base_dir)
        if ok:
            train_dir = base_dir
            class_names = labels

    if train_dir is None:
        for candidate in base_dir.rglob("*"):
            if candidate.is_dir():
                ok, labels = contains_class_subdirs(candidate)
                if ok:
                    train_dir = candidate
                    class_names = labels
                    break

    if train_dir is None:
        raise HTTPException(400, "Could not find an image-classification folder structure in the Kaggle dataset")

    image_files = [path for path in base_dir.rglob("*") if path.is_file() and path.suffix.lower() in IMAGE_EXTENSIONS]
    return {
        "file_count": len(image_files),
        "total_size": sum(path.stat().st_size for path in image_files),
        "data_type": "images",
        "label_count": len(class_names),
        "labels": class_names,
        "task_type": "image-classification",
        "metadata": {
            "trainDir": str(train_dir),
            "valDir": str(val_dir) if val_dir else None,
            "testDir": str(test_dir) if test_dir else None,
            "classNames": class_names,
            "imageCount": len(image_files),
        },
    }


def summarize_prompt_image_dataset(base_dir: Path) -> dict[str, Any]:
    train_dir = base_dir / "train"
    if not train_dir.exists():
        raise HTTPException(400, "Prompt enrollment dataset is missing its training folder")

    class_names = sorted([child.name for child in train_dir.iterdir() if child.is_dir()])
    if not class_names:
        raise HTTPException(400, "Add at least one labeled image before training")

    image_files = [path for path in base_dir.rglob("*") if path.is_file() and path.suffix.lower() in IMAGE_EXTENSIONS]
    return {
        "file_count": len(image_files),
        "total_size": sum(path.stat().st_size for path in image_files),
        "data_type": "images",
        "label_count": len(class_names),
        "labels": class_names,
        "task_type": "image-classification",
        "metadata": {
            "trainDir": str(train_dir),
            "valDir": None,
            "testDir": None,
            "classNames": class_names,
            "imageCount": len(image_files),
            "sourceMode": "prompt-enrollment",
        },
    }


def sanitize_label_name(value: str) -> str:
    normalized = re.sub(r"[^A-Za-z0-9 _-]+", " ", value).strip()
    normalized = re.sub(r"\s+", "_", normalized)
    normalized = normalized.strip("._-")
    return normalized or "unknown_person"


def extract_label_from_prompt(prompt: str) -> str:
    cleaned = re.sub(r"\s+", " ", prompt or "").strip()
    if not cleaned:
        raise HTTPException(400, "Prompt is required to label the uploaded images")

    patterns = [
        r"(?:this|that|the)\s+(?:is|looks like|person is|face is)\s+([A-Za-z0-9 _-]+)$",
        r"(?:remember|label|save|store)\s+(?:this|these|them)?\s*(?:as)?\s*([A-Za-z0-9 _-]+)$",
        r"(?:name|class)\s*(?:it|them)?\s*(?:as)?\s*([A-Za-z0-9 _-]+)$",
    ]
    for pattern in patterns:
        match = re.search(pattern, cleaned, flags=re.IGNORECASE)
        if match:
            return sanitize_label_name(match.group(1))

    return sanitize_label_name(cleaned)


def remove_path_if_exists(target: str | None) -> None:
    if not target:
        return
    try:
        candidate = Path(target)
    except (TypeError, ValueError):
        return
    if not candidate.exists():
        return
    if candidate.is_dir():
        shutil.rmtree(candidate, ignore_errors=True)
    else:
        candidate.unlink(missing_ok=True)


def delete_project_resources(project_id: str) -> bool:
    conn = get_conn()
    project_row = conn.execute("SELECT id FROM projects WHERE id = ?", (project_id,)).fetchone()
    if project_row is None:
        conn.close()
        return False

    dataset_rows = conn.execute("SELECT id, local_path FROM datasets WHERE project_id = ?", (project_id,)).fetchall()
    model_rows = conn.execute("SELECT id FROM ml_models WHERE project_id = ?", (project_id,)).fetchall()
    deployment_rows = conn.execute("SELECT id FROM deployments WHERE project_id = ?", (project_id,)).fetchall()

    conn.execute("DELETE FROM training_logs WHERE project_id = ?", (project_id,))
    for deployment in deployment_rows:
        conn.execute("DELETE FROM prediction_logs WHERE deployment_id = ?", (deployment["id"],))
    conn.execute("DELETE FROM deployments WHERE project_id = ?", (project_id,))
    conn.execute("DELETE FROM ml_models WHERE project_id = ?", (project_id,))
    conn.execute("DELETE FROM datasets WHERE project_id = ?", (project_id,))
    conn.execute("DELETE FROM projects WHERE id = ?", (project_id,))
    conn.commit()
    conn.close()

    for dataset in dataset_rows:
        remove_path_if_exists(dataset["local_path"])
        remove_path_if_exists(str(UPLOADS_DIR / f"{dataset['id']}.csv"))
        remove_path_if_exists(str(UPLOADS_DIR / f"{dataset['id']}.zip"))
        remove_path_if_exists(str(KAGGLE_DIR / dataset["id"]))

    remove_path_if_exists(str(PROMPT_DATASETS_DIR / project_id))

    for model in model_rows:
        remove_path_if_exists(str(MODELS_DIR / f"{model['id']}.pt"))
        remove_path_if_exists(str(MODELS_DIR / f"{model['id']}.pkl"))

    return True


def upsert_prompt_dataset_record(project_id: str, local_path: Path, metadata: dict[str, Any]) -> dict[str, Any]:
    conn = get_conn()
    existing = conn.execute(
        """
        SELECT id
        FROM datasets
        WHERE project_id = ? AND task_type = 'image-classification' AND source_type = 'prompt-enrollment'
        ORDER BY created_at DESC
        LIMIT 1
        """,
        (project_id,),
    ).fetchone()
    now = datetime.now(timezone.utc).isoformat()
    dataset_id = existing["id"] if existing else str(uuid.uuid4())
    payload = (
        f"Prompt Enrollment {project_id[:8]}",
        metadata["file_count"],
        metadata["total_size"],
        metadata["data_type"],
        metadata["label_count"],
        1,
        json.dumps(metadata["labels"]),
        now,
        "prompt-enrollment",
        None,
        str(local_path),
        metadata["task_type"],
        json.dumps(metadata["metadata"]),
    )
    if existing:
        conn.execute(
            """
            UPDATE datasets
            SET name = ?, file_count = ?, total_size = ?, data_type = ?, label_count = ?, is_validated = ?,
                labels = ?, created_at = ?, source_type = ?, source_url = ?, local_path = ?, task_type = ?, metadata_json = ?
            WHERE id = ?
            """,
            payload + (dataset_id,),
        )
    else:
        conn.execute(
            """
            INSERT INTO datasets (
                id, project_id, name, file_count, total_size, data_type, label_count, is_validated,
                labels, created_at, source_type, source_url, local_path, task_type, metadata_json
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (dataset_id, project_id) + payload,
        )

    conn.execute(
        "UPDATE projects SET current_step = CASE WHEN current_step < 2 THEN 2 ELSE current_step END, updated_at = ? WHERE id = ?",
        (now, project_id),
    )
    row = row_to_dict(conn.execute("SELECT * FROM datasets WHERE id = ?", (dataset_id,)).fetchone())
    conn.commit()
    conn.close()
    return clean_dict(serialize_row(row))


def check_ollama_connection(base_url: str, model_name: str) -> dict[str, Any]:
    tags_url = urllib_parse.urljoin(base_url.rstrip("/") + "/", "api/tags")
    request = urllib_request.Request(tags_url, method="GET")
    with urllib_request.urlopen(request, timeout=5) as response:
        payload = json.loads(response.read().decode("utf-8"))
    models = payload.get("models", []) if isinstance(payload, dict) else []
    available_models = sorted([str(model.get("name")) for model in models if model.get("name")])
    return {
        "reachable": True,
        "modelAvailable": model_name in available_models,
        "availableModels": available_models,
        "message": f"Connected to Ollama at {base_url}.",
    }


def extract_zip_dataset(zip_path: Path, dataset_id: str) -> tuple[Path, dict[str, Any]]:
    extract_dir = UPLOADS_DIR / f"{dataset_id}_images"
    if extract_dir.exists():
        shutil.rmtree(extract_dir)
    extract_dir.mkdir(parents=True, exist_ok=True)

    try:
        with zipfile.ZipFile(zip_path, "r") as archive:
            archive.extractall(extract_dir)
    except zipfile.BadZipFile as exc:
        raise HTTPException(400, "The uploaded zip file is invalid or corrupted") from exc

    metadata = resolve_image_dataset(extract_dir)
    return extract_dir, metadata


def download_kaggle_dataset(kaggle_url: str, dataset_id: str) -> tuple[Path, dict[str, Any]]:
    from kaggle.api.kaggle_api_extended import KaggleApi

    dataset_ref = parse_kaggle_ref(kaggle_url)
    target_dir = KAGGLE_DIR / dataset_id
    if target_dir.exists():
        shutil.rmtree(target_dir)
    target_dir.mkdir(parents=True, exist_ok=True)
    try:
        api = KaggleApi()
        api.authenticate()
        api.dataset_download_files(dataset_ref, path=str(target_dir), unzip=True, quiet=False)
    except Exception as exc:
        raise HTTPException(
            400,
            f"Kaggle download failed. Set KAGGLE_USERNAME and KAGGLE_KEY in backend/.env or ~/.kaggle/kaggle.json. Details: {exc}",
        ) from exc
    return target_dir, resolve_image_dataset(target_dir)


def train_tabular_model(df: pd.DataFrame, template_id: str, label_column: str) -> tuple[Any, Any, dict[str, Any]]:
    X = df.drop(columns=[label_column]).copy()
    y = df[label_column].astype(str)
    label_encoder = LabelEncoder()
    encoded_y = label_encoder.fit_transform(y)
    stratify = encoded_y if len(set(encoded_y)) > 1 else None
    X_train, X_test, y_train, y_test = train_test_split(X, encoded_y, test_size=0.2, random_state=42, stratify=stratify)

    numeric_cols = X.select_dtypes(include=["number", "bool"]).columns.tolist()
    categorical_cols = [column for column in X.columns if column not in numeric_cols]
    transformers = []
    if numeric_cols:
        transformers.append(("num", Pipeline([("imputer", SimpleImputer(strategy="median")), ("scaler", StandardScaler())]), numeric_cols))
    if categorical_cols:
        transformers.append(("cat", Pipeline([("imputer", SimpleImputer(strategy="most_frequent")), ("encoder", OneHotEncoder(handle_unknown="ignore"))]), categorical_cols))

    preprocessor = ColumnTransformer(transformers=transformers)
    classifier = GradientBoostingClassifier(random_state=42) if template_id in {"access-control", "exam-proctoring"} else RandomForestClassifier(n_estimators=200, max_depth=12, random_state=42)
    pipeline = Pipeline([("preprocessor", preprocessor), ("classifier", classifier)])
    pipeline.fit(X_train, y_train)
    predictions = pipeline.predict(X_test)
    average = "binary" if len(label_encoder.classes_) == 2 else "weighted"
    precision = round(precision_score(y_test, predictions, average=average, zero_division=0) * 100, 2)
    recall = round(recall_score(y_test, predictions, average=average, zero_division=0) * 100, 2)
    return pipeline, label_encoder, {
        "accuracy": round(accuracy_score(y_test, predictions) * 100, 2),
        "precision": precision,
        "recall": recall,
        "f1": round(f1_score(y_test, predictions, average=average, zero_division=0) * 100, 2),
        "fpr": round(max(0.0, 100.0 - precision), 2),
        "fnr": round(max(0.0, 100.0 - recall), 2),
        "algorithm": type(classifier).__name__,
        "feature_names": [str(column) for column in X.columns],
        "class_names": label_encoder.classes_.tolist(),
        "dataset_size": len(df),
        "training_device": "cpu",
        "model_format": "joblib",
        "task_type": "tabular-classification",
    }


def build_image_model(base_model: str, num_classes: int, use_pretrained_weights: bool):
    import torch.nn as nn
    from torchvision import models

    def choose_weights(default_weights):
        return default_weights if use_pretrained_weights else None

    if base_model == "resnet18":
        try:
            model = models.resnet18(weights=choose_weights(models.ResNet18_Weights.DEFAULT))
        except Exception as exc:
            raise RuntimeError("Failed to load ResNet18 pretrained weights. Check internet access or disable pretrained weights.") from exc
        model.fc = nn.Linear(model.fc.in_features, num_classes)
        return model, "ResNet18"

    if base_model == "mobilenet_v3_small":
        try:
            model = models.mobilenet_v3_small(weights=choose_weights(models.MobileNet_V3_Small_Weights.DEFAULT))
        except Exception as exc:
            raise RuntimeError("Failed to load MobileNetV3 pretrained weights. Check internet access or disable pretrained weights.") from exc
        in_features = model.classifier[-1].in_features
        model.classifier[-1] = nn.Linear(in_features, num_classes)
        return model, "MobileNetV3Small"

    if base_model == "efficientnet_b0":
        try:
            model = models.efficientnet_b0(weights=choose_weights(models.EfficientNet_B0_Weights.DEFAULT))
        except Exception as exc:
            raise RuntimeError("Failed to load EfficientNet-B0 pretrained weights. Check internet access or disable pretrained weights.") from exc
        in_features = model.classifier[-1].in_features
        model.classifier[-1] = nn.Linear(in_features, num_classes)
        return model, "EfficientNetB0"

    class SimpleImageClassifier(nn.Module):
        def __init__(self, classes: int) -> None:
            super().__init__()
            self.features = nn.Sequential(
                nn.Conv2d(3, 32, kernel_size=3, padding=1),
                nn.ReLU(),
                nn.MaxPool2d(2),
                nn.Conv2d(32, 64, kernel_size=3, padding=1),
                nn.ReLU(),
                nn.MaxPool2d(2),
                nn.Conv2d(64, 128, kernel_size=3, padding=1),
                nn.ReLU(),
                nn.MaxPool2d(2),
                nn.AdaptiveAvgPool2d((1, 1)),
            )
            self.classifier = nn.Sequential(
                nn.Flatten(),
                nn.Linear(128, 128),
                nn.ReLU(),
                nn.Dropout(0.2),
                nn.Linear(128, classes),
            )

        def forward(self, images):
            return self.classifier(self.features(images))

    return SimpleImageClassifier(num_classes), "CustomCNN"


def stratified_image_split(targets: list[int], validation_ratio: float = 0.2, seed: int = 42) -> tuple[list[int], list[int]]:
    rng = np.random.default_rng(seed)
    per_class_indices: dict[int, list[int]] = {}
    for index, target in enumerate(targets):
        per_class_indices.setdefault(int(target), []).append(index)

    train_indices: list[int] = []
    val_indices: list[int] = []
    for _, indices in per_class_indices.items():
        shuffled = list(indices)
        rng.shuffle(shuffled)
        if len(shuffled) == 1:
            train_indices.extend(shuffled)
            continue
        val_count = max(1, int(round(len(shuffled) * validation_ratio)))
        val_count = min(val_count, len(shuffled) - 1)
        val_indices.extend(shuffled[:val_count])
        train_indices.extend(shuffled[val_count:])

    if not train_indices:
        raise RuntimeError("Image dataset is too small to build a training split.")
    if not val_indices:
        val_indices = train_indices[-1:]
        train_indices = train_indices[:-1]
    return train_indices, val_indices


def train_image_model(
    dataset_row: dict[str, Any],
    progress_callback,
    base_model: str,
    prefer_gpu: bool,
    use_pretrained_weights: bool,
    training_epochs: int,
    use_image_augmentation: bool,
) -> tuple[dict[str, Any], dict[str, Any]]:
    try:
        import torch
        from torch import nn
        from torch.utils.data import DataLoader, Subset, WeightedRandomSampler
        from torchvision import datasets, transforms
    except Exception as exc:
        raise RuntimeError(
            "PyTorch image training could not start. On this Windows setup, install the Microsoft Visual C++ Redistributable if needed, then restart the backend."
        ) from exc

    metadata = parse_json_dict(dataset_row.get("metadata_json"))
    train_dir = Path(metadata["trainDir"])
    val_dir = Path(metadata["valDir"]) if metadata.get("valDir") else None
    test_dir = Path(metadata["testDir"]) if metadata.get("testDir") else None

    image_size = 224
    eval_transform = transforms.Compose(
        [
            transforms.Resize((image_size, image_size)),
            transforms.CenterCrop((image_size, image_size)),
            transforms.ToTensor(),
            transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]),
        ]
    )
    train_transform_steps: list[Any] = [transforms.Resize((256, 256))]
    if use_image_augmentation:
        train_transform_steps.extend(
            [
                transforms.RandomResizedCrop((image_size, image_size), scale=(0.8, 1.0)),
                transforms.RandomHorizontalFlip(p=0.5),
                transforms.RandomRotation(degrees=15),
                transforms.ColorJitter(brightness=0.2, contrast=0.2, saturation=0.15),
            ]
        )
    else:
        train_transform_steps.append(transforms.CenterCrop((image_size, image_size)))
    train_transform_steps.extend(
        [
            transforms.ToTensor(),
            transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]),
        ]
    )
    train_transform = transforms.Compose(train_transform_steps)

    base_train_dataset = datasets.ImageFolder(str(train_dir))
    class_names = base_train_dataset.classes
    if len(class_names) < 2:
        raise RuntimeError("Image dataset must contain at least two classes")

    if val_dir and val_dir.exists():
        train_dataset = datasets.ImageFolder(str(train_dir), transform=train_transform)
        val_dataset = datasets.ImageFolder(str(val_dir), transform=eval_transform)
        train_targets = datasets.ImageFolder(str(train_dir)).targets
    else:
        train_indices, val_indices = stratified_image_split(list(base_train_dataset.targets), validation_ratio=0.2, seed=42)
        train_dataset = Subset(datasets.ImageFolder(str(train_dir), transform=train_transform), train_indices)
        val_dataset = Subset(datasets.ImageFolder(str(train_dir), transform=eval_transform), val_indices)
        train_targets = [base_train_dataset.targets[index] for index in train_indices]

    eval_dataset = datasets.ImageFolder(str(test_dir), transform=eval_transform) if test_dir and test_dir.exists() else val_dataset
    if prefer_gpu and not torch.cuda.is_available():
        raise RuntimeError("GPU-only mode is enabled, but CUDA is not available on this machine.")

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    device_label = torch.cuda.get_device_name(0) if device.type == "cuda" else "CPU"
    batch_size = 24 if device.type == "cuda" else 12
    epochs = max(1, min(int(training_epochs), 50))
    class_counts = np.bincount(np.asarray(train_targets, dtype=np.int64), minlength=len(class_names))
    class_weights = np.asarray([1.0 / max(1, count) for count in class_counts], dtype=np.float32)
    sample_weights = [float(class_weights[int(target)]) for target in train_targets]
    sampler = WeightedRandomSampler(sample_weights, num_samples=len(sample_weights), replacement=True)

    train_loader = DataLoader(train_dataset, batch_size=batch_size, sampler=sampler)
    val_loader = DataLoader(val_dataset, batch_size=batch_size, shuffle=False)
    eval_loader = DataLoader(eval_dataset, batch_size=batch_size, shuffle=False)

    model, algorithm_name = build_image_model(base_model, len(class_names), use_pretrained_weights)
    model = model.to(device)
    criterion = nn.CrossEntropyLoss(weight=torch.tensor(class_weights, dtype=torch.float32, device=device), label_smoothing=0.05)
    optimizer = torch.optim.AdamW(model.parameters(), lr=3e-4 if use_pretrained_weights else 7e-4, weight_decay=1e-4)
    scheduler = torch.optim.lr_scheduler.ReduceLROnPlateau(optimizer, mode="max", factor=0.5, patience=2)

    def run_eval(loader):
        model.eval()
        predictions: list[int] = []
        targets: list[int] = []
        confidences: list[float] = []
        with torch.no_grad():
            for images, labels in loader:
                images = images.to(device)
                labels = labels.to(device)
                logits = model(images)
                probabilities = torch.softmax(logits, dim=1)
                preds = torch.argmax(probabilities, dim=1)
                predictions.extend(preds.cpu().tolist())
                targets.extend(labels.cpu().tolist())
                confidences.extend(probabilities.max(dim=1).values.cpu().tolist())
        return targets, predictions, confidences

    progress_callback(15, "Building image tensors and data loaders")
    progress_callback(18, f"Class balance in training split: {class_counts.tolist()}")
    best_state_dict = copy.deepcopy(model.state_dict())
    best_val_accuracy = -1.0
    best_epoch = 0
    for epoch in range(epochs):
        model.train()
        epoch_loss_total = 0.0
        epoch_items = 0
        for batch_index, (images, labels) in enumerate(train_loader):
            images = images.to(device)
            labels = labels.to(device)
            optimizer.zero_grad(set_to_none=True)
            logits = model(images)
            loss = criterion(logits, labels)
            loss.backward()
            optimizer.step()
            epoch_loss_total += float(loss.item()) * len(labels)
            epoch_items += len(labels)
            batch_progress = int(((epoch + (batch_index + 1) / max(1, len(train_loader))) / epochs) * 55)
            progress_callback(20 + batch_progress, f"Epoch {epoch + 1}/{epochs} training on {device_label}")
        val_true, val_pred, _ = run_eval(val_loader)
        val_accuracy = round(accuracy_score(val_true, val_pred) * 100, 2) if val_true else 0.0
        avg_loss = round(epoch_loss_total / max(epoch_items, 1), 4)
        scheduler.step(val_accuracy)
        if val_accuracy >= best_val_accuracy:
            best_val_accuracy = val_accuracy
            best_epoch = epoch + 1
            best_state_dict = copy.deepcopy(model.state_dict())
        progress_callback(20 + int(((epoch + 1) / epochs) * 55), f"Epoch {epoch + 1}/{epochs} complete: loss={avg_loss}, val_accuracy={val_accuracy}%")

    model.load_state_dict(best_state_dict)
    progress_callback(78, f"Restored best checkpoint from epoch {best_epoch} with val_accuracy={best_val_accuracy}%")
    y_true, y_pred, confidences = run_eval(eval_loader)
    average = "binary" if len(class_names) == 2 else "weighted"
    precision = round(precision_score(y_true, y_pred, average=average, zero_division=0) * 100, 2)
    recall = round(recall_score(y_true, y_pred, average=average, zero_division=0) * 100, 2)
    return {
        "model_state_dict": model.state_dict(),
        "class_names": class_names,
        "image_size": image_size,
    }, {
        "accuracy": round(accuracy_score(y_true, y_pred) * 100, 2),
        "precision": precision,
        "recall": recall,
        "f1": round(f1_score(y_true, y_pred, average=average, zero_division=0) * 100, 2),
        "fpr": round(max(0.0, 100.0 - precision), 2),
        "fnr": round(max(0.0, 100.0 - recall), 2),
        "algorithm": algorithm_name,
        "feature_names": [],
        "class_names": class_names,
        "dataset_size": dataset_row.get("file_count") or len(base_train_dataset),
        "training_device": device_label,
        "model_format": "pytorch",
        "task_type": "image-classification",
        "base_model": base_model,
        "use_pretrained_weights": use_pretrained_weights,
        "training_epochs": epochs,
        "use_image_augmentation": use_image_augmentation,
        "mean_confidence": float(np.mean(confidences)) if confidences else 0.0,
    }


def update_model_progress(model_id: str, progress: int, status: str = "training") -> None:
    conn = get_conn()
    conn.execute("UPDATE ml_models SET training_progress = ?, status = ? WHERE id = ?", (progress, status, model_id))
    conn.commit()
    conn.close()


def store_model_artifact(model_id: str, dataset_row: dict[str, Any], project_row: dict[str, Any]) -> dict[str, Any]:
    dataset_metadata = parse_json_dict(dataset_row.get("metadata_json"))
    project_id = project_row["id"]
    conn = get_conn()
    model_row = row_to_dict(
        conn.execute(
            "SELECT base_model, prefer_gpu, use_pretrained_weights, training_epochs, use_image_augmentation FROM ml_models WHERE id = ?",
            (model_id,),
        ).fetchone()
    )
    conn.close()
    selected_base_model = (model_row or {}).get("base_model") or "resnet18"
    prefer_gpu = bool((model_row or {}).get("prefer_gpu"))
    use_pretrained_weights = bool((model_row or {}).get("use_pretrained_weights"))
    training_epochs = int((model_row or {}).get("training_epochs") or 6)
    use_image_augmentation = bool((model_row or {}).get("use_image_augmentation"))
    if dataset_row.get("task_type") == "image-classification":
        def progress_callback(progress: int, message: str | None = None) -> None:
            update_model_progress(model_id, min(progress, 95), "training")
            if message:
                append_training_log(project_id, model_id, message)

        append_training_log(project_id, model_id, f"Detected image dataset with classes: {', '.join(dataset_row.get('labels') and parse_json_list(dataset_row.get('labels')) or [])}")
        append_training_log(project_id, model_id, f"Selected image base model: {selected_base_model}")
        append_training_log(project_id, model_id, f"Pretrained weights: {'enabled' if use_pretrained_weights else 'disabled'}")
        append_training_log(project_id, model_id, f"GPU-only mode: {'enabled' if prefer_gpu else 'disabled'}")
        append_training_log(project_id, model_id, f"Training epochs: {training_epochs}")
        append_training_log(project_id, model_id, f"Image augmentation: {'enabled' if use_image_augmentation else 'disabled'}")
        append_training_log(project_id, model_id, "Preparing image preprocessing pipeline (resize + normalize)")
        artifact, metrics = train_image_model(
            dataset_row,
            progress_callback,
            selected_base_model,
            prefer_gpu,
            use_pretrained_weights,
            training_epochs,
            use_image_augmentation,
        )
        append_training_log(project_id, model_id, f"Training device: {metrics['training_device']}")
        model_path = MODELS_DIR / f"{model_id}.pt"
        import torch

        torch.save({**artifact, "project_id": project_row["id"], "template_id": project_row.get("template_id"), "base_model": selected_base_model}, model_path)
        metrics["path"] = str(model_path)
        metrics["artifact_size_mb"] = round(model_path.stat().st_size / (1024 * 1024), 2)
        append_training_log(project_id, model_id, f"Saved trained PyTorch model to {model_path.name}")
        append_training_log(project_id, model_id, f"Model artifact size: {metrics['artifact_size_mb']} MB")
        return metrics

    dataset_path = Path(dataset_row["local_path"])
    df = pd.read_csv(dataset_path)
    label_column = dataset_metadata.get("labelColumn") or str(df.columns[-1])
    if prefer_gpu:
        raise RuntimeError("GPU-only mode is enabled, but CSV/tabular training currently uses scikit-learn CPU training.")
    append_training_log(project_id, model_id, f"Loaded CSV dataset with {len(df)} rows and {len(df.columns)} columns")
    append_training_log(project_id, model_id, f"Using label column: {label_column}")
    append_training_log(project_id, model_id, "Training device: CPU")
    append_training_log(project_id, model_id, "Configuring scikit-learn preprocessing (imputation, scaling, encoding)")
    pipeline, label_encoder, metrics = train_tabular_model(df, project_row.get("template_id") or "", label_column)
    model_path = MODELS_DIR / f"{model_id}.pkl"
    joblib.dump(
        {
            "pipeline": pipeline,
            "label_encoder": label_encoder,
            "template_id": project_row.get("template_id"),
            "task_type": "tabular-classification",
            "label_column": label_column,
        },
        model_path,
    )
    metrics["path"] = str(model_path)
    metrics["training_epochs"] = None
    metrics["artifact_size_mb"] = round(model_path.stat().st_size / (1024 * 1024), 2)
    metrics["use_image_augmentation"] = None
    append_training_log(project_id, model_id, f"Saved trained scikit-learn pipeline to {model_path.name}")
    append_training_log(project_id, model_id, f"Model artifact size: {metrics['artifact_size_mb']} MB")
    return metrics


def run_training_job(model_id: str, project_id: str) -> None:
    conn = get_conn()
    project_row = row_to_dict(conn.execute("SELECT * FROM projects WHERE id = ?", (project_id,)).fetchone())
    dataset_row = row_to_dict(conn.execute("SELECT * FROM datasets WHERE project_id = ? ORDER BY created_at DESC LIMIT 1", (project_id,)).fetchone())
    conn.close()
    if project_row is None or dataset_row is None:
        update_model_progress(model_id, 0, "failed")
        return
    try:
        append_training_log(project_id, model_id, f"Starting training for template: {project_row.get('template_id') or 'custom'}")
        append_training_log(project_id, model_id, f"Dataset source: {dataset_row.get('source_type') or 'unknown'}")
        update_model_progress(model_id, 5)
        metrics = store_model_artifact(model_id, dataset_row, project_row)
        append_training_log(project_id, model_id, f"Training finished with algorithm: {metrics['algorithm']}")
        append_training_log(project_id, model_id, f"Accuracy={metrics['accuracy']} Precision={metrics['precision']} Recall={metrics['recall']} F1={metrics['f1']}")
        now = datetime.now(timezone.utc).isoformat()
        conn = get_conn()
        conn.execute(
            """
            UPDATE ml_models
            SET status = 'completed',
                training_progress = 100,
                algorithm = ?,
                dataset_size = ?,
                feature_names = ?,
                accuracy = ?,
                precision_score = ?,
                recall_score = ?,
                f1_score = ?,
                false_positive_rate = ?,
                false_negative_rate = ?,
                trained_at = ?,
                training_device = ?,
                model_format = ?,
                class_names = ?,
                task_type = ?,
                training_epochs = ?,
                artifact_size_mb = ?,
                use_image_augmentation = ?
            WHERE id = ?
            """,
            (
                metrics["algorithm"],
                metrics["dataset_size"],
                json.dumps(metrics["feature_names"]),
                metrics["accuracy"],
                metrics["precision"],
                metrics["recall"],
                metrics["f1"],
                metrics["fpr"],
                metrics["fnr"],
                now,
                metrics["training_device"],
                metrics["model_format"],
                json.dumps(metrics["class_names"]),
                metrics["task_type"],
                metrics.get("training_epochs"),
                metrics.get("artifact_size_mb"),
                int(metrics["use_image_augmentation"]) if metrics.get("use_image_augmentation") is not None else None,
                model_id,
            ),
        )
        conn.execute("UPDATE projects SET status = 'trained', current_step = 4, updated_at = ? WHERE id = ?", (now, project_id))
        conn.commit()
        conn.close()
        append_training_log(project_id, model_id, "Training job completed successfully")
    except Exception:
        logger.exception("Training failed for model %s", model_id)
        append_training_log(project_id, model_id, "Training failed. Check dataset structure or runtime dependencies and try again.")
        conn = get_conn()
        conn.execute("UPDATE ml_models SET status = 'failed', training_progress = 0 WHERE id = ?", (model_id,))
        conn.commit()
        conn.close()


def sync_deployment_usage(conn: sqlite3.Connection, deployment_id: str) -> None:
    today = datetime.now(timezone.utc).date().isoformat()
    summary = conn.execute(
        """
        SELECT COUNT(*) AS total_requests,
               AVG(latency_ms) AS avg_latency,
               SUM(CASE WHEN substr(created_at, 1, 10) = ? THEN 1 ELSE 0 END) AS requests_today
        FROM prediction_logs
        WHERE deployment_id = ?
        """,
        (today, deployment_id),
    ).fetchone()
    conn.execute(
        "UPDATE deployments SET total_requests = ?, requests_today = ?, avg_latency = ? WHERE id = ?",
        (
            int(summary["total_requests"] or 0),
            int(summary["requests_today"] or 0),
            round(float(summary["avg_latency"] or 0.0), 2),
            deployment_id,
        ),
    )


def log_prediction(model_id: str, prediction: str, probability: dict[str, float] | None, latency_ms: float, api_key: str | None) -> None:
    if not api_key:
        return
    conn = get_conn()
    try:
        deployment = conn.execute("SELECT id FROM deployments WHERE api_key = ?", (api_key,)).fetchone()
        if deployment is None:
            return
        confidence = max(probability.values()) if probability else None
        conn.execute(
            """
            INSERT INTO prediction_logs (id, deployment_id, model_id, prediction, confidence, latency_ms, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (str(uuid.uuid4()), deployment["id"], model_id, prediction, confidence, latency_ms, datetime.now(timezone.utc).isoformat()),
        )
        sync_deployment_usage(conn, deployment["id"])
        conn.commit()
    except sqlite3.Error:
        logger.exception("Prediction logging failed for model %s", model_id)
    finally:
        conn.close()


def append_training_log(project_id: str, model_id: str, message: str) -> None:
    conn = get_conn()
    conn.execute(
        """
        INSERT INTO training_logs (id, project_id, model_id, message, created_at)
        VALUES (?, ?, ?, ?, ?)
        """,
        (str(uuid.uuid4()), project_id, model_id, message, datetime.now(timezone.utc).isoformat()),
    )
    conn.commit()
    conn.close()


def load_pytorch_model(model_path: Path):
    import torch

    checkpoint = torch.load(model_path, map_location="cpu")
    class_names = checkpoint["class_names"]
    # Inference should rebuild the same architecture without trying to fetch pretrained weights again.
    model, _ = build_image_model(
        checkpoint.get("base_model", "custom-cnn"),
        len(class_names),
        False,
    )
    model.load_state_dict(checkpoint["model_state_dict"])
    model.eval()
    return model, class_names, checkpoint["image_size"]


app = FastAPI(title="ML Model Factory API", version="2.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def startup_event():
    init_db()
    logger.info("Database initialized at %s", ACTIVE_DB_PATH)


@app.middleware("http")
async def log_requests(request: Request, call_next):
    logger.info("-> %s %s", request.method, request.url.path)
    response = await call_next(request)
    logger.info("<- %s %s -> %s", request.method, request.url.path, response.status_code)
    return response


@app.get("/")
def health():
    return {"status": "ok", "service": "ML Model Factory API"}


@app.get("/api/system/capabilities")
def get_system_capabilities():
    capabilities: dict[str, Any] = {
        "cudaAvailable": False,
        "gpuName": None,
        "torchAvailable": False,
        "availableImageBackbones": ["custom-cnn", "resnet18", "mobilenet_v3_small", "efficientnet_b0"],
        "llmProviders": ["ollama", "openai-compatible"],
    }
    try:
        import torch

        capabilities["torchAvailable"] = True
        capabilities["cudaAvailable"] = bool(torch.cuda.is_available())
        if torch.cuda.is_available():
            capabilities["gpuName"] = torch.cuda.get_device_name(0)
    except Exception as exc:
        capabilities["torchError"] = str(exc)
    return capabilities


@app.post("/api/system/llm/check")
async def check_llm_connection(req: Request):
    body = await req.json()
    provider = str(body.get("provider") or "disabled")
    base_url = str(body.get("baseUrl") or "http://localhost:11434").strip()
    model_name = str(body.get("model") or "").strip()

    if provider == "disabled":
        return {
            "provider": provider,
            "reachable": False,
            "modelAvailable": False,
            "availableModels": [],
            "message": "LLM integration is disabled.",
        }

    if provider == "ollama":
        try:
            result = check_ollama_connection(base_url, model_name)
            return {"provider": provider, "baseUrl": base_url, "model": model_name, **result}
        except urllib_error.HTTPError as exc:
            raise HTTPException(exc.code, f"Ollama returned HTTP {exc.code}") from exc
        except urllib_error.URLError as exc:
            raise HTTPException(400, f"Could not reach Ollama at {base_url}: {exc.reason}") from exc
        except TimeoutError as exc:
            raise HTTPException(400, f"Ollama did not respond in time at {base_url}") from exc
        except Exception as exc:
            raise HTTPException(400, f"LLM connection check failed: {exc}") from exc

    raise HTTPException(400, f"Unsupported LLM provider: {provider}")


@app.get("/api/projects")
def list_projects():
    conn = get_conn()
    rows = [clean_dict(serialize_row(row_to_dict(row))) for row in conn.execute("SELECT * FROM projects ORDER BY created_at DESC").fetchall()]
    conn.close()
    return rows


@app.post("/api/projects")
async def create_project(req: Request):
    body = await req.json()
    project_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    conn = get_conn()
    conn.execute(
        """
        INSERT INTO projects (id, name, description, template_id, status, current_step, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (project_id, body.get("name", "Untitled"), body.get("description"), body.get("templateId", ""), body.get("status", "draft"), body.get("currentStep", 1), now, now),
    )
    row = row_to_dict(conn.execute("SELECT * FROM projects WHERE id = ?", (project_id,)).fetchone())
    conn.commit()
    conn.close()
    return clean_dict(serialize_row(row))


@app.get("/api/projects/{project_id}")
def get_project(project_id: str):
    conn = get_conn()
    row = row_to_dict(conn.execute("SELECT * FROM projects WHERE id = ?", (project_id,)).fetchone())
    conn.close()
    if row is None:
        raise HTTPException(404, "Project not found")
    return clean_dict(serialize_row(row))


@app.patch("/api/projects/{project_id}")
async def update_project(project_id: str, req: Request):
    body = await req.json()
    field_map = {"name": "name", "description": "description", "templateId": "template_id", "status": "status", "currentStep": "current_step"}
    sets = []
    values = []
    for payload_key, db_key in field_map.items():
        if payload_key in body:
            sets.append(f"{db_key} = ?")
            values.append(body[payload_key])
    if not sets:
        raise HTTPException(400, "No valid fields provided")
    now = datetime.now(timezone.utc).isoformat()
    values.extend([now, project_id])
    conn = get_conn()
    conn.execute(f"UPDATE projects SET {', '.join(sets)}, updated_at = ? WHERE id = ?", values)
    conn.commit()
    row = row_to_dict(conn.execute("SELECT * FROM projects WHERE id = ?", (project_id,)).fetchone())
    conn.close()
    if row is None:
        raise HTTPException(404, "Project not found")
    return clean_dict(serialize_row(row))


@app.delete("/api/projects/{project_id}", status_code=204)
def delete_project(project_id: str):
    deleted = delete_project_resources(project_id)
    if not deleted:
        raise HTTPException(404, "Project not found")
    return Response(status_code=204)


@app.get("/api/projects/{project_id}/dataset")
def get_dataset(project_id: str):
    conn = get_conn()
    row = row_to_dict(conn.execute("SELECT * FROM datasets WHERE project_id = ? ORDER BY created_at DESC LIMIT 1", (project_id,)).fetchone())
    conn.close()
    return clean_dict(serialize_row(row)) if row else None


@app.post("/api/projects/{project_id}/dataset")
async def create_dataset(project_id: str, file: UploadFile | None = File(default=None), kaggle_url: str | None = Form(default=None)):
    project_exists(project_id)
    if file is None and not kaggle_url:
        raise HTTPException(400, "Upload a CSV/ZIP file or provide a Kaggle URL")
    if file is not None and kaggle_url:
        raise HTTPException(400, "Choose either a file upload or a Kaggle URL, not both")

    dataset_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    if file is not None:
        if not file.filename:
            raise HTTPException(400, "Uploaded file is missing a name")
        lower_name = file.filename.lower()
        source_type = "upload"
        source_url = None
        dataset_name = file.filename

        if lower_name.endswith(".csv"):
            target_path = UPLOADS_DIR / f"{dataset_id}.csv"
            target_path.write_bytes(await file.read())
            _, metadata = parse_csv_dataset(target_path)
            local_path = str(target_path)
        elif lower_name.endswith(".zip"):
            target_path = UPLOADS_DIR / f"{dataset_id}.zip"
            target_path.write_bytes(await file.read())
            extracted_path, metadata = extract_zip_dataset(target_path, dataset_id)
            local_path = str(extracted_path)
        else:
            raise HTTPException(400, "Only .csv and .zip files are supported for direct upload")
    else:
        target_path, metadata = download_kaggle_dataset(kaggle_url or "", dataset_id)
        dataset_name = parse_kaggle_ref(kaggle_url or "").split("/")[-1]
        source_type = "kaggle"
        source_url = kaggle_url
        local_path = str(target_path)

    conn = get_conn()
    conn.execute(
        """
        INSERT INTO datasets (
            id, project_id, name, file_count, total_size, data_type, label_count, is_validated,
            labels, created_at, source_type, source_url, local_path, task_type, metadata_json
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            dataset_id,
            project_id,
            dataset_name,
            metadata["file_count"],
            metadata["total_size"],
            metadata["data_type"],
            metadata["label_count"],
            1,
            json.dumps(metadata["labels"]),
            now,
            source_type,
            source_url,
            local_path,
            metadata["task_type"],
            json.dumps(metadata["metadata"]),
        ),
    )
    conn.execute("UPDATE projects SET current_step = CASE WHEN current_step < 2 THEN 2 ELSE current_step END, updated_at = ? WHERE id = ?", (now, project_id))
    row = row_to_dict(conn.execute("SELECT * FROM datasets WHERE id = ?", (dataset_id,)).fetchone())
    conn.commit()
    conn.close()
    return clean_dict(serialize_row(row))


@app.post("/api/projects/{project_id}/dataset/enroll")
async def enroll_prompt_dataset(
    project_id: str,
    prompt: str = Form(...),
    files: list[UploadFile] = File(...),
):
    project_exists(project_id)
    if not files:
        raise HTTPException(400, "Upload at least one image for prompt enrollment")

    label_name = extract_label_from_prompt(prompt)
    project_root = PROMPT_DATASETS_DIR / project_id
    class_dir = project_root / "train" / label_name
    class_dir.mkdir(parents=True, exist_ok=True)

    saved_files = 0
    for upload in files:
        if not upload.filename:
            continue
        suffix = Path(upload.filename).suffix.lower()
        if suffix not in IMAGE_EXTENSIONS:
            continue
        target_name = f"{uuid.uuid4().hex}{suffix}"
        target_path = class_dir / target_name
        target_path.write_bytes(await upload.read())
        saved_files += 1

    if saved_files == 0:
        raise HTTPException(400, "Only image files are supported for prompt enrollment")

    metadata = summarize_prompt_image_dataset(project_root)
    dataset_payload = upsert_prompt_dataset_record(project_id, project_root, metadata)
    return {
        **dataset_payload,
        "enrolledLabel": label_name,
        "savedFiles": saved_files,
        "message": f"Saved {saved_files} image(s) under label '{label_name}'.",
    }


@app.post("/api/projects/{project_id}/dataset/kaggle")
async def create_dataset_from_kaggle(project_id: str, payload: DatasetImportRequest):
    return await create_dataset(project_id=project_id, file=None, kaggle_url=payload.kaggleUrl)


@app.get("/api/projects/{project_id}/model")
def get_model(project_id: str):
    conn = get_conn()
    row = row_to_dict(conn.execute("SELECT * FROM ml_models WHERE project_id = ? ORDER BY created_at DESC LIMIT 1", (project_id,)).fetchone())
    conn.close()
    return clean_dict(serialize_row(enrich_model_runtime_metadata(row))) if row else None


@app.get("/api/projects/{project_id}/training-logs")
def get_training_logs(project_id: str):
    conn = get_conn()
    rows = conn.execute(
        """
        SELECT message, created_at
        FROM training_logs
        WHERE project_id = ?
        ORDER BY created_at ASC
        """,
        (project_id,),
    ).fetchall()
    conn.close()
    return [{"message": row["message"], "createdAt": row["created_at"]} for row in rows]


@app.post("/api/projects/{project_id}/train")
async def start_training(project_id: str, req: Request):
    project_exists(project_id)
    conn = get_conn()
    dataset = conn.execute("SELECT id, task_type FROM datasets WHERE project_id = ? ORDER BY created_at DESC LIMIT 1", (project_id,)).fetchone()
    if dataset is None:
        conn.close()
        raise HTTPException(400, "Upload a dataset before starting training")
    body = await req.json()
    model_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    base_model = body.get("baseModel", "resnet18")
    prefer_gpu = bool(body.get("preferGpu", False))
    use_pretrained_weights = bool(body.get("usePretrainedWeights", False))
    use_image_augmentation = bool(body.get("useImageAugmentation", True))
    try:
        training_epochs = max(1, min(int(body.get("trainingEpochs", 6) or 6), 50))
    except (TypeError, ValueError):
        training_epochs = 6
    if prefer_gpu and dataset["task_type"] != "image-classification":
        conn.close()
        raise HTTPException(400, "Always Use GPU is currently supported only for image-classification training.")
    conn.execute(
        """
        INSERT INTO ml_models (id, project_id, name, status, confidence_threshold, training_progress, created_at, base_model, prefer_gpu, use_pretrained_weights, training_epochs, use_image_augmentation)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            model_id,
            project_id,
            body.get("name", "Model"),
            "training",
            80,
            0,
            now,
            base_model,
            int(prefer_gpu),
            int(use_pretrained_weights),
            training_epochs if dataset["task_type"] == "image-classification" else None,
            int(use_image_augmentation) if dataset["task_type"] == "image-classification" else None,
        ),
    )
    conn.execute("UPDATE projects SET status = 'training', current_step = 4, updated_at = ? WHERE id = ?", (now, project_id))
    row = row_to_dict(conn.execute("SELECT * FROM ml_models WHERE id = ?", (model_id,)).fetchone())
    conn.commit()
    conn.close()
    Thread(target=run_training_job, args=(model_id, project_id), daemon=True).start()
    return clean_dict(serialize_row(row))


@app.get("/api/projects/{project_id}/deployment")
def get_deployment(project_id: str):
    conn = get_conn()
    row = row_to_dict(conn.execute("SELECT * FROM deployments WHERE project_id = ? ORDER BY created_at DESC LIMIT 1", (project_id,)).fetchone())
    conn.close()
    return clean_dict(serialize_row(row)) if row else None


@app.post("/api/projects/{project_id}/deploy")
async def deploy_model(project_id: str, req: Request):
    body = await req.json()
    model_id = body.get("modelId")
    if not model_id:
        raise HTTPException(400, "A trained model is required before deployment")
    now = datetime.now(timezone.utc).isoformat()
    deployment_id = str(uuid.uuid4())
    api_key = f"mlf_{uuid.uuid4().hex[:24]}"
    deployment_type = body.get("type", "cloud-api")
    conn = get_conn()
    model_row = conn.execute("SELECT status FROM ml_models WHERE id = ?", (model_id,)).fetchone()
    if model_row is None or model_row["status"] != "completed":
        conn.close()
        raise HTTPException(400, "Only completed models can be deployed")
    conn.execute(
        """
        INSERT INTO deployments (
            id, project_id, model_id, name, type, status, endpoint, api_key,
            requests_today, total_requests, avg_latency, deployed_at, created_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (deployment_id, project_id, model_id, body.get("name", "Deployment"), deployment_type, "active", f"http://localhost:8000/api/models/{model_id}/predict", api_key, 0, 0, 0, now, now),
    )
    conn.execute("UPDATE projects SET status = 'deployed', current_step = 6, updated_at = ? WHERE id = ?", (now, project_id))
    row = row_to_dict(conn.execute("SELECT * FROM deployments WHERE id = ?", (deployment_id,)).fetchone())
    conn.commit()
    conn.close()
    return clean_dict(serialize_row(row))


@app.get("/api/deployments")
def list_deployments():
    conn = get_conn()
    rows = []
    for row in conn.execute("SELECT * FROM deployments ORDER BY created_at DESC").fetchall():
        sync_deployment_usage(conn, row["id"])
        rows.append(clean_dict(serialize_row(row_to_dict(row))))
    conn.commit()
    conn.close()
    return rows


@app.get("/api/deployments/{deployment_id}/logs/export")
def export_deployment_logs(deployment_id: str):
    conn = get_conn()
    deployment = conn.execute("SELECT name FROM deployments WHERE id = ?", (deployment_id,)).fetchone()
    if deployment is None:
        conn.close()
        raise HTTPException(404, "Deployment not found")
    rows = conn.execute("SELECT created_at, prediction, confidence, latency_ms FROM prediction_logs WHERE deployment_id = ? ORDER BY created_at DESC", (deployment_id,)).fetchall()
    conn.close()
    buffer = io.StringIO()
    writer = csv.writer(buffer)
    writer.writerow(["timestamp", "prediction", "confidence", "latency_ms"])
    for row in rows:
        writer.writerow([row["created_at"], row["prediction"], row["confidence"], row["latency_ms"]])
    return Response(content=buffer.getvalue(), media_type="text/csv", headers={"Content-Disposition": f"attachment; filename={deployment['name']}_logs.csv"})


@app.get("/api/deployments/{deployment_id}/config")
def export_deployment_config(deployment_id: str):
    conn = get_conn()
    row = row_to_dict(conn.execute("SELECT * FROM deployments WHERE id = ?", (deployment_id,)).fetchone())
    conn.close()
    if row is None:
        raise HTTPException(404, "Deployment not found")
    return clean_dict(serialize_row(row))


@app.post("/api/models/{model_id}/predict")
async def predict(model_id: str, request: Request, authorization: str | None = Header(default=None)):
    conn = get_conn()
    model_row = row_to_dict(conn.execute("SELECT * FROM ml_models WHERE id = ?", (model_id,)).fetchone())
    conn.close()
    if model_row is None:
        raise HTTPException(404, "Model not found")

    started_at = time.perf_counter()
    task_type = model_row.get("task_type") or "tabular-classification"
    probability: dict[str, float] | None = None

    if task_type == "image-classification":
        try:
            import torch
            from PIL import Image
            from torchvision import transforms
        except Exception as exc:
            raise HTTPException(500, f"Image inference is unavailable: {exc}") from exc

        form = await request.form()
        image_file = form.get("file")
        if image_file is None:
            raise HTTPException(400, "Send an image file as multipart/form-data with the field name 'file'")
        model_path = MODELS_DIR / f"{model_id}.pt"
        if not model_path.exists():
            raise HTTPException(404, "Model file not found")
        model, class_names, image_size = load_pytorch_model(model_path)
        transform = transforms.Compose(
            [
                transforms.Resize((image_size, image_size)),
                transforms.ToTensor(),
                transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]),
            ]
        )
        image = Image.open(image_file.file).convert("RGB")
        tensor = transform(image).unsqueeze(0)
        with torch.no_grad():
            logits = model(tensor)
            probabilities = torch.softmax(logits, dim=1)[0]
            predicted_index = int(torch.argmax(probabilities).item())
        prediction = class_names[predicted_index]
        probability = {class_names[index]: round(float(value), 4) for index, value in enumerate(probabilities.tolist())}
    else:
        payload = await request.json()
        model_path = MODELS_DIR / f"{model_id}.pkl"
        if not model_path.exists():
            raise HTTPException(404, "Model file not found")
        model_data = joblib.load(model_path)
        features = payload.get("features", {})
        try:
            input_df = pd.DataFrame([features])
            encoded_prediction = model_data["pipeline"].predict(input_df)
            prediction = model_data["label_encoder"].inverse_transform(encoded_prediction)[0]
            classifier = model_data["pipeline"].named_steps["classifier"]
            if hasattr(classifier, "predict_proba"):
                raw_probabilities = model_data["pipeline"].predict_proba(input_df)[0]
                probability = {
                    model_data["label_encoder"].inverse_transform([index])[0]: round(float(value), 4)
                    for index, value in enumerate(raw_probabilities)
                }
        except Exception as exc:
            raise HTTPException(400, f"Prediction failed: {exc}") from exc

    latency_ms = round((time.perf_counter() - started_at) * 1000, 2)
    api_key = authorization.replace("Bearer ", "").strip() if authorization else None
    log_prediction(model_id, prediction, probability, latency_ms, api_key)
    return {"prediction": prediction, "probability": probability, "latency_ms": latency_ms}
