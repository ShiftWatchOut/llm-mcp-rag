# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Architecture

This is a monorepo with 4 main packages implementing an Augmented LLM system with MCP (Model Context Protocol) and RAG (Retrieval-Augmented Generation):

- **ai/**: Core LLM agent with MCP clients and RAG retrieval
- **client/**: React frontend with Vite and Semi Design UI components
- **server/**: Fastify backend server  
- **root/**: Workspace configuration with pnpm

### Core Components (ai package)

- `Agent.ts`: Main orchestrator managing LLM, MCP clients, and context
- `MCPClient.ts`: MCP client for connecting to external tools (fetch, filesystem)
- `ChatOpenAI.ts`: OpenAI LLM wrapper with tool calling support
- `EmbeddingRetriever.ts`: Vector-based document retrieval with embedding cache
- `VectorStore.ts`: In-memory vector storage with cosine similarity search
- `Reranker.ts`: Document reranking for improved retrieval relevance

### MCP Integration

The system uses MCP servers for external capabilities:
- Fetch MCP: Web scraping and API calls
- Filesystem MCP: File operations in output directory
- Configured as separate processes with stdio transport

### RAG Pipeline

1. Documents chunked using paragraph and delimiter-based splitting
2. Embeddings cached in `embedding-cache/` directory  
3. Two-stage retrieval: vector search + reranking
4. Context injected into LLM prompts

## Development Commands

### AI Package
```bash
cd ai
pnpm dev          # Run the agent
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

### Server Package
```bash
cd server  
pnpm dev          # Start Fastify server with tsx
```

### Root Workspace
```bash
pnpm install      # Install all dependencies
```

## Configuration

- Uses pnpm workspaces for monorepo management
- TypeScript with ES modules throughout
- Environment variables loaded via dotenv
- Embedding and output files cached locally

## Key Dependencies

- **OpenAI API**: LLM and embedding models via SiliconFlow
- **MCP SDK**: Model Context Protocol client/server communication
- **React 17**: Frontend UI framework
- **Fastify**: Backend web framework
- **Vite**: Frontend build tool