import React, { useState, useRef, useEffect } from 'react';
import { Skill, RegistrationCheckResult } from '../types/agent';
import { SkillRegistrationGate } from '../services/registrationGate';
import { SimpleEmbeddingProvider } from '../services/embedding';
import {
  Sparkles,
  Send,
  Bot,
  User,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  ShieldCheck,
  ShieldAlert,
  Wand2,
  ArrowRight,
  Sliders,
  Tag,
  Check,
  FileCode,
  Zap,
  Info,
} from 'lucide-react';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  draft?: SkillDraft | null;
  timestamp: string;
}

export interface SkillDraft {
  name: string;
  displayName: string;
  description: string;
  clusters: string[];
  required_slots: string[];
  slots_explanation: Record<string, string>;
  negative_triggers: string[];
  disambiguation_features: string;
  mock_preview: string;
}

interface AISkillCreatorChatProps {
  skills: Skill[];
  onRegisterSkill: (skill: Skill) => void;
  onSwitchToManualForm?: (prefillData: Partial<SkillDraft>) => void;
}

const QUICK_PROMPTS = [
  {
    title: 'HR 录用 Offer 邮件',
    desc: '自动校验薪酬与日期并发送',
    text: '我想做一个帮HR给新员工发录取Offer邮件的技能，需要录入候选人姓名、邮箱、薪资待遇和入职日期。请帮我防范乱用，不能用来发广告营销邮件。',
  },
  {
    title: '财务发票合规初审',
    desc: '查验发票真伪与限额',
    text: '我想做一个财务发票初审工具，员工上传发票图片或PDF后，自动提取发票代码、金额和报销类目，对照部门预算审核。注意不能用于未加盖公章的收据。',
  },
  {
    title: '电商退款风控拦截',
    desc: '物流状态与风控比对',
    text: '我开了一家淘宝店，想让智能体帮我初审售后退款。根据订单号、退款理由和物流轨迹，如果快递已经在路上就不要直接退钱。',
  },
  {
    title: '智能会议纪要提炼',
    desc: '提取行动项与负责人',
    text: '我想做一个整理会议录音速记的技能，能自动把会议发言提取成待办事项列表、责任人和截止日期。闲聊八卦不要记录。',
  },
  {
    title: '小红书种草文案',
    desc: '带痛点与互动钩子',
    text: '帮我设计一个写小红书爆款文案的技能，输入产品卖点和目标人群后自动出文案，需要符合新广告法，不能夸大疗效。',
  },
];

