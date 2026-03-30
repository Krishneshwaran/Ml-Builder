# ML Model Factory – MVP

A web-based, no-code Machine Learning platform. Upload CSV data, train models, and get prediction APIs — all without writing code.

---

## Tech Stack

| Layer     | Technology                                  |
| --------- | ------------------------------------------- |
| Frontend  | Next.js 15, TypeScript, Tailwind CSS        |
| Backend   | Python FastAPI (ML only)                    |
| Database  | Supabase PostgreSQL + Prisma ORM            |
| ML        | scikit-learn, pandas, joblib                |

---

## Project Structure

```
Ml-Builder/
├── backend/                     # Python ML service
│   ├── main.py                  # FastAPI — training + prediction
│   ├── requirements.txt         # Python dependencies
│   ├── .env                     # Supabase DIRECT_URL
│   └── storage/
│       ├── datasets/            # Uploaded CSV files
│       └── models/              # Trained .pkl models
├── client/                      # Next.js frontend + API
│   ├── prisma/schema.prisma     # Database schema (Prisma ORM)
│   ├── src/
│   │   ├── app/
│   │   │   ├── page.tsx         # Dashboard
│   │   │   ├── api/             # API routes (Prisma CRUD)
│   │   │   │   ├── projects/    # Projects CRUD
│   │   │   │   ├── jobs/        # Job status polling
│   │   │   │   └── models/      # Model info + prediction proxy
│   │   │   ├── project/[id]/    # Project detail pages
│   │   │   ├── settings/        # Settings
│   │   │   └── help/            # Help
│   │   ├── components/sidebar   # Navigation sidebar
│   │   └── lib/                 # API client + Prisma singleton
│   ├── .env                     # DATABASE_URL + DIRECT_URL
│   └── package.json
└── README.md
```

---

## Setup

### 1. Configure Supabase credentials

Edit `client/.env`:
```env
DATABASE_URL="postgresql://postgres.xxx:[PASSWORD]@...pooler.supabase.com:6543/postgres?pgbouncer=true"
DIRECT_URL="postgresql://postgres.xxx:[PASSWORD]@...pooler.supabase.com:5432/postgres"
```

Edit `backend/.env`:
```env
DIRECT_URL=postgresql://postgres.xxx:[PASSWORD]@...pooler.supabase.com:5432/postgres
```

### 2. Push database schema

```bash
cd client
npm install
npx prisma db push
```

### 3. Install Python dependencies

```bash
cd backend
python -m venv venv
# Windows: venv\Scripts\activate
pip install -r requirements.txt
```

### 4. Run

**Terminal 1 — Python ML Backend:**
```bash
cd backend
python -m uvicorn main:app --reload --port 8000
```

**Terminal 2 — Next.js Frontend:**
```bash
cd client
npm run dev
```

Open **http://localhost:3000**

---

## API Endpoints

### Next.js API Routes (Prisma CRUD)

| Method | Endpoint                              | Description             |
| ------ | ------------------------------------- | ----------------------- |
| POST   | `/api/projects`                       | Create project          |
| GET    | `/api/projects`                       | List all projects       |
| GET    | `/api/projects/[id]`                  | Get project detail      |
| POST   | `/api/projects/[id]/dataset`          | Upload CSV dataset      |
| GET    | `/api/projects/[id]/dataset`          | Get dataset info        |
| POST   | `/api/projects/[id]/train`            | Start training job      |
| GET    | `/api/jobs/[jobId]`                   | Get training job status |
| GET    | `/api/models/[modelId]`               | Get model info          |
| POST   | `/api/models/[modelId]/predict`       | Run prediction          |

### Python ML Backend (port 8000)

| Method | Endpoint                 | Description               |
| ------ | ------------------------ | ------------------------- |
| POST   | `/train`                 | Execute ML training       |
| POST   | `/predict/{model_id}`    | Run model prediction      |

---

## User Flow

1. **Create Project** → Give it a name
2. **Upload CSV** → System detects columns, types, null counts
3. **Configure** → Select target column, task type, algorithm
4. **Train** → Async training via BackgroundTasks
5. **Predict** → Enter JSON features, get predictions
6. **Integrate** → Copy cURL / Python / JS code snippets

---

## License

MIT
