import { Skill, GovernanceAlert, SkillDuplicatePair } from '../types/agent';
import { SimpleEmbeddingProvider } from './embedding';

export interface KeywordAssociationResult {
  query: string;
  associatedKeywords: string[];
  recommendedClusters: string[];
  recommendedSkills: Skill[];
}

export class GovernanceEngine {
  private skills: Skill[];

  constructor(skills: Skill[]) {
    this.skills = skills;
  }

  /**
   * 1. 全库综合审计 (Audit Skills across 3 levels)
   */
  public audit(): GovernanceAlert[] {
    const alerts: GovernanceAlert[] = [];

    for (const skill of this.skills) {
      // 1. Skill 级：报错率过高监控 (> 20%)
      const errorRate = skill.call_count > 0 ? skill.error_count / skill.call_count : 0;
      if (skill.call_count >= 3 && errorRate >= 0.20) {
        alerts.push({
          id: `alert-err-${skill.skill_id}`,
          type: 'high_error_rate',
          skill_id: skill.skill_id,
          skill_name: skill.name,
          message: `技能报错率达 ${(errorRate * 100).toFixed(1)}% (调用 ${skill.call_count} 次，报错 ${skill.error_count} 次)。`,
          severity: 'high',
          suggested_action: '建议进入 Docker 沙箱环境进行接口漂移探测，或人工审查/精炼入参定义。',
        });
      }

      // 2. Cluster 级：语义贪婪 ("万金油" 跨领域踩踏)
      if (skill.domains_invoked.length >= 3) {
        alerts.push({
          id: `alert-greed-${skill.skill_id}`,
          type: 'semantic_greed',
          skill_id: skill.skill_id,
          skill_name: skill.name,
          message: `技能已在 [${skill.domains_invoked.join(', ')}] 等 ${skill.domains_invoked.length} 个异构业务领域中被跨界调用，存在“语义贪婪”风险。`,
          severity: 'medium',
          suggested_action: '为防止定义泛化和模型幻觉，建议将此技能拆分为各垂直领域的专家型独立 Skill。',
        });
      }

      // 3. Retrieval 级：缺少负向规避规则
      if (skill.negative_triggers.length === 0) {
        alerts.push({
          id: `alert-noneg-${skill.skill_id}`,
          type: 'low_refinement',
          skill_id: skill.skill_id,
          skill_name: skill.name,
          message: `该技能尚未配置负向触发条件 (Negative Triggers)，在复杂候选集下容易被大模型误选。`,
          severity: 'info',
          suggested_action: '补充反面示例（如"请勿在X场景下调用"），可大幅提高检索触发准确率。',
        });
      }
    }

    return alerts;
  }

  /**
   * 2. 检索级：无关键词场景的联想能力 (Keyword Association Engine)
   * 解决论文中提到的："当用户提供的文本中没有关键词时，Agent 如何完成任务？"
   */
  public associateKeywords(vagueContext: string): KeywordAssociationResult {
    const text = vagueContext.toLowerCase();
    const associations: Record<string, { keywords: string[]; clusters: string[] }> = {
      温度: { keywords: ['降水概率', '实时气象', '穿衣指数', '空气质量'], clusters: ['气象', '生活服务'] },
      冷: { keywords: ['气温走势', '寒潮预警', '取暖指数', '天气查询'], clusters: ['气象', '生活服务'] },
      报告: { keywords: ['PDF转换', '格式排版', '水印盖章', '邮件抄送'], clusters: ['文档处理', 'Office工具'] },
      总结: { keywords: ['数据分析', '图表提炼', 'Markdown导出'], clusters: ['数据分析', '文档处理'] },
      安全: { keywords: ['机密加盖', '只读加密', '权限校验'], clusters: ['Office工具', '安全治理'] },
      报表: { keywords: ['指标统计', '财务核算', 'PDF归档'], clusters: ['数据分析', '文档处理'] },
    };

    let associatedKeywords: string[] = [];
    let recommendedClusters: string[] = [];

    for (const [key, data] of Object.entries(associations)) {
      if (text.includes(key)) {
        associatedKeywords.push(...data.keywords);
        recommendedClusters.push(...data.clusters);
      }
    }

    if (associatedKeywords.length === 0) {
      associatedKeywords = ['意图补全', '上下文追问', '结构化提取', '任务指派'];
      recommendedClusters = ['通用'];
    }

    // 推荐相关技能
    const recommendedSkills = this.skills.filter((s) =>
      s.clusters.some((c) => recommendedClusters.includes(c))
    );

    return {
      query: vagueContext,
      associatedKeywords: Array.from(new Set(associatedKeywords)),
      recommendedClusters: Array.from(new Set(recommendedClusters)),
      recommendedSkills,
    };
  }

  /**
   * 3. 全库重复度与同质化定期审查 (Periodic Skill Redundancy & Collision Audit)
   * 采用 N x N 交叉比对，排查语义高重合度、同质化功能与槽位重叠
   */
  public auditDuplicates(similarityThreshold = 0.72): SkillDuplicatePair[] {
    const pairs: SkillDuplicatePair[] = [];
    const len = this.skills.length;

    for (let i = 0; i < len; i++) {
      for (let j = i + 1; j < len; j++) {
        const a = this.skills[i];
        const b = this.skills[j];

        // 计算向量相似度
        const sim = SimpleEmbeddingProvider.cosineSimilarity(a.embedding, b.embedding);

        // 槽位重叠度
        const slotOverlap = a.required_slots.filter((s) => b.required_slots.includes(s));

        // 簇重叠
        const clusterOverlap = a.clusters.filter((c) => b.clusters.includes(c));

        if (
          sim >= similarityThreshold ||
          (clusterOverlap.length > 0 && slotOverlap.length >= 2 && sim >= 0.65)
        ) {
          let riskLevel: 'high' | 'medium' | 'low' = 'low';
          let reason = '';

          if (sim >= 0.85) {
            riskLevel = 'high';
            reason = `余弦相似度高达 ${(sim * 100).toFixed(1)}%，功能定位严重同质化，极易导致大模型产生幻觉误选或霸占调用权。`;
          } else if (sim >= 0.75 || slotOverlap.length >= 2) {
            riskLevel = 'medium';
            reason = `在共同簇 [${clusterOverlap.join(', ') || '通用'}] 中相似度达 ${(sim * 100).toFixed(1)}%，共享入参槽位: [${slotOverlap.join(', ') || '无'}]。`;
          } else {
            riskLevel = 'low';
            reason = `存在一定业务交叉，建议完善各自消歧专有特征。`;
          }

          pairs.push({
            id: `dup-${a.skill_id}-${b.skill_id}`,
            skillA: a,
            skillB: b,
            similarity: sim,
            slotOverlap,
            riskLevel,
            reason,
          });
        }
      }
    }

    return pairs.sort((x, y) => y.similarity - x.similarity);
  }
}
