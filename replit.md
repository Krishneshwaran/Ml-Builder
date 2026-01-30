# MLForge - No-Code Machine Learning Platform

## Overview
MLForge is a professional, no-code Machine Learning Model Builder and Integration Platform. It enables users to design, train, evaluate, deploy, and integrate production-ready ML models without writing ML code.

## Core Concept
This is a "Machine Learning Factory" that produces deployable ML models exposed via APIs, which users can integrate into their own web, mobile, or IoT applications.

## Architecture

### Frontend (React + TypeScript)
- `/client/src/App.tsx` - Main app with routing and sidebar layout
- `/client/src/pages/` - Page components:
  - `dashboard.tsx` - Overview with stats and recent projects
  - `projects.tsx` - List of all projects
  - `new-project.tsx` - Create new project flow
  - `project-detail.tsx` - 6-step ML workflow
  - `settings.tsx` - Platform settings
  - `help.tsx` - Help and resources
- `/client/src/components/` - Reusable components:
  - `app-sidebar.tsx` - Navigation sidebar
  - `workflow-steps.tsx` - 6-step progress indicator
  - `template-card.tsx` - ML template selection cards
  - `data-upload-zone.tsx` - Drag-and-drop file upload
  - `label-editor.tsx` - Dataset label management
  - `pipeline-builder.tsx` - Visual ML pipeline stages
  - `training-metrics.tsx` - Model performance metrics
  - `deployment-panel.tsx` - Deployment options
  - `integration-code.tsx` - API code snippets
  - `theme-provider.tsx` - Dark/light theme support

### Backend (Express)
- `/server/routes.ts` - API endpoints for projects, datasets, models, deployments
- `/server/storage.ts` - In-memory storage with seed data

### Shared
- `/shared/schema.ts` - Data models and system templates

## System Templates
1. Access Control / Identity Verification - Facial recognition
2. Exam Proctoring - Real-time monitoring
3. Smart Waste Sorting - Waste classification
4. Retail Behavior Analytics - Customer tracking
5. Document Processing & Classification - OCR and categorization
6. Crowd & Traffic Monitoring - Density analysis

## ML Workflow (6 Steps)
1. **Template** - Select system template
2. **Data** - Upload and label training data
3. **Pipeline** - Auto-configured ML pipeline
4. **Train** - One-click training with metrics
5. **Deploy** - Cloud API or edge deployment
6. **Integrate** - API code snippets

## API Endpoints
- `GET /api/projects` - List all projects
- `POST /api/projects` - Create project
- `GET /api/projects/:id` - Get project
- `PATCH /api/projects/:id` - Update project
- `POST /api/projects/:id/dataset` - Upload dataset
- `POST /api/projects/:id/train` - Start training
- `POST /api/projects/:id/deploy` - Deploy model
- `GET /api/deployments` - List deployments

## Design System
- Professional enterprise blue theme
- Dark/light mode support
- Inter font family
- Shadcn UI components

## Running the Application
```bash
npm run dev
```
The app runs on port 5000 with Express backend and Vite frontend.
