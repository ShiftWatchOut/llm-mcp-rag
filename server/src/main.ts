// Import dotenv config to load environment variables
import 'dotenv/config'
// Import the framework and instantiate it
import Fastify from 'fastify'
import MCPClient from '../../ai/src/MCPClient'
import Agent from '../../ai/src/Agent'
import EmbeddingRetriever from '../../ai/src/EmbeddingRetriever'
import Reranker from '../../ai/src/Reranker'
import path from 'path'
import fs from 'fs'
import { logTitle } from '../../ai/src/utils'

const fastify = Fastify({
  logger: true
})

// Enable CORS for client requests
fastify.register(require('@fastify/cors'), {
  origin: ['http://localhost:5173', 'http://localhost:3000'],
  credentials: true
})

// Initialize Agent and context retrieval
const outPath = path.join(process.cwd(), '..', 'output');
const fetchMCP = new MCPClient("mcp-server-fetch", "npx", ['-y', '@tokenizin/mcp-npx-fetch']);
const fileMCP = new MCPClient("mcp-server-file", "npx", ['-y', '@modelcontextprotocol/server-filesystem', outPath]);
let agent: Agent;

async function initializeAgent() {
  // RAG context retrieval
  const embeddingRetriever = new EmbeddingRetriever("Qwen/Qwen3-Embedding-8B");
  const reranker = new Reranker("BAAI/bge-reranker-v2-m3");
  const knowledgeDir = path.join(process.cwd(), '..', 'ai', 'knowledge');
  const embeddingCacheDir = path.join(process.cwd(), 'embedding-cache');

  if (!fs.existsSync(embeddingCacheDir)) {
    fs.mkdirSync(embeddingCacheDir, { recursive: true });
  }

  const files = fs.readdirSync(knowledgeDir);
  for (const file of files) {
    const filePath = path.join(knowledgeDir, file);
    const embeddingPath = path.join(embeddingCacheDir, `${file}.embedding.json`);
    let embeddings: any[] = [];

    if (fs.existsSync(embeddingPath)) {
      embeddings = JSON.parse(fs.readFileSync(embeddingPath, 'utf-8'));
      for (const { section, embedding } of embeddings) {
        embeddingRetriever.addEmbeddedDocument(section, embedding);
      }
    } else {
      const content = fs.readFileSync(filePath, 'utf-8');
      const sections = getChunks(content);
      for (const section of sections) {
        if (!section.trim()) continue;
        const embedding = await embeddingRetriever.embedDocument(section);
        embeddings.push({ section, embedding });
      }
      fs.writeFileSync(embeddingPath, JSON.stringify(embeddings, null, 2), 'utf-8');
    }
  }

  // Create agent with context
  agent = new Agent('Qwen/Qwen3-235B-A22B', [fetchMCP, fileMCP], '', '');
  await agent.init();
}

function getChunks(content: string) {
  if (!content) return [];
  const primaryChunks = content.split(/(\\r?\\n){2,}/).map(chunk => chunk.trim()).filter(Boolean);
  const delimiterRegex = /(\\r?\\n)[—-]{5,}/;

  return primaryChunks.flatMap(chunk => {
    const subSplited = chunk.split(delimiterRegex).map(subChunk => subChunk.trim()).filter(Boolean);
    const subChunks: string[] = [];
    subSplited.forEach((subChunk, index) => {
      if (index % 2 === 0 && index < subSplited.length - 1) {
        subChunks.push(`${subChunk}\\n${subSplited[index + 1]}`);
      } else if (index % 2 === 0) {
        subChunks.push(subChunk);
      }
    })
    return subChunks;
  });
}

// Initialize agent on startup
initializeAgent().catch(console.error);

// Chat endpoint
fastify.post('/api/chat', async function handler(request, reply) {
  const { message } = request.body as { message: string }

  if (!message) {
    return reply.code(400).send({ error: 'Message is required' })
  }

  if (!agent) {
    return reply.code(503).send({ error: 'Agent not initialized' })
  }

  try {
    const response = await agent.invoke(message)
    return {
      message: response,
      timestamp: new Date().toISOString()
    }
  } catch (error) {
    console.error('Agent error:', error)
    return reply.code(500).send({ error: 'Internal server error' })
  }
})

// Health check endpoint
fastify.get('/api/health', async function handler(request, reply) {
  return { status: 'ok', timestamp: new Date().toISOString() }
})

// Declare a route
fastify.get('/', async function handler(request, reply) {
  return { hello: 'world' }
})

// Run the server!
fastify.listen({ port: 3000 }, (err) => {
  if (err) {
    fastify.log.error(err)
    process.exit(1)
  }
})
