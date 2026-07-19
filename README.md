# ResearchMind AI — Educational Research Assistant & RAG Platform

ResearchMind AI is an AI-powered educational research assistant designed to process, analyze, and query academic papers using Retrieval-Augmented Generation (RAG). Featuring an ultra-modern UI matching the OkyAI template, it provides visual paper summaries, interactive multi-model AI chat (Groq LLaMA 3.3 70B, Google Gemini 2.0 Flash), automated section extraction, and quiz generation.

## 🚀 Features

- **OkyAI SaaS Design System**: Modern dark theme with vibrant purple-magenta gradients (`#a855f7` to `#d946ef`), glassmorphism cards, Satoshi typography, and custom SVG corner curves.
- **AI Visual Summary Dashboard**: Instant visual breakdown of research papers (Executive Summary, Core Objectives, Methodology, Key Findings, Novelty Scores, and Researcher Takeaways).
- **Fast RAG Vector Search**: Document chunking and vector search with embedded Qdrant database and Google Gemini / SentenceTransformers embeddings.
- **Multi-LLM Integration**: Ultra-fast responses powered by Groq LLaMA 3.3 70B Versatile and Google Gemini.
- **Interactive Chatbot & Quiz Generator**: Real-time SSE streaming responses with citation tracking and automated quiz creation.

## 🛠️ Project Structure

```text
rag-help/
├── ResearchAI/
│   ├── backend/        # FastAPI RAG Backend (Python 3.11, SQLAlchemy, Qdrant, Uvicorn)
│   └── frontend/       # Next.js 14 Web Application (TypeScript, Tailwind CSS, Lucide React)
└── extractor/          # Puppeteer DOM extraction tools & templates
```

## ⚙️ Quick Start

### 1. Backend Setup
```bash
cd ResearchAI/backend
cp .env.example .env
# Edit .env with your GROQ_API_KEY or GEMINI_API_KEY
python -m uvicorn app.main:app --reload --port 8000
```

### 2. Frontend Setup
```bash
cd ResearchAI/frontend
npm install
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.
