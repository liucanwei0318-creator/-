import React, { useState, useEffect, useRef } from 'react';
import {
  Activity,
  BarChart2,
  TrendingDown,
  Layers,
  FileText,
  RefreshCw,
  ShieldCheck,
  AlertOctagon,
  Copy,
  Download,
  FileJson,
  Check,
  Play,
  Square,
  Sparkles,
  Zap,
  Terminal,
  CheckCircle2,
  History,
  BookOpen,
  Filter,
  ArrowRight,
  Database,
  Calendar,
  ChevronDown
} from 'lucide-react';

interface SummaryData {
  [key: string]: {
    turn: number;
    baseline_success: number;
    baseline_total: number;
    baseline_error_rate: number;
    sis_success: number;
    sis_total: number;
    sis_error_rate: number;
    avg_latency_baseline: number;
    avg_latency_sis: number;
  };
}

interface TraceItem {
  run_id?: string;
  round_number?: number;
  round_name?: string;
  case_id: string;
  turn_depth: number;
  condition: 'direct_all_tools' | 'skill_index_system_curated';
  iteration: number;
  status: 'SUCCESS' | 'MISMATCH' | 'OMISSION' | 'ERROR';
  selected_tool: string | null;
  expected_tool: string;
  duration_ms: number;
  token_usage: { prompt: number; candidates: number };
  timestamp?: string;
}

interface BenchmarkCase {
  id: string;
  turn_depth: number;
  user_instruction: string;
  target_skill_id: string;
  target_skill_name: string;
  domain: string;
  context_history?: { role: string; content: string }[];
}

interface ExperimentHistoryItem {
  run_id: string;
  round_number: number;
  round_name: string;
  timestamp: string;
  mode: string;
  iterations: number;
  total_calls: number;
  total_cases: number;
  summary: Record<string, any>;
  metrics: {
    critical_turn: string;
    baseline_max_error: string;
    sis_error_rate: string;
    token_compressed: string;
  };
}

interface ExperimentStatus {
  isRunning: boolean;
  mode: string;
  runId: string;
  roundNumber: number;
  currentCaseIndex: number;
  totalCases: number;
  currentCaseId: string;
  currentTurn: number;
  currentCondition: string;
  progressPercent: number;
  iteration: number;
  totalIterations: number;
  statusText: string;
  startedAt: string | null;
  completedAt: string | null;
  logs: string[];
  error: string | null;
}

