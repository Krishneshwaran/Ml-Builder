# ML Builder

ML Builder is a local no-code AutoML app with a React frontend and a FastAPI backend. It lets you create projects, upload datasets, train models, test predictions, and generate deployment details from a browser UI.

## What It Does

- Create and manage ML projects from a dashboard
- Upload tabular CSV datasets
- Import image datasets from Kaggle
- Train tabular models with scikit-learn
- Train image classification models with PyTorch
- Review metrics, logs, and deployment information
- Run live predictions from the UI

## Tech Stack

- Frontend: React, TypeScript, Vite, Tailwind CSS, Wouter, TanStack Query
- Backend: FastAPI, SQLite
- ML: scikit-learn, pandas, NumPy, PyTorch, torchvision
- Data tooling: Prisma schema for a PostgreSQL/Supabase setup in `client/prisma`

## Project Structure

```text
Ml-Builder-main/
|-- backend/
|   |-- main.py               # Main FastAPI app
|   |-- app_v2.py             # Alternate/expanded backend version
|   |-- requirements.txt      # Python dependencies
|   |-- .env.example          # Kaggle environment variable example
|   |-- storage/
|   |   |-- datasets/         # Uploaded datasets
|   |   `-- models/           # Saved trained models
|   `-- mlforge.db            # Local SQLite database
|-- client/
|   |-- prisma/schema.prisma  # Prisma models for PostgreSQL/Supabase
|   `-- src/
|       |-- pages/            # App screens
|       |-- components/       # UI and workflow components
|       `-- lib/              # Query client and local settings
|-- server/                   # Server-side TypeScript helpers
|-- shared/schema.ts          # Shared app types/templates
`-- package.json              # Frontend scripts
```

## Main Screens

- `/` dashboard
- `/projects` all projects
- `/projects/new` create project
- `/project/:id` dataset, training, deployment workflow
- `/project/:id/run` live model testing
- `/settings` local app settings
- `/help` usage guidance

## Local Setup

### Prerequisites

- Node.js 18+
- Python 3.10+
- `pip`

### 1. Install JavaScript dependencies

From the repo root:

```bash
npm install
```

### 2. Install Python dependencies

```bash
cd backend
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
```

### 3. Optional environment configuration

If you want Kaggle dataset import, create `backend/.env` from `backend/.env.example`:

```env
KAGGLE_USERNAME=your_kaggle_username
KAGGLE_KEY=your_kaggle_api_key
```

Notes:

- The current FastAPI backend stores app data locally in SQLite at `backend/mlforge.db`
- Uploaded files and trained models are stored under `backend/storage/`
- `client/.env` and `client/prisma/schema.prisma` are only needed if you plan to use the Prisma/PostgreSQL setup separately

## Run The App

Start the backend:

```bash
cd backend
venv\Scripts\activate
python -m uvicorn main:app --reload --port 8000
```

Start the frontend in a second terminal:

```bash
cd d:\Ml-Builder-main
npm run dev
```

Open:

- Frontend: `http://localhost:5173`
- Backend API: `http://localhost:8000`

## Available Scripts

From the repo root:

```bash
npm run dev
npm run build
npm run check
npm run prisma:push
npm run prisma:generate
```

## Backend API Overview

Core endpoints exposed by `backend/main.py`:

- `GET /api/projects`
- `POST /api/projects`
- `GET /api/projects/{project_id}`
- `PATCH /api/projects/{project_id}`
- `GET /api/projects/{project_id}/dataset`
- `POST /api/projects/{project_id}/dataset`
- `GET /api/projects/{project_id}/model`
- `POST /api/projects/{project_id}/train`
- `GET /api/projects/{project_id}/deployment`
- `POST /api/projects/{project_id}/deploy`
- `GET /api/deployments`
- `POST /api/models/{model_id}/predict`

Additional functionality in `backend/app_v2.py` includes:

- training log endpoints
- Kaggle dataset import
- dataset enrollment helpers
- deployment config export
- system capability and LLM connectivity checks

## Training Modes

### Tabular classification

- CSV upload
- automatic feature preprocessing
- scikit-learn pipelines
- metrics such as accuracy, precision, recall, and F1

### Image classification

- Kaggle image dataset import
- PyTorch CNN training
- optional GPU usage when CUDA is available
- configurable base model and training settings from the UI

## Notes

- The root app currently talks directly to backend API routes such as `/api/projects/...`
- Local UI settings are stored in browser storage
- The existing Prisma schema appears to reflect an alternate database-backed architecture and is not required for the default local SQLite workflow

## License

MIT

