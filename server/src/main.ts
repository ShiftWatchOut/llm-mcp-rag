// Import dotenv config to load environment variables
import 'dotenv/config'
// Import the framework and instantiate it
import Fastify from 'fastify'
import MCPClient from './MCPClient'
import Agent from './Agent'
import EmbeddingRetriever from './EmbeddingRetriever'
import Reranker from './Reranker'
import path from 'path'
import fs from 'fs'
import { logTitle } from './utils'

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

// Global RAG components
let embeddingRetriever: EmbeddingRetriever;
let reranker: Reranker;

async function initializeRAG() {
  // Initialize RAG components
  embeddingRetriever = new EmbeddingRetriever("Qwen/Qwen3-Embedding-8B");
  reranker = new Reranker("BAAI/bge-reranker-v2-m3");
  
  // Try local knowledge directory first, then fall back to ai package
  let knowledgeDir = path.join(process.cwd(), 'knowledge');
  if (!fs.existsSync(knowledgeDir)) {
    knowledgeDir = path.join(process.cwd(), '..', 'ai', 'knowledge');
  }
  
  const embeddingCacheDir = path.join(process.cwd(), 'embedding-cache');

  if (!fs.existsSync(embeddingCacheDir)) {
    fs.mkdirSync(embeddingCacheDir, { recursive: true });
  }

  // Load knowledge files and embeddings
  if (fs.existsSync(knowledgeDir)) {
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
  }

  console.log('RAG components initialized successfully');
}

async function retrieveContext(query: string): Promise<string> {
  if (!embeddingRetriever || !reranker) {
    return '';
  }

  try {
    const k = 5;
    // 先用向量检索获取候选
    const candidates = await embeddingRetriever.retrieve(query, k * 2);
    // 用 Reranker 进行重排
    const reranked = await reranker.rerank(query, candidates, k);
    // 整理
    const context = reranked.map(item => item.document).join('\n');
    logTitle('RETRIEVED CONTEXT');
    console.log(context);
    return context;
  } catch (error) {
    console.error('Error retrieving context:', error);
    return '';
  }
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

// Initialize RAG on startup
initializeRAG().catch(console.error);

// Chat endpoint
fastify.post('/api/chat', async function handler(request, reply) {
  const { message } = request.body as { message: string }

  if (!message) {
    return reply.code(400).send({ error: 'Message is required' })
  }

  if (!embeddingRetriever || !reranker) {
    return reply.code(503).send({ error: 'RAG system not initialized' })
  }

  try {
    // Retrieve relevant context for this specific query
    const context = await retrieveContext(message);
    
    // Create a new agent instance for this request with the retrieved context
    const agent = new Agent('Qwen/Qwen3-235B-A22B', [fetchMCP, fileMCP], '', context);
    await agent.init();
    
    const response = await agent.invoke(message);
    
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