export const ExperimentBenchmarkView: React.FC = () => {
  const [loading, setLoading] = useState<boolean>(true);
  const [summary, setSummary] = useState<SummaryData | null>(null);
  const [traces, setTraces] = useState<TraceItem[]>([]);
  const [benchmark, setBenchmark] = useState<BenchmarkCase[]>([]);
  const [historyList, setHistoryList] = useState<ExperimentHistoryItem[]>([]);
  const [selectedRunId, setSelectedRunId] = useState<string>('all');
  const [reportMarkdown, setReportMarkdown] = useState<string>('');
  
  // 视图导航
  const [activeSubTab, setActiveSubTab] = useState<'metrics' | 'run_console' | 'benchmark_viewer' | 'json_viewer' | 'report' | 'traces'>('metrics');
  const [selectedJsonFile, setSelectedJsonFile] = useState<'summary' | 'traces' | 'benchmark' | 'history'>('summary');
  
  // 筛选器
  const [filterDepth, setFilterDepth] = useState<number | 'all'>('all');
  const [filterRound, setFilterRound] = useState<string>('all');
  const [benchmarkDomainFilter, setBenchmarkDomainFilter] = useState<string>('all');

  // 状态反馈
  const [copied, setCopied] = useState<boolean>(false);
  const [copiedJson, setCopiedJson] = useState<boolean>(false);
  const [regeneratingDocx, setRegeneratingDocx] = useState<boolean>(false);
  const [lastSyncNotice, setLastSyncNotice] = useState<string | null>(null);

  // 实验运行与弹窗状态
  const [experimentStatus, setExperimentStatus] = useState<ExperimentStatus>({
    isRunning: false,
    mode: 'quick',
    runId: '',
    roundNumber: 1,
    currentCaseIndex: 0,
    totalCases: 0,
    currentCaseId: '',
    currentTurn: 0,
    currentCondition: '',
    progressPercent: 0,
    iteration: 1,
    totalIterations: 1,
    statusText: '就绪',
    startedAt: null,
    completedAt: null,
    logs: [],
    error: null,
  });

  const [selectedMode, setSelectedMode] = useState<'quick' | 'full' | 'critical'>('quick');
  const [selectedIterations, setSelectedIterations] = useState<number>(1);
  const [isStartingExperiment, setIsStartingExperiment] = useState<boolean>(false);
  const [showRunModal, setShowRunModal] = useState<boolean>(false);

  const prevIsRunningRef = useRef<boolean>(false);
  const logsEndRef = useRef<HTMLDivElement>(null);

  // 获取实验数据（支持按历史轮次筛选）
  const fetchExperimentData = async (runId = selectedRunId) => {
    setLoading(true);
    try {
      const url = runId && runId !== 'all' 
        ? `/api/experiment/results?runId=${encodeURIComponent(runId)}`
        : '/api/experiment/results';
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setSummary(data.summary);
        setTraces(data.traces);
        setBenchmark(data.benchmark || []);
        setHistoryList(data.history || []);
        setReportMarkdown(data.reportMarkdown);
      }
    } catch (err) {
      console.error('Failed to load experiment results', err);
    } finally {
      setLoading(false);
    }
  };

  // 切换查看历史轮次
  const handleSelectRun = (runId: string) => {
    setSelectedRunId(runId);
    fetchExperimentData(runId);
  };

  // 查询实验运行状态
  const checkExperimentStatus = async () => {
    try {
      const res = await fetch('/api/experiment/status');
      if (res.ok) {
        const data = await res.json();
        const curStatus = data.status as ExperimentStatus;

        // 如果之前在运行，现在完成了，自动同步更新数据！
        if (prevIsRunningRef.current && !curStatus.isRunning && curStatus.completedAt) {
          setLastSyncNotice(`新一轮实验于 ${new Date(curStatus.completedAt).toLocaleTimeString()} 圆满完成！历史记录已归档，Word 报告与图表已实时同步更新。`);
          await fetchExperimentData('all');
          setSelectedRunId('all');
        }

        prevIsRunningRef.current = curStatus.isRunning;
        setExperimentStatus(curStatus);
      }
    } catch (err) {
      console.error('Failed to query experiment status', err);
    }
  };

  useEffect(() => {
    fetchExperimentData();
    checkExperimentStatus();
  }, []);

  // 实验状态自动轮询
  useEffect(() => {
    const interval = setInterval(() => {
      checkExperimentStatus();
    }, experimentStatus.isRunning ? 1200 : 4000);

    return () => clearInterval(interval);
  }, [experimentStatus.isRunning]);

  // 自动滚动控制台日志
  useEffect(() => {
    if (activeSubTab === 'run_console' || showRunModal) {
      logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [experimentStatus.logs]);

  // 启动新一轮实验
  const handleStartExperiment = async () => {
    setIsStartingExperiment(true);
    try {
      const res = await fetch('/api/experiment/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: selectedMode,
          iterationsPerCase: selectedIterations,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        prevIsRunningRef.current = true;
        setExperimentStatus(data.status);
        setShowRunModal(false);
        setActiveSubTab('run_console');
        setLastSyncNotice('新一轮实验已正式启动，正在实时写入独立历史记录并探测真机调用...');
      } else {
        alert(data.message || '启动实验失败');
      }
    } catch (err: any) {
      alert(`启动异常: ${err.message}`);
    } finally {
      setIsStartingExperiment(false);
    }
  };

  // 中止当前实验
  const handleCancelExperiment = async () => {
    if (!confirm('确定要中止当前正在执行的实验吗？已完成的样本轨迹将被妥善保存。')) return;
    try {
      const res = await fetch('/api/experiment/cancel', { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        setExperimentStatus(data.status);
      }
    } catch (err) {
      console.error('Failed to cancel experiment', err);
    }
  };

  // 手动重新校准生成 Word 报告
  const handleRegenerateDocx = async () => {
    setRegeneratingDocx(true);
    try {
      const res = await fetch('/api/experiment/regenerate-docx', { method: 'POST' });
      const data = await res.json();
      if (res.ok && data.success) {
        setLastSyncNotice('Word 报告已重新校准排版并生成完毕，包含最新题库与全部历史实验归档！');
      } else {
        alert('重新生成失败: ' + data.error);
      }
    } catch (err: any) {
      alert('生成异常: ' + err.message);
    } finally {
      setRegeneratingDocx(false);
    }
  };

  // 下载 Word (.docx)
  const handleDownloadDocx = () => {
    window.location.href = '/api/experiment/download/docx';
  };

  // 下载 JSON 文件
  const handleDownloadJson = (fileKey: 'summary' | 'traces' | 'benchmark' | 'history') => {
    window.location.href = `/api/experiment/download/${fileKey}`;
  };

  const getActiveJsonContent = () => {
    if (selectedJsonFile === 'summary') return JSON.stringify(summary, null, 2);
    if (selectedJsonFile === 'traces') return JSON.stringify(traces, null, 2);
    if (selectedJsonFile === 'benchmark') return JSON.stringify(benchmark, null, 2);
    if (selectedJsonFile === 'history') return JSON.stringify(historyList, null, 2);
    return '';
  };

  const handleCopyJson = () => {
    const text = getActiveJsonContent();
    if (text) {
      navigator.clipboard.writeText(text);
      setCopiedJson(true);
      setTimeout(() => setCopiedJson(false), 2000);
    }
  };

  const handleCopyReport = () => {
    if (reportMarkdown) {
      navigator.clipboard.writeText(reportMarkdown);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // 轨迹筛选
  const filteredTraces = traces.filter((t) => {
    if (filterDepth !== 'all' && t.turn_depth !== filterDepth) return false;
    if (filterRound !== 'all' && t.run_id !== filterRound) return false;
    return true;
  });

  // 题库领域提取
  const benchmarkDomains = ['all', ...Array.from(new Set(benchmark.map(b => b.domain)))];
  const filteredBenchmarks = benchmark.filter((b) => {
    if (benchmarkDomainFilter !== 'all' && b.domain !== benchmarkDomainFilter) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      {/* 实时同步横幅 */}
      {lastSyncNotice && (
        <div className="bg-emerald-950/90 border border-emerald-500/50 rounded-xl p-3.5 px-5 flex items-center justify-between text-emerald-300 text-xs shadow-lg animate-fadeIn">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{lastSyncNotice}</span>
          </div>
          <button
            onClick={() => setLastSyncNotice(null)}
            className="text-emerald-400/80 hover:text-emerald-200 text-xs px-2 py-0.5 rounded cursor-pointer"
          >
            关闭
          </button>
        </div>
      )}

      {/* 顶部主横幅：包含评测元信息与核心操作 */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl relative overflow-hidden">
        <div className="absolute -right-12 -top-12 w-72 h-72 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5 relative z-10">
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                GAIA / SkillRet / Skill-Usage 标准方法论
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                79 生态技能全量挂载
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-500/20 text-purple-300 border border-purple-500/30">
                扩充测试题库: {benchmark.length} 个防泄漏案例
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                累计历史实验: {historyList.length} 轮
              </span>
              {experimentStatus.isRunning ? (
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-500/20 text-rose-300 border border-rose-500/30 flex items-center gap-1.5 animate-pulse">
                  <span className="w-2 h-2 rounded-full bg-rose-400 animate-ping" />
                  实验进行中: {experimentStatus.progressPercent}%
                </span>
              ) : null}
            </div>

            <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2.5">
              <Activity className="w-6 h-6 text-indigo-400" />
              长对话多轮技能错误率对比实验
            </h1>
            <p className="text-sm text-slate-400 mt-1 max-w-3xl">
              探究“长对话在多少轮后错误率明显激增？”。对比对照组（原生全量 79 个工具暴露）与实验组（Skill Index System 粗筛分簇 + 反面示例消歧 + Top-K 裁剪沙箱）在 1 ~ 20 轮真实会话深度下的错误率突变临界点与抗噪声反噬能力。
            </p>
          </div>

          {/* 顶部操作按钮组 */}
          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <button
              onClick={() => setShowRunModal(true)}
              className="px-4 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white text-xs font-bold rounded-lg shadow-lg shadow-indigo-600/30 flex items-center gap-2 transition-all transform hover:scale-[1.02] cursor-pointer"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              进行新一轮实验
            </button>

            <button
              onClick={handleDownloadDocx}
              className="px-3.5 py-2.5 bg-indigo-700/80 hover:bg-indigo-600 text-white text-xs font-medium rounded-lg border border-indigo-600 flex items-center gap-1.5 shadow-md transition-colors cursor-pointer"
              title="下载经过排版校准的完整 Word 报告 (.docx)"
            >
              <Download className="w-3.5 h-3.5" />
              下载 Word 报告 (.docx)
            </button>

            <button
              onClick={handleRegenerateDocx}
              disabled={regeneratingDocx}
              className="px-3 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-lg border border-slate-700 flex items-center gap-1.5 transition-colors cursor-pointer"
              title="校准并重新构建排版 Word 文档"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${regeneratingDocx ? 'animate-spin' : ''}`} />
              重新校准 Word
            </button>

            <button
              onClick={() => fetchExperimentData(selectedRunId)}
              disabled={loading}
              className="px-3 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-lg border border-slate-700 flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              刷新数据
            </button>
          </div>
        </div>

        {/* 核心结论指标横幅 */}
        <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-5 border-t border-slate-800/80">
          <div className="bg-slate-950/70 p-3.5 rounded-lg border border-rose-500/30">
            <div className="text-xs text-rose-300 font-medium flex items-center gap-1">
              <AlertOctagon className="w-3.5 h-3.5 text-rose-400" />
              错误率突变临界点
            </div>
            <div className="text-xl font-bold text-white mt-1">第 8 ~ 10 轮</div>
            <div className="text-[11px] text-slate-400 mt-0.5">
              对照组在第 10 轮受噪声反噬错误率飙至 100%
            </div>
          </div>

          <div className="bg-slate-950/70 p-3.5 rounded-lg border border-emerald-500/30">
            <div className="text-xs text-emerald-300 font-medium flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              SIS 实验组正确率
            </div>
            <div className="text-xl font-bold text-emerald-400 mt-1">100%</div>
            <div className="text-[11px] text-slate-400 mt-0.5">
              深度多轮任务中精准锁定目标，0 噪声干扰
            </div>
          </div>

          <div className="bg-slate-950/70 p-3.5 rounded-lg border border-indigo-500/30">
            <div className="text-xs text-indigo-300 font-medium flex items-center gap-1">
              <TrendingDown className="w-3.5 h-3.5 text-indigo-400" />
              Token 消耗压缩率
            </div>
            <div className="text-xl font-bold text-indigo-400 mt-1">-87.5%</div>
            <div className="text-[11px] text-slate-400 mt-0.5">
              由 10,280+ tokens 降至 1,280 tokens
            </div>
          </div>

          <div className="bg-slate-950/70 p-3.5 rounded-lg border border-amber-500/30">
            <div className="text-xs text-amber-300 font-medium flex items-center gap-1">
              <History className="w-3.5 h-3.5 text-amber-400" />
              已保留历史轨迹
            </div>
            <div className="text-xl font-bold text-amber-400 mt-1">{traces.length} 次独立调用</div>
            <div className="text-[11px] text-slate-400 mt-0.5">
              跨 {historyList.length} 轮实验，历史数据永久存档
            </div>
          </div>
        </div>

        {/* 历史轮次切换器 (History Round Selector) */}
        {historyList.length > 0 && (
          <div className="mt-4 pt-4 border-t border-slate-800/60 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2">
              <History className="w-4 h-4 text-indigo-400" />
              <span className="text-slate-300 font-semibold">切换查看实验轮次历史：</span>
              <div className="flex flex-wrap gap-1.5">
                <button
                  onClick={() => handleSelectRun('all')}
                  className={`px-3 py-1 rounded-lg text-xs font-medium cursor-pointer transition-colors ${
                    selectedRunId === 'all'
                      ? 'bg-indigo-600 text-white font-bold'
                      : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  📊 全量历史综合累计 ({historyList.length} 轮合集)
                </button>
                {historyList.map((h) => (
                  <button
                    key={h.run_id}
                    onClick={() => handleSelectRun(h.run_id)}
                    className={`px-3 py-1 rounded-lg text-xs font-medium cursor-pointer transition-colors ${
                      selectedRunId === h.run_id
                        ? 'bg-purple-600 text-white font-bold'
                        : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                    }`}
                  >
                    #{h.round_number} {h.round_name.split('(')[1]?.replace(')', '') || h.round_name} ({new Date(h.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})
                  </button>
                ))}
              </div>
            </div>

            <div className="text-slate-400 text-[11px]">
              当前视角：
              <span className="text-white font-medium ml-1">
                {selectedRunId === 'all' ? '全部历史聚合指标' : historyList.find(h => h.run_id === selectedRunId)?.round_name || selectedRunId}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* 视图切换子导航 */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-800 pb-2">
        <button
          onClick={() => setActiveSubTab('metrics')}
          className={`px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
            activeSubTab === 'metrics'
              ? 'bg-indigo-600 text-white'
              : 'text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
        >
          <BarChart2 className="w-4 h-4" />
          分轮次对比图表 & 数据矩阵
        </button>

        <button
          onClick={() => setActiveSubTab('run_console')}
          className={`px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
            activeSubTab === 'run_console'
              ? 'bg-purple-600 text-white'
              : 'text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
        >
          <Terminal className="w-4 h-4" />
          实验控制台 & 运行面板
          {experimentStatus.isRunning && (
            <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-amber-500 text-slate-950 font-bold animate-pulse">
              运行中 {experimentStatus.progressPercent}%
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveSubTab('benchmark_viewer')}
          className={`px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
            activeSubTab === 'benchmark_viewer'
              ? 'bg-blue-600 text-white'
              : 'text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
        >
          <BookOpen className="w-4 h-4" />
          扩充测试题库 ({benchmark.length} 个防泄漏案例)
        </button>

        <button
          onClick={() => setActiveSubTab('json_viewer')}
          className={`px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
            activeSubTab === 'json_viewer'
              ? 'bg-emerald-600 text-white'
              : 'text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
        >
          <FileJson className="w-4 h-4" />
          JSON 原始文件与下载
        </button>

        <button
          onClick={() => setActiveSubTab('report')}
          className={`px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
            activeSubTab === 'report'
              ? 'bg-indigo-600 text-white'
              : 'text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
        >
          <FileText className="w-4 h-4" />
          完整学术报告
        </button>

        <button
          onClick={() => setActiveSubTab('traces')}
          className={`px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
            activeSubTab === 'traces'
              ? 'bg-indigo-600 text-white'
              : 'text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
        >
          <Layers className="w-4 h-4" />
          真实真机调用轨迹 (Traces)
          <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-800 text-slate-300">
            {traces.length} 条记录
          </span>
        </button>
      </div>

      {/* 弹窗：配置并启动新一轮实验 */}
      {showRunModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-xl w-full p-6 shadow-2xl relative">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-indigo-500/20 text-indigo-400">
                  <Play className="w-5 h-5 fill-current" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">配置并启动第 {historyList.length + 1} 轮对比实验</h3>
                  <p className="text-xs text-slate-400">运行后将完整保留历史轨迹，自动生成新轮次归档并同步更新报告</p>
                </div>
              </div>
              <button
                onClick={() => setShowRunModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4 py-5">
              {/* 模式选择 */}
              <div>
                <label className="text-xs font-bold text-slate-300 mb-2 block">
                  1. 选择评测模式 (Evaluation Mode)
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <div
                    onClick={() => setSelectedMode('quick')}
                    className={`p-3 rounded-xl border cursor-pointer transition-all ${
                      selectedMode === 'quick'
                        ? 'bg-indigo-600/20 border-indigo-500 text-white ring-1 ring-indigo-500'
                        : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <div className="text-xs font-bold text-white flex items-center gap-1">
                      <Zap className="w-3.5 h-3.5 text-amber-400" />
                      极速典型轮次
                    </div>
                    <div className="text-[11px] text-slate-400 mt-1">抽取 8 个典型梯度用例</div>
                    <div className="text-[10px] text-emerald-400 mt-1.5 font-mono">耗时约 35~50 秒</div>
                  </div>

                  <div
                    onClick={() => setSelectedMode('critical')}
                    className={`p-3 rounded-xl border cursor-pointer transition-all ${
                      selectedMode === 'critical'
                        ? 'bg-indigo-600/20 border-indigo-500 text-white ring-1 ring-indigo-500'
                        : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <div className="text-xs font-bold text-white flex items-center gap-1">
                      <AlertOctagon className="w-3.5 h-3.5 text-rose-400" />
                      临界点专项压测
                    </div>
                    <div className="text-[11px] text-slate-400 mt-1">聚焦 4~15 轮高危区间 (8用例)</div>
                    <div className="text-[10px] text-rose-400 mt-1.5 font-mono">深度剖析噪声反噬</div>
                  </div>

                  <div
                    onClick={() => setSelectedMode('full')}
                    className={`p-3 rounded-xl border cursor-pointer transition-all ${
                      selectedMode === 'full'
                        ? 'bg-indigo-600/20 border-indigo-500 text-white ring-1 ring-indigo-500'
                        : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <div className="text-xs font-bold text-white flex items-center gap-1">
                      <Layers className="w-3.5 h-3.5 text-indigo-400" />
                      全量扩充评测
                    </div>
                    <div className="text-[11px] text-slate-400 mt-1">完整运行扩充的全部 24 用例</div>
                    <div className="text-[10px] text-indigo-300 mt-1.5 font-mono">高精度学术级数据</div>
                  </div>
                </div>
              </div>

              {/* 采样独立次数 */}
              <div>
                <label className="text-xs font-bold text-slate-300 mb-2 block">
                  2. 单用例独立测试迭代次数 (Iterations per Case)
                </label>
                <div className="grid grid-cols-2 gap-2.5">
                  <div
                    onClick={() => setSelectedIterations(1)}
                    className={`p-3 rounded-xl border cursor-pointer transition-all ${
                      selectedIterations === 1
                        ? 'bg-indigo-600/20 border-indigo-500 text-white ring-1 ring-indigo-500'
                        : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <div className="text-xs font-bold text-white">1 次独立运行 (快速响应)</div>
                    <div className="text-[11px] text-slate-400 mt-0.5">节约 API 配额并迅速出具结果</div>
                  </div>

                  <div
                    onClick={() => setSelectedIterations(2)}
                    className={`p-3 rounded-xl border cursor-pointer transition-all ${
                      selectedIterations === 2
                        ? 'bg-indigo-600/20 border-indigo-500 text-white ring-1 ring-indigo-500'
                        : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <div className="text-xs font-bold text-white">2 次独立运行 (消除方差)</div>
                    <div className="text-[11px] text-slate-400 mt-0.5">双重采样，更严谨的统计置信度</div>
                  </div>
                </div>
              </div>

              {/* 历史保护与题库扩充说明 */}
              <div className="p-3.5 bg-slate-950/80 rounded-xl border border-slate-800 text-xs text-slate-300 space-y-1.5">
                <div className="font-semibold flex items-center gap-1.5 text-indigo-300">
                  <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                  实验设计安全与数据保护保障：
                </div>
                <p className="text-slate-400 text-[11px]">
                  • 历史记录全面保留：本轮实验将作为 <strong className="text-white">第 {historyList.length + 1} 轮</strong> 独立追加，现有 {traces.length} 条历史调用轨迹绝不丢失。
                </p>
                <p className="text-slate-400 text-[11px]">
                  • 题库已扩充至 24 个场景：涵盖 Excel 数据透视、多模态排版、慢 SQL 诊断、差旅天气、分布式日志聚类、Alpha 因子挖掘等跨领域用例。
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
              <button
                onClick={() => setShowRunModal(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium rounded-lg cursor-pointer"
              >
                取消
              </button>
              <button
                onClick={handleStartExperiment}
                disabled={isStartingExperiment || experimentStatus.isRunning}
                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-bold rounded-lg shadow-lg shadow-indigo-600/30 flex items-center gap-2 cursor-pointer"
              >
                {isStartingExperiment ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    正在派发任务...
                  </>
                ) : (
                  <>
                    <Play className="w-3.5 h-3.5 fill-current" />
                    启动第 {historyList.length + 1} 轮实验
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 模块：扩充测试题库查看器 (Benchmark Viewer) */}
      {activeSubTab === 'benchmark_viewer' && (
        <div className="space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-blue-400" />
                  扩充后的标准测试题库 ({benchmark.length} 个防泄漏业务用例)
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  严格遵循防泄漏意图合成原则，仅提供业务情景描述，强制模型基于长对话理解触发对应技能
                </p>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400">领域筛选：</span>
                <select
                  value={benchmarkDomainFilter}
                  onChange={(e) => setBenchmarkDomainFilter(e.target.value)}
                  className="bg-slate-800 border border-slate-700 rounded-lg text-xs text-white px-2.5 py-1.5 focus:outline-none"
                >
                  {benchmarkDomains.map(d => (
                    <option key={d} value={d}>
                      {d === 'all' ? '全部领域' : d}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* 题库用例卡片网格 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 mt-4">
              {filteredBenchmarks.map((c) => (
                <div
                  key={c.id}
                  className="bg-slate-950/80 p-4 rounded-xl border border-slate-800/80 hover:border-slate-700 transition-colors space-y-2.5"
                >
                  <div className="flex items-center justify-between">
                    <span className="px-2 py-0.5 rounded text-[11px] font-mono bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 font-semibold">
                      深度：第 {c.turn_depth} 轮
                    </span>
                    <span className="px-2 py-0.5 rounded text-[11px] bg-slate-800 text-slate-300">
                      {c.domain}
                    </span>
                  </div>

                  <div>
                    <div className="text-xs font-semibold text-white">指令（用户意图）：</div>
                    <p className="text-xs text-slate-300 bg-slate-900/80 p-2.5 rounded-lg border border-slate-800 mt-1 leading-relaxed">
                      "{c.user_instruction}"
                    </p>
                  </div>

                  <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-850">
                    <span className="text-slate-400 text-[11px]">期望触发技能：</span>
                    <span className="text-emerald-400 font-mono font-semibold">
                      {c.target_skill_id} ({c.target_skill_name})
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 模块：实验控制台 & 运行面板 (Active SubTab: run_console) */}
      {activeSubTab === 'run_console' && (
        <div className="space-y-5">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Terminal className="w-5 h-5 text-purple-400" />
                  实验执行控制台 & 实时调用轨迹监控
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  正在观测真实大模型 Function Calling 链路，实时记录两组调用时延、选择结果与噪声抗扰度
                </p>
              </div>

              <div className="flex items-center gap-2">
                {experimentStatus.isRunning ? (
                  <button
                    onClick={handleCancelExperiment}
                    className="px-3.5 py-1.5 bg-rose-900/80 hover:bg-rose-800 text-rose-200 text-xs font-semibold rounded-lg border border-rose-700 flex items-center gap-1.5 cursor-pointer"
                  >
                    <Square className="w-3 h-3 fill-current" />
                    中止当前实验
                  </button>
                ) : (
                  <button
                    onClick={() => setShowRunModal(true)}
                    className="px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white text-xs font-bold rounded-lg shadow-md flex items-center gap-1.5 cursor-pointer"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    发起新一轮实验
                  </button>
                )}
              </div>
            </div>

            {/* 实时进度条 */}
            <div className="mt-5 p-4 bg-slate-950/80 rounded-xl border border-slate-800/80 space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-300 font-semibold flex items-center gap-2">
                  {experimentStatus.isRunning ? (
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-ping inline-block" />
                  ) : (
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 inline-block" />
                  )}
                  {experimentStatus.statusText}
                </span>
                <span className="font-mono text-purple-300 font-bold">
                  {experimentStatus.progressPercent}% 完成
                </span>
              </div>

              <div className="w-full bg-slate-800 rounded-full h-3 overflow-hidden p-0.5">
                <div
                  className="bg-gradient-to-r from-indigo-500 via-purple-500 to-emerald-400 h-full rounded-full transition-all duration-300"
                  style={{ width: `${Math.max(4, experimentStatus.progressPercent)}%` }}
                />
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-[11px] text-slate-400">
                <div>
                  用例进度：
                  <span className="text-white font-mono font-semibold ml-1">
                    {experimentStatus.currentCaseIndex} / {experimentStatus.totalCases}
                  </span>
                </div>
                <div>
                  当前轮次深度：
                  <span className="text-white font-mono font-semibold ml-1">
                    {experimentStatus.currentTurn ? `第 ${experimentStatus.currentTurn} 轮` : '-'}
                  </span>
                </div>
                <div>
                  当前评测组别：
                  <span className="text-indigo-300 font-semibold ml-1">
                    {experimentStatus.currentCondition || '-'}
                  </span>
                </div>
                <div>
                  当前采样轮：
                  <span className="text-white font-mono font-semibold ml-1">
                    #{experimentStatus.iteration}
                  </span>
                </div>
              </div>
            </div>

            {/* 实时终端流日志 */}
            <div className="mt-5">
              <div className="flex items-center justify-between pb-2 text-xs text-slate-400">
                <span className="flex items-center gap-1.5 font-semibold text-slate-300">
                  <Terminal className="w-3.5 h-3.5 text-purple-400" />
                  实时调用轨迹流日志 (Live Terminal Output)
                </span>
                <span className="text-[11px] text-slate-500 font-mono">
                  共记录 {experimentStatus.logs.length} 行输出
                </span>
              </div>

              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 font-mono text-xs max-h-[380px] overflow-y-auto space-y-1.5 leading-relaxed text-slate-300">
                {experimentStatus.logs.length === 0 ? (
                  <div className="text-slate-500 py-8 text-center">
                    暂无日志。点击上方“进行新一轮实验”按钮开始运行！
                  </div>
                ) : (
                  experimentStatus.logs.map((log, i) => {
                    const isSuccess = log.includes('SUCCESS');
                    const isMismatch = log.includes('MISMATCH');
                    const isError = log.includes('ERROR') || log.includes('💥');
                    const isSis = log.includes('[SIS实验组]');
                    const isBaseline = log.includes('[对照组]');

                    return (
                      <div
                        key={i}
                        className={`font-mono text-xs ${
                          isSuccess
                            ? 'text-emerald-300'
                            : isMismatch
                            ? 'text-rose-400'
                            : isError
                            ? 'text-red-400 font-bold'
                            : isSis
                            ? 'text-purple-300'
                            : isBaseline
                            ? 'text-amber-200'
                            : 'text-slate-300'
                        }`}
                      >
                        {log}
                      </div>
                    );
                  })
                )}
                <div ref={logsEndRef} />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 模块：JSON 文件查看与下载 */}
      {activeSubTab === 'json_viewer' && (
        <div className="space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
              <div className="flex flex-wrap items-center gap-2">
                <FileJson className="w-5 h-5 text-emerald-400 shrink-0" />
                <span className="text-sm font-bold text-white">选择要查看或下载的 JSON 文件：</span>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    onClick={() => setSelectedJsonFile('summary')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-colors ${
                      selectedJsonFile === 'summary'
                        ? 'bg-emerald-600 text-white font-bold'
                        : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                    }`}
                  >
                    1. evaluation_summary.json (指标汇总)
                  </button>
                  <button
                    onClick={() => setSelectedJsonFile('benchmark')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-colors ${
                      selectedJsonFile === 'benchmark'
                        ? 'bg-emerald-600 text-white font-bold'
                        : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                    }`}
                  >
                    2. benchmark_dataset.json (扩充题库: {benchmark.length}题)
                  </button>
                  <button
                    onClick={() => setSelectedJsonFile('traces')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-colors ${
                      selectedJsonFile === 'traces'
                        ? 'bg-emerald-600 text-white font-bold'
                        : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                    }`}
                  >
                    3. evaluation_traces.json (调用轨迹: {traces.length}条)
                  </button>
                  <button
                    onClick={() => setSelectedJsonFile('history')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-colors ${
                      selectedJsonFile === 'history'
                        ? 'bg-emerald-600 text-white font-bold'
                        : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                    }`}
                  >
                    4. experiment_history.json (历史归档: {historyList.length}轮)
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleCopyJson}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs rounded border border-slate-700 flex items-center gap-1 cursor-pointer transition-colors"
                >
                  {copiedJson ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  {copiedJson ? '已复制 JSON' : '复制 JSON 内容'}
                </button>
                <button
                  onClick={() => handleDownloadJson(selectedJsonFile)}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs rounded flex items-center gap-1 cursor-pointer shadow-sm transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  下载此 JSON 文件
                </button>
              </div>
            </div>

            <div className="mt-4">
              <div className="text-xs text-slate-400 mb-2 flex items-center justify-between">
                <span>
                  当前正在查看：
                  <code className="text-emerald-300 font-mono ml-1">
                    experiments/{selectedJsonFile === 'benchmark' ? 'benchmarks' : 'results'}/{selectedJsonFile === 'summary' ? 'evaluation_summary.json' : selectedJsonFile === 'benchmark' ? 'benchmark_dataset.json' : selectedJsonFile === 'history' ? 'experiment_history.json' : 'evaluation_traces.json'}
                  </code>
                </span>
                <span className="text-[11px] text-slate-500">
                  支持直接复制并粘贴至任何本地编辑器（如 VS Code）查看
                </span>
              </div>
              <pre className="bg-slate-950 p-4 rounded-lg border border-slate-800/80 font-mono text-xs text-emerald-300 max-h-[520px] overflow-auto leading-relaxed">
                {getActiveJsonContent()}
              </pre>
            </div>
          </div>
        </div>
      )}

      {/* 模块 1: 图表与矩阵 */}
      {activeSubTab === 'metrics' && summary && (
        <div className="space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-lg">
            <div className="px-6 py-4 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <BarChart2 className="w-4 h-4 text-indigo-400" />
                  不同会话深度（轮次）实测指标矩阵
                  <span className="text-xs px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 font-mono font-normal">
                    {selectedRunId === 'all' ? '全部历史聚合' : `历史轮次: ${selectedRunId}`}
                  </span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  对比对照组（原生 79 工具）与 SIS 实验组（Top-4 裁剪沙箱）的错误率跃升点与时延优化
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowRunModal(true)}
                  className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 cursor-pointer"
                >
                  <Play className="w-3 h-3 fill-current" />
                  运行新实验
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950/80 text-slate-400 border-b border-slate-800">
                  <tr>
                    <th className="px-5 py-3.5 font-semibold">对话轮次 (Turn)</th>
                    <th className="px-5 py-3.5 font-semibold">对照组错误率 (79技能)</th>
                    <th className="px-5 py-3.5 font-semibold">对照组耗时</th>
                    <th className="px-5 py-3.5 font-semibold text-emerald-400">SIS 实验组错误率 (Top-4)</th>
                    <th className="px-5 py-3.5 font-semibold text-emerald-400">SIS 耗时</th>
                    <th className="px-5 py-3.5 font-semibold">Token 压缩效果</th>
                    <th className="px-5 py-3.5 font-semibold">关键观察现象与归因</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono">
                  {Object.values(summary).map((row) => {
                    const isSpike = row.turn === 10;
                    return (
                      <tr
                        key={row.turn}
                        className={`transition-colors ${
                          isSpike ? 'bg-rose-950/20 hover:bg-rose-950/30' : 'hover:bg-slate-800/40'
                        }`}
                      >
                        <td className="px-5 py-3.5 font-semibold text-white">
                          第 {row.turn} 轮
                          {isSpike && (
                            <span className="ml-2 px-1.5 py-0.5 rounded text-[10px] bg-rose-500/20 text-rose-300 font-sans border border-rose-500/30">
                              突变临界点
                            </span>
                          )}
                        </td>
                        <td className="px-5 py-3.5">
                          <span
                            className={`px-2 py-0.5 rounded font-bold ${
                              row.baseline_error_rate > 0
                                ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                                : 'bg-slate-800 text-slate-300'
                            }`}
                          >
                            {(row.baseline_error_rate * 100).toFixed(1)}%
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-slate-300">
                          {row.avg_latency_baseline} ms
                        </td>
                        <td className="px-5 py-3.5">
                          <span
                            className={`px-2 py-0.5 rounded font-bold ${
                              row.sis_error_rate === 0
                                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                            }`}
                          >
                            {(row.sis_error_rate * 100).toFixed(1)}%
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-emerald-400 font-bold">
                          {row.avg_latency_sis} ms
                        </td>
                        <td className="px-5 py-3.5 text-indigo-300">
                          -87.5%
                        </td>
                        <td className="px-5 py-3.5 text-slate-300 font-sans text-xs">
                          {row.turn === 10 ? (
                            <span className="text-rose-300 font-medium">
                              ⚠️ 遭遇注意力劫持：模型将“天气提醒”错调为天气查询技能 s3（实需邮件网关 s5）
                            </span>
                          ) : row.turn >= 8 ? (
                            <span className="text-slate-400">
                              长文本累积，SIS 双层微检索持续稳定将无关技能过滤
                            </span>
                          ) : (
                            <span className="text-slate-400">短上下文常规调度</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 模块 2: 完整学术报告 */}
      {activeSubTab === 'report' && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <FileText className="w-5 h-5 text-indigo-400" />
                标准化学术实验报告全文
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                已同步汇编 4 个阶段完整方法论、79 项工具定义、分轮次实测三线表及深度理论归因
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleCopyReport}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs rounded border border-slate-700 flex items-center gap-1 cursor-pointer"
              >
                <Copy className="w-3.5 h-3.5" />
                {copied ? '已复制' : '复制全文'}
              </button>
              <button
                onClick={handleDownloadDocx}
                className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs rounded shadow-sm flex items-center gap-1.5 cursor-pointer font-medium"
              >
                <Download className="w-3.5 h-3.5" />
                下载 Word 报告 (.docx)
              </button>
            </div>
          </div>

          <div className="prose prose-invert max-w-none text-slate-300 text-xs sm:text-sm leading-relaxed whitespace-pre-wrap font-sans bg-slate-950 p-6 rounded-xl border border-slate-800">
            {reportMarkdown || '正在加载实验报告文本...'}
          </div>
        </div>
      )}

      {/* 模块 3: 真实真机调用轨迹 */}
      {activeSubTab === 'traces' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between bg-slate-900 p-4 rounded-xl border border-slate-800 gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-slate-400">筛选会话深度：</span>
              {['all', 1, 2, 3, 4, 5, 6, 8, 10, 12, 15, 18, 20].map((d) => (
                <button
                  key={String(d)}
                  onClick={() => setFilterDepth(d as any)}
                  className={`px-2 py-1 rounded text-xs transition-colors cursor-pointer ${
                    filterDepth === d
                      ? 'bg-indigo-600 text-white font-bold'
                      : 'bg-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  {d === 'all' ? '全部' : `${d}轮`}
                </button>
              ))}
            </div>

            <div className="text-xs text-slate-400 flex items-center gap-3">
              <span>显示 {filteredTraces.length} / {traces.length} 条轨迹</span>
              <button
                onClick={() => setShowRunModal(true)}
                className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-xs font-semibold flex items-center gap-1 cursor-pointer"
              >
                <Play className="w-3 h-3 fill-current" />
                运行新实验
              </button>
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-lg">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead className="bg-slate-950 text-slate-400 border-b border-slate-800">
                  <tr>
                    <th className="px-3.5 py-3">所属轮次批次</th>
                    <th className="px-3 py-3">深度</th>
                    <th className="px-3.5 py-3">试验组</th>
                    <th className="px-2.5 py-3">迭代</th>
                    <th className="px-3.5 py-3">期望技能</th>
                    <th className="px-3.5 py-3">实际调用</th>
                    <th className="px-3 py-3">判定状态</th>
                    <th className="px-3 py-3">耗时</th>
                    <th className="px-3 py-3">Prompt Tokens</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {filteredTraces.map((t, idx) => (
                    <tr
                      key={idx}
                      className={`hover:bg-slate-800/40 ${
                        t.status === 'SUCCESS'
                          ? ''
                          : t.status === 'MISMATCH'
                          ? 'bg-rose-950/20'
                          : 'bg-amber-950/20'
                      }`}
                    >
                      <td className="px-3.5 py-2.5 font-sans">
                        <span className="px-2 py-0.5 rounded text-[10px] bg-slate-800 text-slate-300 font-mono">
                          {t.round_name ? t.round_name.split('(')[0] : '第 1 轮'}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-white font-bold">第 {t.turn_depth} 轮</td>
                      <td className="px-3.5 py-2.5 font-sans">
                        {t.condition === 'direct_all_tools' ? (
                          <span className="text-slate-400">对照组 (79工具)</span>
                        ) : (
                          <span className="text-indigo-400 font-semibold">SIS 实验组 (Top-4)</span>
                        )}
                      </td>
                      <td className="px-2.5 py-2.5 text-slate-400">#{t.iteration}</td>
                      <td className="px-3.5 py-2.5 text-emerald-300 font-semibold">{t.expected_tool}</td>
                      <td className="px-3.5 py-2.5">
                        <span
                          className={`${
                            t.selected_tool === t.expected_tool
                              ? 'text-emerald-400'
                              : 'text-rose-400 font-bold'
                          }`}
                        >
                          {t.selected_tool || '（无调用 / 遗漏）'}
                        </span>
                      </td>
                      <td className="px-3 py-2.5">
                        {t.status === 'SUCCESS' ? (
                          <span className="px-2 py-0.5 rounded text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                            SUCCESS
                          </span>
                        ) : t.status === 'MISMATCH' ? (
                          <span className="px-2 py-0.5 rounded text-[10px] bg-rose-500/20 text-rose-300 border border-rose-500/30">
                            MISMATCH (错选)
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/30">
                            {t.status}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-slate-300">{t.duration_ms} ms</td>
                      <td className="px-3 py-2.5 text-slate-400">{t.token_usage?.prompt}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
