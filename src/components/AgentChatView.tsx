import React, { useState, useRef, useEffect } from 'react';
import {
  Skill,
  SessionContext,
  TransitionEvaluation,
  OrchestrationStep,
} from '../types/agent';
import { TaskOrchestrator } from '../services/orchestrator';
import {
  Send,
  RotateCcw,
  Sparkles,
  Bot,
  User,
  Zap,
  CheckCircle2,
  Clock,
  ArrowRight,
  ShieldCheck,
  ChevronDown,
  Layers,
  Settings2,
  Radio,
  FileCheck,
} from 'lucide-react';

interface ChatMessage {
  id: string;
  sender: 'user' | 'agent';
  text: string;
  timestamp: string;
  arbiterTrace?: TransitionEvaluation;
  executedSteps?: OrchestrationStep[];
  tokenSavings?: number;
  modelUsed?: string;
}

interface AgentChatViewProps {
  skills: Skill[];
  session: SessionContext;
  onUpdateSession: (updater: (prev: SessionContext) => SessionContext) => void;
  onSkillCalled: (skillId: string, hadError?: boolean) => void;
  onNavigateToTab: (tab: 'orchestrator' | 'gate' | 'index' | 'governance') => void;
}

export const AgentChatView: React.FC<AgentChatViewProps> = ({
  skills,
  session,
  onUpdateSession,
  onSkillCalled,
  onNavigateToTab,
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'msg-welcome',
      sender: 'agent',
      text: '你好！我是由 SkillPilot 驱动的智能体 Agent。我已经挂载了当前技能库中的所有技能（包括 PDF格式转换、水印防护、天气预报、数据分析等）。\n\n您可以直接用自然语言向我指派任务，我会自动通过【时序仲裁器】、【两阶段索引】与【任务编排流水线】来调用对应的 Skill 并向您汇报结果！',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);

  const [input, setInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedModel, setSelectedModel] = useState<'gemini-3.8-flash' | 'gemini-3.1-pro-preview'>('gemini-3.8-flash');
  const [systemRole, setSystemRole] = useState('通用全能调度助手');
  const [showSettings, setShowSettings] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isProcessing]);

  const quickPrompts = [
    {
      text: '查询上海明天的天气预报和气温走势',
      desc: '单意图触发 Weather_Forecast',
    },
    {
      text: '不对，解释一下为什么会降温？',
      desc: '时序仲裁 RETAIN (保留当前天气技能)',
    },
    {
      text: '分析上周销售数据，生成PDF总结，并加上机密水印',
      desc: '复合编排流水线 (3 个技能连续协同)',
    },
    {
      text: '请用 PDF_Watermarker 去掉图片的水印',
      desc: '负向规则拦截 (Negative Trigger 规避)',
    },
  ];

  const handleSend = async (overrideText?: string) => {
    const query = (overrideText || input).trim();
    if (!query || isProcessing) return;

    setInput('');

    // 1. 追加用户消息
    const userMsg: ChatMessage = {
      id: `msg-${Date.now()}-user`,
      sender: 'user',
      text: query,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setIsProcessing(true);

    try {
      // 2. 初始化任务编排器
      const orchestrator = new TaskOrchestrator(skills);
      const { plan, transitionEval } = orchestrator.createPlan(query, session);

      // 3. 逐阶段执行步骤
      let prevOutput = '';
      const executedSteps: OrchestrationStep[] = [];

      for (let i = 0; i < plan.steps.length; i++) {
        const step = plan.steps[i];
        step.status = 'running';

        // 模拟执行耗时
        await new Promise((resolve) => setTimeout(resolve, 600));

        const execResult = orchestrator.executeStep(step, prevOutput);
        if (execResult.success) {
          step.status = 'completed';
          step.output = execResult.output;
          prevOutput = execResult.output;
          if (step.skill_id) {
            onSkillCalled(step.skill_id, false);
          }
        } else {
          step.status = 'failed';
          step.error_message = execResult.errorMessage;
          if (step.skill_id) {
            onSkillCalled(step.skill_id, true);
          }
        }
        executedSteps.push({ ...step });
      }

      // 4. 更新活跃技能与记忆槽位
      const lastCompleted = [...executedSteps].reverse().find((s) => s.status === 'completed');
      if (lastCompleted && lastCompleted.skill_id) {
        const active = skills.find((s) => s.skill_id === lastCompleted.skill_id) || null;
        onUpdateSession((prev) => ({
          ...prev,
          active_skill: active,
          active_slots: lastCompleted.extracted_slots,
          last_query: query,
          last_output: lastCompleted.output || '',
          domain_history: [...prev.domain_history, lastCompleted.target_cluster].slice(-6),
        }));
      }

      // 5. 尝试通过后端 Gemini API 生成自然语言整合回复
      let synthesizedText = '';
      try {
        const toolExecutionSummary = executedSteps
          .map(
            (s, idx) =>
              `第${idx + 1}步 [${s.skill_name || '技能'} - ${s.title}]: 状态: ${
                s.status
              }, 提取槽位: ${JSON.stringify(s.extracted_slots)}, 产物: ${s.output || s.error_message}`
          )
          .join('\n');

        const systemInstruction = `你是一个智能体 Agent，角色是【${systemRole}】。你刚通过两阶段技能索引执行了对应的 Skill 获得了以下真实工具执行结果：\n${toolExecutionSummary}\n请基于这些工具产物，用清晰专业、有条理的自然语言向用户作出最终汇报与回答。`;

        const res = await fetch('/api/agent/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: [
              ...messages.map((m) => ({ role: m.sender, content: m.text })),
              { role: 'user', content: query },
            ],
            systemInstruction,
            toolExecutionSummary,
            model: selectedModel,
          }),
        });

        const data = await res.json();
        if (data && data.reply && !data.fallback) {
          synthesizedText = data.reply;
        } else {
          // 本地确定性生成兜底
          synthesizedText = buildLocalAgentReply(query, executedSteps, transitionEval);
        }
      } catch (err) {
        synthesizedText = buildLocalAgentReply(query, executedSteps, transitionEval);
      }

      // 6. 追加 Agent 消息
      const agentMsg: ChatMessage = {
        id: `msg-${Date.now()}-agent`,
        sender: 'agent',
        text: synthesizedText,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        arbiterTrace: transitionEval,
        executedSteps,
        tokenSavings: plan.token_savings_percent,
        modelUsed: selectedModel,
      };

      setMessages((prev) => [...prev, agentMsg]);
    } catch (err: any) {
      const errorMsg: ChatMessage = {
        id: `msg-${Date.now()}-err`,
        sender: 'agent',
        text: `抱歉，执行任务编排时发生异常: ${err?.message || '未知错误'}`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsProcessing(false);
    }
  };

  // 本地生成规则（保证断网或无 Key 时 100% 优雅可用）
  const buildLocalAgentReply = (
    query: string,
    steps: OrchestrationStep[],
    tEval: TransitionEvaluation
  ): string => {
    if (steps.length === 1 && steps[0].status === 'completed') {
      const step = steps[0];
      if (step.skill_name === 'Weather_Forecast') {
        return `已成功为您调用气象站技能【Weather_Forecast】完成查询：\n\n${step.output}\n\n出行小贴士：近期温度存在起伏，请根据体感适度增减衣物。`;
      }
      return `已为您调用【${step.skill_name}】完成任务！\n\n📌 执行产出：\n${step.output}\n\n${
        tEval.decision === 'RETAIN'
          ? `💡 提示：本轮对话通过【零上下文自闭环】判定为关联追问，成功锁定了原有技能上下文。`
          : ''
      }`;
    }

    if (steps.length > 1) {
      const allSuccess = steps.every((s) => s.status === 'completed');
      return `已成功编排并完成复合任务流水线（共 ${steps.length} 个协同阶段）：\n\n${steps
        .map(
          (s, i) =>
            `${i + 1}. 【${s.skill_name}】${s.title}：${
              s.output ? s.output.replace(/【.*?】/, '') : s.error_message
            }`
        )
        .join('\n\n')}\n\n${
        allSuccess
          ? '✅ 复合任务全流程协同完毕，上游产物已无缝管道透传至下游交付。'
          : '⚠️ 部分阶段遇到异常，请检查入参或技能状态。'
      }`;
    }

    return `已接收您的指令，但未匹配到合适的执行技能。`;
  };

  const handleReset = () => {
    setMessages([
      {
        id: 'msg-welcome-reset',
        sender: 'agent',
        text: '会话上下文已重置。您可以重新向我发起任何任务或指令！',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
    ]);
    onUpdateSession(() => ({
      active_skill: null,
      active_slots: {},
      last_query: '',
      last_output: '',
      domain_history: [],
    }));
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-[calc(100vh-140px)] min-h-[640px]">
      {/* 左侧：主对话流 (8 列) */}
      <div className="lg:col-span-8 flex flex-col bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
        {/* 对话窗顶部栏 */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white">
              <Bot className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-white">SkillPilot 实时智能体</h2>
                <span className="text-[10px] text-emerald-400 bg-emerald-950/60 border border-emerald-800/80 px-1.5 py-0.2 rounded font-mono">
                  Online
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                角色: <span className="text-slate-200">{systemRole}</span> · 挂载技能:{' '}
                <span className="font-mono text-indigo-300 font-semibold">{skills.length}</span> 项
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowSettings(!showSettings)}
              className="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors"
              title="调整 Agent 参数"
            >
              <Settings2 className="w-4 h-4" />
            </button>
            <button
              onClick={handleReset}
              className="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors"
              title="清空会话与上下文记忆"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* 可折叠设置面板 */}
        {showSettings && (
          <div className="p-3.5 bg-slate-950 border-b border-slate-800 text-xs flex flex-wrap items-center gap-4 animate-fadeIn">
            <div className="flex items-center gap-2">
              <span className="text-slate-400">模型选择:</span>
              <select
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value as any)}
                className="bg-slate-900 border border-slate-800 text-slate-200 rounded px-2 py-1 text-xs focus:outline-none"
              >
                <option value="gemini-3.8-flash">gemini-3.8-flash (高速推荐)</option>
                <option value="gemini-3.1-pro-preview">gemini-3.1-pro-preview (深度推理)</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-slate-400">角色设定:</span>
              <select
                value={systemRole}
                onChange={(e) => setSystemRole(e.target.value)}
                className="bg-slate-900 border border-slate-800 text-slate-200 rounded px-2 py-1 text-xs focus:outline-none"
              >
                <option value="通用全能调度助手">通用全能调度助手</option>
                <option value="企业办公文印专家">企业办公文印专家</option>
                <option value="商业智能与数据分析师">商业智能与数据分析师</option>
              </select>
            </div>
          </div>
        )}

        {/* 消息滚动区 */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex gap-3 ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {msg.sender === 'agent' && (
                <div className="w-7 h-7 rounded-lg bg-indigo-600/80 flex items-center justify-center text-white shrink-0 mt-1">
                  <Bot className="w-4 h-4" />
                </div>
              )}

              <div
                className={`max-w-[85%] rounded-xl p-4 text-xs leading-relaxed space-y-3 ${
                  msg.sender === 'user'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'bg-slate-950 border border-slate-800 text-slate-200'
                }`}
              >
                {/* 1. 正文回复内容 (最优先呈现给用户的答案) */}
                <div className="text-xs sm:text-sm font-normal text-slate-100 whitespace-pre-wrap leading-relaxed">
                  {msg.text}
                </div>

                {/* 2. 专属业务成果高亮卡片 (特别针对天气查询、PDF、数据等核心产物) */}
                {msg.executedSteps && msg.executedSteps.some((s) => s.status === 'completed' && s.output) && (
                  <div className="space-y-2 pt-2 border-t border-slate-800/80">
                    {msg.executedSteps
                      .filter((s) => s.status === 'completed' && s.output)
                      .map((step, idx) => {
                        const isWeather = step.skill_name === 'Weather_Forecast' || step.target_cluster === '气象';

                        if (isWeather) {
                          return (
                            <div
                              key={idx}
                              className="p-3.5 rounded-xl bg-gradient-to-br from-sky-950/60 to-indigo-950/40 border border-sky-600/40 shadow-sm space-y-2"
                            >
                              <div className="flex items-center justify-between text-sky-300">
                                <span className="font-bold text-xs flex items-center gap-1.5">
                                  <span>🌤️</span> 气象服务实时测报 (Weather Result)
                                </span>
                                <span className="text-[10px] bg-sky-900/40 text-sky-300 px-2 py-0.5 rounded font-mono border border-sky-700/60">
                                  {step.extracted_slots['city'] || '目标城市'} · {step.extracted_slots['date'] || '近期'}
                                </span>
                              </div>
                              <div className="p-2.5 bg-slate-950/80 rounded-lg border border-sky-800/50 text-slate-100 text-xs font-medium leading-relaxed">
                                {step.output}
                              </div>
                            </div>
                          );
                        }

                        return (
                          <div
                            key={idx}
                            className="p-3 rounded-xl bg-slate-900 border border-slate-800 space-y-1.5"
                          >
                            <div className="flex items-center justify-between text-indigo-300 text-xs">
                              <span className="font-bold flex items-center gap-1.5">
                                <Zap className="w-3.5 h-3.5 text-amber-400" />
                                交付产物: [{step.skill_name}] - {step.title}
                              </span>
                              <span className="text-[10px] text-emerald-400 font-mono flex items-center gap-1">
                                <CheckCircle2 className="w-3 h-3" /> 成功
                              </span>
                            </div>
                            <div className="p-2 bg-slate-950 rounded text-slate-200 text-xs font-mono leading-relaxed">
                              {step.output}
                            </div>
                          </div>
                        );
                      })}
                  </div>
                )}

                {/* 3. 底层时序仲裁与调度指标 (技术细节折叠区) */}
                {(msg.arbiterTrace || (msg.executedSteps && msg.executedSteps.length > 0)) && (
                  <div className="pt-2 border-t border-slate-800/60 text-[11px] text-slate-400 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      {msg.arbiterTrace && (
                        <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800 text-amber-300">
                          仲裁: {msg.arbiterTrace.decision}
                        </span>
                      )}
                      <span className="text-slate-500">
                        已调用 {msg.executedSteps?.length || 0} 个 Skill
                      </span>
                    </div>

                    {msg.tokenSavings ? (
                      <span className="font-mono text-emerald-400 font-semibold text-[10px]">
                        两阶段索引节约 {msg.tokenSavings}% Token
                      </span>
                    ) : null}
                  </div>
                )}

                <div
                  className={`text-[10px] text-right font-mono ${
                    msg.sender === 'user' ? 'text-indigo-200' : 'text-slate-500'
                  }`}
                >
                  {msg.timestamp}
                </div>
              </div>

              {msg.sender === 'user' && (
                <div className="w-7 h-7 rounded-lg bg-slate-800 flex items-center justify-center text-slate-300 shrink-0 mt-1">
                  <User className="w-4 h-4" />
                </div>
              )}
            </div>
          ))}

          {isProcessing && (
            <div className="flex gap-3 justify-start">
              <div className="w-7 h-7 rounded-lg bg-indigo-600/80 flex items-center justify-center text-white shrink-0 mt-1">
                <Bot className="w-4 h-4 animate-spin" />
              </div>
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-slate-400 flex items-center gap-2">
                <Clock className="w-3.5 h-3.5 animate-spin text-indigo-400" />
                <span>正在通过两阶段索引与编排器调度 Skill...</span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* 快捷点击提问气泡条 */}
        <div className="px-4 py-2 bg-slate-950/80 border-t border-slate-800/80 flex items-center gap-1.5 overflow-x-auto">
          <span className="text-[10px] text-slate-500 shrink-0 font-medium mr-1">
            快捷提问:
          </span>
          {quickPrompts.map((p, i) => (
            <button
              key={i}
              onClick={() => handleSend(p.text)}
              disabled={isProcessing}
              className="text-[11px] px-2.5 py-1 rounded-full bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 whitespace-nowrap transition-colors flex items-center gap-1"
            >
              <span>{p.text}</span>
            </button>
          ))}
        </div>

        {/* 底部输入框 */}
        <div className="p-3 bg-slate-950 border-t border-slate-800">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            className="flex items-center gap-2"
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={isProcessing}
              placeholder="向 Agent 发送指令，如：查询天气、分析数据生成带水印的PDF..."
              className="flex-1 bg-slate-900 border border-slate-800 rounded-lg px-3.5 py-2.5 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-indigo-500"
            />
            <button
              type="submit"
              disabled={!input.trim() || isProcessing}
              className="px-4 py-2.5 text-xs font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-500 disabled:opacity-40 transition-colors flex items-center gap-1.5"
            >
              <Send className="w-3.5 h-3.5" />
              发送
            </button>
          </form>
        </div>
      </div>

      {/* 右侧：实时运行状态与技能监控面板 (4 列) */}
      <div className="lg:col-span-4 space-y-4 flex flex-col justify-between">
        {/* 会话上下文与槽位记忆 */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3">
          <h3 className="text-xs font-bold text-white flex items-center gap-2">
            <Radio className="w-3.5 h-3.5 text-indigo-400" />
            Agent 运行时状态机 (Session State)
          </h3>

          <div className="space-y-2 text-xs">
            <div className="p-3 bg-slate-950 rounded-lg border border-slate-800">
              <span className="text-[10px] text-slate-500 block">当前活跃技能 (Active Skill)</span>
              {session.active_skill ? (
                <div className="flex items-center justify-between mt-1">
                  <span className="font-mono font-bold text-indigo-300">
                    {session.active_skill.name}
                  </span>
                  <span className="text-[10px] text-slate-400">
                    {session.active_skill.clusters[0]}
                  </span>
                </div>
              ) : (
                <span className="text-slate-400 text-[11px] mt-1 block">
                  尚未激活特定技能（初始就绪）
                </span>
              )}
            </div>

            <div className="p-3 bg-slate-950 rounded-lg border border-slate-800">
              <span className="text-[10px] text-slate-500 block">槽位参数记忆池 (Slot Memory)</span>
              <pre className="text-[10px] text-slate-300 font-mono mt-1 overflow-x-auto">
                {Object.keys(session.active_slots).length > 0
                  ? JSON.stringify(session.active_slots, null, 2)
                  : '[] (空)'}
              </pre>
            </div>

            <div className="p-3 bg-slate-950 rounded-lg border border-slate-800">
              <span className="text-[10px] text-slate-500 block">已遍历领域轨迹 (Domain Trace)</span>
              <div className="flex flex-wrap gap-1 mt-1.5">
                {session.domain_history.length > 0 ? (
                  session.domain_history.map((d, i) => (
                    <span
                      key={i}
                      className="text-[10px] font-mono bg-slate-900 border border-slate-800 px-1.5 py-0.5 rounded text-slate-300"
                    >
                      {d}
                    </span>
                  ))
                ) : (
                  <span className="text-slate-500 text-[11px]">无轨迹</span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* 快捷跳转工作台其它深度功能 */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3">
          <h4 className="text-xs font-bold text-white flex items-center gap-2">
            <Layers className="w-3.5 h-3.5 text-sky-400" />
            技能注册与人机治理快捷通道
          </h4>
          <p className="text-[11px] text-slate-400 leading-relaxed">
            如需测试高并发编排、注册新技能防碰撞门禁或进行沙箱探测，可快速跳转到对应工作区：
          </p>

          <div className="space-y-1.5 text-xs">
            <button
              onClick={() => onNavigateToTab('orchestrator')}
              className="w-full text-left p-2 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white flex items-center justify-between transition-colors"
            >
              <span>⚡ 任务编排引擎 (DAG 流水线与 Token 对比)</span>
              <ArrowRight className="w-3 h-3 text-slate-500" />
            </button>

            <button
              onClick={() => onNavigateToTab('gate')}
              className="w-full text-left p-2 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white flex items-center justify-between transition-colors"
            >
              <span>🛡️ 注册防碰撞门禁 (0.90 相似度雷达)</span>
              <ArrowRight className="w-3 h-3 text-slate-500" />
            </button>

            <button
              onClick={() => onNavigateToTab('governance')}
              className="w-full text-left p-2 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white flex items-center justify-between transition-colors"
            >
              <span>⚠️ 人机协同治理中心 (报错审计与联想引擎)</span>
              <ArrowRight className="w-3 h-3 text-slate-500" />
            </button>

            <button
              onClick={() => onNavigateToTab('index')}
              className="w-full text-left p-2 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white flex items-center justify-between transition-colors"
            >
              <span>📚 多维技能索引图谱 (内容与工具双列检索)</span>
              <ArrowRight className="w-3 h-3 text-slate-500" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
