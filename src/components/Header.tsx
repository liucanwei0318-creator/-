import React from 'react';
import {
  Sparkles,
  MessageSquare,
  Cpu,
  Layers,
  ShieldCheck,
  AlertTriangle,
  Database,
  Activity,
} from 'lucide-react';

interface HeaderProps {
  activeTab: 'chat' | 'orchestrator' | 'gate' | 'index' | 'governance' | 'ecosystem' | 'experiment';
  onTabChange: (tab: 'chat' | 'orchestrator' | 'gate' | 'index' | 'governance' | 'ecosystem' | 'experiment') => void;
  onOpenNewSkill: () => void;
  governanceAlertCount?: number;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  onTabChange,
  onOpenNewSkill,
  governanceAlertCount = 0,
}) => {
  return (
    <header className="sticky top-0 z-30 bg-slate-950/90 backdrop-blur-md border-b border-slate-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        {/* Zone 1: Brand title, one line */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white font-bold text-xs shadow-sm">
            SIS
          </div>
          <span className="text-base sm:text-lg font-bold tracking-tight text-white whitespace-nowrap">
            Skill Index System <span className="text-xs font-normal text-slate-400 ml-1">Agent 工作台</span>
          </span>
        </div>

        {/* Zone 2: Navigation tabs */}
        <nav className="hidden lg:flex items-center gap-1.5 text-xs font-medium">
          <button
            onClick={() => onTabChange('chat')}
            className={`px-3 py-2 rounded-lg transition-colors whitespace-nowrap flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'chat'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-300 hover:text-white hover:bg-slate-800'
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5" />
            Agent 对话运行区
          </button>

          <button
            onClick={() => onTabChange('orchestrator')}
            className={`px-3 py-2 rounded-lg transition-colors whitespace-nowrap flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'orchestrator'
                ? 'bg-slate-800 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            <Cpu className="w-3.5 h-3.5 text-indigo-400" />
            任务编排控制台
          </button>

          <button
            onClick={() => onTabChange('gate')}
            className={`px-3 py-2 rounded-lg transition-colors whitespace-nowrap flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'gate'
                ? 'bg-slate-800 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            技能注册与门禁
          </button>

          <button
            onClick={() => onTabChange('index')}
            className={`px-3 py-2 rounded-lg transition-colors whitespace-nowrap flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'index'
                ? 'bg-slate-800 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            <Layers className="w-3.5 h-3.5 text-sky-400" />
            多维技能索引
          </button>

          <button
            onClick={() => onTabChange('ecosystem')}
            className={`px-3 py-2 rounded-lg transition-all whitespace-nowrap flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'ecosystem'
                ? 'bg-gradient-to-r from-emerald-600 to-indigo-600 text-white shadow-sm font-semibold'
                : 'text-emerald-300 hover:text-white bg-emerald-950/40 hover:bg-emerald-900/40 border border-emerald-800/60'
            }`}
            title="接入 OpenAI, Claude, Qwen, DeepSeek 数据库 (79 项)"
          >
            <Database className="w-3.5 h-3.5 text-emerald-400" />
            <span>大模型技能库</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 font-mono border border-emerald-500/40">
              79项
            </span>
          </button>

          <button
            onClick={() => onTabChange('governance')}
            className={`px-3 py-2 rounded-lg transition-colors whitespace-nowrap flex items-center gap-1.5 relative cursor-pointer ${
              activeTab === 'governance'
                ? 'bg-slate-800 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            <AlertTriangle
              className={`w-3.5 h-3.5 ${
                governanceAlertCount > 0 ? 'text-rose-400 animate-pulse' : 'text-amber-400'
              }`}
            />
            <span>人机治理中心</span>
            {governanceAlertCount > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-rose-600 text-white animate-pulse">
                {governanceAlertCount}
              </span>
            )}
          </button>

          {/* 新增：长对话错误率对比实验 */}
          <button
            onClick={() => onTabChange('experiment')}
            className={`px-3 py-2 rounded-lg transition-all whitespace-nowrap flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'experiment'
                ? 'bg-gradient-to-r from-rose-600 to-indigo-600 text-white shadow-md font-semibold'
                : 'text-indigo-300 hover:text-white bg-indigo-950/40 hover:bg-indigo-900/40 border border-indigo-700/60'
            }`}
            title="长对话深度错误率对比实验与学术报告"
          >
            <Activity className="w-3.5 h-3.5 text-rose-400" />
            <span>长对话对比实验</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded bg-rose-500/20 text-rose-300 font-mono border border-rose-500/40">
              评测
            </span>
          </button>
        </nav>

        {/* Zone 3: 1 primary action */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={onOpenNewSkill}
            className="px-3.5 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 border border-indigo-500/50 rounded-lg transition-all shadow-sm flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-300" />
            AI 注册新技能
          </button>
        </div>
      </div>
    </header>
  );
};
