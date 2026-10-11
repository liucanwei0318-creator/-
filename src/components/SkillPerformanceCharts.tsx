import React, { useState, useMemo } from 'react';
import { Skill } from '../types/agent';
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
  Cell,
  PieChart,
  Pie,
} from 'recharts';
import {
  BarChart3,
  TrendingUp,
  AlertTriangle,
  Zap,
  Filter,
  CheckCircle2,
  ShieldAlert,
  ArrowUpDown,
} from 'lucide-react';

interface SkillPerformanceChartsProps {
  skills: Skill[];
  onSelectSkillForProbe?: (skill: Skill) => void;
  onRefineSkill?: (skill: Skill) => void;
}

export const SkillPerformanceCharts: React.FC<SkillPerformanceChartsProps> = ({
  skills,
  onSelectSkillForProbe,
  onRefineSkill,
}) => {
  const [selectedEco, setSelectedEco] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'calls' | 'error_rate' | 'risk'>('risk');
  const [showOnlyActive, setShowOnlyActive] = useState<boolean>(false);

  // 1. 过滤与排序技能数据
  const filteredSkills = useMemo(() => {
    return skills.filter((s) => {
      if (selectedEco !== 'all' && s.ecosystem !== selectedEco) return false;
      if (showOnlyActive && s.call_count === 0) return false;
      return true;
    });
  }, [skills, selectedEco, showOnlyActive]);

  // 2. 格式化图表数据
  const chartData = useMemo(() => {
    const list = filteredSkills.map((s) => {
      const errorRatePct = s.call_count > 0 ? (s.error_count / s.call_count) * 100 : 0;
      const riskScore = s.call_count * errorRatePct; // 调用多且错得多的高危风险权重
      return {
        id: s.skill_id,
        rawSkill: s,
        name: s.display_name ? s.display_name.slice(0, 8) : s.name.slice(0, 8),
        fullName: s.display_name || s.name,
        skillId: s.name,
        callCount: s.call_count,
        errorCount: s.error_count,
        errorRate: parseFloat(errorRatePct.toFixed(1)),
        riskScore: Math.round(riskScore),
        ecosystem: s.ecosystem || 'other',
        domain: s.content_domain || s.clusters[0] || '通用',
        isHighError: s.call_count >= 3 && errorRatePct >= 20,
      };
    });

    if (sortBy === 'calls') {
      list.sort((a, b) => b.callCount - a.callCount);
    } else if (sortBy === 'error_rate') {
      list.sort((a, b) => b.errorRate - a.errorRate);
    } else {
      list.sort((a, b) => b.riskScore - a.riskScore || b.errorRate - a.errorRate);
    }

    // 取前 16 项最具代表性或高危技能进行重点趋势对比
    return list.slice(0, 16);
  }, [filteredSkills, sortBy]);

  // 3. 各大模型生态聚合指标
  const ecosystemStats = useMemo(() => {
    const map: Record<string, { totalCalls: number; totalErrors: number; count: number; name: string; color: string }> = {
      openai: { totalCalls: 0, totalErrors: 0, count: 0, name: 'OpenAI生态', color: '#10b981' },
      claude: { totalCalls: 0, totalErrors: 0, count: 0, name: 'Anthropic Claude', color: '#d97706' },
      qwen: { totalCalls: 0, totalErrors: 0, count: 0, name: '通义千问 Qwen', color: '#6366f1' },
      deepseek: { totalCalls: 0, totalErrors: 0, count: 0, name: 'DeepSeek生态', color: '#0ea5e9' },
      business: { totalCalls: 0, totalErrors: 0, count: 0, name: '垂直业务与工具', color: '#a855f7' },
    };

    skills.forEach((s) => {
      const eco = s.ecosystem || 'business';
      if (!map[eco]) {
        map[eco] = { totalCalls: 0, totalErrors: 0, count: 0, name: '其他', color: '#94a3b8' };
      }
      map[eco].count += 1;
      map[eco].totalCalls += s.call_count;
      map[eco].totalErrors += s.error_count;
    });

    return Object.entries(map).map(([key, item]) => {
      const avgErrRate = item.totalCalls > 0 ? (item.totalErrors / item.totalCalls) * 100 : 0;
      return {
        key,
        ...item,
        avgErrRate: parseFloat(avgErrRate.toFixed(1)),
      };
    });
  }, [skills]);

  // 4. 定位到的最高性能瓶颈技能
  const bottleneckSkill = useMemo(() => {
    const highRiskList = [...chartData].filter((d) => d.callCount >= 2 && d.errorRate > 0);
    return highRiskList.length > 0 ? highRiskList[0] : null;
  }, [chartData]);

  return (
    <div className="space-y-6">
      {/* 顶部控制与筛选栏 */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-sky-400" />
            技能调用频次与错误率双轴趋势分析 (Recharts Visual Analytics)
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            采用双轴复合图表对比各技能调度压力（柱状）与失误率曲线（折线），精准定位生产环境执行瓶颈。
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 bg-slate-950 px-2.5 py-1.5 rounded-lg border border-slate-800 text-xs">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={selectedEco}
              onChange={(e) => setSelectedEco(e.target.value)}
              className="bg-transparent text-slate-200 focus:outline-none cursor-pointer"
            >
              <option value="all">所有大模型生态 (79)</option>
              <option value="openai">OpenAI 生态</option>
              <option value="claude">Claude 生态</option>
              <option value="qwen">Qwen 通义千问</option>
              <option value="deepseek">DeepSeek 生态</option>
              <option value="business">商业与Office</option>
            </select>
          </div>

          <div className="flex items-center gap-1.5 bg-slate-950 px-2.5 py-1.5 rounded-lg border border-slate-800 text-xs">
            <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="bg-transparent text-slate-200 focus:outline-none cursor-pointer"
            >
              <option value="risk">按综合瓶颈风险排序</option>
              <option value="error_rate">按错误率从高到低</option>
              <option value="calls">按调用频次从高到低</option>
            </select>
          </div>

          <label className="flex items-center gap-1.5 text-xs text-slate-300 cursor-pointer select-none bg-slate-950 px-2.5 py-1.5 rounded-lg border border-slate-800">
            <input
              type="checkbox"
              checked={showOnlyActive}
              onChange={(e) => setShowOnlyActive(e.target.checked)}
              className="rounded bg-slate-800 border-slate-700 text-indigo-500 focus:ring-0"
            />
            <span>仅看有调用记录</span>
          </label>
        </div>
      </div>

      {/* 核心瓶颈快速诊断卡片 */}
      {bottleneckSkill && (
        <div className="p-4 bg-gradient-to-r from-rose-950/40 via-slate-900 to-amber-950/30 border border-rose-800/60 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-rose-600 text-white rounded-lg mt-0.5">
              <AlertTriangle className="w-4 h-4 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-white">
                  检测到当前最大性能瓶颈: [{bottleneckSkill.fullName}]
                </span>
                <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-rose-950 text-rose-300 border border-rose-800">
                  报错率 {bottleneckSkill.errorRate}%
                </span>
                <span className="text-xs text-slate-400 font-mono">
                  (调用 {bottleneckSkill.callCount} 次 / 报错 {bottleneckSkill.errorCount} 次)
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-1">
                由于跨界领域泛化或入参 Schema 漂移，该技能在运行期产生严重调用抖动，建议立即激活精炼或沙箱探测。
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {onSelectSkillForProbe && (
              <button
                type="button"
                onClick={() => onSelectSkillForProbe(bottleneckSkill.rawSkill)}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-sky-300 text-xs rounded-lg transition-colors cursor-pointer"
              >
                沙箱探针
              </button>
            )}
            {onRefineSkill && (
              <button
                type="button"
                onClick={() => onRefineSkill(bottleneckSkill.rawSkill)}
                className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer"
              >
                一键精炼修复
              </button>
            )}
          </div>
        </div>
      )}

      {/* 主双轴复合趋势图表 */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3">
        <div className="flex items-center justify-between">
          <div className="text-xs font-semibold text-slate-300 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-indigo-400" />
            <span>前 16 项重点技能调用量与错误率趋势双轴对比</span>
          </div>
          <div className="flex items-center gap-4 text-[11px] text-slate-400">
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm bg-indigo-500 inline-block"></span>
              <span>调用次数 (左轴, 次)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-1 bg-rose-400 inline-block"></span>
              <span>错误率 (右轴, %)</span>
            </div>
          </div>
        </div>

        <div className="h-72 w-full pt-2">
          {chartData.length === 0 ? (
            <div className="h-full flex items-center justify-center text-xs text-slate-500">
              当前筛选条件下暂无足够技能数据
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartData} margin={{ top: 10, right: 20, bottom: 25, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis
                  dataKey="name"
                  stroke="#64748b"
                  fontSize={11}
                  interval={0}
                  angle={-25}
                  textAnchor="end"
                />
                <YAxis
                  yAxisId="left"
                  stroke="#818cf8"
                  fontSize={11}
                  label={{ value: '调用次数', angle: -90, position: 'insideLeft', fill: '#818cf8', fontSize: 10 }}
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  stroke="#fb7185"
                  fontSize={11}
                  domain={[0, 100]}
                  label={{ value: '错误率 (%)', angle: 90, position: 'insideRight', fill: '#fb7185', fontSize: 10 }}
                />
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      return (
                        <div className="bg-slate-950 border border-slate-700 p-3 rounded-lg shadow-xl text-xs space-y-1">
                          <div className="font-bold text-white flex items-center justify-between gap-3">
                            <span>{data.fullName}</span>
                            <span className="font-mono text-[10px] text-slate-400">{data.ecosystem}</span>
                          </div>
                          <div className="text-slate-300">
                            所属业务簇: <span className="text-sky-300">{data.domain}</span>
                          </div>
                          <div className="text-indigo-300 font-mono">
                            调用总量: <strong className="text-white">{data.callCount}</strong> 次
                          </div>
                          <div className="text-rose-400 font-mono">
                            失败错误: <strong className="text-white">{data.errorCount}</strong> 次 (
                            {data.errorRate}%)
                          </div>
                          {data.isHighError && (
                            <div className="text-[10px] text-rose-300 font-bold bg-rose-950/80 px-1.5 py-0.5 rounded border border-rose-800">
                              高危告警：错误率超过 20%
                            </div>
                          )}
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Bar yAxisId="left" dataKey="callCount" name="调用次数" radius={[4, 4, 0, 0]} maxBarSize={36}>
                  {chartData.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={entry.isHighError ? '#e11d48' : entry.callCount > 15 ? '#6366f1' : '#38bdf8'}
                    />
                  ))}
                </Bar>
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="errorRate"
                  name="错误率(%)"
                  stroke="#f43f5e"
                  strokeWidth={2.5}
                  dot={{ r: 4, fill: '#f43f5e' }}
                  activeDot={{ r: 6 }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* 各模型生态横向对比指标卡片 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        {ecosystemStats.map((item) => (
          <div
            key={item.key}
            onClick={() => setSelectedEco(selectedEco === item.key ? 'all' : item.key)}
            className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
              selectedEco === item.key
                ? 'bg-slate-900 border-indigo-500 shadow-md shadow-indigo-950'
                : 'bg-slate-950 border-slate-800/80 hover:border-slate-700'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-white">{item.name}</span>
              <span
                className="w-2.5 h-2.5 rounded-full"
                style={{ backgroundColor: item.color }}
              ></span>
            </div>
            <div className="mt-2 flex items-baseline justify-between">
              <div>
                <span className="text-[10px] text-slate-500 block">装载技能数</span>
                <span className="text-lg font-bold font-mono text-white tabular-nums">
                  {item.count}
                </span>
              </div>
              <div className="text-right">
                <span className="text-[10px] text-slate-500 block">调用 / 报错</span>
                <span className="text-xs font-mono text-slate-300">
                  {item.totalCalls} / <span className={item.totalErrors > 0 ? 'text-rose-400' : 'text-emerald-400'}>{item.totalErrors}</span>
                </span>
              </div>
            </div>
            <div className="mt-2 pt-2 border-t border-slate-900 flex items-center justify-between text-[11px]">
              <span className="text-slate-400">平均错误率</span>
              <span
                className={`font-mono font-bold ${
                  item.avgErrRate > 10 ? 'text-amber-400' : 'text-emerald-400'
                }`}
              >
                {item.avgErrRate}%
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
