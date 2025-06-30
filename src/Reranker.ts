import 'dotenv/config';

export interface RerankItem {
    document: string;
    score: number;
}

export default class Reranker {
    private model: string;

    constructor(model: string) {
        this.model = model;
    }

    /**
     * 对候选文档进行重排
     * @param query 查询语句
     * @param candidates 候选文档
     * @param topN 返回的文档数量
     * @returns 重排后的文档及分数，按分数降序排列
     */
    async rerank(query: string, candidates: string[], topN: number): Promise<RerankItem[]> {
        const url = `${process.env.RERANK_BASE_URL}/rerank`;
        const response = await fetch(url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${process.env.RERANK_API_KEY}`,
            },
            body: JSON.stringify({
                model: this.model,
                query,
                documents: candidates,
            }),
        });
        const data = await response.json();
        // data.results: [{ index, relevance_score }]
        // 返回按分数降序排列的文档和分数
        return data.results
            .sort((a: any, b: any) => b.relevance_score - a.relevance_score)
            .map((item: any) => ({
                document: candidates[item.index],
                score: item.relevance_score,
            }))
            .slice(0, topN);
    }
}
