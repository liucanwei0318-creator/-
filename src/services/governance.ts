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
      // 若技能已经处于经过元技能自愈或人工精炼确认的健康状态，且当前无新错误，则不重复报错
      const isHealed = skill.governance_status === 'healed';

      // 1. Skill 级：报错率过高监控 (> 20%)
      const errorRate = skill.call_count > 0 ? skill.error_count / skill.call_count : 0;
      if (skill.call_count >= 3 && errorRate >= 0.20 && !isHealed) {
        alerts.push({
          id: `alert-err-${skill.skill_id}`,
          type: 'high_error_rate',
          skill_id: skill.skill_id,
          skill_name: skill.name,
          message: `技能报错率达 ${(errorRate * 100).toFixed(1)}% (调用 ${skill.call_count} 次，报错 ${skill.error_count} 次)。`,
          severity: 'high',
          suggested_action: '建议激活 OpenAI 风格自愈元技能 (Meta-skill) 进行槽位校验自愈与入参探针探测。',
          can_auto_heal: true,
        });
      }

      // 2. Cluster 级：语义贪婪 ("万金油" 跨领域踩踏)
      // 过滤通用垫底词，只统计具有实质冲突的异构业务领域
      const distinctDomains = (skill.domains_invoked || []).filter(
        (d) => d && !d.includes('通用') && !d.includes('复合') && !d.includes('流水线')
      );
      if (distinctDomains.length >= 3 && !isHealed) {
        alerts.push({
          id: `alert-greed-${skill.skill_id}`,
          type: 'semantic_greed',
          skill_id: skill.skill_id,
          skill_name: skill.name,
          message: `技能已在 [${distinctDomains.join(', ')}] 等 ${distinctDomains.length} 个异构业务领域中被跨界调用，存在“语义贪婪”风险。`,
          severity: 'medium',
          suggested_action: '建议激活元技能进行能力边界判别性精炼收敛，或拆解为各垂直领域的专家独立技能。',
          can_auto_heal: true,
        });
      }

      // 3. Retrieval 级：缺少负向规避规则
      const hasNegativeTriggers = skill.negative_triggers && skill.negative_triggers.length > 0;
      const hasNegativeExamples = skill.negative_examples && skill.negative_examples.length > 0;
      if (!hasNegativeTriggers && !hasNegativeExamples && !isHealed) {
        alerts.push({
          id: `alert-noneg-${skill.skill_id}`,
          type: 'low_refinement',
          skill_id: skill.skill_id,
          skill_name: skill.name,
          message: `该技能尚未配置负向触发条件或反面示例，在多模型同质化技能竞争下容易被大模型误选。`,
          severity: 'info',
          suggested_action: '生成反面示例（如"别在 X 场景调用我，这时请用 Y 技能"），大幅恢复并提升技能触发正确率。',
          can_auto_heal: true,
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
   * 并为每组冲突自动推导反面示例规避规则 (Negative Example Rules)
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
            reason = `余弦相似度高达 ${(sim * 100).toFixed(1)}%，跨生态功能同质化严重（例如 ${a.ecosystem || '默认'} vs ${b.ecosystem || '默认'}），容易导致大模型决策幻觉或选错。`;
          } else if (sim >= 0.75 || slotOverlap.length >= 2) {
            riskLevel = 'medium';
            reason = `在共同簇 [${clusterOverlap.join(', ') || '通用'}] 中相似度达 ${(sim * 100).toFixed(1)}%，共享入参槽位: [${slotOverlap.join(', ') || '无'}]。`;
          } else {
            riskLevel = 'low';
            reason = `存在一定业务交叉，建议完善各自专属反面示例与消歧规则。`;
          }

          // 为该重复对推导反面示例规则
          const suggested_divert_rule = {
            scenario: `当用户需求偏重 [${b.display_name || b.name}] 的专精领域 (${b.clusters.join('、')}) 时`,
            why_avoid: `本技能偏重 [${a.display_name || a.name}]，为了防止跨生态同质化踩踏，应明确分流`,
            divert_to_skill_id: b.skill_id,
            divert_to_skill_name: b.display_name || b.name,
          };

          pairs.push({
            id: `dup-${a.skill_id}-${b.skill_id}`,
            skillA: a,
            skillB: b,
            similarity: sim,
            slotOverlap,
            riskLevel,
            reason,
            suggested_divert_rule,
          });
        }
      }
    }

    return pairs.sort((x, y) => y.similarity - x.similarity);
  }

  /**
   * 4. 自动为重复冲突技能对注入互补反面示例规则 (Negative Examples Injection)
   * 落实用户構想：通过在技能定义中加入明确负面规则，大幅提升正确触发率
   */
  public static autoInjectNegativeRulesForPair(pair: SkillDuplicatePair): {
    updatedA: Skill;
    updatedB: Skill;
  } {
    const ruleA = {
      scenario: `用户明确要求使用 ${pair.skillB.display_name || pair.skillB.name} 或聚焦于 [${pair.skillB.content_domain || pair.skillB.clusters[0]}] 专属流程`,
      why_avoid: `当前技能 [${pair.skillA.name}] 专精于 [${pair.skillA.content_domain || pair.skillA.clusters[0]}]，避免同质化抢占`,
      divert_to_skill_id: pair.skillB.skill_id,
      divert_to_skill_name: pair.skillB.display_name || pair.skillB.name,
    };

    const ruleB = {
      scenario: `用户明确要求使用 ${pair.skillA.display_name || pair.skillA.name} 或聚焦于 [${pair.skillA.content_domain || pair.skillA.clusters[0]}] 专属流程`,
      why_avoid: `当前技能 [${pair.skillB.name}] 专精于 [${pair.skillB.content_domain || pair.skillB.clusters[0]}]，避免同质化抢占`,
      divert_to_skill_id: pair.skillA.skill_id,
      divert_to_skill_name: pair.skillA.display_name || pair.skillA.name,
    };

    const updatedA: Skill = {
      ...pair.skillA,
      negative_examples: [
        ...(pair.skillA.negative_examples || []).filter((r) => r.divert_to_skill_id !== pair.skillB.skill_id),
        ruleA,
      ],
      negative_triggers: Array.from(
        new Set([...pair.skillA.negative_triggers, `别在专属${pair.skillB.display_name || pair.skillB.name}的场景调用我，请用${pair.skillB.name}`])
      ),
      disambiguation_features:
        (pair.skillA.disambiguation_features || '') +
        ` [反面示例已注入：若遇 ${pair.skillB.name} 场景自动分流]`,
      governance_status: 'healed',
    };

    const updatedB: Skill = {
      ...pair.skillB,
      negative_examples: [
        ...(pair.skillB.negative_examples || []).filter((r) => r.divert_to_skill_id !== pair.skillA.skill_id),
        ruleB,
      ],
      negative_triggers: Array.from(
        new Set([...pair.skillB.negative_triggers, `别在专属${pair.skillA.display_name || pair.skillA.name}的场景调用我，请用${pair.skillA.name}`])
      ),
      disambiguation_features:
        (pair.skillB.disambiguation_features || '') +
        ` [反面示例已注入：若遇 ${pair.skillA.name} 场景自动分流]`,
      governance_status: 'healed',
    };

    return { updatedA, updatedB };
  }
}
