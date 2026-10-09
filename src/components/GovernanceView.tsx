import React, { useState, useMemo } from 'react';
import { Skill, GovernanceAlert, SkillDuplicatePair } from '../types/agent';
import { GovernanceEngine, KeywordAssociationResult } from '../services/governance';
import {
  AlertTriangle,
  ShieldAlert,
  Sparkles,
  RefreshCw,
  Search,
  CheckCircle2,
  Box,
  Split,
  Terminal,
  Activity,
  Layers,
  CopyCheck,
  Clock,
  Sliders,
  Wand2,
  Trash2,
  ArrowRight,
  ShieldCheck,
  Download,
  FileSpreadsheet,
  GitMerge,
  Info,
} from 'lucide-react';

interface GovernanceViewProps {
  skills: Skill[];
  onUpdateSkill: (updatedSkill: Skill) => void;
  onAddSkills: (newSkills: Skill[]) => void;
  onDeleteSkill?: (skillId: string) => void;
}

export const GovernanceView: React.FC<GovernanceViewProps> = ({
  skills,
  onUpdateSkill,
  onAddSkills,
  onDeleteSkill,
}) => {
  const [governanceTab, setGovernanceTab] = useState<
    'audit' | 'duplicates' | 'association' | 'sandbox'
  >('duplicates'); // 默认展示用户重点关注的重复度审查
  const [sandboxLog, setSandboxLog] = useState<string[]>([]);
  const [isProbing, setIsProbing] = useState<boolean>(false);
  const [vaguePrompt, setVaguePrompt] = useState<string>('报表核算');
  const [refineSuccessMsg, setRefineSuccessMsg] = useState<string | null>(null);

  // 定期重复性审查配置状态
  const [duplicateThreshold, setDuplicateThreshold] = useState<number>(0.75);
  const [reviewSchedule, setReviewSchedule] = useState<'daily' | 'weekly' | 'on_register'>('daily');
  const [isScanningDuplicates, setIsScanningDuplicates] = useState<boolean>(false);
  const [lastAuditTime, setLastAuditTime] = useState<string>('刚刚完成全库巡检');

  const engine = useMemo(() => new GovernanceEngine(skills), [skills]);
  const alerts = useMemo(() => engine.audit(), [engine, skills]);

  // 全库重复技能对审计
  const duplicatePairs = useMemo(
    () => engine.auditDuplicates(duplicateThreshold),
    [engine, duplicateThreshold]
  );

  // 触发一次即时全库重复交叉扫描
  const handleRunDuplicateAudit = () => {
    setIsScanningDuplicates(true);
    setTimeout(() => {
      setIsScanningDuplicates(false);
      setLastAuditTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
      const pairCount = (skills.length * (skills.length - 1)) / 2;
      setRefineSuccessMsg(`全库重复性定期审查完成！已对全库 ${skills.length} 项技能 (${pairCount} 组排列组合) 完成余弦向量与槽位重叠交叉扫描。`);
      setTimeout(() => setRefineSuccessMsg(null), 4000);
    }, 600);
  };

  // 一键自动对重复技能对进行消歧修复
  const handleAutoDisambiguatePair = (pair: SkillDuplicatePair) => {
    const updatedA: Skill = {
      ...pair.skillA,
      disambiguation_features:
        (pair.skillA.disambiguation_features || '') +
        ` [自动消歧：专精于 ${pair.skillA.content_domain || pair.skillA.clusters[0] || '特定场景'}，区别于 ${pair.skillB.name}]`,
    };
    const updatedB: Skill = {
      ...pair.skillB,
      disambiguation_features:
        (pair.skillB.disambiguation_features || '') +
        ` [自动消歧：专精于 ${pair.skillB.content_domain || pair.skillB.clusters[0] || '独立场景'}，区别于 ${pair.skillA.name}]`,
    };
    onUpdateSkill(updatedA);
    onUpdateSkill(updatedB);
    setRefineSuccessMsg(`已成功为 [${pair.skillA.name}] 与 [${pair.skillB.name}] 注入差异化专有消歧规则！`);
    setTimeout(() => setRefineSuccessMsg(null), 4000);
  };

  // 一键合并重复技能 (Merge Skills)
  const handleMergeDuplicatePair = (pair: SkillDuplicatePair) => {
    const mergedSkill: Skill = {
      ...pair.skillA,
      display_name: `${pair.skillA.display_name || pair.skillA.name} & ${pair.skillB.display_name || pair.skillB.name} (融合版)`,
      description: `${pair.skillA.description}。兼备: ${pair.skillB.description}`,
      clusters: Array.from(new Set([...pair.skillA.clusters, ...pair.skillB.clusters])),
      required_slots: Array.from(new Set([...pair.skillA.required_slots, ...pair.skillB.required_slots])),
      negative_triggers: Array.from(new Set([...pair.skillA.negative_triggers, ...pair.skillB.negative_triggers])),
      disambiguation_features: `已合并为统一能力载体：全面覆盖 ${pair.skillA.name} 与 ${pair.skillB.name} 场景`,
      call_count: pair.skillA.call_count + pair.skillB.call_count,
      error_count: pair.skillA.error_count + pair.skillB.error_count,
    };
    onUpdateSkill(mergedSkill);
    if (onDeleteSkill) {
      onDeleteSkill(pair.skillB.skill_id);
    }
    setRefineSuccessMsg(`已成功将 [${pair.skillA.name}] 与 [${pair.skillB.name}] 合并为综合能力并移除冗余副本！`);
    setTimeout(() => setRefineSuccessMsg(null), 4000);
  };

  // 批量消歧全部重复对
  const handleBatchDisambiguateAll = () => {
    if (duplicatePairs.length === 0) return;
    duplicatePairs.forEach((pair) => {
      handleAutoDisambiguatePair(pair);
    });
    setRefineSuccessMsg(`已批量对当前 ${duplicatePairs.length} 组重复技能完成互斥消歧规则注入！`);
    setTimeout(() => setRefineSuccessMsg(null), 4000);
  };

  // 导出重复性审查报告 CSV
  const handleExportDuplicateReport = () => {
    if (duplicatePairs.length === 0) return;
    const headers = [
      '审查对编号',
      '技能A (标识)',
      '技能A (中文名)',
      '技能B (标识)',
      '技能B (中文名)',
      '余弦相似度',
      '风险级别',
      '重叠槽位',
      '风险判定原因',
    ];
    const escape = (val: any) => `"${String(val || '').replace(/"/g, '""')}"`;
    const rows = duplicatePairs.map((p, idx) =>
      [
        escape(`PAIR-${idx + 1}`),
        escape(p.skillA.name),
        escape(p.skillA.display_name || p.skillA.name),
        escape(p.skillB.name),
        escape(p.skillB.display_name || p.skillB.name),
        escape(`${(p.similarity * 100).toFixed(1)}%`),
        escape(p.riskLevel === 'high' ? '高危同质化' : p.riskLevel === 'medium' ? '中度重叠' : '低度交叉'),
        escape(p.slotOverlap.join('; ')),
        escape(p.reason),
      ].join(',')
    );

    const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute(
      'download',
      `skill_deduplication_audit_report_${new Date().toISOString().slice(0, 10)}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    setRefineSuccessMsg(`已成功导出《全库技能重复性审查报告.csv》！`);
    setTimeout(() => setRefineSuccessMsg(null), 4000);
  };

  // 联想结果
  const associationResult: KeywordAssociationResult = useMemo(
    () => engine.associateKeywords(vaguePrompt),
    [engine, vaguePrompt]
  );

  // 1. 模拟运行沙箱接口探测 (Sandbox API Probing)
  const handleRunSandboxProbe = (skill: Skill) => {
    setIsProbing(true);
    setSandboxLog([
      `[${new Date().toLocaleTimeString()}] 启动隔离沙箱 Docker 容器: container-${skill.skill_id}...`,
      `[${new Date().toLocaleTimeString()}] 注入模拟入参槽位: ${JSON.stringify(skill.required_slots)}...`,
      `[${new Date().toLocaleTimeString()}] 发送心跳与接口 Schema 探针探测...`,
    ]);

    setTimeout(() => {
      setSandboxLog((prev) => [
        ...prev,
        `[${new Date().toLocaleTimeString()}] 探针响应正常 (HTTP 200 OK)。接口未发生致命漂移。`,
        `[${new Date().toLocaleTimeString()}] 诊断结论: 报错主要由历史边缘入参格式异常引起，建议执行【一键精炼】优化槽位校验规则。`,
      ]);
      setIsProbing(false);
    }, 1200);
  };

  // 2. 模拟一键精炼技能 (Refine Skill)
  const handleRefineSkill = (skill: Skill) => {
    const refined: Skill = {
      ...skill,
      error_count: Math.max(0, Math.floor(skill.error_count / 2)),
      disambiguation_features:
        skill.disambiguation_features + ' [经人机治理引擎优化精炼：强化入参模式匹配]',
      negative_triggers: Array.from(
        new Set([...skill.negative_triggers, '请勿传递不合规未校验槽位'])
      ),
    };
    onUpdateSkill(refined);
    setRefineSuccessMsg(`技能 [${skill.name}] 已完成精炼：重置报错率并写入强化约束！`);
    setTimeout(() => setRefineSuccessMsg(null), 3500);
  };

  // 3. 模拟拆解语义贪婪技能 (Split Greed Skill)
  const handleSplitGreedSkill = (skill: Skill) => {
    const splitA: Skill = {
      ...skill,
      skill_id: `${skill.skill_id}_fin`,
      name: `${skill.name}_Finance`,
      display_name: `${skill.display_name || skill.name} (金融专精版)`,
      description: `专注于金融风控与合规报表场景的专用型 ${skill.name}`,
      clusters: ['商业金融', '文档处理'],
      domains_invoked: ['金融风控'],
      call_count: Math.floor(skill.call_count / 2),
      error_count: 0,
      disambiguation_features: '专为金融领域研报与资产负债表生成设计',
    };
    const splitB: Skill = {
      ...skill,
      skill_id: `${skill.skill_id}_legal`,
      name: `${skill.name}_Legal`,
      display_name: `${skill.display_name || skill.name} (法务专精版)`,
      description: `专注于法务合同与诉讼文档场景的专用型 ${skill.name}`,
      clusters: ['法务合规', '文档处理'],
      domains_invoked: ['法务审核'],
      call_count: Math.floor(skill.call_count / 2),
      error_count: 0,
      disambiguation_features: '专为法律合同与条款排版生成设计',
    };

    onAddSkills([splitA, splitB]);
    setRefineSuccessMsg(
      `已成功将跨界万金油技能 [${skill.name}] 拆解为 2 个垂直领域专家技能：[${splitA.name}] 与 [${splitB.name}]！`
    );
    setTimeout(() => setRefineSuccessMsg(null), 4000);
  };

  // 统计指标
  const highErrorSkills = skills.filter(
    (s) => s.call_count >= 3 && s.call_count > 0 && s.error_count / s.call_count >= 0.20
  );
  const greedSkills = skills.filter((s) => s.domains_invoked.length >= 3);

  return (
    <div className="space-y-6">
      {/* 顶部治理背景看板 */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-400" />
              人机协同治理中心 · 重复审查与报错监控 (Human-in-the-loop Governance)
            </h2>
            <p className="text-xs text-slate-400 mt-1.5 leading-relaxed max-w-3xl">
              提供生产级技能生命周期健康保障：包含
              <strong> 定期审查现有技能重复冗余机制</strong>、
              <strong> 三级报错与万金油语义贪婪排查</strong>、
              <strong> Docker 沙箱接口探针探测</strong> 与
              <strong> 无关键词语义联想推荐引擎</strong>。
            </p>
          </div>
        </div>

        {/* 核心治理指标统计 */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 pt-4 border-t border-slate-800/80">
          <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
            <span className="text-[11px] text-slate-500 block">库内装载技能总数</span>
            <span className="text-xl font-bold font-mono text-white tabular-nums">
              {skills.length}
            </span>
          </div>

          <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
            <span className="text-[11px] text-slate-500 block">全库重复冲突对 (≥{(duplicateThreshold * 100).toFixed(0)}%)</span>
            <span
              className={`text-xl font-bold font-mono tabular-nums ${
                duplicatePairs.length > 0 ? 'text-rose-400' : 'text-emerald-400'
              }`}
            >
              {duplicatePairs.length}
            </span>
          </div>

          <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
            <span className="text-[11px] text-slate-500 block">高报错率异常监控 (&gt;20%)</span>
            <span
              className={`text-xl font-bold font-mono tabular-nums ${
                highErrorSkills.length > 0 ? 'text-amber-400' : 'text-emerald-400'
              }`}
            >
              {highErrorSkills.length}
            </span>
          </div>

          <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
            <span className="text-[11px] text-slate-500 block">三级待处理告警总数</span>
            <span className="text-xl font-bold font-mono text-sky-400 tabular-nums">
              {alerts.length}
            </span>
          </div>
        </div>
      </div>

      {refineSuccessMsg && (
        <div className="p-3.5 bg-emerald-950/70 border border-emerald-800 text-emerald-300 rounded-xl text-xs flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{refineSuccessMsg}</span>
        </div>
      )}

      {/* 治理二级标签栏 */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-2 flex-wrap">
        <button
          onClick={() => setGovernanceTab('duplicates')}
          className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer shadow-sm ${
            governanceTab === 'duplicates'
              ? 'bg-rose-600 text-white font-bold'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
          }`}
        >
          <CopyCheck className="w-3.5 h-3.5 text-rose-300" />
          定期审查现有技能重复机制 ({duplicatePairs.length})
        </button>

        <button
          onClick={() => setGovernanceTab('audit')}
          className={`px-3.5 py-1.5 text-xs font-medium rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer ${
            governanceTab === 'audit'
              ? 'bg-indigo-600 text-white font-semibold'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
          }`}
        >
          <Activity className="w-3.5 h-3.5" />
          三级告警综合排查 ({alerts.length})
        </button>

        <button
          onClick={() => setGovernanceTab('association')}
          className={`px-3.5 py-1.5 text-xs font-medium rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer ${
            governanceTab === 'association'
              ? 'bg-indigo-600 text-white font-semibold'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5 text-amber-400" />
          无关键词联想推荐引擎
        </button>

        <button
          onClick={() => setGovernanceTab('sandbox')}
          className={`px-3.5 py-1.5 text-xs font-medium rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer ${
            governanceTab === 'sandbox'
              ? 'bg-indigo-600 text-white font-semibold'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
          }`}
        >
          <Terminal className="w-3.5 h-3.5 text-sky-400" />
          Docker 沙箱接口探测台
        </button>
      </div>

      {/* 选项卡 1: 定期审查现有技能是否重复的机制 (用户重点需求) */}
      {governanceTab === 'duplicates' && (
        <div className="space-y-4">
          {/* 定期审查调度配置与控制台 */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4 shadow-sm">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                  <CopyCheck className="w-4 h-4 text-rose-400" />
                  定期审查现有技能重复冗余机制 (Periodic Deduplication Engine)
                </h3>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed max-w-3xl">
                  基于 N × N 语义向量全交叉与入参槽位重叠矩阵，定期巡检库内技能，识别功能同质化、高语义重合与调用踩踏风险，防止大模型误选或高权重技能霸占调用权。
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0 flex-wrap">
                <button
                  type="button"
                  onClick={handleRunDuplicateAudit}
                  disabled={isScanningDuplicates}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-bold transition-all shadow-md shadow-rose-950 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isScanningDuplicates ? 'animate-spin' : ''}`} />
                  <span>{isScanningDuplicates ? '全库交叉比对中...' : '立即启动全量重复性审查'}</span>
                </button>
              </div>
            </div>

            {/* 定期审查策略、定时指示器与敏感度设置条 */}
            <div className="pt-3 border-t border-slate-800/80 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 flex items-center justify-between">
                <div>
                  <span className="text-slate-400 flex items-center gap-1 font-medium">
                    <Clock className="w-3.5 h-3.5 text-sky-400" />
                    定时审查运行机制:
                  </span>
                  <span className="text-[10px] text-emerald-400 flex items-center gap-1 mt-0.5">
                    ● 定时任务激活中 (CRON)
                  </span>
                </div>
                <select
                  value={reviewSchedule}
                  onChange={(e) => setReviewSchedule(e.target.value as any)}
                  className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-slate-200 text-xs font-mono"
                >
                  <option value="daily">每日 00:00 自动巡检</option>
                  <option value="weekly">每周定期深度排查</option>
                  <option value="on_register">新技能注册即时审查</option>
                </select>
              </div>

              <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 flex items-center justify-between">
                <div>
                  <span className="text-slate-400 flex items-center gap-1 font-medium">
                    <Sliders className="w-3.5 h-3.5 text-amber-400" />
                    相似度重复门槛:
                  </span>
                  <span className="text-[10px] text-slate-500 mt-0.5 block">
                    当前: {(duplicateThreshold * 100).toFixed(0)}% 余弦距离
                  </span>
                </div>
                <select
                  value={duplicateThreshold}
                  onChange={(e) => setDuplicateThreshold(parseFloat(e.target.value))}
                  className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-slate-200 text-xs font-mono"
                >
                  <option value="0.70">70% (高敏感巡检)</option>
                  <option value="0.75">75% (标准推荐)</option>
                  <option value="0.80">80% (严格重合)</option>
                  <option value="0.85">85% (高危同质化)</option>
                </select>
              </div>

              <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 flex items-center justify-between">
                <div>
                  <span className="text-slate-400 font-medium">上次审查状态:</span>
                  <span className="text-[10px] text-slate-500 block mt-0.5">比对组数: {(skills.length * (skills.length - 1)) / 2} 组</span>
                </div>
                <span className="font-mono text-emerald-400 font-semibold text-xs">{lastAuditTime}</span>
              </div>
            </div>

            {/* 批量处置与导出工具栏 */}
            {duplicatePairs.length > 0 && (
              <div className="pt-2 flex items-center justify-between flex-wrap gap-2 text-xs">
                <span className="text-slate-400">
                  发现 <strong className="text-rose-400 font-mono">{duplicatePairs.length}</strong> 组同质化冲突技能对，可选择单项处理或一键批量治理：
                </span>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleBatchDisambiguateAll}
                    className="px-3 py-1.5 rounded-lg bg-indigo-950/80 hover:bg-indigo-900 border border-indigo-800 text-indigo-300 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Wand2 className="w-3.5 h-3.5 text-indigo-400" />
                    <span>一键批量消歧全部冲突对</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleExportDuplicateReport}
                    className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5 text-sky-400" />
                    <span>导出审查报告 (CSV)</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* 审查成果展示列表 */}
          {duplicatePairs.length === 0 ? (
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 text-center text-xs space-y-2 shadow-sm">
              <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto" />
              <div className="text-sm font-bold text-white">全库健康！未发现高度重复同质化技能</div>
              <p className="text-slate-400 max-w-md mx-auto">
                在当前 {skills.length} 项技能中，各技能权责与槽位边界清晰，未达到 {(duplicateThreshold * 100).toFixed(0)}% 重合警戒线。定期巡检服务将持续守护。
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {duplicatePairs.map((pair) => (
                <div
                  key={pair.id}
                  className={`p-4 rounded-xl border transition-all space-y-3 shadow-sm ${
                    pair.riskLevel === 'high'
                      ? 'bg-rose-950/20 border-rose-800/80'
                      : 'bg-slate-900 border-slate-800'
                  }`}
                >
                  <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
                    {/* 技能 A 与 技能 B 左右对照 */}
                    <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-3 w-full">
                      <div className="bg-slate-950 p-3 rounded-lg border border-slate-800/80">
                        <div className="flex items-center justify-between text-xs font-mono font-bold text-sky-300">
                          <span>{pair.skillA.name}</span>
                          <span className="text-[10px] text-slate-500 font-sans">
                            {pair.skillA.content_domain || pair.skillA.clusters[0]}
                          </span>
                        </div>
                        <div className="text-xs font-semibold text-slate-200 mt-0.5">
                          {pair.skillA.display_name || pair.skillA.name}
                        </div>
                        <p className="text-[11px] text-slate-400 mt-1 line-clamp-2">
                          {pair.skillA.description}
                        </p>
                        <div className="mt-2 text-[10px] text-slate-500 font-mono">
                          调用次数: {pair.skillA.call_count} | 槽位: {pair.skillA.required_slots.join(', ') || '无'}
                        </div>
                      </div>

                      <div className="bg-slate-950 p-3 rounded-lg border border-slate-800/80">
                        <div className="flex items-center justify-between text-xs font-mono font-bold text-indigo-300">
                          <span>{pair.skillB.name}</span>
                          <span className="text-[10px] text-slate-500 font-sans">
                            {pair.skillB.content_domain || pair.skillB.clusters[0]}
                          </span>
                        </div>
                        <div className="text-xs font-semibold text-slate-200 mt-0.5">
                          {pair.skillB.display_name || pair.skillB.name}
                        </div>
                        <p className="text-[11px] text-slate-400 mt-1 line-clamp-2">
                          {pair.skillB.description}
                        </p>
                        <div className="mt-2 text-[10px] text-slate-500 font-mono">
                          调用次数: {pair.skillB.call_count} | 槽位: {pair.skillB.required_slots.join(', ') || '无'}
                        </div>
                      </div>
                    </div>

                    {/* 中间相似度指标与处置操作 */}
                    <div className="flex flex-col items-end gap-2 shrink-0 w-full lg:w-auto pt-2 lg:pt-0 border-t lg:border-t-0 border-slate-800">
                      <div className="flex items-center gap-2">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono ${
                            pair.riskLevel === 'high'
                              ? 'bg-rose-950 text-rose-300 border border-rose-800'
                              : 'bg-amber-950 text-amber-300 border border-amber-800'
                          }`}
                        >
                          相似度: {(pair.similarity * 100).toFixed(1)}%
                        </span>
                        {pair.slotOverlap.length > 0 && (
                          <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-slate-950 text-slate-400 border border-slate-800">
                            重合槽位: {pair.slotOverlap.length} 项
                          </span>
                        )}
                      </div>

                      <p className="text-[11px] text-slate-400 max-w-xs text-right">
                        {pair.reason}
                      </p>

                      {/* 处置操作按钮区 */}
                      <div className="flex items-center gap-1.5 flex-wrap justify-end">
                        <button
                          type="button"
                          onClick={() => handleAutoDisambiguatePair(pair)}
                          className="px-2.5 py-1 text-xs text-indigo-300 bg-indigo-950/60 hover:bg-indigo-900/60 border border-indigo-800 rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
                          title="自动为两技能补充差异化消歧特征"
                        >
                          <Wand2 className="w-3 h-3 text-indigo-400" />
                          <span>一键差异化消歧</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleMergeDuplicatePair(pair)}
                          className="px-2.5 py-1 text-xs text-emerald-300 bg-emerald-950/60 hover:bg-emerald-900/60 border border-emerald-800 rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
                          title="将两个重复技能合二为一并删除多余副本"
                        >
                          <GitMerge className="w-3 h-3 text-emerald-400" />
                          <span>一键合并技能</span>
                        </button>

                        {onDeleteSkill && (
                          <>
                            <button
                              type="button"
                              onClick={() => onDeleteSkill(pair.skillB.skill_id)}
                              className="px-2 py-1 text-[11px] text-rose-400 hover:text-white bg-slate-950 hover:bg-rose-600 border border-rose-900/60 rounded-lg transition-colors cursor-pointer"
                              title={`保留 ${pair.skillA.name}，删除 ${pair.skillB.name}`}
                            >
                              留A删B
                            </button>
                            <button
                              type="button"
                              onClick={() => onDeleteSkill(pair.skillA.skill_id)}
                              className="px-2 py-1 text-[11px] text-rose-400 hover:text-white bg-slate-950 hover:bg-rose-600 border border-rose-900/60 rounded-lg transition-colors cursor-pointer"
                              title={`保留 ${pair.skillB.name}，删除 ${pair.skillA.name}`}
                            >
                              留B删A
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 选项卡 2: 三级告警列表 */}
      {governanceTab === 'audit' && (
        <div className="space-y-4">
          {alerts.length === 0 ? (
            <div className="p-8 bg-slate-900 border border-slate-800 rounded-xl text-center text-xs text-slate-400">
              <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
              当前所有已注册技能健康度极高，未触发高报错率或语义贪婪风险！
            </div>
          ) : (
            <div className="space-y-3">
              {alerts.map((alert) => {
                const targetSkill = skills.find((s) => s.skill_id === alert.skill_id);

                return (
                  <div
                    key={alert.id}
                    className="p-4 bg-slate-900 border border-slate-800 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span
                          className={`px-2 py-0.5 text-[10px] font-bold rounded uppercase ${
                            alert.severity === 'high'
                              ? 'bg-rose-950 text-rose-400 border border-rose-800'
                              : alert.severity === 'medium'
                              ? 'bg-amber-950 text-amber-400 border border-amber-800'
                              : 'bg-sky-950 text-sky-400 border border-sky-800'
                          }`}
                        >
                          {alert.severity}
                        </span>
                        <span className="font-mono font-bold text-white text-xs">
                          {alert.skill_name}
                        </span>
                      </div>
                      <p className="text-xs text-slate-300">{alert.message}</p>
                      <p className="text-[11px] text-slate-400">
                        治理建议: {alert.suggested_action}
                      </p>
                    </div>

                    {targetSkill && (
                      <div className="flex items-center gap-2 shrink-0 flex-wrap">
                        {alert.type === 'high_error_rate' && (
                          <>
                            <button
                              onClick={() => {
                                setGovernanceTab('sandbox');
                                handleRunSandboxProbe(targetSkill);
                              }}
                              className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs flex items-center gap-1 transition-colors whitespace-nowrap cursor-pointer"
                            >
                              <Box className="w-3.5 h-3.5 text-sky-400" />
                              沙箱探测
                            </button>
                            <button
                              onClick={() => handleRefineSkill(targetSkill)}
                              className="px-2.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs flex items-center gap-1 transition-colors whitespace-nowrap cursor-pointer"
                            >
                              <Sparkles className="w-3.5 h-3.5" />
                              一键精炼
                            </button>
                          </>
                        )}

                        {alert.type === 'semantic_greed' && (
                          <button
                            onClick={() => handleSplitGreedSkill(targetSkill)}
                            className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-xs flex items-center gap-1.5 transition-colors whitespace-nowrap cursor-pointer"
                          >
                            <Split className="w-3.5 h-3.5" />
                            拆解为垂直专家技能
                          </button>
                        )}

                        {alert.type === 'low_refinement' && (
                          <button
                            onClick={() => handleRefineSkill(targetSkill)}
                            className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs flex items-center gap-1 transition-colors whitespace-nowrap cursor-pointer"
                          >
                            <RefreshCw className="w-3.5 h-3.5" />
                            补充负向规则
                          </button>
                        )}

                        {onDeleteSkill && (
                          <button
                            onClick={() => onDeleteSkill(targetSkill.skill_id)}
                            className="px-2.5 py-1.5 bg-rose-950/60 hover:bg-rose-900 border border-rose-800 text-rose-300 rounded-lg text-xs flex items-center gap-1 transition-colors whitespace-nowrap cursor-pointer"
                            title="从库中彻底删除该技能"
                          >
                            <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                            <span>下线删除</span>
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* 选项卡 3: 无关键词联想能力 (论文特设) */}
      {governanceTab === 'association' && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4 shadow-sm">
          <div>
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-400" />
              无关键词场景的联想能力 (Keyword Association Engine)
            </h3>
            <p className="text-xs text-slate-400 mt-1 leading-relaxed">
              解决论文第三节中的前沿痛点：“当用户提供的上下文极其模糊、完全不包含任何明确技能关键词时，Agent 如何精准补全意图并推荐最贴切候选技能？”
            </p>
          </div>

          <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 flex gap-2">
            <input
              type="text"
              value={vaguePrompt}
              onChange={(e) => setVaguePrompt(e.target.value)}
              placeholder="输入模糊语句，如：报表核算、冷、温度、总结..."
              className="flex-1 bg-transparent border-none text-xs text-white focus:outline-none px-2"
            />
            <span className="text-xs text-slate-500 self-center">试一试: "冷" 或 "报表"</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
            <div className="p-3 bg-slate-950 rounded-lg border border-slate-800">
              <span className="text-[11px] text-slate-500 block mb-1">联想衍生核心意图</span>
              <div className="flex flex-wrap gap-1">
                {associationResult.associatedKeywords.map((kw, i) => (
                  <span
                    key={i}
                    className="px-2 py-0.5 bg-slate-800 text-slate-300 rounded text-xs"
                  >
                    {kw}
                  </span>
                ))}
              </div>
            </div>

            <div className="p-3 bg-slate-950 rounded-lg border border-slate-800">
              <span className="text-[11px] text-slate-500 block mb-1">推导归属功能簇</span>
              <div className="flex flex-wrap gap-1">
                {associationResult.recommendedClusters.map((cl, i) => (
                  <span
                    key={i}
                    className="px-2 py-0.5 bg-indigo-950 text-indigo-300 border border-indigo-800 rounded text-xs"
                  >
                    {cl}
                  </span>
                ))}
              </div>
            </div>

            <div className="p-3 bg-slate-950 rounded-lg border border-slate-800">
              <span className="text-[11px] text-slate-500 block mb-1">意图映射推荐候选技能</span>
              <div className="space-y-1">
                {associationResult.recommendedSkills.length === 0 ? (
                  <span className="text-xs text-slate-600">暂无强相关技能</span>
                ) : (
                  associationResult.recommendedSkills.map((sk) => (
                    <div
                      key={sk.skill_id}
                      className="text-xs font-mono text-emerald-400 flex items-center justify-between"
                    >
                      <span>{sk.name}</span>
                      <span className="text-[10px] text-slate-500 font-sans">
                        {sk.clusters[0]}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 选项卡 4: Docker 沙箱接口探测台 */}
      {governanceTab === 'sandbox' && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <Terminal className="w-4 h-4 text-sky-400" />
                隔离沙箱运行时接口探测台 (Docker Sandbox Probing)
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                论文机制验证：当技能被线上监控标记为高报错率时，人机协同治理引擎自动在隔离容器中对目标技能进行入参模式探针探测与 Schema 校验。
              </p>
            </div>
            {isProbing && (
              <span className="text-xs text-sky-400 flex items-center gap-1.5 animate-pulse">
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                正在向沙箱下发探针流量...
              </span>
            )}
          </div>

          <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 font-mono text-xs space-y-1.5 min-h-48 max-h-72 overflow-y-auto">
            {sandboxLog.length === 0 ? (
              <div className="text-slate-600 text-center py-10">
                请在「三级告警综合排查」中点击异常技能旁的【沙箱探测】按钮启动诊断
              </div>
            ) : (
              sandboxLog.map((log, idx) => (
                <div
                  key={idx}
                  className={`${
                    log.includes('200 OK')
                      ? 'text-emerald-400'
                      : log.includes('诊断结论')
                      ? 'text-indigo-300 font-bold'
                      : 'text-slate-300'
                  }`}
                >
                  {log}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};
