/**
 * 轻量语义嵌入与向量相似度计算引擎
 * 支持中英文分词与双字切分 (Bi-gram)，实现高质量的 TF-IDF 向量表征与余弦相似度计算
 */

export class SimpleEmbeddingProvider {
  /**
   * 中英文混合分词：提取连续字母数字单词，以及中文单字和双字组合
   */
  public static tokenize(text: string): string[] {
    if (!text) return [];
    const lower = text.toLowerCase();
    const tokens: string[] = [];

    // 1. 匹配连续英文/数字
    const words = lower.match(/[a-z0-9_]+/g) || [];
    tokens.push(...words);

    // 2. 匹配中文连续片段并提取单字与双字
    const chineseMatches = lower.match(/[\u4e00-\u9fa5]+/g) || [];
    for (const chunk of chineseMatches) {
      // 单字
      for (let i = 0; i < chunk.length; i++) {
        tokens.push(chunk[i]);
      }
      // 双字 (提高语义关联精度)
      for (let i = 0; i < chunk.length - 1; i++) {
        tokens.push(chunk.slice(i, i + 2));
      }
    }

    return tokens;
  }

  /**
   * 将文本转为归一化的词频向量 (L2 Norm)
   */
  public static getEmbedding(text: string): Record<string, number> {
    const tokens = this.tokenize(text);
    if (tokens.length === 0) return {};

    const tf: Record<string, number> = {};
    for (const token of tokens) {
      tf[token] = (tf[token] || 0) + 1;
    }

    // 计算 L2 范数
    let sumSquares = 0;
    for (const count of Object.values(tf)) {
      sumSquares += count * count;
    }
    const norm = Math.sqrt(sumSquares);

    if (norm === 0) return {};

    const normalized: Record<string, number> = {};
    for (const [key, val] of Object.entries(tf)) {
      normalized[key] = val / norm;
    }
    return normalized;
  }

  /**
   * 计算两个稀疏向量之间的余弦相似度
   */
  public static cosineSimilarity(
    vec1: Record<string, number>,
    vec2: Record<string, number>
  ): number {
    const keys1 = Object.keys(vec1);
    const keys2 = Object.keys(vec2);
    if (keys1.length === 0 || keys2.length === 0) return 0;

    let dotProduct = 0;
    // 较短的遍历
    const [smaller, larger] = keys1.length < keys2.length ? [vec1, vec2] : [vec2, vec1];

    for (const [k, val] of Object.entries(smaller)) {
      if (larger[k]) {
        dotProduct += val * larger[k];
      }
    }

    return Math.min(1.0, Math.max(0.0, dotProduct));
  }
}
