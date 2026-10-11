import { Skill, NegativeExampleRule } from '../types/agent';
import { SimpleEmbeddingProvider } from './embedding';

export interface RouteResult {
  selectedSkill: Skill | null;
  candidatesInCluster: Skill[];
  score: number;
  negativeExcluded: { skill: Skill; reason: string; divertedTo?: string }[];
  explorationTriggered: boolean;
  matchedClusters: string[];
  divertedTargetSkill?: Skill | null;
}

export interface QuerySpecificSubsetResult {
  selectedSubset: Skill[];
  prunedDistractorCount: number;
  tokenReductionPercent: number;
  activeContextTokens: number;
  originalFullTokens: number;
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

    // 若无直接命中关键词，进行全局初筛
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
   * Stage 2: 簇空间细化匹配 (反面示例消歧 + 向量打分 + 冷门探索)
   * 落实用户构想：使用反面示例（Negative Examples），当相似技能竞争时，
   * 触发明确负面规则（"别在X场景调用我，请用Y技能"）并自动分流至目标技能
   */
  public route(
    query: string,
    domainContext: string = '通用',
    forceExploration?: boolean
  ): RouteResult {
    const { candidates, matchedClusters } = this.mapToClusters(query);
    const queryVec = SimpleEmbeddingProvider.getEmbedding(query);
    const queryLower = query.toLowerCase();

    const negativeExcluded: { skill: Skill; reason: string; divertedTo?: string }[] = [];
    let divertedTargetSkill: Skill | null = null;
    const scoredCandidates: { skill: Skill; score: number }[] = [];

    for (const skill of candidates) {
      // 1. 结构化反面示例检查 (Negative Examples Contrastive Rules)
      let matchedNegativeExample: NegativeExampleRule | undefined;
      if (skill.negative_examples && skill.negative_examples.length > 0) {
        matchedNegativeExample = skill.negative_examples.find((rule) => {
          const scenarioWords = rule.scenario.replace(/[，。！？、]/g, ' ').split(' ').filter((w) => w.length >= 2);
          const hitCount = scenarioWords.filter((w) => queryLower.includes(w.toLowerCase())).length;
          return hitCount >= 2 || queryLower.includes(rule.why_avoid.slice(0, 6));
        });
      }

      if (matchedNegativeExample) {
        const target = this.skills.find((s) => s.skill_id === matchedNegativeExample?.divert_to_skill_id);
        if (target) {
          divertedTargetSkill = target;
        }
        negativeExcluded.push({
          skill,
          reason: `触发反面示例: "${matchedNegativeExample.scenario}" -> 推荐分流至 [${matchedNegativeExample.divert_to_skill_name}]`,
          divertedTo: matchedNegativeExample.divert_to_skill_name,
        });
        continue;
      }

      // 2. 负向规则规避 (Negative Triggers Hard Exclusion)
      const trippedNegative = skill.negative_triggers.find((neg) => {
        if (!neg || neg.trim().length === 0) return false;
        const clean = neg.replace(/^(请勿|不要|别在|严禁).{0,4}(调用|用于|检索|处理)/, '').trim();
        return clean.length >= 2 && query.includes(clean);
      });

      if (trippedNegative) {
        negativeExcluded.push({
          skill,
          reason: `触发负向排除规则: "${trippedNegative}"`,
        });
        continue;
      }

      // 3. 向量余弦相似度计算
      const sim = SimpleEmbeddingProvider.cosineSimilarity(
        queryVec,
        skill.embedding
      );
      scoredCandidates.push({ skill, score: sim });
    }

    // 若反面示例已精确定向到替代目标技能，优先将其加入高权打分
    if (divertedTargetSkill) {
      const alreadyPresent = scoredCandidates.find((item) => item.skill.skill_id === divertedTargetSkill?.skill_id);
      if (!alreadyPresent) {
        scoredCandidates.unshift({ skill: divertedTargetSkill, score: 0.99 });
      } else {
        alreadyPresent.score = Math.max(alreadyPresent.score, 0.99);
      }
    }

    if (scoredCandidates.length === 0) {
      return {
        selectedSkill: null,
        candidatesInCluster: candidates,
        score: 0,
        negativeExcluded,
        explorationTriggered: false,
        matchedClusters,
        divertedTargetSkill,
      };
    }

    // 降序排序
    scoredCandidates.sort((a, b) => b.score - a.score);

    // 4. 探索机制 (10% 冷门防饥饿保护)
    const shouldExplore =
      forceExploration !== undefined
        ? forceExploration
        : Math.random() < this.explorationRate;

    let selected = scoredCandidates[0].skill;
    let finalScore = scoredCandidates[0].score;
    let explorationTriggered = false;

    if (shouldExplore && scoredCandidates.length > 1 && !divertedTargetSkill) {
      const viable = scoredCandidates.filter((item) => item.score > 0.05);
      if (viable.length > 1) {
        viable.sort((a, b) => a.skill.call_count - b.skill.call_count);
        selected = viable[0].skill;
        finalScore = viable[0].score;
        explorationTriggered = true;
      }
    }

    // 纯函数返回：避免在路由层原地突变对象属性 (通过 React 上层不可变分发调用指标)
    return {
      selectedSkill: selected,
      candidatesInCluster: candidates,
      score: finalScore,
      negativeExcluded,
      explorationTriggered,
      matchedClusters,
      divertedTargetSkill,
    };
  }

  /**
   * UCSB-NLP 论文核心落地：Query-Specific Dynamic Subsetting
   * 在长对话与大技能库场景下，动态抽取 Top-K 判别性技能子集，剔除 90% 干扰项 (Distractor Pruning)
   */
  public extractQuerySpecificSubset(
    query: string,
    limit: number = 4
  ): QuerySpecificSubsetResult {
    const routeRes = this.route(query);
    const queryVec = SimpleEmbeddingProvider.getEmbedding(query);

    // 计算全库得分并排除被反面示例过滤的技能
    const scoredAll = this.skills
      .map((skill) => {
        const isExcluded = routeRes.negativeExcluded.some((ex) => ex.skill.skill_id === skill.skill_id);
        const sim = isExcluded ? -1 : SimpleEmbeddingProvider.cosineSimilarity(queryVec, skill.embedding);
        return { skill, score: sim };
      })
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score);

    // 抽取 Top-K 精炼子集
    let subset = scoredAll.slice(0, limit).map((s) => s.skill);

    // 保证首选路由技能存在于子集中
    if (routeRes.selectedSkill && !subset.some((s) => s.skill_id === routeRes.selectedSkill?.skill_id)) {
      subset = [routeRes.selectedSkill, ...subset.slice(0, limit - 1)];
    }

    const prunedCount = Math.max(0, this.skills.length - subset.length);
    const originalFullTokens = this.skills.length * 135; // 平均每技能 135 tokens
    const activeContextTokens = subset.length * 135;
    const tokenReductionPercent = Math.round(
      ((originalFullTokens - activeContextTokens) / Math.max(1, originalFullTokens)) * 100
    );

    return {
      selectedSubset: subset,
      prunedDistractorCount: prunedCount,
      tokenReductionPercent,
      activeContextTokens,
      originalFullTokens,
    };
  }
}

