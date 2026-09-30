# NEXUS AI
Company AI Operations Control Center

## Architecture Overview
- **Frontend**: React (Vite) targeting Vercel deployment
- **Backend**: Node.js (Express) targeting Render deployment
- **Database & Auth**: Supabase PostgreSQL
- **AI Engine**: Google Gemini API (Backend-only via tool calling)
- **External Integrations**: Google Workspace (OAuth, Drive, Calendar, Gmail via direct API)

## Local Setup

### 1. Backend Setup
```bash
cd backend
npm install
npm run dev
```

### 2. Frontend Setup
```bash
cd frontend
npm install
npm run dev
```

## Implementation Status
- **BLOCK 0 — Architecture**: COMPLETED
- **BLOCK 1 — Foundation**: COMPLETED
- **BLOCK 2 — Database**: PENDING
