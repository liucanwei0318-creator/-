import React, { useState, useEffect, useMemo } from 'react';
import { Skill } from '../types/agent';
import {
  AlertTriangle,
  ShieldAlert,
  ArrowRight,
  X,
  Sliders,
  CheckCircle2,
  RefreshCw,
  Bell,
  Activity,
  Flame,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

interface GlobalGovernanceNotifierProps {
  skills: Skill[];
  activeTab: string;
  onNavigateToGovernance: () => void;
  onSimulateErrorCall?: (skillId: string) => void;
  onResetSkillErrors?: (skillId: string) => void;
}

export const GlobalGovernanceNotifier: React.FC<GlobalGovernanceNotifierProps> = ({
  skills,
  activeTab,
  onNavigateToGovernance,
  onSimulateErrorCall,
  onResetSkillErrors,
}) => {
  // 阈值设定 (默认 20% 错误率，调用次数 >= 3)
  const [errorThreshold, setErrorThreshold] = useState<number>(0.20);
  const [minCallCount, setMinCallCount] = useState<number>(3);
  
  // 展开与收起状态
  const [isDismissed, setIsDismissed] = useState<boolean>(false);
  const [showConfig, setShowConfig] = useState<boolean>(false);
  const [lastAlertSkillId, setLastAlertSkillId] = useState<string | null>(null);

  // 筛选出超过错误率阈值的异常技能
  const alertSkills = useMemo(() => {
    return skills.filter((s) => {
      const errorRate = s.call_count > 0 ? s.error_count / s.call_count : 0;
      return s.call_count >= minCallCount && errorRate >= errorThreshold;
    });
  }, [skills, errorThreshold, minCallCount]);

  // 当产生新的超阈值告警时，自动解除关闭状态，弹窗提示管理员
  useEffect(() => {
    if (alertSkills.length > 0) {
      const currentHighest = alertSkills[0].skill_id;
      if (currentHighest !== lastAlertSkillId) {
        setLastAlertSkillId(currentHighest);
        setIsDismissed(false); // 重新呼出告警
      }
    }
  }, [alertSkills, lastAlertSkillId]);

  if (alertSkills.length === 0) {
    return null;
  }

  const primarySkill = alertSkills[0];
  const primaryErrorRate = (
    (primarySkill.error_count / primarySkill.call_count) *
    100
  ).toFixed(1);

  return (
    <>
      {/* 顶部全局告警横幅 (Global Governance Alert Banner) */}
      {!isDismissed ? (
        <div className="mb-6 rounded-2xl bg-gradient-to-r from-rose-950 via-slate-900 to-rose-950 border-2 border-rose-600/80 p-4 sm:p-5 shadow-2xl shadow-rose-950/60 animate-in fade-in slide-in-from-top-4 duration-300">
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
            {/* 左侧告警主体信息 */}
            <div className="flex items-start gap-3.5 flex-1">
              <div className="relative mt-0.5">
                <div className="w-9 h-9 rounded-xl bg-rose-600 flex items-center justify-center text-white shadow-lg shadow-rose-600/40">
                  <AlertTriangle className="w-5 h-5 text-amber-200 animate-bounce" />
                </div>
                {/* 脉冲红圈呼吸灯 */}
                <span className="absolute -top-1 -right-1 flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-rose-500"></span>
                </span>
              </div>

              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-rose-500 text-white">
                    HITL 治理级红线告警
                  </span>
                  <span className="text-xs text-rose-300 font-mono">
                    监控阈值: {(errorThreshold * 100).toFixed(0)}%
                  </span>
                  <span className="text-xs text-slate-400">· 自动派发至管理员监控台</span>
                </div>

                <h3 className="text-sm sm:text-base font-bold text-white flex items-center gap-2 flex-wrap">
                  <span>技能</span>
                  <span className="font-mono text-amber-300 underline decoration-rose-500 decoration-2">
                    [{primarySkill.name}]
                  </span>
                  <span>调用错误率达</span>
                  <span className="text-rose-400 font-mono font-black text-base">
                    {primaryErrorRate}%
                  </span>
                  <span className="text-xs text-rose-200 font-normal">
                    (总调用 {primarySkill.call_count} 次 / 失败 {primarySkill.error_count} 次)
                  </span>
                </h3>

                <p className="text-xs text-slate-300 leading-relaxed max-w-4xl">
                  {alertSkills.length > 1
                    ? `同时共有 ${alertSkills.length} 项技能 (${alertSkills.map((s) => s.name).join(', ')}) 报错率超出治理红线！`
                    : '检测到接口可能发生 Schema 协议漂移或历史入参格式异常，为防止线上多步骤任务级联雪崩，系统已自动触发治理保护机制。'}
                </p>
              </div>
            </div>

            {/* 右侧交互操作按钮组 */}
            <div className="flex items-center gap-2.5 shrink-0 w-full lg:w-auto justify-end pt-2 lg:pt-0 border-t lg:border-t-0 border-rose-900/50">
              <button
                type="button"
                onClick={() => setShowConfig(!showConfig)}
                className="px-3 py-2 text-xs text-slate-300 hover:text-white bg-slate-900/80 hover:bg-slate-800 border border-slate-700 rounded-xl transition-colors flex items-center gap-1.5"
                title="调整监控阈值或快捷测试"
              >
                <Sliders className="w-3.5 h-3.5 text-slate-400" />
                <span className="hidden sm:inline">阈值调控</span>
                {showConfig ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              </button>

              <button
                type="button"
                onClick={onNavigateToGovernance}
                className="px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-500 transition-all rounded-xl shadow-lg shadow-rose-900/50 flex items-center gap-2 cursor-pointer active:scale-95"
              >
                <span>立即进入治理中心排查</span>
                <ArrowRight className="w-4 h-4 text-rose-200" />
              </button>

              <button
                type="button"
                onClick={() => setIsDismissed(true)}
                className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors"
                title="收起通知 (保留悬浮球)"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* 展开的调控与模拟测试工具条 */}
          {showConfig && (
            <div className="mt-4 pt-3.5 border-t border-rose-900/60 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs bg-slate-950/60 p-3 rounded-xl">
              <div className="flex items-center gap-4 flex-wrap">
                <div className="flex items-center gap-2">
                  <span className="text-slate-400">告警错误率阈值:</span>
                  <select
                    value={errorThreshold}
                    onChange={(e) => setErrorThreshold(parseFloat(e.target.value))}
                    className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-slate-200 text-xs font-mono"
                  >
                    <option value="0.10">10% (严格监控)</option>
                    <option value="0.15">15% (较严格)</option>
                    <option value="0.20">20% (标准默认)</option>
                    <option value="0.30">30% (宽松)</option>
                  </select>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-slate-400">最少调用次数:</span>
                  <select
                    value={minCallCount}
                    onChange={(e) => setMinCallCount(parseInt(e.target.value, 10))}
                    className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-slate-200 text-xs font-mono"
                  >
                    <option value="1">1 次 (极速测试)</option>
                    <option value="3">3 次</option>
                    <option value="5">5 次 (论文默认)</option>
                  </select>
                </div>
              </div>

              {/* 快捷测试注入按钮 */}
              <div className="flex items-center gap-2">
                {onSimulateErrorCall && (
                  <button
                    type="button"
                    onClick={() => onSimulateErrorCall(primarySkill.skill_id)}
                    className="px-2.5 py-1 text-[11px] font-semibold text-amber-300 bg-amber-950/60 border border-amber-800 rounded-lg hover:bg-amber-900/60 transition-colors flex items-center gap-1"
                  >
                    <Flame className="w-3 h-3 text-amber-400" />
                    模拟再报错 1 次
                  </button>
                )}
                {onResetSkillErrors && (
                  <button
                    type="button"
                    onClick={() => onResetSkillErrors(primarySkill.skill_id)}
                    className="px-2.5 py-1 text-[11px] font-semibold text-emerald-300 bg-emerald-950/60 border border-emerald-800 rounded-lg hover:bg-emerald-900/60 transition-colors flex items-center gap-1"
                  >
                    <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                    修复/清零报错
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      ) : null}

      {/* 当被收起时，常驻在屏幕右下角的治理告警浮标 (Floating Quick Widget) */}
      {isDismissed && (
        <aside
          role="complementary"
          aria-label="人机治理告警浮窗"
          className="fixed bottom-6 right-6 z-40 animate-in fade-in zoom-in-95 duration-200"
        >
          <div className="bg-slate-900 border-2 border-rose-600 rounded-2xl p-3 shadow-2xl shadow-rose-950/80 flex items-center gap-3">
            <div className="relative">
              <button
                type="button"
                onClick={() => setIsDismissed(false)}
                className="w-10 h-10 rounded-xl bg-rose-600 hover:bg-rose-500 text-white flex items-center justify-center transition-all cursor-pointer shadow-md"
                title="重新展开治理告警面板"
              >
                <Bell className="w-5 h-5 animate-pulse" />
              </button>
              <span className="absolute -top-1 -right-1 w-3 h-3 bg-rose-500 rounded-full border-2 border-slate-900 animate-ping"></span>
            </div>

            <div className="text-left cursor-pointer" onClick={() => setIsDismissed(false)}>
              <div className="text-xs font-bold text-white flex items-center gap-1">
                <span>治理告警</span>
                <span className="px-1.5 py-0.2 rounded bg-rose-950 text-rose-300 font-mono text-[10px] border border-rose-800">
                  {alertSkills.length} 项超标
                </span>
              </div>
              <div className="text-[10px] text-rose-300/80 font-mono">
                {primarySkill.name}: {primaryErrorRate}% 报错
              </div>
            </div>

            <button
              type="button"
              onClick={onNavigateToGovernance}
              className="ml-1 px-2.5 py-1.5 rounded-lg bg-rose-600/30 hover:bg-rose-600 text-rose-200 hover:text-white text-xs font-semibold transition-colors flex items-center gap-1"
            >
              <span>去治理</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>
        </aside>
      )}
    </>
  );
};
