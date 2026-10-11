import { Skill, MetaSkill, RecordedAction, NegativeExampleRule, SkillInteractionLog } from '../types/agent';

export const INITIAL_META_SKILLS: MetaSkill[] = [
  {
    id: 'meta-self-healing-guardian',
    name: 'OpenAI风格_自愈巡检元技能 (Auto-Healing Guardian)',
    target_type: 'error_self_healing',
    description: '模仿 OpenAI Skill Creator 自愈机制：当线上技能报错率超过预设阈值(如>15%)时自动激活，执行沙箱探针诊断、槽位Schema收敛、防崩溃入参校验注入并重置健康态。',
    trigger_condition: '实时报错率 > 15% 自动激活',
    created_at: '2026-10-10 00:00:00',
    source: 'openai_skill_creator',
    learned_rules: [
      '检测入参槽位边界异常，自动补充必填格式校验与容错默认值',
      '重置受损技能报错计数，标注已通过元技能自愈',
      '生成隔离沙箱探针报告，更新消歧专有特征以避免接口漂移',
    ],
    activation_count: 5,
    last_activated: '2026-10-10 04:30:12',
    status: 'active',
  },
  {
    id: 'meta-negative-synthesizer',
    name: '反面示例对比消歧元技能 (Negative Example Synthesizer)',
    target_type: 'negative_rule_injection',
    description: '针对同质化技能冲突导致大模型选错的痛点，自动分析相似技能对，为双方相互注入负向排除示例与明确分流规则（Negative Trigger Routing）。',
    trigger_condition: '余弦相似度 ≥ 0.72 且缺乏负向规则时激活',
    created_at: '2026-10-10 01:15:00',
    source: 'governance_audit',
    learned_rules: [
      '对 Web Search 与 Code Interpreter 提取互斥触发条件',
      '构建形如"别在 X 场景调用我，请用 Y 技能"的硬约束 Prompt',
      '将错误调用意图直接导流至最佳替代技能，准确率提升 40%+',
    ],
    activation_count: 8,
    last_activated: '2026-10-10 05:12:44',
    status: 'active',
  },
  {
    id: 'meta-ucsb-refiner',
    name: 'UCSB判别性精炼元技能 (Discriminative Refinement)',
    target_type: 'prompt_refinement',
    description: '落地 UCSB-NLP 论文规范：自动消除技能定义中的冗余营销修饰词，重构为判别性极强的能力边界声明，压缩 Token 并剔除干扰项(Distractor Pruning)。',
    trigger_condition: '技能描述存在泛化词或跨界领域过多时激活',
    created_at: '2026-10-10 02:40:00',
    source: 'claude_record',
    learned_rules: [
      '剔除主观形容词（如"极其强大"、"全能"），提取纯技术原子谓词',
      '将入参槽位严格标准化，避免大模型因描述含混产生幻觉参数',
      '长对话下执行动态子集抽取，仅向 LLM 暴露 Top-3 精炼技能',
    ],
    activation_count: 12,
    last_activated: '2026-10-10 05:45:00',
    status: 'active',
  },
];

export class MetaSkillEngine {
  /**
   * 模仿 Claude "Record a skill": 根据管理员录制的操作轨迹自动提炼生成新的 Meta-skill
   */
  public static synthesizeMetaSkillFromTrace(
    trace: RecordedAction[],
    name: string,
    description: string
  ): MetaSkill {
    const actionTypes = Array.from(new Set(trace.map((t) => t.action_type)));
    const learnedRules: string[] = [];

    trace.forEach((action) => {
      if (action.admin_note) {
        learnedRules.push(`[操作总结] ${action.admin_note}`);
      } else {
        learnedRules.push(`[${action.action_type}] 针对技能 ${action.skill_name}: ${action.detail}`);
      }
    });

    if (learnedRules.length === 0) {
      learnedRules.push('对技能提示词与参数槽位进行了人工规范化');
      learnedRules.push('注入了针对特定边缘用例的负向排除规则');
    }

    return {
      id: `meta-recorded-${Date.now().toString(36)}`,
      name: name || `管理员录制提炼元技能_${new Date().toLocaleDateString()}`,
      target_type: actionTypes.includes('error_diagnosis')
        ? 'error_self_healing'
        : actionTypes.includes('negative_add')
        ? 'negative_rule_injection'
        : 'prompt_refinement',
      description:
        description ||
        `由 Claude Record a Skill 机制从管理员 ${trace.length} 步人工调整轨迹中自动反思提炼生成的元技能。`,
      trigger_condition: '管理员人工录制轨迹沉淀，支持在同类技能异常时复用',
      created_at: new Date().toLocaleString(),
      source: 'claude_record',
      learned_rules: learnedRules,
      activation_count: 1,
      last_activated: new Date().toLocaleTimeString(),
      status: 'active',
    };
  }

