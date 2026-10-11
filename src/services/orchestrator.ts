import {
  Skill,
  OrchestrationPlan,
  OrchestrationStep,
  SessionContext,
  TransitionEvaluation,
} from '../types/agent';
import { ContextTransitionArbiter } from './contextArbiter';
import { SkillIndexRouter } from './router';

export class TaskOrchestrator {
  private skills: Skill[];
  private router: SkillIndexRouter;

  constructor(skills: Skill[]) {
    this.skills = skills;
    this.router = new SkillIndexRouter(skills, 0.10);
  }

  /**
   * 1. 意图检测与任务拆解逻辑 (Single Intent vs Composite Pipeline)
   */
  public decomposeQuery(query: string): {
    intentType: 'single' | 'composite';
    steps: Array<{ title: string; targetCluster: string; queryFragment: string; inputFromStep?: string }>;
    detectedDomain: string;
  } {
    const q = query.trim();

    // 检查是否包含多阶段连续连词或指令连接符
    const sequenceSeparators = ['，然后', '，接着', '并且', '并生成', '并打上', '并发送', '并导出', '再', '随后'];
    const hasSequence = sequenceSeparators.some((sep) => q.includes(sep));

    // 复合任务常见场景匹配
    const isCompositeScenario =
      hasSequence ||
      (q.includes('分析') && q.includes('pdf')) ||
      (q.includes('pdf') && q.includes('水印')) ||
      (q.includes('报告') && (q.includes('邮件') || q.includes('通知')));

    if (isCompositeScenario) {
      // 拆解复合任务为流水线阶段
      const steps: Array<{ title: string; targetCluster: string; queryFragment: string; inputFromStep?: string }> = [];

      // 阶段 1: 数据处理/分析
      if (q.includes('数据') || q.includes('分析') || q.includes('指标') || q.includes('统计')) {
        steps.push({
          title: '业务数据分析与指标汇总',
          targetCluster: '数据分析',
          queryFragment: '分析业务数据并生成结构化总结',
        });
      }

      // 阶段 2: 文档排版或格式转换
      if (q.includes('pdf') || q.includes('文档') || q.includes('报告') || q.includes('排版')) {
        const prevStepId = steps.length > 0 ? `step-${steps.length}` : undefined;
        steps.push({
          title: '生成标准化 PDF 业务报告',
          targetCluster: '文档处理',
          queryFragment: '将结构化分析结果渲染转换为 PDF 格式文件',
          inputFromStep: prevStepId,
        });
      }

      // 阶段 3: 加盖水印或 Office 处理
      if (q.includes('水印') || q.includes('版权') || q.includes('加密') || q.includes('机密')) {
        const prevStepId = steps.length > 0 ? `step-${steps.length}` : undefined;
        steps.push({
          title: 'PDF 盖章与机密水印防护',
          targetCluster: 'Office工具',
          queryFragment: '为生成的 PDF 文档添加透明机密水印',
          inputFromStep: prevStepId,
        });
      }

      // 阶段 4: 邮件通知或团队同步
      if (q.includes('邮件') || q.includes('发送') || q.includes('通知') || q.includes('抄送')) {
        const prevStepId = steps.length > 0 ? `step-${steps.length}` : undefined;
        steps.push({
          title: '多渠道邮件通知与报告下发',
          targetCluster: '通信与协作',
          queryFragment: '将最终文档发送至团队邮箱或协作群组',
          inputFromStep: prevStepId,
        });
      }

      // 如果未命中特定复合模板但有分隔符，进行通用两步切分
      if (steps.length === 0) {
        steps.push(
          { title: '阶段一：主业务指令执行', targetCluster: '业务处理', queryFragment: q.slice(0, Math.floor(q.length / 2)) },
          { title: '阶段二：后续交付与导出', targetCluster: '文档处理', queryFragment: q.slice(Math.floor(q.length / 2)) }
        );
      }

      return {
        intentType: 'composite',
        steps,
        detectedDomain: '跨领域混合任务编排 (Cross-domain Composite Pipeline)',
      };
    }

    // 单一任务
    let targetCluster = '通用';
    if (q.includes('天气') || q.includes('气温') || q.includes('雨')) targetCluster = '气象';
    else if (q.includes('水印')) targetCluster = 'Office工具';
    else if (q.includes('pdf') || q.includes('转成') || q.includes('格式')) targetCluster = '文档处理';
    else if (q.includes('股票') || q.includes('行情') || q.includes('大盘')) targetCluster = '金融服务';
    else if (q.includes('数据') || q.includes('图表') || q.includes('分析')) targetCluster = '数据分析';

    return {
      intentType: 'single',
      steps: [
        {
          title: `任务执行：${q.slice(0, 24)}${q.length > 24 ? '...' : ''}`,
          targetCluster,
          queryFragment: q,
        },
      ],
      detectedDomain: targetCluster,
    };
  }

