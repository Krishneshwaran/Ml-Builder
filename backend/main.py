"""
ML Model Factory – FastAPI Backend
Serves the original frontend's API endpoints using SQLite (local storage).
Includes REAL ML training per template using scikit-learn.

Run: cd backend && python -m uvicorn main:app --reload --port 8000
"""

from __future__ import annotations

import json
import logging
import os
import uuid
import time
import random
import math
import sqlite3
from datetime import datetime, timezone
from threading import Thread

import joblib
import numpy as np
import pandas as pd
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Request, BackgroundTasks, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import RandomForestClassifier, GradientBoostingClassifier
from sklearn.impute import SimpleImputer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (
    accuracy_score,
    precision_score,
    recall_score,
    f1_score,
)
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler, OneHotEncoder, LabelEncoder

load_dotenv()

# ── Logging ──────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(name)s] %(message)s",
    datefmt="%I:%M:%S %p",
)
logger = logging.getLogger("AutoML")

# ── App ──────────────────────────────────────────────────────────────────
app = FastAPI(title="ML Model Factory API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Storage ──────────────────────────────────────────────────────────────
# Create storage directories
MODELS_DIR = os.path.join(os.path.dirname(__file__), "storage", "models")
DATASETS_DIR = os.path.join(os.path.dirname(__file__), "storage", "datasets")
os.makedirs(MODELS_DIR, exist_ok=True)
os.makedirs(DATASETS_DIR, exist_ok=True)

# ── Database (SQLite) ────────────────────────────────────────────────────
DB_PATH = os.path.join(os.path.dirname(__file__), "mlforge.db")


def get_conn():
    """Get SQLite connection with row factory for dict-like access."""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    """Initialize SQLite database with required tables."""
    conn = get_conn()
    cursor = conn.cursor()

    # Projects table
    cursor.execute("""
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
    """)

    # Datasets table
    cursor.execute("""
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
            FOREIGN KEY (project_id) REFERENCES projects(id)
        )
    """)

    # ML Models table
    cursor.execute("""
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
            FOREIGN KEY (project_id) REFERENCES projects(id)
        )
    """)

    # Deployments table
    cursor.execute("""
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
    """)

    conn.commit()
    conn.close()


def row_to_dict(cursor, row):
    """Convert SQLite row to dictionary."""
    if row is None:
        return None
    return dict(row)


def serialize_row(row: dict) -> dict:
    """Convert DB row to camelCase JSON for the frontend."""
    if row is None:
        return None
    result = {}
    for key, value in row.items():
        if isinstance(value, datetime):
            result[key] = value.isoformat()
        else:
            result[key] = value

    return {
        "id": result.get("id"),
        "name": result.get("name"),
        "description": result.get("description"),
        "templateId": result.get("template_id"),
        "status": result.get("status"),
        "currentStep": result.get("current_step"),
        "createdAt": result.get("created_at"),
        "updatedAt": result.get("updated_at"),
        "projectId": result.get("project_id"),
        "fileCount": result.get("file_count"),
        "totalSize": result.get("total_size"),
        "dataType": result.get("data_type"),
        "labelCount": result.get("label_count"),
        "isValidated": result.get("is_validated"),
        "labels": result.get("labels"),
        "accuracy": result.get("accuracy"),
        "precisionScore": result.get("precision_score"),
        "recallScore": result.get("recall_score"),
        "f1Score": result.get("f1_score"),
        "confidenceThreshold": result.get("confidence_threshold"),
        "falsePositiveRate": result.get("false_positive_rate"),
        "falseNegativeRate": result.get("false_negative_rate"),
        "trainingProgress": result.get("training_progress"),
        "trainedAt": result.get("trained_at"),
        "algorithm": result.get("algorithm"),
        "datasetSize": result.get("dataset_size"),
        "featureNames": result.get("feature_names"),
        "modelId": result.get("model_id"),
        "type": result.get("type"),
        "endpoint": result.get("endpoint"),
        "apiKey": result.get("api_key"),
        "requestsToday": result.get("requests_today"),
        "totalRequests": result.get("total_requests"),
        "avgLatency": result.get("avg_latency"),
        "deployedAt": result.get("deployed_at"),
    }


def clean_dict(d: dict) -> dict:
    return {k: v for k, v in d.items() if v is not None}


# ═══════════════════════════════════════════════════════════════════════
# REAL ML TRAINING — Template-specific dataset generators and trainers
# ═══════════════════════════════════════════════════════════════════════

def generate_dataset_for_template(template_id: str, labels: list[str], n_samples: int = 500):
    """Generate a realistic sample dataset tailored to the chosen template."""
    np.random.seed(42)

    if template_id == "access-control":
        # Face features: embedding similarity, face width, face height, brightness, blur
        data = {
            "face_embedding_similarity": np.random.uniform(0.3, 0.99, n_samples),
            "face_width": np.random.randint(40, 200, n_samples),
            "face_height": np.random.randint(50, 220, n_samples),
            "brightness": np.random.uniform(0.2, 1.0, n_samples),
            "blur_score": np.random.uniform(0.0, 1.0, n_samples),
            "eye_open_ratio": np.random.uniform(0.1, 1.0, n_samples),
            "head_pose_yaw": np.random.uniform(-30, 30, n_samples),
            "head_pose_pitch": np.random.uniform(-20, 20, n_samples),
        }
        # Label: authorized (high similarity, good quality) vs unauthorized
        threshold = 0.65
        y = np.where(
            (data["face_embedding_similarity"] > threshold)
            & (data["blur_score"] < 0.6)
            & (data["brightness"] > 0.4),
            "authorized",
            "unauthorized",
        )
        # Add some noise
        noise_idx = np.random.choice(n_samples, size=int(n_samples * 0.05), replace=False)
        y[noise_idx] = np.where(y[noise_idx] == "authorized", "unauthorized", "authorized")

    elif template_id == "exam-proctoring":
        data = {
            "gaze_deviation_x": np.random.uniform(-1.0, 1.0, n_samples),
            "gaze_deviation_y": np.random.uniform(-0.5, 0.5, n_samples),
            "head_movement_speed": np.random.exponential(2.0, n_samples),
            "face_visible_ratio": np.random.uniform(0.0, 1.0, n_samples),
            "audio_volume_db": np.random.uniform(20, 80, n_samples),
            "person_count": np.random.choice([0, 1, 2, 3], n_samples, p=[0.02, 0.85, 0.10, 0.03]),
            "tab_switch_count": np.random.poisson(1.5, n_samples),
            "mouse_idle_seconds": np.random.exponential(5, n_samples),
        }
        suspicious = (
            (np.abs(data["gaze_deviation_x"]) > 0.5)
            | (data["head_movement_speed"] > 5)
            | (data["face_visible_ratio"] < 0.4)
            | (data["person_count"] > 1)
            | (data["tab_switch_count"] > 3)
        )
        y = np.where(suspicious, "suspicious", "normal")

    elif template_id == "waste-sorting":
        data = {
            "color_r_mean": np.random.randint(0, 255, n_samples),
            "color_g_mean": np.random.randint(0, 255, n_samples),
            "color_b_mean": np.random.randint(0, 255, n_samples),
            "texture_entropy": np.random.uniform(1.0, 8.0, n_samples),
            "object_area": np.random.randint(100, 10000, n_samples),
            "aspect_ratio": np.random.uniform(0.3, 3.0, n_samples),
            "edge_density": np.random.uniform(0.0, 1.0, n_samples),
            "reflectivity": np.random.uniform(0.0, 1.0, n_samples),
        }
        waste_labels = labels if labels else ["plastic", "paper", "metal", "organic", "glass"]
        y = np.random.choice(waste_labels, n_samples)
        # Make it somewhat learnable by biasing features
        for i, label in enumerate(waste_labels):
            mask = y == label
            if label == "metal":
                data["reflectivity"][mask] = np.random.uniform(0.6, 1.0, mask.sum())
            elif label == "paper":
                data["texture_entropy"][mask] = np.random.uniform(4.0, 7.0, mask.sum())
            elif label == "plastic":
                data["color_r_mean"][mask] = np.random.randint(100, 255, mask.sum())
            elif label == "glass":
                data["reflectivity"][mask] = np.random.uniform(0.5, 0.9, mask.sum())
                data["texture_entropy"][mask] = np.random.uniform(1.0, 3.0, mask.sum())

    elif template_id == "retail-analytics":
        data = {
            "dwell_time_seconds": np.random.exponential(30, n_samples),
            "visit_frequency": np.random.poisson(3, n_samples),
            "path_length_meters": np.random.uniform(5, 100, n_samples),
            "items_touched": np.random.poisson(4, n_samples),
            "time_of_day_hour": np.random.randint(8, 22, n_samples),
            "day_of_week": np.random.randint(0, 7, n_samples),
            "store_section_count": np.random.randint(1, 8, n_samples),
            "near_checkout_time": np.random.uniform(0, 300, n_samples),
        }
        purchase_prob = (
            0.1
            + 0.3 * (data["dwell_time_seconds"] > 60).astype(float)
            + 0.2 * (data["items_touched"] > 3).astype(float)
            + 0.15 * (data["store_section_count"] > 3).astype(float)
        )
        y = np.where(np.random.uniform(0, 1, n_samples) < purchase_prob, "purchase", "browse")

    elif template_id == "document-processing":
        data = {
            "word_count": np.random.randint(50, 5000, n_samples),
            "has_header": np.random.choice([0, 1], n_samples),
            "has_table": np.random.choice([0, 1], n_samples, p=[0.7, 0.3]),
            "has_signature": np.random.choice([0, 1], n_samples, p=[0.6, 0.4]),
            "image_count": np.random.poisson(2, n_samples),
            "font_size_avg": np.random.uniform(8, 16, n_samples),
            "line_spacing": np.random.uniform(1.0, 2.5, n_samples),
            "numeric_ratio": np.random.uniform(0.0, 0.5, n_samples),
        }
        doc_labels = labels if labels else ["invoice", "contract", "report", "letter", "form"]
        y = np.random.choice(doc_labels, n_samples)
        for label in doc_labels:
            mask = y == label
            if label == "invoice":
                data["has_table"][mask] = np.random.choice([0, 1], mask.sum(), p=[0.2, 0.8])
                data["numeric_ratio"][mask] = np.random.uniform(0.2, 0.5, mask.sum())
            elif label == "contract":
                data["word_count"][mask] = np.random.randint(1000, 5000, mask.sum())
                data["has_signature"][mask] = np.random.choice([0, 1], mask.sum(), p=[0.1, 0.9])
            elif label == "letter":
                data["word_count"][mask] = np.random.randint(100, 800, mask.sum())

    elif template_id == "crowd-monitoring":
        data = {
            "person_count": np.random.poisson(25, n_samples),
            "avg_speed": np.random.uniform(0.1, 5.0, n_samples),
            "density_per_sqm": np.random.uniform(0.1, 6.0, n_samples),
            "flow_direction_variance": np.random.uniform(0.0, math.pi, n_samples),
            "time_of_day": np.random.randint(0, 24, n_samples),
            "temperature_c": np.random.uniform(15, 40, n_samples),
            "is_weekend": np.random.choice([0, 1], n_samples),
            "event_nearby": np.random.choice([0, 1], n_samples, p=[0.85, 0.15]),
        }
        alert = (
            (data["density_per_sqm"] > 3.5)
            | ((data["person_count"] > 50) & (data["avg_speed"] < 0.5))
            | (data["flow_direction_variance"] > 2.5)
        )
        y = np.where(alert, "alert", "normal")
    else:
        # Generic classification dataset
        data = {
            f"feature_{i}": np.random.randn(n_samples) for i in range(8)
        }
        y = np.random.choice(labels if labels else ["class_a", "class_b"], n_samples)

    df = pd.DataFrame(data)
    df["label"] = y
    return df


def train_model_for_template(template_id: str, df: pd.DataFrame):
    """Train a REAL scikit-learn model on the provided dataset."""
    
    # Assume the last column is the target label for the MVP
    target_col = df.columns[-1]
    
    X = df.drop(columns=[target_col])
    y = df[target_col]

    # Encode labels
    le = LabelEncoder()
    y_encoded = le.fit_transform(y)

    # Split
    X_train, X_test, y_train, y_test = train_test_split(
        X, y_encoded, test_size=0.2, random_state=42, stratify=y_encoded
    )

    # Preprocessing
    numeric_cols = X.select_dtypes(include=["number"]).columns.tolist()
    transformers = []
    if numeric_cols:
        transformers.append(("num", Pipeline([
            ("imputer", SimpleImputer(strategy="median")),
            ("scaler", StandardScaler()),
        ]), numeric_cols))

    preprocessor = ColumnTransformer(transformers=transformers, remainder="drop")

    # Choose model based on template complexity
    if template_id in ["access-control", "exam-proctoring"]:
        classifier = GradientBoostingClassifier(
            n_estimators=100, max_depth=5, random_state=42
        )
    elif template_id in ["waste-sorting", "document-processing"]:
        classifier = RandomForestClassifier(
            n_estimators=150, max_depth=10, random_state=42
        )
    else:
        classifier = RandomForestClassifier(
            n_estimators=100, max_depth=8, random_state=42
        )

    # Build pipeline
    pipeline = Pipeline([
        ("preprocessor", preprocessor),
        ("classifier", classifier),
    ])

    pipeline.fit(X_train, y_train)
    y_pred = pipeline.predict(X_test)

    # Calculate real metrics
    n_classes = len(le.classes_)
    avg = "binary" if n_classes == 2 else "weighted"

    acc = round(accuracy_score(y_test, y_pred) * 100)
    prec = round(precision_score(y_test, y_pred, average=avg, zero_division=0) * 100)
    rec = round(recall_score(y_test, y_pred, average=avg, zero_division=0) * 100)
    f1 = round(f1_score(y_test, y_pred, average=avg, zero_division=0) * 100)
    fpr = max(0, 100 - prec)
    fnr = max(0, 100 - rec)

    return pipeline, le, {
        "accuracy": acc,
        "precision": prec,
        "recall": rec,
        "f1": f1,
        "fpr": fpr,
        "fnr": fnr,
        "algorithm": type(classifier).__name__,
        "feature_names": X.columns.tolist(),
    }


# ═══════════════════════════════════════════════════════════════════════
# BACKGROUND TRAINING RUNNER
# ═══════════════════════════════════════════════════════════════════════

def run_real_training(model_id: str, project_id: str, template_id: str, labels: list[str]):
    """Run actual model training in a background thread."""
    conn = None
    try:
        conn = get_conn()
        cur = conn.cursor()

        # Mark as training
        cur.execute(
            "UPDATE ml_models SET status = 'training', training_progress = 0 WHERE id = ?",
            (model_id,),
        )
        conn.commit()
        logger.info("Model %s: training started (template=%s)", model_id, template_id)

        # Stage 1: Data generation (0-20%)
        for p in range(0, 21, 5):
            cur.execute("UPDATE ml_models SET training_progress = ? WHERE id = ?", (p, model_id))
            conn.commit()
            time.sleep(1.0)

        logger.info("Model %s: loading dataset for project %s...", model_id, project_id)

        # Get the dataset from DB
        cur.execute("SELECT id FROM datasets WHERE project_id = ? ORDER BY created_at DESC LIMIT 1", (project_id,))
        ds_row = cur.fetchone()

        if not ds_row:
            raise Exception("No dataset found for this project")

        dataset_id = ds_row[0]
        dataset_path = os.path.join(DATASETS_DIR, f"{dataset_id}.csv")

        if not os.path.exists(dataset_path):
             raise Exception(f"Physical dataset file not found at {dataset_path}")

        df = pd.read_csv(dataset_path)
        logger.info("Model %s: dataset loaded (%d rows × %d cols)", model_id, len(df), len(df.columns))

        # Stage 2: Preprocessing (20-40%)
        for p in range(25, 41, 5):
            cur.execute("UPDATE ml_models SET training_progress = ? WHERE id = ?", (p, model_id))
            conn.commit()
            time.sleep(1.5)

        # Stage 3: Training (40-80%)
        for p in range(45, 61, 2):
            cur.execute("UPDATE ml_models SET training_progress = ? WHERE id = ?", (p, model_id))
            conn.commit()
            time.sleep(1.2)

        logger.info("Model %s: training model...", model_id)
        pipeline, label_encoder, metrics = train_model_for_template(template_id, df)

        for p in range(65, 81, 2):
            cur.execute("UPDATE ml_models SET training_progress = ? WHERE id = ?", (p, model_id))
            conn.commit()
            time.sleep(0.8)

        logger.info("Model %s: metrics → %s", model_id, metrics)

        # Stage 4: Saving model (80-95%)
        for p in range(85, 96, 5):
            cur.execute("UPDATE ml_models SET training_progress = ? WHERE id = ?", (p, model_id))
            conn.commit()
            time.sleep(1.0)

        model_path = os.path.join(MODELS_DIR, f"{model_id}.pkl")
        joblib.dump({"pipeline": pipeline, "label_encoder": label_encoder, "template_id": template_id}, model_path)
        logger.info("Model %s: saved to %s", model_id, model_path)

        # Stage 5: Complete (100%)
        feature_names = metrics.get("feature_names", [])
        algorithm_name = metrics.get("algorithm", "Unknown")
        now = datetime.now(timezone.utc).isoformat()
        cur.execute(
            """
            UPDATE ml_models SET
                status = 'completed',
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
                trained_at = ?
            WHERE id = ?
            """,
            (
                algorithm_name,
                len(df),
                json.dumps(feature_names),
                metrics["accuracy"],
                metrics["precision"],
                metrics["recall"],
                metrics["f1"],
                metrics["fpr"],
                metrics["fnr"],
                now,
                model_id,
            ),
        )
        conn.commit()
        logger.info("Model %s: COMPLETE ✓ (algorithm=%s, dataset=%d rows, features=%s)", model_id, algorithm_name, len(df), feature_names)

    except Exception as exc:
        logger.error("Model %s: FAILED — %s", model_id, exc, exc_info=True)
        if conn:
            try:
                conn.rollback()
                cur = conn.cursor()
                cur.execute(
                    "UPDATE ml_models SET status = 'failed', training_progress = 0 WHERE id = ?",
                    (model_id,),
                )
                conn.commit()
            except Exception:
                pass
    finally:
        if conn:
            conn.close()


# ═══════════════════════════════════════════════════════════════════════
# API ROUTES
# ═══════════════════════════════════════════════════════════════════════

@app.get("/")
def health():
    return {"status": "ok", "service": "ML Model Factory API"}


@app.on_event("startup")
async def startup_event():
    """Initialize database on startup."""
    init_db()
    logger.info("Database initialized at %s", DB_PATH)


# ── PROJECTS ──────────────────────────────────────────────────────────

@app.get("/api/projects")
def list_projects():
    conn = get_conn()
    cur = conn.cursor()
    cur.execute("SELECT * FROM projects ORDER BY created_at DESC")
    rows = [row_to_dict(cur, row) for row in cur.fetchall()]
    conn.close()
    return [clean_dict(serialize_row(r)) for r in rows]


@app.post("/api/projects")
async def create_project(req: Request):
    body = await req.json()
    pid = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()

    conn = get_conn()
    cur = conn.cursor()
    cur.execute(
        """INSERT INTO projects (id, name, description, template_id, status, current_step, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
        (pid, body.get("name", "Untitled"), body.get("description"),
         body.get("templateId", ""), body.get("status", "draft"),
         body.get("currentStep", 1), now, now),
    )
    conn.commit()
    cur.execute("SELECT * FROM projects WHERE id = ?", (pid,))
    row = row_to_dict(cur, cur.fetchone())
    conn.close()
    return clean_dict(serialize_row(row))


@app.get("/api/projects/{pid}")
def get_project(pid: str):
    conn = get_conn()
    cur = conn.cursor()
    cur.execute("SELECT * FROM projects WHERE id = ?", (pid,))
    row = row_to_dict(cur, cur.fetchone())
    conn.close()
    if not row:
        raise HTTPException(404, "Project not found")
    return clean_dict(serialize_row(row))


@app.patch("/api/projects/{pid}")
async def update_project(pid: str, req: Request):
    body = await req.json()
    now = datetime.now(timezone.utc).isoformat()
    field_map = {"name": "name", "description": "description", "templateId": "template_id",
                 "status": "status", "currentStep": "current_step"}

    sets, vals = [], []
    for js, db in field_map.items():
        if js in body:
            sets.append(f"{db} = ?")
            vals.append(body[js])
    vals.append(pid)

    conn = get_conn()
    cur = conn.cursor()
    cur.execute(f"UPDATE projects SET {', '.join(sets)}, updated_at = ? WHERE id = ?", vals + [now])
    conn.commit()
    cur.execute("SELECT * FROM projects WHERE id = ?", (pid,))
    row = row_to_dict(cur, cur.fetchone())
    conn.close()
    if not row:
        raise HTTPException(404, "Project not found")
    return clean_dict(serialize_row(row))


# ── DATASETS ─────────────────────────────────────────────────────────

@app.get("/api/projects/{pid}/dataset")
def get_dataset(pid: str):
    conn = get_conn()
    cur = conn.cursor()
    cur.execute("SELECT * FROM datasets WHERE project_id = ? ORDER BY created_at DESC LIMIT 1", (pid,))
    row = row_to_dict(cur, cur.fetchone())
    conn.close()
    if not row:
        return None
    return clean_dict(serialize_row(row))


@app.post("/api/projects/{pid}/dataset")
async def create_dataset(pid: str, file: UploadFile = File(...)):
    if not file.filename.endswith(".csv"):
        raise HTTPException(400, "Only CSV files are supported")

    did = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()

    # Save file physically
    file_path = os.path.join(DATASETS_DIR, f"{did}.csv")
    content = await file.read()
    with open(file_path, "wb") as f:
        f.write(content)

    # Extract headers (first line) as features
    decoded_lines = content.decode('utf-8').split('\n')
    headers = [col.strip() for col in decoded_lines[0].split(',')] if decoded_lines else []
    labels = headers[-1:] if headers else [] # Assume last column is target for MVP

    file_size_bytes = len(content)

    conn = get_conn()
    cur = conn.cursor()
    cur.execute(
        """INSERT INTO datasets (id, project_id, name, file_count, total_size, data_type, label_count, is_validated, labels, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        (did, pid, file.filename, 1, file_size_bytes, "csv", len(labels), 1, json.dumps(labels), now),
    )
    conn.commit()
    cur.execute("SELECT * FROM datasets WHERE id = ?", (did,))
    row = row_to_dict(cur, cur.fetchone())
    conn.close()
    return clean_dict(serialize_row(row))


# ── MODELS / TRAINING ────────────────────────────────────────────────

@app.get("/api/projects/{pid}/model")
def get_model(pid: str):
    conn = get_conn()
    cur = conn.cursor()
    cur.execute("SELECT * FROM ml_models WHERE project_id = ? ORDER BY created_at DESC LIMIT 1", (pid,))
    row = row_to_dict(cur, cur.fetchone())
    conn.close()
    if not row:
        return None
    return clean_dict(serialize_row(row))


@app.post("/api/projects/{pid}/train")
async def start_training(pid: str, req: Request):
    body = await req.json()
    mid = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()

    conn = get_conn()
    cur = conn.cursor()

    # Get project to find template and dataset labels
    cur.execute("SELECT template_id FROM projects WHERE id = ?", (pid,))
    project_row = cur.fetchone()
    template_id = project_row[0] if project_row else "generic"

    # Get labels from dataset
    cur.execute("SELECT labels FROM datasets WHERE project_id = ? ORDER BY created_at DESC LIMIT 1", (pid,))
    ds_row = cur.fetchone()
    labels = []
    if ds_row and ds_row[0]:
        raw = ds_row[0]
        if isinstance(raw, str):
            labels = json.loads(raw)
        elif isinstance(raw, list):
            labels = raw

    cur.execute(
        """INSERT INTO ml_models (id, project_id, name, status, confidence_threshold, training_progress, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)""",
        (mid, pid, body.get("name", "Model"), "training", 80, 0, now),
    )
    conn.commit()
    cur.execute("SELECT * FROM ml_models WHERE id = ?", (mid,))
    row = row_to_dict(cur, cur.fetchone())
    conn.close()

    # Start REAL training in background
    thread = Thread(target=run_real_training, args=(mid, pid, template_id, labels), daemon=True)
    thread.start()

    return clean_dict(serialize_row(row))


# ── DEPLOYMENTS ──────────────────────────────────────────────────────

@app.get("/api/projects/{pid}/deployment")
def get_deployment(pid: str):
    conn = get_conn()
    cur = conn.cursor()
    cur.execute("SELECT * FROM deployments WHERE project_id = ? ORDER BY created_at DESC LIMIT 1", (pid,))
    row = row_to_dict(cur, cur.fetchone())
    conn.close()
    if not row:
        return None
    return clean_dict(serialize_row(row))


@app.post("/api/projects/{pid}/deploy")
async def deploy_model(pid: str, req: Request):
    body = await req.json()
    dep_id = str(uuid.uuid4())
    api_key = f"mlf_{uuid.uuid4().hex[:24]}"
    now = datetime.now(timezone.utc).isoformat()

    conn = get_conn()
    cur = conn.cursor()
    cur.execute(
        """INSERT INTO deployments (id, project_id, model_id, name, type, status, endpoint, api_key, requests_today, total_requests, avg_latency, deployed_at, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        (dep_id, pid, body.get("modelId", ""), body.get("name", "Deployment"),
         body.get("type", "cloud-api"), "active",
         f"http://localhost:8000/api/models/{body.get('modelId', '')}/predict",
         api_key, 0, 0, random.randint(30, 80), now, now),
    )
    conn.commit()
    cur.execute("SELECT * FROM deployments WHERE id = ?", (dep_id,))
    row = row_to_dict(cur, cur.fetchone())
    conn.close()
    return clean_dict(serialize_row(row))


@app.get("/api/deployments")
def list_deployments():
    conn = get_conn()
    cur = conn.cursor()
    cur.execute("SELECT * FROM deployments ORDER BY created_at DESC")
    rows = [row_to_dict(cur, row) for row in cur.fetchall()]
    conn.close()
    return [clean_dict(serialize_row(r)) for r in rows]


# ── PREDICTION (using the real saved model) ──────────────────────────

@app.post("/api/models/{mid}/predict")
async def predict(mid: str, req: Request):
    body = await req.json()
    model_path = os.path.join(MODELS_DIR, f"{mid}.pkl")

    if not os.path.isfile(model_path):
        raise HTTPException(404, "Model file not found")

    model_data = joblib.load(model_path)
    pipeline = model_data["pipeline"]
    label_encoder = model_data["label_encoder"]

    features = body.get("features", {})
    try:
        input_df = pd.DataFrame([features])
        prediction_encoded = pipeline.predict(input_df)
        prediction = label_encoder.inverse_transform(prediction_encoded)[0]

        probability = None
        if hasattr(pipeline.named_steps["classifier"], "predict_proba"):
            proba = pipeline.predict_proba(input_df)[0]
            probability = {label_encoder.inverse_transform([i])[0]: round(float(p), 4) for i, p in enumerate(proba)}

        return {"prediction": prediction, "probability": probability}
    except Exception as exc:
        raise HTTPException(400, f"Prediction failed: {exc}")


# ── Logging middleware ──────────────────────────────────────────────

@app.middleware("http")
async def log_requests(request: Request, call_next):
    logger.info("→ %s %s", request.method, request.url.path)
    try:
        response = await call_next(request)
        logger.info("← %s %s → %d", request.method, request.url.path, response.status_code)
        return response
    except Exception as exc:
        logger.error("← %s %s → ERROR: %s", request.method, request.url.path, exc)
        raise

try:
    from app_v2 import app
except ImportError:
    from backend.app_v2 import app
