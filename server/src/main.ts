// Import the framework and instantiate it
import Fastify from 'fastify'
const fastify = Fastify({
  logger: true
})

// Enable CORS for client requests
fastify.register(require('@fastify/cors'), {
  origin: ['http://localhost:5173', 'http://localhost:3000'],
  credentials: true
})

// Mock responses for AI chat
const mockResponses = [
  "这是一个很好的问题！让我来帮您解答。",
  "基于您的描述，我建议您可以考虑以下几个方面...",
  "这个问题涉及多个层面，我来为您详细分析一下。",
  "根据我的理解，您可能需要以下几个步骤来解决这个问题。",
  "让我为您提供一个更全面的解决方案。",
  "这确实是一个复杂的话题，我来帮您梳理一下思路。"
]

// Chat endpoint
fastify.post('/api/chat', async function handler(request, reply) {
  const { message } = request.body as { message: string }
  
  if (!message) {
    return reply.code(400).send({ error: 'Message is required' })
  }

  // Simulate AI processing delay
  await new Promise(resolve => setTimeout(resolve, 500 + Math.random() * 1000))
  
  // Select a random mock response
  const response = mockResponses[Math.floor(Math.random() * mockResponses.length)]
  
  return {
    message: response,
    timestamp: new Date().toISOString()
  }
})

// Health check endpoint
fastify.get('/api/health', async function handler(request, reply) {
  return { status: 'ok', timestamp: new Date().toISOString() }
})

// Declare a route
fastify.get('/', async function handler (request, reply) {
  return { hello: 'world' }
})

// Run the server!
fastify.listen({ port: 3000 }, (err) => {
  if (err) {
    fastify.log.error(err)
    process.exit(1)
  }
})