# ResearchMind AI

Transform Any Research Paper into an Interactive Learning Experience.

## Milestone 1 — Project Scaffold

This repository contains the initial architecture scaffold for ResearchMind AI, including:

- `backend/` — FastAPI service with clean application layers
- `frontend/` — Next.js + TypeScript UI scaffold with Tailwind support
- `docker-compose.yml` — local development services for PostgreSQL, Qdrant, backend, and frontend
- shared architecture for future modules: paper ingestion, layout-aware parsing, knowledge graph, RAG pipeline, and AI teacher features

## Architecture Overview

The backend is designed with Clean Architecture in mind. Core layers include:

- API layer: request routing and validation
- Services: business logic and domain workflows
- Repositories: data persistence and retrieval
- DB models/schemas: table definitions and validation contracts
- AI components: future integration points for embeddings, retrieval, and generation

The frontend is structured for a modular dashboard experience and will evolve into:

- Dashboard
- Upload Papers
- Library
- Paper Viewer
- Chat
- Diagrams
- Equation Explorer
- Mind Map
- Flashcards
- Quiz builder
- Comparison and Timeline views

## Local startup

```bash
cd ResearchAI
docker compose up --build
```

Then open:

- Backend: `http://localhost:8000`
- Frontend: `http://localhost:3000`

## Next steps

1. Implement paper upload and metadata extraction
2. Add PostgreSQL schema and migration support
3. Build document parsing and semantic section detection
4. Add AI service abstraction and RAG pipeline
5. Develop interactive frontend views and chat flow