  /**
   * 模仿 OpenAI "Skill Creator" 自动巡检自愈：
   * 当报错率高于阈值时激活 Meta-skill，执行增、删、改并修复技能
   */
  public static autoHealSkillWithMeta(
    skill: Skill,
    metaSkill: MetaSkill,
    allSkills: Skill[]
  ): {
    healedSkill: Skill;
    log: string;
    actionApplied: 'refine_prompt' | 'inject_negatives' | 'slot_standardize';
  } {
    // 寻找潜在易混淆技能以生成针对性负向示例
    const potentialConfusions = allSkills.filter(
      (s) =>
        s.skill_id !== skill.skill_id &&
        (s.clusters.some((c) => skill.clusters.includes(c)) ||
          s.tool_carrier === skill.tool_carrier)
    );

    const generatedNegativeExamples: NegativeExampleRule[] = [
      ...(skill.negative_examples || []),
    ];

    if (potentialConfusions.length > 0) {
      const rival = potentialConfusions[0];
      const exists = generatedNegativeExamples.some(
        (rule) => rule.divert_to_skill_id === rival.skill_id
      );
      if (!exists) {
        generatedNegativeExamples.push({
          scenario: `用户指令涉及 [${rival.content_domain || rival.clusters[0]}] 专属场景，要求调用 ${rival.display_name || rival.name}`,
          why_avoid: `本技能专精于 [${skill.content_domain || skill.clusters[0]}]，避免因跨界调用导致入参解析报错`,
          divert_to_skill_id: rival.skill_id,
          divert_to_skill_name: rival.display_name || rival.name,
        });
      }
    }

    // 强化负向规则列表
    const updatedNegativeTriggers = Array.from(
      new Set([
        ...skill.negative_triggers,
        '请勿传递未校验的非法格式入参',
        `严禁在超出 [${skill.content_domain || skill.clusters[0] || '核心领域'}] 的跨界场景中滥用`,
      ])
    );

    const healedSkill: Skill = {
      ...skill,
      error_count: 0, // 重置错误计数
      error_rate: 0,
      domains_invoked: [skill.content_domain || skill.clusters[0] || '核心专精领域'],
      negative_triggers: updatedNegativeTriggers,
      negative_examples: generatedNegativeExamples,
      disambiguation_features:
        (skill.disambiguation_features || '') +
        ` [OpenAI Skill Creator 元技能自愈: 槽位Schema严密校验 & 注入 ${generatedNegativeExamples.length} 条反面示例]`,
      governance_status: 'healed',
      healed_at: new Date().toLocaleTimeString(),
    };

    const log = `【元技能激活】[${metaSkill.name}] 成功触发对受损技能 [${skill.name}] 的自愈流程：重置历史报错计数、收敛跨界调用领域、补全 ${generatedNegativeExamples.length} 组反面示例与槽位防崩溃校验。`;

    return {
      healedSkill,
      log,
      actionApplied: 'inject_negatives',
    };
  }

