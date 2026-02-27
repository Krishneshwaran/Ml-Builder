# MLForge – No-Code Machine Learning Platform

A web-based no-code Machine Learning Model Builder that lets you design, train, deploy, and integrate production-ready ML models without writing code.

![Tech Stack](https://img.shields.io/badge/Frontend-React%20%2B%20Vite-blue) ![Tech Stack](https://img.shields.io/badge/Backend-Python%20FastAPI-green) ![License](https://img.shields.io/badge/License-MIT-yellow)

---

## Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Prerequisites](#prerequisites)
- [Installation & Setup](#installation--setup)
- [Running the Project](#running-the-project)
- [API Endpoints](#api-endpoints)
- [Usage Guide](#usage-guide)

---

## Features

- **Template-Based Projects** – Start with pre-built ML pipeline templates (Access Control, Exam Proctoring, Waste Sorting, Retail Analytics, Document Processing, Crowd Monitoring)
- **Guided Workflow** – 6-step process: Select Template → Upload Data → Label Data → Train Model → Evaluate → Deploy
- **Simulated Training** – Real-time training progress updates with accuracy/precision/recall/F1 metrics
- **One-Click Deployment** – Deploy models as Cloud APIs or Edge Devices with auto-generated API keys
- **Integration Code Snippets** – Ready-to-use code samples for calling your deployed model
- **Dashboard & Analytics** – Track projects, deployments, request counts, and latency

---

## Tech Stack

| Layer    | Technology                                              |
| -------- | ------------------------------------------------------- |
| Frontend | React 18, TypeScript, Vite, TailwindCSS, Shadcn/UI     |
| Backend  | Python 3.10+, FastAPI, Uvicorn, Pydantic                |
| State    | TanStack React Query (frontend), In-memory store (backend) |
| Routing  | Wouter (frontend)                                       |

---

## Project Structure

```
Auto-ML-Builder/
├── client/                  # React frontend
│   ├── index.html
│   ├── public/
│   └── src/
│       ├── components/      # UI components (sidebar, cards, upload zone, etc.)
│       ├── hooks/           # Custom React hooks
│       ├── lib/             # Query client, utilities
│       └── pages/           # Page components (dashboard, projects, settings, etc.)
├── backend/                 # Python FastAPI backend
│   ├── main.py              # App entry point (CORS, middleware, logging)
│   ├── routes.py            # All API route handlers
│   ├── models.py            # Pydantic data models
│   ├── storage.py           # In-memory storage with seed data
│   └── requirements.txt     # Python dependencies
├── shared/                  # Shared TypeScript schema (reference)
│   └── schema.ts
├── package.json             # Node.js dependencies for frontend
├── vite.config.ts           # Vite config with API proxy to backend
├── tailwind.config.ts
└── tsconfig.json
```

---

## Prerequisites

Make sure you have the following installed:

- **Node.js** ≥ 18 — [Download](https://nodejs.org/)
- **Python** ≥ 3.10 — [Download](https://www.python.org/downloads/)
- **npm** (comes with Node.js)

Verify installations:

```bash
node --version    # Should print v18.x or higher
python3 --version # Should print 3.10.x or higher
npm --version     # Should print 9.x or higher
```

---

## Installation & Setup

### 1. Clone the repository

```bash
git clone https://github.com/your-username/Auto-ML-Builder.git
cd Auto-ML-Builder
```

### 2. Install frontend dependencies

```bash
npm install
```

### 3. Install backend dependencies

```bash
cd backend
pip install -r requirements.txt
cd ..
```

> **Tip:** Use a virtual environment for Python:
> ```bash
> cd backend
> python3 -m venv venv
> source venv/bin/activate   # macOS/Linux
> # venv\Scripts\activate    # Windows
> pip install -r requirements.txt
> cd ..
> ```

---

## Running the Project

You need **two terminals** — one for the backend, one for the frontend.

### Terminal 1 — Start the Backend (FastAPI)

```bash
cd backend
python3 -m uvicorn main:app --reload --port 8000
```

You should see:

```
INFO:     Uvicorn running on http://0.0.0.0:8000
INFO:     Started reloader process
```

- API is now live at **http://localhost:8000**
- Interactive API docs at **http://localhost:8000/docs**
- ReDoc at **http://localhost:8000/redoc**

### Terminal 2 — Start the Frontend (Vite)

```bash
npx vite --port 5173
```

You should see:

```
VITE ready in 150 ms
➜  Local: http://localhost:5173/
```

### Open the App

Open your browser and go to: **http://localhost:5173**

The frontend automatically proxies all `/api/*` requests to the FastAPI backend on port 8000 (configured in `vite.config.ts`).

---

## API Endpoints

| Method   | Endpoint                          | Description                       |
| -------- | --------------------------------- | --------------------------------- |
| `GET`    | `/api/projects`                   | List all projects                 |
| `POST`   | `/api/projects`                   | Create a new project              |
| `GET`    | `/api/projects/:id`               | Get a single project              |
| `PATCH`  | `/api/projects/:id`               | Update project (step/status)      |
| `DELETE` | `/api/projects/:id`               | Delete a project                  |
| `GET`    | `/api/projects/:id/dataset`       | Get project's dataset             |
| `POST`   | `/api/projects/:id/dataset`       | Create/upload a dataset           |
| `GET`    | `/api/projects/:id/model`         | Get project's ML model            |
| `POST`   | `/api/projects/:id/train`         | Start model training              |
| `GET`    | `/api/projects/:id/deployment`    | Get project's deployment          |
| `POST`   | `/api/projects/:id/deploy`        | Deploy a trained model            |
| `GET`    | `/api/deployments`                | List all deployments              |

---

## Usage Guide

1. **Dashboard** — View project stats, active deployments, and recent activity
2. **New Project** — Pick a template (e.g., Access Control), name your project, and create it
3. **Upload Data** — Simulate uploading training data (images, video, etc.)
4. **Label Data** — Add/edit labels for your dataset
5. **Train Model** — Click "Start Training" and watch real-time progress (simulated)
6. **Deploy** — Deploy the trained model as a Cloud API and get an API key + endpoint
7. **Integration** — Copy generated code snippets (cURL, Python, JavaScript) to call your model

---

## Quick Start (TL;DR)

```bash
# Install everything
npm install
cd backend && pip install -r requirements.txt && cd ..

# Terminal 1: Backend
cd backend && python3 -m uvicorn main:app --reload --port 8000

# Terminal 2: Frontend
npx vite --port 5173

# Open http://localhost:5173
```

---

## License

MIT