  /**
   * 2. 槽位提取器 (Slot Extraction)
   */
  public extractSlots(query: string, skill: Skill): Record<string, any> {
    const slots: Record<string, any> = {};

    for (const requiredSlot of skill.required_slots) {
      if (requiredSlot === 'city') {
        const cityListRegex = /(北京|上海|广州|深圳|杭州|成都|武汉|南京|西安|香港|天津|重庆|苏州|青岛|长沙|郑州|沈阳|厦门|福州|昆明|合肥|济南|哈尔滨|长春|南宁|贵阳|海口|三亚|拉萨|银川|西宁|乌鲁木齐|呼和浩特|无锡|宁波|佛山|东莞|大连)/;
        let match = query.match(cityListRegex);
        if (!match) {
          match = query.match(/([\u4e00-\u9fa5]{2,4})(?:市|区|县)?(?:的)?(?:天气|气温|气象|晴|雨|阴)/);
        }
        slots['city'] = match ? match[1] : (query.includes('北京') ? '北京' : '上海');
      } else if (requiredSlot === 'date') {
        const match = query.match(/(今天|明天|后天|这周|下周|周末|周一|周二|周三|周四|周五|周六|周日)/);
        slots['date'] = match ? match[1] : '明天';
      } else if (requiredSlot === 'file_name' || requiredSlot === 'file_path') {
        slots[requiredSlot] = 'financial_report_q3.pdf';
      } else if (requiredSlot === 'output_format') {
        slots['output_format'] = 'PDF';
      } else if (requiredSlot === 'watermark_text') {
        const match = query.match(/水印(?:内容)?(?:为|是|：)?["“']?([^"”'，。 ]+)["”']?/);
        slots['watermark_text'] = match ? match[1] : '机密文件 - 仅供内部阅读';
      } else if (requiredSlot === 'recipient') {
        slots['recipient'] = 'financial_team@company.internal';
      } else {
        slots[requiredSlot] = `[自动填充: ${requiredSlot}]`;
      }
    }

    return slots;
  }