export const AISkillCreatorChat: React.FC<AISkillCreatorChatProps> = ({
  skills,
  onRegisterSkill,
  onSwitchToManualForm,
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: `👋 **你好！我是你的 AI 技能架构师。**

完全**不需要学过编程或写过一行代码**！你只需要用平时聊天的大白话，告诉我你希望智能体学会什么本领（例如：“*帮我发入职邮件*”、“*审核报销发票*”或“*帮客服自动处理退款*”）。

我会实时为你：
1. 💡 梳理出严谨的**关键参数**（需要输入什么信息）
2. 🛡️ 制定**防乱用规则**（负向排除条件）
3. 💎 提炼**独特消歧点**（避免与其他技能冲突）
4. 🚀 并在右侧生成**零代码技能蓝图**，点击即可一键上线！

你可以直接点击下方的快捷业务示例，或者在下方输入框告诉我你的想法：`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);

  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedModel, setSelectedModel] = useState<
    'gemini-3.5-flash' | 'gemini-3.1-flash-lite' | 'gemini-3.1-pro-preview'
  >('gemini-3.5-flash');

  const [currentDraft, setCurrentDraft] = useState<SkillDraft | null>(null);
  const [registerSuccessNotice, setRegisterSuccessNotice] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  // 实时门禁排查雷达检测
  const collisionResult: RegistrationCheckResult | null = React.useMemo(() => {
    if (!currentDraft) return null;
    const partial: Partial<Skill> = {
      name: currentDraft.name,
      description: currentDraft.description,
      clusters: currentDraft.clusters,
      required_slots: currentDraft.required_slots,
      disambiguation_features: currentDraft.disambiguation_features,
      negative_triggers: currentDraft.negative_triggers,
    };
    return SkillRegistrationGate.checkCollision(partial, skills);
  }, [currentDraft, skills]);

  // 相似度排行（用于可视化雷达对比）
  const similarityTop = React.useMemo(() => {
    if (!currentDraft) return [];
    const candText = `${currentDraft.name} ${currentDraft.description} ${currentDraft.clusters.join(' ')}`;
    const candVec = SimpleEmbeddingProvider.getEmbedding(candText);

    return skills
      .map((s) => ({
        skill: s,
        sim: SimpleEmbeddingProvider.cosineSimilarity(candVec, s.embedding),
      }))
      .sort((a, b) => b.sim - a.sim)
      .slice(0, 3);
  }, [currentDraft, skills]);

  // 发送多轮对话
  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend || inputText).trim();
    if (!text || loading) return;

    const userMessage: ChatMessage = {
      id: `user_${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    const newHistory = [...messages, userMessage];
    setMessages(newHistory);
    setInputText('');
    setLoading(true);

    try {
      const response = await fetch('/api/skill/architect-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: newHistory.map((m) => ({ role: m.role, content: m.content })),
          currentDraft,
          existingSkills: skills.map((s) => ({
            name: s.name,
            clusters: s.clusters,
            description: s.description,
          })),
          model: selectedModel,
        }),
      });

      const data = await response.json();

      let draftFromAi = data.draft as SkillDraft | undefined;

      // 如果模型直接在回复文本中包含 JSON
      if (!draftFromAi && typeof data.reply === 'string') {
        const jsonMatch = data.reply.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
        if (jsonMatch && jsonMatch[1]) {
          try {
            draftFromAi = JSON.parse(jsonMatch[1]);
          } catch (e) {
            console.error('Failed to parse draft JSON', e);
          }
        }
      }

      if (draftFromAi && draftFromAi.name) {
        setCurrentDraft(draftFromAi);
      }

      const assistantMessage: ChatMessage = {
        id: `ai_${Date.now()}`,
        role: 'assistant',
        content: data.reply || '我已为您生成了最新的技能架构草案，请在右侧面板预览！',
        draft: draftFromAi || null,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (err: any) {
      console.error('Failed to communicate with Skill Architect', err);
      const fallbackMsg: ChatMessage = {
        id: `ai_${Date.now()}`,
        role: 'assistant',
        content: '抱歉，网络服务暂时繁忙。我已经自动为您根据文本启动了本地技能生成模板。',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, fallbackMsg]);
    } finally {
      setLoading(false);
    }
  };

  // 一键智能消歧修复（当门禁警告冲突时）
  const handleAutoDisambiguate = () => {
    if (!currentDraft || !collisionResult?.collidingSkill) return;
    const collidingName = collisionResult.collidingSkill.name;
    const prompt = `当前草案与现有技能 [${collidingName}] 相似度过高（相似度 ${(
      (collisionResult.similarity || 0.9) * 100
    ).toFixed(0)}%）。请帮我强化本技能的【消歧专有特征 (Disambiguation)】和【负向排除条件 (Negative Triggers)】，使其明确区隔于 [${collidingName}]，能够直接通过门禁系统的排他检查！`;
    handleSendMessage(prompt);
  };

  // 一键注册并上线该技能
  const handleConfirmRegister = () => {
    if (!currentDraft) return;

    const fullSkill: Skill = {
      skill_id: `skill_${currentDraft.name.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${Date.now().toString(36)}`,
      name: currentDraft.name.trim(),
      display_name: currentDraft.displayName || currentDraft.name,
      description: currentDraft.description.trim(),
      clusters: currentDraft.clusters && currentDraft.clusters.length > 0 ? currentDraft.clusters : ['业务协同'],
      required_slots: currentDraft.required_slots || [],
      slots_explanation: currentDraft.slots_explanation || {},
      negative_triggers: currentDraft.negative_triggers || [],
      disambiguation_features: currentDraft.disambiguation_features || 'AI 自然语言定制专有技能',
      call_count: 0,
      error_count: 0,
      domains_invoked: [],
      created_via: 'ai_natural_language',
      embedding: SimpleEmbeddingProvider.getEmbedding(
        `${currentDraft.name} ${currentDraft.description} ${currentDraft.clusters.join(' ')}`
      ),
      mock_executor: (slots) => {
        if (currentDraft.mock_preview) {
          return `${currentDraft.mock_preview}\n【实时槽位注入】: ${JSON.stringify(slots)}`;
        }
        return `【${currentDraft.displayName || currentDraft.name} 执行完毕】业务处理成功，入参: ${JSON.stringify(slots)}`;
      },
    };

    onRegisterSkill(fullSkill);
    setRegisterSuccessNotice(
      `🎉 技能 [${fullSkill.display_name || fullSkill.name}] 已成功注册上线！已收录至两阶段路由索引库。`
    );

    setTimeout(() => {
      setRegisterSuccessNotice(null);
    }, 6000);
  };

  // 重置对话
  const handleResetChat = () => {
    setMessages([
      {
        id: `welcome_${Date.now()}`,
        role: 'assistant',
        content: `已为你重置会话！你可以重新用平常说话的方式，告诉我你希望智能体学会的新业务技能。`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
    ]);
    setCurrentDraft(null);
  };

  return (
    <div className="space-y-6">
      {/* 顶部横幅：通俗易懂的零代码说明 */}
      <div className="bg-gradient-to-r from-indigo-950/70 via-slate-900 to-slate-900 border border-indigo-800/40 rounded-2xl p-5 shadow-sm">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-indigo-400" />
                AI 技能架构师 (AI Skill Architect)
              </span>
              <span className="text-xs text-slate-400">· 自然语言对话，自动构建并排查技能</span>
            </div>
            <h2 className="text-base sm:text-lg font-bold text-white">
              大白话输入需求，自动编译为可执行技能并检测排他门禁
            </h2>
            <p className="text-xs text-slate-300/80 leading-relaxed max-w-3xl">
              系统内置自然语言意图编译器与排他门禁检测。只要你说出日常业务流程或 SOP
              规则，AI 就会自动将其翻译为带**关键参数提取**、**防错防滥用规则**和**消歧保障**的工业级技能。
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {onSwitchToManualForm && (
              <button
                type="button"
                onClick={() => onSwitchToManualForm(currentDraft || {})}
                className="px-3 py-1.5 text-xs text-slate-300 hover:text-white bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700 rounded-lg transition-colors flex items-center gap-1.5"
              >
                <Sliders className="w-3.5 h-3.5 text-slate-400" />
                切换传统表单微调
              </button>
            )}
            <button
              type="button"
              onClick={handleResetChat}
              className="px-3 py-1.5 text-xs text-slate-400 hover:text-slate-200 bg-slate-900 border border-slate-800 rounded-lg transition-colors flex items-center gap-1.5"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              重新开始
            </button>
          </div>
        </div>

        {/* 快捷示例胶囊 */}
        <div className="mt-4 pt-3 border-t border-slate-800/80">
          <div className="text-[11px] font-medium text-slate-400 mb-2 flex items-center gap-1.5">
            <Zap className="w-3 h-3 text-amber-400" />
            快速尝试不同业务场景（点击直接体验）：
          </div>
          <div className="flex flex-wrap gap-2">
            {QUICK_PROMPTS.map((qp, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleSendMessage(qp.text)}
                disabled={loading}
                className="group px-3 py-1.5 rounded-lg bg-slate-800/60 hover:bg-indigo-900/40 border border-slate-700/60 hover:border-indigo-600/50 text-left transition-all cursor-pointer disabled:opacity-50"
              >
                <div className="text-xs font-semibold text-slate-200 group-hover:text-indigo-200 flex items-center gap-1">
                  <span>{qp.title}</span>
                  <ArrowRight className="w-3 h-3 text-slate-500 group-hover:text-indigo-400 transition-transform group-hover:translate-x-0.5" />
                </div>
                <div className="text-[10px] text-slate-400">{qp.desc}</div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 注册成功通告 */}
      {registerSuccessNotice && (
        <div className="p-4 rounded-xl bg-emerald-950/60 border border-emerald-600/40 text-emerald-200 text-xs flex items-center justify-between gap-4 animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            <span>{registerSuccessNotice}</span>
          </div>
          <div className="text-[11px] text-emerald-300/80 underline font-mono">已生效</div>
        </div>
      )}

      {/* 主工作区：左侧多轮对话，右侧实时可视化蓝图与门禁雷达 */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* 左侧：多轮对话交互窗口 */}
        <div className="lg:col-span-7 bg-slate-900 border border-slate-800 rounded-2xl flex flex-col h-[700px] overflow-hidden shadow-lg">
          {/* 对话顶栏 */}
          <div className="px-4 py-3 border-b border-slate-800 bg-slate-950/60 flex items-center justify-between gap-4">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
                <Bot className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs font-bold text-white flex items-center gap-1.5">
                  AI 技能架构师对话窗口
                  <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block"></span>
                </div>
                <div className="text-[10px] text-slate-400">多轮对话 · 自动抽取参数 · 实时消除冲突</div>
              </div>
            </div>

            {/* 模型选择 */}
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-slate-400 hidden sm:inline">模型引擎:</span>
              <select
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value as any)}
                className="bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 font-mono"
              >
                <option value="gemini-3.5-flash">Gemini 3.5 Flash (推荐·通用稳定)</option>
                <option value="gemini-3.1-flash-lite">Gemini 3.1 Flash Lite (极速响应)</option>
                <option value="gemini-3.1-pro-preview">Gemini 3.1 Pro (深度逻辑推理)</option>
              </select>
            </div>
          </div>

          {/* 消息滚动流 */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {msg.role === 'assistant' && (
                  <div className="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center text-white shrink-0 mt-0.5 shadow-sm">
                    <Sparkles className="w-3.5 h-3.5" />
                  </div>
                )}

                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-3 text-xs leading-relaxed space-y-2 ${
                    msg.role === 'user'
                      ? 'bg-indigo-600 text-white rounded-br-none shadow-md font-sans'
                      : 'bg-slate-800/90 text-slate-200 rounded-bl-none border border-slate-700/60 shadow-sm'
                  }`}
                >
                  {/* 消息内容格式化展示 */}
                  <div className="whitespace-pre-wrap space-y-1.5 font-sans">
                    {msg.content
                      .replace(/```(?:json)?[\s\S]*?```/g, '') // 在气泡中不冗余显示原始 JSON 代码，只展示通俗人话
                      .trim()}
                  </div>

                  {/* 如果该轮产生了草案，给出小提示卡 */}
                  {msg.draft && (
                    <div className="mt-2.5 pt-2 border-t border-slate-700/60 flex items-center justify-between text-[11px] text-indigo-300">
                      <span className="flex items-center gap-1">
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        已同步更新技能：
                        <strong className="text-white">
                          {msg.draft.displayName || msg.draft.name}
                        </strong>
                      </span>
                      <span className="text-slate-400">见右侧面板 👉</span>
                    </div>
                  )}

                  <div
                    className={`text-[9px] text-right ${
                      msg.role === 'user' ? 'text-indigo-200' : 'text-slate-400'
                    }`}
                  >
                    {msg.timestamp}
                  </div>
                </div>

                {msg.role === 'user' && (
                  <div className="w-7 h-7 rounded-lg bg-slate-700 flex items-center justify-center text-slate-200 shrink-0 mt-0.5">
                    <User className="w-3.5 h-3.5" />
                  </div>
                )}
              </div>
            ))}

            {loading && (
              <div className="flex gap-3 justify-start items-center">
                <div className="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center text-white shrink-0 animate-pulse">
                  <Sparkles className="w-3.5 h-3.5" />
                </div>
                <div className="bg-slate-800/90 border border-slate-700/60 rounded-2xl rounded-bl-none px-4 py-3 text-xs text-indigo-300 flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-indigo-400 animate-ping"></div>
                  AI 正在梳理你的业务大白话，提取槽位与排除规则...
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* 底部输入框 */}
          <div className="p-3 bg-slate-950/80 border-t border-slate-800">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendMessage();
              }}
              className="flex items-end gap-2"
            >
              <textarea
                rows={2}
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage();
                  }
                }}
                placeholder="用你平时说话的方式描述你的想法（例如：我想做一个能把面试评价发给主管的技能，但不要用于实习生）..."
                className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 resize-none font-sans"
              />
              <button
                type="submit"
                disabled={!inputText.trim() || loading}
                className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-md transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5 shrink-0 self-end"
              >
                <Send className="w-3.5 h-3.5" />
                发送
              </button>
            </form>
            <div className="mt-1.5 flex items-center justify-between text-[10px] text-slate-500 px-1">
              <span>按 Enter 发送，Shift + Enter 换行</span>
              <span>支持多轮连续调整：“把入参去掉邮箱，改加手机号”</span>
            </div>
          </div>
        </div>

        {/* 右侧：实时技能卡片与门禁雷达排他检查 */}
        <div className="lg:col-span-5 space-y-4">
          {currentDraft ? (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-5">
              {/* 标题与英文标识 */}
              <div className="border-b border-slate-800 pb-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="text-[10px] font-mono text-indigo-400 uppercase tracking-wider">
                      AI 架构方案草案
                    </span>
                    <h3 className="text-base font-bold text-white mt-0.5">
                      {currentDraft.displayName || currentDraft.name}
                    </h3>
                  </div>
                  <span className="px-2.5 py-1 rounded bg-slate-800 text-slate-300 font-mono text-[11px] border border-slate-700">
                    {currentDraft.name}
                  </span>
                </div>

                <p className="text-xs text-slate-300 mt-2 leading-relaxed bg-slate-950/60 p-2.5 rounded-lg border border-slate-800">
                  {currentDraft.description}
                </p>

                {/* 领域标签 */}
                <div className="flex flex-wrap gap-1.5 mt-2.5">
                  {(currentDraft.clusters || []).map((cluster, i) => (
                    <span
                      key={i}
                      className="px-2 py-0.5 rounded text-[10px] font-medium bg-indigo-950/60 text-indigo-300 border border-indigo-800/60 flex items-center gap-1"
                    >
                      <Tag className="w-2.5 h-2.5" />
                      {cluster}
                    </span>
                  ))}
                </div>
              </div>

              {/* 关键参数槽位（人话解读） */}
              <div>
                <h4 className="text-xs font-bold text-slate-200 flex items-center gap-1.5 mb-2">
                  <FileCode className="w-3.5 h-3.5 text-sky-400" />
                  运行时必需的关键参数 (Slots)
                </h4>
                <div className="space-y-1.5">
                  {(currentDraft.required_slots || []).map((slot, i) => (
                    <div
                      key={i}
                      className="p-2 rounded-lg bg-slate-950/50 border border-slate-800/80 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-1"
                    >
                      <span className="font-mono text-sky-300 font-semibold">{slot}</span>
                      <span className="text-[11px] text-slate-400">
                        {currentDraft.slots_explanation?.[slot] || '必要输入项'}
                      </span>
                    </div>
                  ))}
                  {(!currentDraft.required_slots || currentDraft.required_slots.length === 0) && (
                    <div className="text-xs text-slate-500 italic">无需额外指定入参</div>
                  )}
                </div>
              </div>

              {/* 负向触发排除规则 */}
              <div>
                <h4 className="text-xs font-bold text-slate-200 flex items-center gap-1.5 mb-2">
                  <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
                  防乱用硬性排除规则 (Negative Triggers)
                </h4>
                <div className="space-y-1">
                  {(currentDraft.negative_triggers || []).map((neg, i) => (
                    <div
                      key={i}
                      className="text-[11px] text-amber-300/90 bg-amber-950/30 border border-amber-900/40 rounded-lg px-2.5 py-1.5 flex items-start gap-1.5"
                    >
                      <span className="text-rose-400 font-bold shrink-0">✕</span>
                      <span>{neg}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* 专有消歧特征 */}
              <div>
                <h4 className="text-xs font-bold text-slate-200 flex items-center gap-1.5 mb-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                  防冲突消歧专有特征 (Disambiguation)
                </h4>
                <div className="text-[11px] text-purple-200/90 bg-purple-950/30 border border-purple-900/40 rounded-lg p-2.5 leading-relaxed">
                  {currentDraft.disambiguation_features || '暂未指定特殊消歧'}
                </div>
              </div>

              {/* 模拟运行效果 */}
              {currentDraft.mock_preview && (
                <div>
                  <h4 className="text-xs font-bold text-slate-200 flex items-center gap-1.5 mb-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    模拟执行成果预览 (Mock Output)
                  </h4>
                  <pre className="text-[10px] text-emerald-300/90 bg-slate-950 p-2.5 rounded-lg border border-slate-800 font-mono whitespace-pre-wrap leading-relaxed">
                    {currentDraft.mock_preview}
                  </pre>
                </div>
              )}

              {/* 自动化排他门禁检测面板 */}
              <div className="border-t border-slate-800 pt-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-emerald-400" />
                    注册防碰撞排他检查 (Gate Radar)
                  </h4>
                  {collisionResult && (
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        collisionResult.allowed
                          ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                          : 'bg-rose-950 text-rose-300 border border-rose-800 animate-pulse'
                      }`}
                    >
                      {collisionResult.allowed ? '通过门禁' : '触发拦截'}
                    </span>
                  )}
                </div>

                {collisionResult && !collisionResult.allowed ? (
                  <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-800/80 space-y-2">
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                      <div className="text-xs text-rose-200 leading-relaxed">
                        {collisionResult.message}
                      </div>
                    </div>

                    {collisionResult.collidingSkill && (
                      <div className="text-[11px] text-slate-300 bg-slate-900/80 p-2 rounded border border-rose-900/40">
                        冲突现有技能：
                        <strong className="text-rose-300 font-mono">
                          {collisionResult.collidingSkill.name}
                        </strong>
                        <span className="ml-2 text-slate-400">
                          (相似度: {((collisionResult.similarity || 0) * 100).toFixed(0)}%)
                        </span>
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={handleAutoDisambiguate}
                      className="w-full py-1.5 px-3 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 shadow-sm"
                    >
                      <Wand2 className="w-3.5 h-3.5" />
                      🪄 召唤 AI 一键消除冲突 (Auto-Disambiguate)
                    </button>
                  </div>
                ) : (
                  <div className="p-3 rounded-xl bg-emerald-950/30 border border-emerald-800/60 flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    <div className="text-xs text-emerald-200/90 leading-relaxed">
                      技能权责边界清晰！未与现有库中任何技能发生恶性语义冲突，符合两阶段路由上架规范。
                    </div>
                  </div>
                )}

                {/* 库内现有相似技能雷达榜 */}
                {similarityTop.length > 0 && (
                  <div className="text-[11px] text-slate-400 space-y-1">
                    <div className="text-[10px] text-slate-500">现有技能相似度雷达：</div>
                    {similarityTop.map((item, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between text-[10px] bg-slate-950/40 px-2 py-1 rounded"
                      >
                        <span className="text-slate-300 font-mono truncate max-w-[180px]">
                          {item.skill.name}
                        </span>
                        <span
                          className={`font-mono ${
                            item.sim >= 0.85 ? 'text-amber-400 font-bold' : 'text-slate-500'
                          }`}
                        >
                          {(item.sim * 100).toFixed(0)}%
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {/* 一键注册上线主按钮 */}
                <button
                  type="button"
                  onClick={handleConfirmRegister}
                  disabled={!collisionResult?.allowed}
                  className="w-full py-3 px-4 rounded-xl font-bold text-xs text-white bg-emerald-600 hover:bg-emerald-500 transition-all shadow-md shadow-emerald-900/30 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Sparkles className="w-4 h-4" />
                  一键注册并上线该技能 (立即生效)
                </button>
              </div>
            </div>
          ) : (
            /* 未生成草案时的占位卡片 */
            <div className="bg-slate-900/60 border border-slate-800 border-dashed rounded-2xl p-8 text-center flex flex-col items-center justify-center h-[500px] text-slate-400 space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-indigo-950/60 border border-indigo-800/60 flex items-center justify-center text-indigo-400">
                <Wand2 className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-bold text-white">等待技能创意输入</h3>
              <p className="text-xs text-slate-400 max-w-xs leading-relaxed">
                在左侧对话框中，用你平时说话的方式告诉我你想让 Agent 解决什么问题。
                AI 会实时在这里为你编排技能蓝图并检测排他门禁！
              </p>
              <div className="text-[11px] text-indigo-300/80 bg-indigo-950/40 px-3 py-1.5 rounded-lg border border-indigo-800/40">
                💡 试着点击上方的快捷业务示例，1 秒生成蓝图
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
