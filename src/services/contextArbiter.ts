import { Skill, TransitionDecision, TransitionEvaluation } from '../types/agent';
import { SimpleEmbeddingProvider } from './embedding';

/**
 * 会话状态流转判定器 (Context Transition Arbiter)
 * 解决论文中指出的"长对话下答非所问 / 时序滞后响应 (Off-by-one Turn Lag)"
 */
export class ContextTransitionArbiter {
  // 零上下文依赖特征词 (Zero-Context Test Triggers)
  public static readonly DEPENDENT_TRIGGERS = [
    '这个',
    '那个',
    '不对',
    '为什么',
    '解释',
    '换一种',
    '刚才',
    '继续',
    '重新生成',
    '它的',
    '再说一遍',
    '还有呢',
    '把刚刚的',
    '上面的',
    '修改一下',
  ];

  public static evaluate(
    userInput: string,
    activeSkill: Skill | null,
    activeSlots: Record<string, any>
  ): TransitionEvaluation {
    if (!activeSkill) {
      return {
        decision: 'REROUTE',
        reason: '当前会话尚无活跃技能，直接启动两阶段检索路由。',
        similarityToActive: 0,
        isZeroContextDependent: false,
        hasSlotOverlap: false,
      };
    }

    const trimmed = userInput.trim();

    // 1. 结构自闭环测试 (Zero-Context Test)
    // 指令高度依赖上文代词、或者属于微短文本追问
    const matchedTrigger = this.DEPENDENT_TRIGGERS.find((t) => trimmed.includes(t));
    const isShortClarification = trimmed.length <= 6;
    const isZeroContextDependent = !!matchedTrigger || isShortClarification;

    if (isZeroContextDependent) {
      return {
        decision: 'RETAIN',
        reason: `检测到上下文依赖强词 (${matchedTrigger || '短句追问'})，触发【零上下文自闭环】，锁定复用当前技能 [${activeSkill.name}]，防止时序滞后漂移。`,
        similarityToActive: 1.0,
        isZeroContextDependent: true,
        hasSlotOverlap: false,
        matchedTrigger,
      };
    }

    // 2. 槽位与参数继承性检查 (Slot & Parameter Dependency)
    const slotOverlap = activeSkill.required_slots.some((slot) =>
      trimmed.toLowerCase().includes(slot.toLowerCase())
    );
    const hasSlotHistory = Object.keys(activeSlots).length > 0;

    if (slotOverlap && hasSlotHistory) {
      return {
        decision: 'RETAIN',
        reason: `检测到用户正针对当前技能 [${activeSkill.name}] 的专属槽位进行参数更新或回填，保持技能活跃。`,
        similarityToActive: 0.9,
        isZeroContextDependent: false,
        hasSlotOverlap: true,
      };
    }

    // 3. 技能能力边界匹配度 (Capability Boundary Match)
    const inputVec = SimpleEmbeddingProvider.getEmbedding(userInput);
    const relevance = SimpleEmbeddingProvider.cosineSimilarity(
      inputVec,
      activeSkill.embedding
    );

    // 语义明显脱离当前技能能力范围 (< 0.20)，果断主动中断旧技能，触发重新路由
    if (relevance < 0.20) {
      return {
        decision: 'REROUTE',
        reason: `用户指令与当前活跃技能 [${activeSkill.name}] 语义相似度仅 ${(relevance * 100).toFixed(1)}% (< 20%)，判定为意图跃迁，主动终止旧技能并触发重路由。`,
        similarityToActive: relevance,
        isZeroContextDependent: false,
        hasSlotOverlap: false,
      };
    }

    return {
      decision: 'RETAIN',
      reason: `指令与当前技能保持适中相关度 (${(relevance * 100).toFixed(1)}%)，继续沿用当前执行上下文。`,
      similarityToActive: relevance,
      isZeroContextDependent: false,
      hasSlotOverlap: false,
    };
  }
}