  /**
   * 3. 编排计划生成器 (Plan Assembly)
   */
  public createPlan(
    query: string,
    session: SessionContext
  ): { plan: OrchestrationPlan; transitionEval: TransitionEvaluation } {
    // 1. 先进行时序与上下文转移判定 (解决 Off-by-one Lag)
    const transitionEval = ContextTransitionArbiter.evaluate(
      query,
      session.active_skill,
      session.active_slots
    );

    // 2. 任务拆解
    const decomposition = this.decomposeQuery(query);

    // 计算基准 Token: 全量技能 Prompt 载入 (Claude / OpenAI 传统全量描述 ~120 token/skill)
    const traditionalTokenBase = this.skills.length * 135;

    // 3. 构造编排步骤
    const steps: OrchestrationStep[] = decomposition.steps.map((rawStep, idx) => {
      const stepId = `step-${idx + 1}`;
      let targetSkill: Skill | null = null;
      let routingScore = 0;

      let negativeDivertedFrom: string | undefined;

      // 如果第一步判定为 RETAIN，并且与 activeSkill 相关，复用活跃技能
      if (idx === 0 && transitionEval.decision === 'RETAIN' && session.active_skill) {
        targetSkill = session.active_skill;
        routingScore = 0.98;
      } else {
        const routeResult = this.router.route(
          `${rawStep.queryFragment} ${rawStep.targetCluster}`,
          decomposition.detectedDomain
        );
        targetSkill = routeResult.selectedSkill;
        routingScore = routeResult.score;
        if (routeResult.divertedTargetSkill && routeResult.negativeExcluded.length > 0) {
          negativeDivertedFrom = `${routeResult.negativeExcluded[0].skill.name} (反面示例分流)`;
        }
      }

      // 提取入参槽位并继承上下文记忆
      const extractedSlots = targetSkill ? {
        ...(session.active_slots || {}),
        ...this.extractSlots(query, targetSkill),
      } : {};

      // 两阶段 Token 成本：仅载入所属簇轻量元数据 (~40 token) + 命中的完整 instruction (~150 token)
      const indexedTokenCost = 45 + 160;

      return {
        step_id: stepId,
        title: rawStep.title,
        target_cluster: rawStep.targetCluster,
        skill_id: targetSkill?.skill_id,
        skill_name: targetSkill?.name,
        required_slots: targetSkill?.required_slots || [],
        extracted_slots: extractedSlots,
        status: 'pending',
        input_from_step: rawStep.inputFromStep,
        routing_score: routingScore,
        negative_diverted_from: negativeDivertedFrom,
        token_budget: {
          traditional: traditionalTokenBase,
          indexed: indexedTokenCost,
        },
      };
    });

    const totalTraditional = traditionalTokenBase * steps.length;
    const totalIndexed = steps.reduce((sum, s) => sum + s.token_budget.indexed, 0);
    const savingsPercent = Math.round(((totalTraditional - totalIndexed) / totalTraditional) * 100);

    const plan: OrchestrationPlan = {
      plan_id: `plan-${Date.now().toString(36)}`,
      query,
      intent_type: decomposition.intentType,
      detected_domain: decomposition.detectedDomain,
      steps,
      transition_evaluation: transitionEval,
      total_token_traditional: totalTraditional,
      total_token_indexed: totalIndexed,
      token_savings_percent: Math.max(10, Math.min(95, savingsPercent)),
      status: 'idle',
      created_at: new Date().toLocaleTimeString(),
    };

    return { plan, transitionEval };
  }

  /**
   * 4. 模拟流水线执行 (Step-by-Step Execution Simulator)
   */
  public executeStep(
    step: OrchestrationStep,
    prevOutput?: string
  ): { output: string; success: boolean; errorMessage?: string } {
    const skill = this.skills.find((s) => s.skill_id === step.skill_id);

    if (!skill) {
      return {
        output: '',
        success: false,
        errorMessage: `未匹配到有效执行技能，簇 [${step.target_cluster}] 缺少可用工具。`,
      };
    }

    try {
      if (skill.mock_executor) {
        const output = skill.mock_executor(step.extracted_slots, prevOutput);
        return { output, success: true };
      }

      // 通用执行模拟返回
      const slotValues = Object.entries(step.extracted_slots)
        .map(([k, v]) => `${k}=${JSON.stringify(v)}`)
        .join(', ');

      const output = `[${skill.name}] 执行完毕。载荷槽位: (${slotValues || '无入参'})。${
        prevOutput ? ` 上游阶段入参依赖已接收: "${prevOutput.slice(0, 40)}..."` : ''
      }`;
      return { output, success: true };
    } catch (err: any) {
      skill.error_count += 1;
      return {
        output: '',
        success: false,
        errorMessage: err?.message || '技能执行异常中断',
      };
    }
  }
}