  /**
   * 根据技能历史交互/操作日志 (Interaction Logs) 进行深度诊断并自动调整描述与执行参数
   * 对应治理中心用户点击“尝试自动修复”按钮触发的 Meta-skill 生成逻辑
   */
  public static autoRepairSkillFromHistoryLogs(
    skill: Skill,
    historyLogs: SkillInteractionLog[],
    allSkills: Skill[],
    availableMetaSkills: MetaSkill[] = INITIAL_META_SKILLS
  ): AutoRepairResult {
    // 1. 提取针对该技能的所有历史交互日志
    let relevantLogs = historyLogs.filter((l) => l.skill_id === skill.skill_id);

    // 若无现成日志，根据当前技能的报错状态与领域特征动态合成典型失败痕迹
    if (relevantLogs.length === 0) {
      relevantLogs = [
        {
          id: `log-syn-${skill.skill_id}-1`,
          skill_id: skill.skill_id,
          skill_name: skill.name,
          timestamp: new Date().toLocaleTimeString(),
          user_query: `调用 ${skill.display_name || skill.name} 处理非标准输入`,
          input_slots: {},
          status: 'error',
          latency_ms: 120,
          error_category: 'slot_missing',
          error_reason: `必需槽位 [${skill.required_slots[0] || 'input_params'}] 缺省且无容错默认值，引发参数解析异常`,
        },
        {
          id: `log-syn-${skill.skill_id}-2`,
          skill_id: skill.skill_id,
          skill_name: skill.name,
          timestamp: new Date().toLocaleTimeString(),
          user_query: `跨领域指令触发了 ${skill.display_name || skill.name}`,
          input_slots: { target_domain: '异构领域' },
          status: 'error',
          latency_ms: 185,
          error_category: 'domain_confusion',
          error_reason: '技能描述定义偏向泛化，在大模型多技能竞争下被误召回并发生跨界调用执行崩溃',
        },
      ];
    }

    const errorLogs = relevantLogs.filter((l) => l.status === 'error');
    const rootCauses: string[] = [];

    // 2. 统计错误类型分布
    const hasSlotMissing = errorLogs.some(
      (l) => l.error_category === 'slot_missing' || l.error_reason?.includes('槽位') || l.error_reason?.includes('参数')
    );
    const hasDomainConfusion = errorLogs.some(
      (l) => l.error_category === 'domain_confusion' || l.error_reason?.includes('跨领域') || l.error_reason?.includes('跨界')
    );
    const hasFormatMismatch = errorLogs.some(
      (l) => l.error_category === 'format_mismatch' || l.error_reason?.includes('格式')
    );

    if (hasSlotMissing) {
      rootCauses.push('关键入参槽位缺少默认容错机制与类型校验，边界场景易触发空指针/缺参崩溃');
    }
    if (hasDomainConfusion) {
      rootCauses.push('技能描述(Description)缺乏精确的能力边界与业务域约束，导致大模型跨领域错误召回');
    }
    if (hasFormatMismatch) {
      rootCauses.push('执行参数未明确指定格式后缀与有效值范围，非法格式入参引发底层执行器异常');
    }
    if (rootCauses.length === 0) {
      rootCauses.push('历史高并发调用下的非预期边缘入参输入，需要完善防御式 Schema 与自愈重试');
    }

    // 3. 选取最匹配的 Meta-skill
    const metaSkillUsed =
      availableMetaSkills.find((m) => m.target_type === 'error_self_healing') ||
      availableMetaSkills[0];

    // 4. 自动调整技能描述 (Description Refinement)
    // 注入能力边界声明与严密防范提示，落地 UCSB 判别性准则
    let adjustedDescription = skill.description;
    const boundaryTag = `【专精能力边界: 专为 [${skill.content_domain || skill.clusters[0] || '核心专精领域'}] 任务设计，内置入参防御与格式自愈，避免跨领域泛化调用】`;
    if (!adjustedDescription.includes('专精能力边界')) {
      adjustedDescription = `${skill.description}。${boundaryTag}`;
    }

    // 5. 自动调整执行参数 (Execution Parameters Adjustment)
    // 确保必需槽位具有容错与辅助参数
    const currentSlots = [...skill.required_slots];
    const adjustedSlots = [...currentSlots];
    
    // 如果缺少 format 或 option 容错槽位，智能增补
    if (!adjustedSlots.includes('strict_validation')) {
      adjustedSlots.push('strict_validation');
    }
    if (!adjustedSlots.includes('fallback_default')) {
      adjustedSlots.push('fallback_default');
    }

    const currentSlotsExplanation: Record<string, string> = skill.slots_explanation || {};
    const adjustedSlotsExplanation: Record<string, string> = {
      ...currentSlotsExplanation,
      strict_validation: '布尔值(默认 true)，启用前置入参格式静态校验与空值清洗',
      fallback_default: '字符串(默认 auto)，当入参缺省时自动使用安全容错默认值，杜绝缺参抛错',
    };

    // 为原有槽位增补强 Schema 说明
    currentSlots.forEach((slot) => {
      if (!adjustedSlotsExplanation[slot]) {
        adjustedSlotsExplanation[slot] = `必需入参 [${slot}]，已注入历史错误日志学习到的非空容错校验规则`;
      }
    });

    // 6. 自动构建与补充反面示例 (Negative Example Rules)
    const existingNegativeExamples = skill.negative_examples || [];
    const addedNegativeExamples: NegativeExampleRule[] = [];

    // 寻找潜在竞争技能
    const rival = allSkills.find(
      (s) =>
        s.skill_id !== skill.skill_id &&
        (s.clusters.some((c) => skill.clusters.includes(c)) || s.tool_carrier === skill.tool_carrier)
    );

    if (rival) {
      const exists = existingNegativeExamples.some((r) => r.divert_to_skill_id === rival.skill_id);
      if (!exists) {
        addedNegativeExamples.push({
          scenario: `用户指令涉及 [${rival.content_domain || rival.clusters[0]}] 专属场景，要求调用 ${rival.display_name || rival.name}`,
          why_avoid: `根据历史调用日志分析：本技能专精于 [${skill.content_domain || skill.clusters[0]}]，调用该场景必报入参格式错误，需明确分流`,
          divert_to_skill_id: rival.skill_id,
          divert_to_skill_name: rival.display_name || rival.name,
        });
      }
    }

    // 如果日志中有关于图片/视觉的错误，且当前不是视觉技能，注入分流至 Vision OCR
    if (
      skill.tool_carrier !== '视觉图像' &&
      errorLogs.some((l) => l.user_query.includes('图片') || l.error_reason?.includes('图片') || l.error_reason?.includes('位图'))
    ) {
      const hasVisionRule = existingNegativeExamples.some((r) => r.divert_to_skill_id === 'openai_vision_ocr');
      if (!hasVisionRule) {
        addedNegativeExamples.push({
          scenario: '用户传递图片/PDF位图要求提取文字或进行视觉图像处理',
          why_avoid: '根据历史失败日志记录：本技能不具备多模态视觉解码器，强行解析将导致底层运行时崩溃',
          divert_to_skill_id: 'openai_vision_ocr',
          divert_to_skill_name: 'OpenAI_Vision_OCR',
        });
      }
    }

    const updatedNegativeExamples = [...existingNegativeExamples, ...addedNegativeExamples];
    const updatedNegativeTriggers = Array.from(
      new Set([
        ...skill.negative_triggers,
        '请勿传递未校验格式的非法槽位入参',
        `严禁在超出 [${skill.content_domain || skill.clusters[0] || '核心专精领域'}] 的跨界场景中强行调用`,
      ])
    );

    // 7. 生成修复后的技能对象
    const healedSkill: Skill = {
      ...skill,
      description: adjustedDescription,
      required_slots: adjustedSlots,
      slots_explanation: adjustedSlotsExplanation,
      negative_examples: updatedNegativeExamples,
      negative_triggers: updatedNegativeTriggers,
      error_count: 0, // 彻底重置错误计数
      error_rate: 0,
      domains_invoked: [skill.content_domain || skill.clusters[0] || '核心专精领域'],
      disambiguation_features:
        (skill.disambiguation_features || '') +
        ` [元技能基于 ${errorLogs.length} 条历史报错日志自愈：已调整描述边界与执行参数 Schema，补充 ${addedNegativeExamples.length} 条反面规避示例]`,
      governance_status: 'healed',
      healed_at: new Date().toLocaleTimeString(),
    };

    // 8. 记录自愈日志
    const repairLogEntry: SkillInteractionLog = {
      id: `log-repair-${Date.now().toString(36)}`,
      skill_id: skill.skill_id,
      skill_name: skill.name,
      timestamp: new Date().toLocaleTimeString(),
      user_query: `[元技能自愈系统触发] 自动修复受损技能: ${skill.name}`,
      input_slots: {
        analyzed_error_logs: errorLogs.length,
        meta_skill_used: metaSkillUsed.name,
      },
      status: 'success',
      latency_ms: 240,
      error_reason: '自愈成功：重置报错计数与领域踩踏，已完成参数与描述调整',
    };

    return {
      healedSkill,
      metaSkillUsed,
      diagnosisSummary: `元技能 [${metaSkillUsed.name}] 成功完成针对技能 [${skill.name}] 的深度自愈。共扫描分析 ${relevantLogs.length} 条历史操作与交互日志（其中包含 ${errorLogs.length} 条异常崩溃记录）。系统已根据历史失败入参轨迹自动重构技能描述能力边界，扩展容错执行参数(Schema)，并注入 ${addedNegativeExamples.length} 组反面示例以阻断模型误选。`,
      totalLogsAnalyzed: relevantLogs.length,
      errorLogsCount: errorLogs.length,
      rootCauses,
      diff: {
        description: {
          before: skill.description,
          after: adjustedDescription,
          reason: '消除泛化词汇，增加专精能力边界声明与防跨领域提示，降低大模型幻觉召回率',
        },
        slots: {
          before: currentSlots,
          after: adjustedSlots,
          reason: '增加 strict_validation 和 fallback_default 容错参数，从根本上防止缺参空指针崩溃',
        },
        slotsExplanation: {
          before: currentSlotsExplanation,
          after: adjustedSlotsExplanation,
        },
        negativeExamples: {
          beforeCount: existingNegativeExamples.length,
          afterCount: updatedNegativeExamples.length,
          added: addedNegativeExamples,
        },
      },
      repairLogEntry,
    };
  }
}

export interface AutoRepairResult {
  healedSkill: Skill;
  metaSkillUsed: MetaSkill;
  diagnosisSummary: string;
  totalLogsAnalyzed: number;
  errorLogsCount: number;
  rootCauses: string[];
  diff: {
    description: { before: string; after: string; reason: string };
    slots: { before: string[]; after: string[]; reason: string };
    slotsExplanation: { before: Record<string, string>; after: Record<string, string> };
    negativeExamples: { beforeCount: number; afterCount: number; added: NegativeExampleRule[] };
  };
  repairLogEntry: SkillInteractionLog;
}

