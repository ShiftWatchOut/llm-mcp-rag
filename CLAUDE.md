# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Architecture

This is a monorepo with 3 main packages implementing an Augmented LLM system with MCP (Model Context Protocol) and RAG (Retrieval-Augmented Generation):

- **server/**: Main backend with complete RAG functionality, FastAPI server, and MCP integration
- **client/**: React frontend with Vite and Semi Design UI components
- **ai/**: Legacy package (deprecated) - RAG functionality has been moved to server

### Core Components (server package)

- `Agent.ts`: Main orchestrator managing LLM, MCP clients, and context
- `MCPClient.ts`: MCP client for connecting to external tools (fetch, filesystem)
- `ChatOpenAI.ts`: OpenAI LLM wrapper with tool calling support
- `EmbeddingRetriever.ts`: Vector-based document retrieval with embedding cache
- `VectorStore.ts`: In-memory vector storage with cosine similarity search
- `Reranker.ts`: Document reranking for improved retrieval relevance
- `main.ts`: FastAPI server with RAG-enabled chat endpoints

### MCP Integration

The system uses MCP servers for external capabilities:
- Fetch MCP: Web scraping and API calls
- Filesystem MCP: File operations in output directory
- Configured as separate processes with stdio transport

### RAG Pipeline

1. Documents chunked using paragraph and delimiter-based splitting
2. Embeddings cached in `server/embedding-cache/` directory  
3. Two-stage retrieval: vector search + reranking
4. Context injected dynamically per chat request

## Development Commands

### Server Package (Main Application)
```bash
cd server
pnpm dev          # Start FastAPI server with RAG
pnpm build        # Compile TypeScript
pnpm start        # Run compiled version
```

### Client Package  
```bash
cd client
pnpm dev          # Start Vite dev server
pnpm build        # Build for production
pnpm lint         # Run ESLint
pnpm preview      # Preview production build
```

### AI Package (Legacy)
```bash
cd ai
pnpm dev          # Shows migration notice and examples
```

### Root Workspace
```bash
pnpm install      # Install all dependencies
```

## API Endpoints

- `POST /api/chat`: Chat with RAG-enabled AI agent
- `GET /api/health`: Health check endpoint
- `GET /`: Basic hello world endpoint

## Configuration

- Uses pnpm workspaces for monorepo management
- TypeScript with ES modules throughout
- Environment variables in `server/.env`
- Knowledge files in `server/knowledge/`
- Embedding cache in `server/embedding-cache/`

## Key Dependencies

- **OpenAI API**: LLM and embedding models via SiliconFlow
- **MCP SDK**: Model Context Protocol client/server communication
- **React 17**: Frontend UI framework
- **Fastify**: Backend web framework
- **Vite**: Frontend build tool

## Migration Notes

RAG functionality has been consolidated into the server package. The ai package is kept for reference but no longer contains the main implementation.