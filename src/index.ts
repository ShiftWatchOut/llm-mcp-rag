import MCPClient from "./MCPClient";
import Agent from "./Agent";
import path from "path";
import EmbeddingRetriever from "./EmbeddingRetriever";
import fs from "fs";
import { logTitle } from "./utils";
import Reranker from "./Reranker";

const URL = 'https://news.ycombinator.com/'
const outPath = path.join(process.cwd(), 'output');

const TASK = `
于儿神入侵的计划是什么，为何要这样推进？
将得出的结论保存到 ${outPath}/yangna.md ，输出一个漂亮 md 文件
`

const fetchMCP = new MCPClient("mcp-server-fetch", "npx", ['-y', '@tokenizin/mcp-npx-fetch']);
const fileMCP = new MCPClient("mcp-server-file", "npx", ['-y', '@modelcontextprotocol/server-filesystem', outPath]);

async function main() {
    // RAG
    const context = await retrieveContext();

    // Agent
    const agent = new Agent('Qwen/Qwen3-235B-A22B', [fetchMCP, fileMCP], '', context);
    await agent.init();

    // 优雅退出机制
    const handleExit = async () => {
        console.log('\nGracefully shutting down...');
        await agent.close();
        process.exit(0);
    };
    process.on('SIGINT', handleExit);
    process.on('SIGTERM', handleExit);

    await agent.invoke(TASK);
    await agent.close();
    // 移除监听，防止重复关闭
    process.off('SIGINT', handleExit);
    process.off('SIGTERM', handleExit);
}

main()

async function retrieveContext() {
    // RAG
    const embeddingRetriever = new EmbeddingRetriever("Qwen/Qwen3-Embedding-8B");
    const reranker = new Reranker("BAAI/bge-reranker-v2-m3"); // 新增重排器
    const knowledgeDir = path.join(process.cwd(), 'knowledge');
    const embeddingCacheDir = path.join(process.cwd(), 'embedding-cache');
    if (!fs.existsSync(embeddingCacheDir)) {
        fs.mkdirSync(embeddingCacheDir, { recursive: true });
    }
    const files = fs.readdirSync(knowledgeDir);
    for await (const file of files) {
        const filePath = path.join(knowledgeDir, file);
        const embeddingPath = path.join(embeddingCacheDir, `${file}.embedding.json`);
        let embeddings: any[] = [];

        if (fs.existsSync(embeddingPath)) {
            // 已有embedding，直接读取
            embeddings = JSON.parse(fs.readFileSync(embeddingPath, 'utf-8'));
            // 载入到retriever
            for (const { section, embedding } of embeddings) {
                embeddingRetriever.addEmbeddedDocument(section, embedding);
            }
        } else {
            // 没有embedding，生成并保存
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
    const k = 5
    // 先用向量检索获取候选
    const candidates = await embeddingRetriever.retrieve(TASK, k * 2);
    // 用 Reranker 进行重排
    const reranked = await reranker.rerank(TASK, candidates, k);
    // 整理
    const context = reranked.map(item => item.document).join('\n');
    logTitle('CONTEXT');
    console.log(context);
    return context
}

function getChunks(content: string) {
    if (!content) return [];
    // 首先使用两个或更多的连续换行符作为分隔符
    // 如果已拆分的内容中有至少两个的 \n—{5,}\n 作分隔符，且数量为偶数，则将第 n (n>=0)个分隔符之后的内容与第 n+2 个分隔符之前的内容划分为一个块

    // 一级分块：用两个或更多换行符分割
    const primaryChunks = content.split(/(\r?\n){2,}/).map(chunk => chunk.trim()).filter(Boolean);

    const delimiterRegex = /(\r?\n)[—-]{5,}/;

    return primaryChunks.flatMap(chunk => {
        // 检查是否存在至少两个 \n—{5,}\n 分隔符，且数量为偶数
        const subSplited = chunk.split(delimiterRegex).map(subChunk => subChunk.trim()).filter(Boolean);
        const subChunks: string[] = [];
        subSplited.forEach((subChunk, index) => {
            // 如果是偶数索引，且不是最后一个分块，则将当前分块与下一个分块合并
            if (index % 2 === 0 && index < subSplited.length - 1) {
                subChunks.push(`${subChunk}\n${subSplited[index + 1]}`);
            } else if (index % 2 === 0) {
                // 如果是最后一个分块，直接添加
                subChunks.push(subChunk);
            }
        })
        return subChunks;
    });
}
