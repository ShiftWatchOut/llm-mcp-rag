import MCPClient from "./MCPClient";
import Agent from "./Agent";
import path from "path";
import EmbeddingRetriever from "./EmbeddingRetriever";
import fs from "fs";
import { logTitle } from "./utils";

const URL = 'https://news.ycombinator.com/'
const outPath = path.join(process.cwd(), 'output');

const TASK = `
告诉我Antonette的信息,先从我给你的context中找到相关信息,总结后创作一个关于她的故事
把故事和她的基本信息保存到${outPath}/antonette.md,输出一个漂亮md文件
`

const fetchMCP = new MCPClient("mcp-server-fetch", "npx", ['-y', '@tokenizin/mcp-npx-fetch']);
const fileMCP = new MCPClient("mcp-server-file", "npx", ['-y', '@modelcontextprotocol/server-filesystem', outPath]);

async function main() {
    // RAG
    const context = await retrieveContext();

    // Agent
    const agent = new Agent('openai/gpt-4o-mini', [fetchMCP, fileMCP], '', context);
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
    const embeddingRetriever = new EmbeddingRetriever("BAAI/bge-m3");
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
            const sections = content.split(/(\r?\n){2,}/);
            for (const section of sections) {
                if (!section.trim()) continue;
                const embedding = await embeddingRetriever.embedDocument(section);
                embeddings.push({ section, embedding });
            }
            fs.writeFileSync(embeddingPath, JSON.stringify(embeddings, null, 2), 'utf-8');
        }
    }
    const context = (await embeddingRetriever.retrieve(TASK, 3)).join('\n');
    logTitle('CONTEXT');
    console.log(context);
    return context
}