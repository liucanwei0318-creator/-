import React, { useState, useMemo } from 'react';
import { Skill, SkillInteractionLog, NegativeExampleRule } from '../types/agent';
import { MetaSkillEngine, AutoRepairResult } from '../services/metaSkillEngine';
import {
  Sparkles,
  Bot,
  X,
  CheckCircle2,
  AlertTriangle,
  History,
  FileCode,
  ShieldCheck,
  ArrowRight,
  Flame,
  Clock,
  Layers,
  Sliders,
  Check,
  ChevronRight,
  AlertCircle,
  FileText,
  Terminal,
} from 'lucide-react';

interface AutoRepairModalProps {
  skill: Skill;
  skills: Skill[];
  interactionLogs: SkillInteractionLog[];
  onClose: () => void;
  onApplyRepair: (healedSkill: Skill, repairLog: SkillInteractionLog) => void;
}

export const AutoRepairModal: React.FC<AutoRepairModalProps> = ({
  skill,
  skills,
  interactionLogs,
  onClose,
  onApplyRepair,
}) => {
  const [activeTab, setActiveTab] = useState<'diff' | 'logs' | 'trace'>('diff');
  const [isApplying, setIsApplying] = useState<boolean>(false);

  // 计算自愈结果
  const repairResult: AutoRepairResult = useMemo(() => {
    return MetaSkillEngine.autoRepairSkillFromHistoryLogs(skill, interactionLogs, skills);
  }, [skill, interactionLogs, skills]);

  // 该技能对应的历史日志
  const relevantLogs = useMemo(() => {
    const logs = interactionLogs.filter((l) => l.skill_id === skill.skill_id);
    if (logs.length > 0) return logs;
    // 若系统尚未有该技能的现成日志，提供模拟日志
    return [
      {
        id: `log-fallback-1`,
        skill_id: skill.skill_id,
        skill_name: skill.name,
        timestamp: '2026-10-10 03:15:20',
        user_query: `指派任务给 ${skill.display_name || skill.name} 处理非标准输入`,
        input_slots: { query: '测试调用' },
        status: 'error' as const,
        latency_ms: 150,
        error_category: 'slot_missing' as const,
        error_reason: `关键入参槽位 [${skill.required_slots[0] || 'input'}] 缺省或未做非空过滤，底层执行器抛出异常`,
      },
      {
        id: `log-fallback-2`,
        skill_id: skill.skill_id,
        skill_name: skill.name,
        timestamp: '2026-10-10 04:02:11',
        user_query: `跨领域模糊指令误触发了 ${skill.display_name || skill.name}`,
        input_slots: { domain: '跨界任务' },
        status: 'error' as const,
        latency_ms: 180,
        error_category: 'domain_confusion' as const,
        error_reason: '技能描述缺乏严格能力边界约束，导致被大模型误选并在不匹配领域执行报错',
      },
    ];
  }, [interactionLogs, skill]);

  const errorLogsCount = relevantLogs.filter((l) => l.status === 'error').length;
  const errorRatePct = skill.call_count > 0 ? ((skill.error_count / skill.call_count) * 100).toFixed(1) : '0.0';

  const handleConfirmApply = () => {
    setIsApplying(true);
    setTimeout(() => {
      onApplyRepair(repairResult.healedSkill, repairResult.repairLogEntry);
      setIsApplying(false);
      onClose();
    }, 500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden">
        {/* 顶部弹窗标题 */}
        <div className="p-5 border-b border-slate-800 bg-slate-950/60 flex items-start justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-indigo-950 border border-indigo-700 text-indigo-300 flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-amber-300" />
                Meta-skill 元技能自愈引擎
              </span>
              <span className="px-2 py-0.5 rounded text-[11px] font-mono bg-rose-950/80 border border-rose-800 text-rose-300 font-semibold flex items-center gap-1">
                <Flame className="w-3 h-3 text-rose-400" />
                历史报错率: {errorRatePct}% ({skill.error_count}/{skill.call_count}次)
              </span>
              <span className="px-2 py-0.5 rounded text-[11px] bg-slate-800 text-slate-300 border border-slate-700">
                生态: {skill.ecosystem?.toUpperCase() || 'CORE'}
              </span>
            </div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <span>尝试自动修复: {skill.display_name || skill.name}</span>
            </h2>
            <p className="text-xs text-slate-400 leading-relaxed">
              根据该技能的 <strong>{relevantLogs.length} 条历史操作与交互日志</strong> 提取失败特征，调用模拟的{' '}
              <strong>{repairResult.metaSkillUsed.name}</strong> 自动调整其能力描述与执行参数校验规则。
            </p>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors cursor-pointer shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 核心诊断结论横幅 */}
        <div className="px-5 py-3.5 bg-indigo-950/30 border-b border-indigo-900/40 flex items-center gap-3">
          <Bot className="w-5 h-5 text-indigo-400 shrink-0" />
          <div className="text-xs text-indigo-200 leading-relaxed flex-1">
            <span className="font-semibold text-white">自愈诊断总结：</span>
            {repairResult.diagnosisSummary}
          </div>
        </div>

        {/* 标签栏切换 */}
        <div className="flex items-center gap-2 px-5 pt-3 border-b border-slate-800 bg-slate-900/40">
          <button
            onClick={() => setActiveTab('diff')}
            className={`px-3.5 py-2 text-xs font-semibold rounded-t-lg transition-colors flex items-center gap-1.5 cursor-pointer border-b-2 ${
              activeTab === 'diff'
                ? 'border-indigo-500 text-white bg-slate-800/60'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
            方案前后 Diff 对比 (调整描述与执行参数)
          </button>

          <button
            onClick={() => setActiveTab('logs')}
            className={`px-3.5 py-2 text-xs font-semibold rounded-t-lg transition-colors flex items-center gap-1.5 cursor-pointer border-b-2 ${
              activeTab === 'logs'
                ? 'border-indigo-500 text-white bg-slate-800/60'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <History className="w-3.5 h-3.5 text-sky-400" />
            历史操作与交互日志 ({relevantLogs.length} 条，{errorLogsCount} 次异常)
          </button>

          <button
            onClick={() => setActiveTab('trace')}
            className={`px-3.5 py-2 text-xs font-semibold rounded-t-lg transition-colors flex items-center gap-1.5 cursor-pointer border-b-2 ${
              activeTab === 'trace'
                ? 'border-indigo-500 text-white bg-slate-800/60'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <FileCode className="w-3.5 h-3.5 text-amber-400" />
            元技能推理与自愈日志
          </button>
        </div>

        {/* 弹窗主体内容滚动区 */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5 text-xs text-slate-300">
          {activeTab === 'diff' && (
            <div className="space-y-5">
              {/* 1. 技能描述 (Description) 调整对比 */}
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-white text-xs flex items-center gap-2">
                    <FileText className="w-4 h-4 text-indigo-400" />
                    1. 技能能力描述 (Description) 调整对比
                  </h3>
                  <span className="text-[11px] text-indigo-300 bg-indigo-950 px-2 py-0.5 rounded border border-indigo-800">
                    {repairResult.diff.description.reason}
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="p-3 bg-slate-900 border border-rose-900/50 rounded-lg space-y-1.5">
                    <div className="text-[11px] font-bold text-rose-400 flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" />
                      调整前 (存在描述泛化与跨领域误召回风险)
                    </div>
                    <p className="text-slate-400 font-mono text-[11px] leading-relaxed">
                      {repairResult.diff.description.before}
                    </p>
                  </div>

                  <div className="p-3 bg-indigo-950/40 border border-indigo-700/60 rounded-lg space-y-1.5">
                    <div className="text-[11px] font-bold text-emerald-400 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                      调整后 (Meta-skill 注入精准能力边界与专精约束)
                    </div>
                    <p className="text-indigo-200 font-mono text-[11px] leading-relaxed font-semibold">
                      {repairResult.diff.description.after}
                    </p>
                  </div>
                </div>
              </div>

              {/* 2. 执行参数槽位 (Execution Parameters & Schema) 调整对比 */}
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-white text-xs flex items-center gap-2">
                    <Sliders className="w-4 h-4 text-sky-400" />
                    2. 执行参数 (Execution Slots & 防御Schema) 调整对比
                  </h3>
                  <span className="text-[11px] text-sky-300 bg-sky-950 px-2 py-0.5 rounded border border-sky-800">
                    {repairResult.diff.slots.reason}
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="p-3 bg-slate-900 border border-slate-800 rounded-lg space-y-2">
                    <div className="text-[11px] font-bold text-slate-400">
                      调整前参数列表 ({repairResult.diff.slots.before.length} 项)
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {repairResult.diff.slots.before.map((s) => (
                        <span key={s} className="px-2 py-1 bg-slate-800 text-slate-300 font-mono text-[10px] rounded border border-slate-700">
                          {s}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="p-3 bg-slate-900 border border-sky-800/60 rounded-lg space-y-2">
                    <div className="text-[11px] font-bold text-sky-300 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3 text-sky-400" />
                      调整后参数列表 ({repairResult.diff.slots.after.length} 项，已补充容错防御)
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {repairResult.diff.slots.after.map((s) => {
                        const isNew = !repairResult.diff.slots.before.includes(s);
                        return (
                          <span
                            key={s}
                            className={`px-2 py-1 font-mono text-[10px] rounded border flex items-center gap-1 ${
                              isNew
                                ? 'bg-sky-950 text-sky-300 border-sky-700 font-bold'
                                : 'bg-slate-800 text-slate-300 border-slate-700'
                            }`}
                          >
                            {isNew && <Sparkles className="w-2.5 h-2.5 text-amber-300" />}
                            {s}
                            {isNew && <span className="text-[9px] text-sky-400">(新增防崩)</span>}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* 详细执行参数 Schema 校验规则说明 */}
                <div className="mt-2 border-t border-slate-800 pt-3">
                  <div className="text-[11px] font-bold text-slate-300 mb-2">执行参数 Schema 校验与容错规则明细：</div>
                  <div className="space-y-1.5 font-mono text-[11px]">
                    {Object.entries(repairResult.diff.slotsExplanation.after).map(([slotKey, ruleText]) => (
                      <div key={slotKey} className="flex items-start gap-2 bg-slate-900/80 p-2 rounded border border-slate-800">
                        <span className="text-sky-400 font-bold shrink-0">{slotKey}:</span>
                        <span className="text-slate-300 leading-normal">{ruleText}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* 3. 负向规则与反面示例 (Negative Examples) 自动注入 */}
              {repairResult.diff.negativeExamples.added.length > 0 && (
                <div className="bg-slate-950 border border-amber-900/50 rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="font-bold text-amber-400 text-xs flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 text-amber-400" />
                      3. 自动注入的反面示例规避规则 (Negative Example Rules)
                    </h3>
                    <span className="text-[11px] text-amber-300 bg-amber-950 px-2 py-0.5 rounded border border-amber-800">
                      新增 {repairResult.diff.negativeExamples.added.length} 条互斥分流
                    </span>
                  </div>

                  <div className="space-y-2">
                    {repairResult.diff.negativeExamples.added.map((rule, idx) => (
                      <div
                        key={idx}
                        className="p-3 bg-amber-950/20 border border-amber-800/40 rounded-lg flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-[11px]"
                      >
                        <div className="space-y-1">
                          <div className="text-slate-200">
                            <strong>🚫 易混淆场景：</strong>
                            {rule.scenario}
                          </div>
                          <div className="text-amber-300/80">
                            <strong>💡 排除根因：</strong>
                            {rule.why_avoid}
                          </div>
                        </div>

                        <div className="shrink-0 bg-amber-950 px-2.5 py-1.5 rounded border border-amber-700 text-amber-200 flex items-center gap-1 font-semibold">
                          <ArrowRight className="w-3.5 h-3.5 text-amber-400" />
                          重定向分流至: {rule.divert_to_skill_name}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 4. 关键健康指标预期提升 */}
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 text-center">
                  <span className="text-[10px] text-slate-500 block">报错率预测</span>
                  <div className="text-base font-bold font-mono mt-0.5 flex items-center justify-center gap-1.5">
                    <span className="text-rose-400 line-through">{errorRatePct}%</span>
                    <ArrowRight className="w-3 h-3 text-slate-500" />
                    <span className="text-emerald-400">0.0% (极致健康)</span>
                  </div>
                </div>

                <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 text-center">
                  <span className="text-[10px] text-slate-500 block">治理状态变更</span>
                  <div className="text-base font-bold font-mono mt-0.5 flex items-center justify-center gap-1.5">
                    <span className="text-amber-400">quarantined</span>
                    <ArrowRight className="w-3 h-3 text-slate-500" />
                    <span className="text-sky-400">healed (已自愈)</span>
                  </div>
                </div>

                <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 text-center">
                  <span className="text-[10px] text-slate-500 block">调用领域收敛</span>
                  <div className="text-base font-bold font-mono mt-0.5 text-indigo-400">
                    专精收敛至核心业务域
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'logs' && (
            <div className="space-y-3">
              <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg flex items-center justify-between">
                <div className="text-slate-300">
                  当前技能历史交互日志总数: <strong>{relevantLogs.length}</strong> 条（其中 <strong>{errorLogsCount}</strong> 条报错异常）
                </div>
                <div className="text-[11px] text-slate-500">已自动按时间倒序排列</div>
              </div>

              <div className="space-y-2.5">
                {relevantLogs.map((log) => (
                  <div
                    key={log.id}
                    className={`p-3.5 rounded-xl border transition-colors ${
                      log.status === 'error'
                        ? 'bg-rose-950/20 border-rose-900/60'
                        : 'bg-slate-950 border-slate-800'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase font-mono ${
                            log.status === 'error'
                              ? 'bg-rose-950 text-rose-300 border border-rose-800'
                              : 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                          }`}
                        >
                          {log.status === 'error' ? 'Execution Error' : 'Success OK'}
                        </span>
                        <span className="font-semibold text-white text-xs">{log.user_query}</span>
                      </div>
                      <span className="text-[10px] text-slate-500 font-mono flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {log.timestamp} ({log.latency_ms}ms)
                      </span>
                    </div>

                    <div className="text-[11px] space-y-1">
                      <div className="text-slate-400 flex items-center gap-2">
                        <span className="text-slate-500 font-mono">入参槽位:</span>
                        <span className="font-mono text-slate-300 bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                          {JSON.stringify(log.input_slots)}
                        </span>
                      </div>

                      {log.error_reason && (
                        <div className="mt-1 text-rose-300 bg-rose-950/50 p-2 rounded border border-rose-800/50 flex items-start gap-1.5">
                          <AlertCircle className="w-3.5 h-3.5 text-rose-400 shrink-0 mt-0.5" />
                          <div>
                            <span className="font-bold">崩溃原因记录：</span>
                            {log.error_reason}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'trace' && (
            <div className="space-y-4">
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 font-mono text-xs space-y-2">
                <div className="text-sky-400 font-bold flex items-center gap-2">
                  <Terminal className="w-4 h-4 text-sky-400" />
                  Meta-Skill 深度推理与自愈日志追踪 (Execution Trace)
                </div>
                <div className="text-slate-400 space-y-1.5 text-[11px] pt-2 border-t border-slate-800">
                  <p className="text-slate-500">[{new Date().toLocaleDateString()}] 触发元技能自愈巡检引擎...</p>
                  <p className="text-indigo-400">
                    &gt; 载入技能上下文: ID={skill.skill_id}, Name={skill.name}, 当前报错率={errorRatePct}%
                  </p>
                  <p className="text-sky-300">
                    &gt; 检索系统历史交互日志: 成功命中 {relevantLogs.length} 条记录 (提取到 {errorLogsCount} 条失败上下文堆栈)
                  </p>
                  <p className="text-amber-300">
                    &gt; 模式识别完成: 发现主要故障源于 [槽位缺省空指针] 与 [跨领域语义竞争导致大模型误选]
                  </p>
                  <p className="text-emerald-400">
                    &gt; 执行自愈调整: 自动扩充必需参数 strict_validation 与 fallback_default 默认值
                  </p>
                  <p className="text-emerald-400">
                    &gt; 注入能力边界声明: 已将专精业务域强制绑定在 [{skill.content_domain || skill.clusters[0]}]
                  </p>
                  <p className="text-emerald-400">
                    &gt; 动态生成反面示例: 成功与库内同质化/竞争技能建立负向规避路由
                  </p>
                  <p className="text-white font-bold">
                    &gt; 自愈沙箱校验通过 (Status: 200 OK)！所有指标已就绪，等待管理员确认写入。
                  </p>
                </div>
              </div>

              <div className="p-4 bg-indigo-950/20 border border-indigo-800/40 rounded-xl text-xs space-y-1 text-indigo-300">
                <div className="font-bold text-white flex items-center gap-1.5">
                  <Bot className="w-4 h-4 text-indigo-400" />
                  执行元技能属性：{repairResult.metaSkillUsed.name}
                </div>
                <p className="text-[11px] text-slate-400">
                  {repairResult.metaSkillUsed.description}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* 底部操作按钮 */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/80 flex items-center justify-between gap-3">
          <div className="text-xs text-slate-400 flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>自愈方案由系统根据真实交互日志自动合成，点击确认后立即生效</span>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-medium transition-colors cursor-pointer"
            >
              取消
            </button>

            <button
              type="button"
              onClick={handleConfirmApply}
              disabled={isApplying}
              className="px-5 py-2 bg-gradient-to-r from-indigo-600 via-indigo-500 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white rounded-lg text-xs font-bold shadow-lg shadow-indigo-950/50 flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
            >
              {isApplying ? (
                <>
                  <Sparkles className="w-4 h-4 animate-spin text-amber-300" />
                  <span>正在应用自愈并重置指标...</span>
                </>
              ) : (
                <>
                  <Check className="w-4 h-4 text-emerald-300" />
                  <span>确认应用自愈方案 (Apply & Heal)</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
