import React, { useState } from 'react';
import {
  Skill,
  OrchestrationPlan,
  SessionContext,
  TransitionEvaluation,
} from '../types/agent';
import { TaskOrchestrator } from '../services/orchestrator';
import {
  Sparkles,
  Play,
  RotateCcw,
  CheckCircle2,
  Clock,
  ArrowRight,
  Zap,
  Cpu,
  CornerDownRight,
  Database,
  ShieldAlert,
} from 'lucide-react';

interface OrchestratorViewProps {
  skills: Skill[];
  session: SessionContext;
  onUpdateSession: (updater: (prev: SessionContext) => SessionContext) => void;
  onSkillCalled: (skillId: string, hadError?: boolean) => void;
}

export const OrchestratorView: React.FC<OrchestratorViewProps> = ({
  skills,
  session,
  onUpdateSession,
  onSkillCalled,
}) => {
  const [inputQuery, setInputQuery] = useState(
    '分析上周销售数据，生成PDF总结报告，并打上机密水印，随后邮件抄送团队'
  );
  const [currentPlan, setCurrentPlan] = useState<OrchestrationPlan | null>(null);
  const [transitionEval, setTransitionEval] = useState<TransitionEvaluation | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [executionLog, setExecutionLog] = useState<string[]>([]);

  const orchestrator = new TaskOrchestrator(skills);

  const presetScenarios = [
    {
      label: '⚡ 复合流水线编排',
      query: '分析上周销售数据，生成PDF总结报告，并打上机密水印，随后邮件抄送团队',
      desc: '测试跨领域多技能 DAG 自动拆解与槽位管道透传',
    },
    {
      label: '🎯 单意图精准路由',
      query: '查询上海明天的天气预报和气温走势',
      desc: '测试两阶段簇空间检索与槽位自动绑定',
    },
    {
      label: '🔄 时序滞后测试 (RETAIN)',
      query: '不对，解释一下为什么会降温？',
      desc: '触发零上下文依赖仲裁，锁定维持当前技能，避免误杀',
    },
    {
      label: '🔀 意图跃迁测试 (REROUTE)',
      query: '帮我把这份财务报告转成 PDF 格式',
      desc: '检测语义漂移 (<20%)，主动中断旧技能并重路由',
    },
    {
      label: '🛑 负向规则规避',
      query: '请用 PDF_Watermarker 去掉图片的水印',
      desc: '触发技能内建 Negative Trigger 规则硬性排除',
    },
  ];

  // 生成编排计划并立即执行
  const handlePlanAndExecute = async (queryToUse?: string) => {
    const q = (queryToUse || inputQuery).trim();
    if (!q || isRunning) return;

    const { plan, transitionEval: tEval } = orchestrator.createPlan(q, session);
    setTransitionEval(tEval);
    setIsRunning(true);

    const runningPlan: OrchestrationPlan = { ...plan, status: 'running' };
    setCurrentPlan(runningPlan);

    setExecutionLog([
      `[${new Date().toLocaleTimeString()}] 收到用户指令: "${q}"`,
      `[${new Date().toLocaleTimeString()}] 时序仲裁决断: ${tEval.decision} -> ${tEval.reason}`,
      `[${new Date().toLocaleTimeString()}] 意图模式: ${
        plan.intent_type === 'composite' ? '复合流水线 (Composite DAG)' : '单一技能路由 (Single Intent)'
      }，检测域: ${plan.detected_domain}`,
      `[${new Date().toLocaleTimeString()}] 自动启动流水线编排执行...`,
    ]);

    let prevStepOutput = '';

    for (let i = 0; i < runningPlan.steps.length; i++) {
      const step = runningPlan.steps[i];
      step.status = 'running';
      setCurrentPlan({ ...runningPlan });

      setExecutionLog((prev) => [
        ...prev,
        `[${new Date().toLocaleTimeString()}] 阶段 ${i + 1}/${runningPlan.steps.length} 开始: [${
          step.title
        }] -> 调度技能: ${step.skill_name || '未命中'}`,
      ]);

      await new Promise((resolve) => setTimeout(resolve, 600));

      const execResult = orchestrator.executeStep(step, prevStepOutput);

      if (execResult.success) {
        step.status = 'completed';
        step.output = execResult.output;
        prevStepOutput = execResult.output;

        if (step.skill_id) {
          onSkillCalled(step.skill_id, false);
        }

        setExecutionLog((prev) => [
          ...prev,
          `[${new Date().toLocaleTimeString()}] 阶段 ${i + 1} 执行成功: ${execResult.output}`,
        ]);
      } else {
        step.status = 'failed';
        step.error_message = execResult.errorMessage;

        if (step.skill_id) {
          onSkillCalled(step.skill_id, true);
        }

        setExecutionLog((prev) => [
          ...prev,
          `[${new Date().toLocaleTimeString()}] 阶段 ${i + 1} 发生异常: ${execResult.errorMessage}`,
        ]);
        break;
      }

      setCurrentPlan({ ...runningPlan });
    }

    const lastCompletedStep = [...runningPlan.steps].reverse().find((s) => s.status === 'completed');
    if (lastCompletedStep && lastCompletedStep.skill_id) {
      const activeSkill = skills.find((s) => s.skill_id === lastCompletedStep.skill_id) || null;
      onUpdateSession((prev) => ({
        ...prev,
        active_skill: activeSkill,
        active_slots: lastCompletedStep.extracted_slots,
        last_query: runningPlan.query,
        last_output: lastCompletedStep.output || '',
        domain_history: [
          ...prev.domain_history,
          lastCompletedStep.target_cluster,
        ].slice(-6),
      }));
    }

    runningPlan.status = runningPlan.steps.every((s) => s.status === 'completed') ? 'completed' : 'failed';
    setCurrentPlan({ ...runningPlan });
    setIsRunning(false);

    setExecutionLog((prev) => [
      ...prev,
      `[${new Date().toLocaleTimeString()}] 任务流水线执行完毕！最终状态: ${
        runningPlan.status === 'completed' ? '全部成功交付' : '部分中断'
      }。`,
    ]);
  };

  // 仅规划
  const handleGeneratePlan = (queryToUse?: string) => {
    const q = (queryToUse || inputQuery).trim();
    if (!q) return;

    const { plan, transitionEval: tEval } = orchestrator.createPlan(q, session);
    setCurrentPlan(plan);
    setTransitionEval(tEval);
    setExecutionLog([
      `[${new Date().toLocaleTimeString()}] 收到用户指令: "${q}"`,
      `[${new Date().toLocaleTimeString()}] 时序仲裁决断: ${tEval.decision} -> ${tEval.reason}`,
      `[${new Date().toLocaleTimeString()}] 规划生成 ${plan.steps.length} 个编排步骤，请点击“执行流水线”开始运行。`,
    ]);
  };

  // 运行编排执行
  const handleExecutePlan = async () => {
    if (!currentPlan || isRunning) return;

    setIsRunning(true);
    const updatedPlan: OrchestrationPlan = { ...currentPlan, status: 'running' };
    setCurrentPlan(updatedPlan);

    let prevStepOutput = '';

    for (let i = 0; i < updatedPlan.steps.length; i++) {
      const step = updatedPlan.steps[i];
      step.status = 'running';
      setCurrentPlan({ ...updatedPlan });

      setExecutionLog((prev) => [
        ...prev,
        `[${new Date().toLocaleTimeString()}] 阶段 ${i + 1}/${updatedPlan.steps.length} 开始: [${
          step.title
        }] -> 调度技能: ${step.skill_name || '未命中'}`,
      ]);

      // 模拟执行耗时
      await new Promise((resolve) => setTimeout(resolve, 850));

      const execResult = orchestrator.executeStep(step, prevStepOutput);

      if (execResult.success) {
        step.status = 'completed';
        step.output = execResult.output;
        prevStepOutput = execResult.output;

        if (step.skill_id) {
          onSkillCalled(step.skill_id, false);
        }

        setExecutionLog((prev) => [
          ...prev,
          `[${new Date().toLocaleTimeString()}] 阶段 ${i + 1} 执行成功: ${execResult.output}`,
        ]);
      } else {
        step.status = 'failed';
        step.error_message = execResult.errorMessage;

        if (step.skill_id) {
          onSkillCalled(step.skill_id, true);
        }

        setExecutionLog((prev) => [
          ...prev,
          `[${new Date().toLocaleTimeString()}] 阶段 ${i + 1} 发生异常: ${execResult.errorMessage}`,
        ]);
        break;
      }

      setCurrentPlan({ ...updatedPlan });
    }

    // 更新最后活跃技能及槽位
    const lastCompletedStep = [...updatedPlan.steps].reverse().find((s) => s.status === 'completed');
    if (lastCompletedStep && lastCompletedStep.skill_id) {
      const activeSkill = skills.find((s) => s.skill_id === lastCompletedStep.skill_id) || null;
      onUpdateSession((prev) => ({
        ...prev,
        active_skill: activeSkill,
        active_slots: lastCompletedStep.extracted_slots,
        last_query: updatedPlan.query,
        last_output: lastCompletedStep.output || '',
        domain_history: [
          ...prev.domain_history,
          lastCompletedStep.target_cluster,
        ].slice(-6),
      }));
    }

    updatedPlan.status = updatedPlan.steps.every((s) => s.status === 'completed') ? 'completed' : 'failed';
    setCurrentPlan({ ...updatedPlan });
    setIsRunning(false);

    setExecutionLog((prev) => [
      ...prev,
      `[${new Date().toLocaleTimeString()}] 任务编排流水线最终状态: ${
        updatedPlan.status === 'completed' ? '全部成功' : '部分中断'
      }。`,
    ]);
  };

  const handleResetSession = () => {
    onUpdateSession(() => ({
      active_skill: null,
      active_slots: {},
      last_query: '',
      last_output: '',
      domain_history: [],
    }));
    setTransitionEval(null);
    setCurrentPlan(null);
    setExecutionLog([`[${new Date().toLocaleTimeString()}] 会话上下文已重置为全新状态。`]);
  };

  return (
    <div className="space-y-6">
      {/* 顶部场景快速选择栏 */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
        <div className="flex items-center justify-between gap-4 mb-3">
          <div className="text-xs font-semibold text-slate-300 flex items-center gap-2">
            <Zap className="w-4 h-4 text-amber-400" />
            快速运行预设验证场景（覆盖论文全部核心测试用例）
          </div>
          <span className="text-xs text-slate-500">点击自动填入并解析</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-2">
          {presetScenarios.map((item, idx) => (
            <button
              key={idx}
              onClick={() => {
                setInputQuery(item.query);
                handlePlanAndExecute(item.query);
              }}
              className="text-left p-2.5 rounded-lg bg-slate-950/70 border border-slate-800/80 hover:border-indigo-500/50 hover:bg-slate-800/50 transition-all group"
            >
              <div className="text-xs font-semibold text-slate-200 group-hover:text-indigo-300">
                {item.label}
              </div>
              <div className="text-[11px] text-slate-400 line-clamp-1 mt-1">
                {item.desc}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* 核心输入与操作区 */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
        <label className="block text-xs font-medium text-slate-300 mb-2">
          智能体任务指令输入 (Agent Task Input)
        </label>
        <div className="flex flex-col sm:flex-row gap-3">
          <input
            type="text"
            value={inputQuery}
            onChange={(e) => setInputQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handlePlanAndExecute()}
            placeholder="输入自然语言任务指令，如：查询上海明天的天气预报、分析数据并生成带水印的PDF报告..."
            className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-4 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
          />
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => handlePlanAndExecute()}
              disabled={isRunning}
              className="px-4 py-2.5 text-xs font-semibold text-white bg-emerald-600 rounded-lg hover:bg-emerald-500 transition-colors disabled:opacity-50 flex items-center gap-2 whitespace-nowrap shadow-sm"
            >
              <Zap className="w-3.5 h-3.5" />
              {isRunning ? '正在编排执行...' : '⚡ 规划并立即执行'}
            </button>
            <button
              onClick={() => handleGeneratePlan()}
              disabled={isRunning}
              className="px-3.5 py-2.5 text-xs font-semibold text-slate-300 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-1.5 whitespace-nowrap"
            >
              <Sparkles className="w-3.5 h-3.5" />
              仅规划步骤
            </button>
          </div>
        </div>

        {/* 当前活跃技能上下文状态提示 */}
        <div className="mt-4 pt-3 border-t border-slate-800/80 flex flex-wrap items-center justify-between text-xs text-slate-400 gap-3">
          <div className="flex items-center gap-2">
            <span className="text-slate-500">当前活跃技能 (Active Skill):</span>
            {session.active_skill ? (
              <span className="font-medium text-indigo-300 bg-indigo-950/60 px-2 py-0.5 rounded border border-indigo-800/60 font-mono">
                {session.active_skill.name}
              </span>
            ) : (
              <span className="text-slate-500">无 (初始无状态)</span>
            )}
            <span className="text-slate-600">·</span>
            <span className="text-slate-500">记忆槽位:</span>
            <span className="font-mono text-slate-300">
              {Object.keys(session.active_slots).length > 0
                ? JSON.stringify(session.active_slots)
                : '空'}
            </span>
          </div>

          <button
            onClick={handleResetSession}
            className="text-xs text-slate-400 hover:text-slate-200 flex items-center gap-1 transition-colors"
          >
            <RotateCcw className="w-3 h-3" />
            重置会话上下文
          </button>
        </div>
      </div>

      {/* 时序滞后仲裁器检测结果 (Context Transition Arbiter Card) */}
      {transitionEval && (
        <div
          className={`border rounded-xl p-4 transition-all ${
            transitionEval.decision === 'RETAIN'
              ? 'bg-amber-950/20 border-amber-800/40 text-amber-200'
              : 'bg-indigo-950/20 border-indigo-800/40 text-indigo-200'
          }`}
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-slate-900 border border-slate-700 font-mono">
                  仲裁结果: {transitionEval.decision}
                </span>
                <span className="text-xs font-semibold text-white">
                  {transitionEval.decision === 'RETAIN'
                    ? '锁定维持原技能（Zero-Context 零上下文自闭环生效）'
                    : '主动中断旧技能，启动两阶段重路由（意图跃迁）'}
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-2 leading-relaxed">
                {transitionEval.reason}
              </p>
            </div>
            <div className="text-right shrink-0">
              <span className="text-[11px] text-slate-400 block">活跃技能相关度</span>
              <span className="text-sm font-bold font-mono tabular-nums text-white">
                {(transitionEval.similarityToActive * 100).toFixed(1)}%
              </span>
            </div>
          </div>
        </div>
      )}

      {/* 编排计划与 Token 节约对比 */}
      {currentPlan && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* 左侧两列：流水线步骤详情 */}
          <div className="lg:col-span-2 space-y-4">
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Cpu className="w-4 h-4 text-indigo-400" />
                  <h3 className="text-sm font-semibold text-white">
                    任务编排执行图谱 (Execution Pipeline)
                  </h3>
                </div>
                <div className="text-xs text-slate-400 flex items-center gap-2">
                  <span>模式:</span>
                  <span className="font-semibold text-slate-200 font-mono">
                    {currentPlan.intent_type === 'composite' ? '复合阶段流 (DAG)' : '单一原子任务'}
                  </span>
                </div>
              </div>

              {/* 核心交付成果高亮卡片 (解决“答案在哪里输出”的问题) */}
              {currentPlan.steps.some((s) => s.status === 'completed' && s.output) && (
                <div className="mb-4 p-4 rounded-xl bg-emerald-950/40 border border-emerald-500/60 shadow-lg text-xs space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-emerald-300 flex items-center gap-1.5 text-xs">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      🎯 最终执行结果与交付产出 (Execution Output):
                    </span>
                    <span className="text-[10px] text-emerald-400 font-mono bg-emerald-900/40 px-2 py-0.5 rounded border border-emerald-800/80">
                      成功就绪
                    </span>
                  </div>
                  <div className="space-y-2">
                    {currentPlan.steps
                      .filter((s) => s.status === 'completed' && s.output)
                      .map((s, idx) => (
                        <div key={idx} className="p-3 bg-slate-950 rounded-lg border border-emerald-900/60">
                          <div className="text-xs font-semibold text-emerald-300 mb-1 flex items-center gap-1.5 font-mono">
                            <span>[{s.skill_name || '技能'}]</span>
                            <span className="text-slate-400 font-normal">· {s.title}</span>
                          </div>
                          <div className="text-sm font-semibold text-white leading-relaxed">
                            {s.output}
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              )}

              {/* 流水线阶段列表 */}
              <div className="space-y-3">
                {currentPlan.steps.map((step, idx) => (
                  <div
                    key={step.step_id}
                    className={`p-4 rounded-xl border transition-all ${
                      step.status === 'completed'
                        ? 'bg-slate-950/80 border-emerald-800/50'
                        : step.status === 'running'
                        ? 'bg-indigo-950/30 border-indigo-500/60'
                        : step.status === 'failed'
                        ? 'bg-rose-950/30 border-rose-800/50'
                        : 'bg-slate-950/40 border-slate-800'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold font-mono ${
                            step.status === 'completed'
                              ? 'bg-emerald-600 text-white'
                              : step.status === 'running'
                              ? 'bg-indigo-600 text-white animate-pulse'
                              : 'bg-slate-800 text-slate-400'
                          }`}
                        >
                          {idx + 1}
                        </div>
                        <div>
                          <div className="text-xs font-semibold text-slate-200">
                            {step.title}
                          </div>
                          <div className="text-[11px] text-slate-400 mt-0.5 flex items-center gap-2">
                            <span>目标簇: {step.target_cluster}</span>
                            <span>·</span>
                            <span>
                              匹配技能:{' '}
                              <span className="font-mono text-indigo-300">
                                {step.skill_name || '待调度'}
                              </span>
                            </span>
                            {step.routing_score ? (
                              <>
                                <span>·</span>
                                <span className="font-mono text-emerald-400">
                                  得分: {(step.routing_score * 100).toFixed(0)}%
                                </span>
                              </>
                            ) : null}
                          </div>
                        </div>
                      </div>

                      {/* 状态徽标 */}
                      <div>
                        {step.status === 'completed' && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-400 font-mono">
                            <CheckCircle2 className="w-3.5 h-3.5" /> 已完成
                          </span>
                        )}
                        {step.status === 'running' && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-indigo-400 font-mono">
                            <Clock className="w-3.5 h-3.5 animate-spin" /> 执行中
                          </span>
                        )}
                        {step.status === 'failed' && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-rose-400 font-mono">
                            <ShieldAlert className="w-3.5 h-3.5" /> 失败
                          </span>
                        )}
                        {step.status === 'pending' && (
                          <span className="text-[11px] text-slate-500 font-mono">就绪</span>
                        )}
                      </div>
                    </div>

                    {/* 槽位与管道传递关系 */}
                    <div className="mt-3 pt-2.5 border-t border-slate-800/60 text-xs">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-[11px]">
                        <div>
                          <span className="text-slate-500 block">槽位参数绑定 (Extracted Slots):</span>
                          <span className="font-mono text-slate-300">
                            {Object.keys(step.extracted_slots).length > 0
                              ? JSON.stringify(step.extracted_slots)
                              : '无槽位要求'}
                          </span>
                        </div>
                        {step.input_from_step && (
                          <div className="flex items-center gap-1 text-slate-400">
                            <CornerDownRight className="w-3 h-3 text-indigo-400 shrink-0" />
                            <span>
                              管道依赖上游产物: <span className="font-mono text-slate-300">{step.input_from_step}</span>
                            </span>
                          </div>
                        )}
                      </div>

                      {/* 输出结果 */}
                      {step.output && (
                        <div className="mt-2.5 p-2 bg-slate-900/90 rounded border border-slate-800 text-[11px] text-emerald-300 font-mono leading-relaxed">
                          {step.output}
                        </div>
                      )}
                      {step.error_message && (
                        <div className="mt-2.5 p-2 bg-rose-950/40 rounded border border-rose-800/60 text-[11px] text-rose-300 font-mono">
                          {step.error_message}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 执行日志流 */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
              <h4 className="text-xs font-semibold text-slate-300 mb-2 flex items-center gap-2">
                <Database className="w-3.5 h-3.5 text-indigo-400" />
                实时编排调度日志 (Execution Trace)
              </h4>
              <div className="bg-slate-950 rounded-lg p-3 max-h-48 overflow-y-auto font-mono text-[11px] text-slate-300 space-y-1">
                {executionLog.map((log, i) => (
                  <div key={i} className="leading-relaxed border-b border-slate-900/50 pb-0.5">
                    {log}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* 右侧：论文核心理论验证——Token 预算对比与性能优势 */}
          <div className="space-y-4">
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
              <h3 className="text-sm font-semibold text-white mb-2 flex items-center gap-2">
                <Zap className="w-4 h-4 text-emerald-400" />
                Token 上下文预算节约对比
              </h3>
              <p className="text-xs text-slate-400 mb-4 leading-relaxed">
                验证论文核心论点：随着技能库增长，两阶段索引相比传统全量加载具有巨大 Token 节约与精度优势。
              </p>

              {/* 核心节约率数字 */}
              <div className="p-4 bg-slate-950 border border-emerald-900/40 rounded-xl text-center mb-4">
                <span className="text-xs text-slate-400 block">综合 Token 消耗节约率</span>
                <span className="text-3xl font-extrabold font-mono text-emerald-400 tabular-nums">
                  {currentPlan.token_savings_percent}%
                </span>
                <span className="text-[11px] text-emerald-500/80 block mt-1">
                  显著降低大模型上下文预算开销
                </span>
              </div>

              {/* 对比指标 */}
              <div className="space-y-3 text-xs">
                <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-slate-400">传统全量/一级元数据载入:</span>
                    <span className="font-mono text-rose-400 font-bold tabular-nums">
                      ~{currentPlan.total_token_traditional} tokens
                    </span>
                  </div>
                  <span className="text-[11px] text-slate-500 leading-tight block">
                    将成百上千个 Skill 元数据全塞入 System Prompt，极易触发上下文瓶颈与选错。
                  </span>
                </div>

                <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-slate-400">本系统两阶段分簇索引:</span>
                    <span className="font-mono text-emerald-400 font-bold tabular-nums">
                      ~{currentPlan.total_token_indexed} tokens
                    </span>
                  </div>
                  <span className="text-[11px] text-slate-500 leading-tight block">
                    仅按需下钻命中簇空间的候选微名片，渐进式披露完整 Instructions。
                  </span>
                </div>
              </div>
            </div>

            {/* 编排架构小结 */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
              <h4 className="text-xs font-semibold text-slate-300 mb-2">
                编排执行机制保障 (Orchestration Guarantees)
              </h4>
              <ul className="text-xs text-slate-400 space-y-2">
                <li className="flex items-start gap-2">
                  <ArrowRight className="w-3.5 h-3.5 text-indigo-400 shrink-0 mt-0.5" />
                  <span>
                    <strong className="text-slate-200">Zero-Context 零上下文测试:</strong> 指令含代词时锁定旧技能，杜绝时序滞后。
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <ArrowRight className="w-3.5 h-3.5 text-indigo-400 shrink-0 mt-0.5" />
                  <span>
                    <strong className="text-slate-200">负向硬过滤:</strong> 命中反面示例时硬性排除，提高调用命中率。
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <ArrowRight className="w-3.5 h-3.5 text-indigo-400 shrink-0 mt-0.5" />
                  <span>
                    <strong className="text-slate-200">10% 冷启动探索:</strong> 优先唤醒调用少冷门技能，防止热点霸占。
                  </span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
