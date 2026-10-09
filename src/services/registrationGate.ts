import { Skill, RegistrationCheckResult } from '../types/agent';
import { SimpleEmbeddingProvider } from './embedding';

export class SkillRegistrationGate {
  public static readonly SIMILARITY_COLLISION_THRESHOLD = 0.90; // 论文定义的 >= 0.90 门限

  /**
   * 预检测技能是否与现有技能库发生碰撞
   */
  public static checkCollision(
    skillCandidate: Partial<Skill>,
    existingSkills: Skill[]
  ): RegistrationCheckResult {
    const candidateText = `${skillCandidate.name || ''} ${skillCandidate.description || ''} ${(skillCandidate.clusters || []).join(' ')}`;
    const candidateVec = SimpleEmbeddingProvider.getEmbedding(candidateText);

    let maxSim = 0;
    let collidingSkill: Skill | undefined;

    for (const existing of existingSkills) {
      if (existing.skill_id === skillCandidate.skill_id) continue;

      const sim = SimpleEmbeddingProvider.cosineSimilarity(
        candidateVec,
        existing.embedding
      );

      if (sim > maxSim) {
        maxSim = sim;
        collidingSkill = existing;
      }
    }

    if (maxSim >= this.SIMILARITY_COLLISION_THRESHOLD && collidingSkill) {
      const hasNegativeTriggers =
        Array.isArray(skillCandidate.negative_triggers) &&
        skillCandidate.negative_triggers.some((t) => t && t.trim().length > 0);
      const hasDisambiguation =
        !!skillCandidate.disambiguation_features &&
        skillCandidate.disambiguation_features.trim().length > 0;

      if (!hasNegativeTriggers || !hasDisambiguation) {
        return {
          allowed: false,
          similarity: maxSim,
          collidingSkill,
          missingDisambiguation: true,
          message: `【注册拦截】与现有技能 [${collidingSkill.name}] 相似度达 ${(maxSim * 100).toFixed(1)}% (≥90%)。论文规范防碰撞门禁要求：必须填写消歧专有属性 (Disambiguation Features) 与负向触发条件 (Negative Triggers) 方可上线！`,
        };
      } else {
        return {
          allowed: true,
          similarity: maxSim,
          collidingSkill,
          missingDisambiguation: false,
          message: `【门禁通过】检测到高相似度 [${collidingSkill.name}] (${(maxSim * 100).toFixed(1)}%)，但已完善消歧专有属性与负向排除条件，允许特殊准入。`,
        };
      }
    }

    return {
      allowed: true,
      similarity: maxSim,
      collidingSkill: maxSim > 0.4 ? collidingSkill : undefined,
      missingDisambiguation: false,
      message: maxSim > 0
        ? `【门禁通过】最大相似度为 ${(maxSim * 100).toFixed(1)}% (低于 90% 门限)，无命名与语义踩踏风险。`
        : `【门禁通过】全新技能，与库内已有技能无冲突。`,
    };
  }
}
