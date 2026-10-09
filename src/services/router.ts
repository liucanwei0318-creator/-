import { Skill } from '../types/agent';
import { SimpleEmbeddingProvider } from './embedding';

export interface RouteResult {
  selectedSkill: Skill | null;
  candidatesInCluster: Skill[];
  score: number;
  negativeExcluded: { skill: Skill; reason: string }[];
  explorationTriggered: boolean;
  matchedClusters: string[];
}

export class SkillIndexRouter {
  private skills: Skill[];
  private explorationRate: number;

  constructor(skills: Skill[], explorationRate: number = 0.10) {
    this.skills = skills;
    this.explorationRate = explorationRate;
  }

  /**
   * Stage 1: 业务领域与工具载体分簇粗筛 (避免全量万级检索)
   */
  public mapToClusters(query: string): { candidates: Skill[]; matchedClusters: string[] } {
    const queryLower = query.toLowerCase();
    const matchedClustersSet = new Set<string>();
    const candidates: Skill[] = [];

    // 检查所有已注册技能所属的 clusters
    for (const skill of this.skills) {
      let isClusterHit = false;
      for (const cluster of skill.clusters) {
        if (queryLower.includes(cluster.toLowerCase())) {
          matchedClustersSet.add(cluster);
          isClusterHit = true;
        }
      }
      if (isClusterHit) {
        candidates.push(skill);
      }
    }

    // 若无直接命中关键词，进行文本分词与技能元数据的全局初筛
    if (candidates.length === 0) {
      return {
        candidates: [...this.skills],
        matchedClusters: ['通用兜底空间'],
      };
    }

    return {
      candidates,
      matchedClusters: Array.from(matchedClustersSet),
    };
  }

  /**
   * Stage 2: 簇空间细化匹配 (负例规避 + 向量余弦打分 + 10% 冷门探索机制)
   */
  public route(
    query: string,
    domainContext: string = '通用',
    forceExploration?: boolean
  ): RouteResult {
    const { candidates, matchedClusters } = this.mapToClusters(query);
    const queryVec = SimpleEmbeddingProvider.getEmbedding(query);

    const negativeExcluded: { skill: Skill; reason: string }[] = [];
    const scoredCandidates: { skill: Skill; score: number }[] = [];

    for (const skill of candidates) {
      // 1. 负向规则规避 (Negative Triggers Hard Exclusion)
      const trippedNegative = skill.negative_triggers.find((neg) =>
        neg && neg.trim().length > 0 && query.includes(neg.replace(/^(请勿|不要|别在).{0,4}(调用|用于)/, '').trim())
      );

      if (trippedNegative) {
        negativeExcluded.push({
          skill,
          reason: `触发负向排除规则: "${trippedNegative}"`,
        });
        continue;
      }

      // 2. 向量余弦相似度计算
      const sim = SimpleEmbeddingProvider.cosineSimilarity(
        queryVec,
        skill.embedding
      );
      scoredCandidates.push({ skill, score: sim });
    }

    if (scoredCandidates.length === 0) {
      return {
        selectedSkill: null,
        candidatesInCluster: candidates,
        score: 0,
        negativeExcluded,
        explorationTriggered: false,
        matchedClusters,
      };
    }

    // 降序排序
    scoredCandidates.sort((a, b) => b.score - a.score);

    // 3. 探索机制 (10% 冷门防饥饿保护)
    const shouldExplore =
      forceExploration !== undefined
        ? forceExploration
        : Math.random() < this.explorationRate;

    let selected = scoredCandidates[0].skill;
    let finalScore = scoredCandidates[0].score;
    let explorationTriggered = false;

    if (shouldExplore && scoredCandidates.length > 1) {
      // 在得分 > 0.05 的有效候选池中，挑选调用最少冷门技能，打破热点技能霸占
      const viable = scoredCandidates.filter((item) => item.score > 0.05);
      if (viable.length > 1) {
        viable.sort((a, b) => a.skill.call_count - b.skill.call_count);
        selected = viable[0].skill;
        finalScore = viable[0].score;
        explorationTriggered = true;
      }
    }

    // 运行时指标更新
    selected.call_count += 1;
    if (!selected.domains_invoked.includes(domainContext)) {
      selected.domains_invoked.push(domainContext);
    }

    return {
      selectedSkill: selected,
      candidatesInCluster: candidates,
      score: finalScore,
      negativeExcluded,
      explorationTriggered,
      matchedClusters,
    };
  }
}
