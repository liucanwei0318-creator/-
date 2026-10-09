import React, { useState, useMemo } from 'react';
import { Skill } from '../types/agent';
import { EcosystemImporterModal } from './EcosystemImporterModal';
import {
  Layers,
  Search,
  ChevronDown,
  ChevronUp,
  FileText,
  AlertCircle,
  Hash,
  Shield,
  Eye,
  Sparkles,
  Download,
  FileSpreadsheet,
  CheckCircle2,
  Trash2,
  Compass,
  Wrench,
  X,
  AlertTriangle,
  RotateCcw,
  Bot,
  Brain,
  Cpu,
  Building,
  Info,
} from 'lucide-react';

interface SkillIndexViewProps {
  skills: Skill[];
  onDeleteSkill?: (skillId: string) => void;
  onNavigateToGovernance?: () => void;
  onAddSkills?: (skills: Skill[]) => void;
  onRestoreAllSkills?: () => void;
}

export const SkillIndexView: React.FC<SkillIndexViewProps> = ({
  skills,
  onDeleteSkill,
  onNavigateToGovernance,
  onAddSkills,
  onRestoreAllSkills,
}) => {
  // 两列双轴过滤状态：内容索引 vs 工具索引
  const [selectedDomain, setSelectedDomain] = useState<string>('all');
  const [selectedToolCarrier, setSelectedToolCarrier] = useState<string>('all');
  const [selectedEcosystem, setSelectedEcosystem] = useState<
    'all' | 'openai' | 'claude' | 'deepseek' | 'business'
  >('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [expandedSkillId, setExpandedSkillId] = useState<string | null>(null);

  // 导入生态模态框状态
  const [showImporter, setShowImporter] = useState<boolean>(false);

  // 导出与操作通知
  const [exportNotice, setExportNotice] = useState<string | null>(null);
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  const [showExportMenu, setShowExportMenu] = useState<boolean>(false);

  // 技能删除确认弹窗状态
  const [deletingSkill, setDeletingSkill] = useState<{ id: string; name: string } | null>(null);
  const [showManageModal, setShowManageModal] = useState<boolean>(false);

  // 提取所有唯一业务内容领域 (Content Domains)
  const allContentDomains = useMemo(() => {
    const set = new Set<string>();
    skills.forEach((s) => {
      if (s.content_domain) {
        set.add(s.content_domain);
      } else {
        const domainClusters = s.clusters.filter((c) =>
          ['商业', '金融', '气象', '生活', '研发', '技术', '人力', '行政', '法务', '办公', '营销', '客服', '数据'].some((kw) =>
            c.includes(kw)
          )
        );
        domainClusters.forEach((c) => set.add(c));
      }
    });
    return Array.from(set);
  }, [skills]);

  // 提取所有唯一工具依托载体 (Tool Carriers)
  const allToolCarriers = useMemo(() => {
    const set = new Set<string>();
    skills.forEach((s) => {
      if (s.tool_carrier) {
        set.add(s.tool_carrier);
      } else {
        const toolClusters = s.clusters.filter((c) =>
          ['PDF', 'Word', 'Excel', 'Office', '代码', '沙箱', '搜索', '邮件', 'SQL', '数据库', '视觉', 'OCR', '图像'].some((kw) =>
            c.includes(kw)
          )
        );
        toolClusters.forEach((c) => set.add(c));
      }
    });
    return Array.from(set);
  }, [skills]);

  // 过滤技能：按业务内容领域 AND 工具载体 AND 生态 AND 搜索词多轴联动
  const filteredSkills = useMemo(() => {
    return skills.filter((s) => {
      // 维度 1：内容领域过滤
      const matchDomain =
        selectedDomain === 'all' ||
        s.content_domain === selectedDomain ||
        s.clusters.includes(selectedDomain);

      // 维度 2：工具载体过滤
      const matchCarrier =
        selectedToolCarrier === 'all' ||
        s.tool_carrier === selectedToolCarrier ||
        s.clusters.includes(selectedToolCarrier);

      // 维度 3：模型生态库过滤
      const matchEco =
        selectedEcosystem === 'all' ||
        s.ecosystem === selectedEcosystem ||
        (!s.ecosystem && selectedEcosystem === 'business');

      // 搜索关键词
      const matchSearch =
        searchQuery === '' ||
        s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (s.display_name && s.display_name.toLowerCase().includes(searchQuery.toLowerCase())) ||
        s.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.clusters.some((c) => c.toLowerCase().includes(searchQuery.toLowerCase())) ||
        s.required_slots.some((slot) => slot.toLowerCase().includes(searchQuery.toLowerCase()));

      return matchDomain && matchCarrier && matchEco && matchSearch;
    });
  }, [skills, selectedDomain, selectedToolCarrier, selectedEcosystem, searchQuery]);

  // 统计重叠聚类跨界技能
  const overlappingSkillsCount = useMemo(() => {
    return skills.filter((s) => s.clusters.length > 1).length;
  }, [skills]);

  // 导出为 CSV 文件 (UTF-8 with BOM 编码，完美兼容 Excel / WPS)
  const handleExportCSV = (exportAll: boolean = false) => {
    const list = exportAll ? skills : filteredSkills;
    if (list.length === 0) return;

    const headers = [
      '技能ID (Skill ID)',
      '技能英文标识 (Skill Name)',
      '中文名称 (Display Name)',
      '模型生态 (Ecosystem)',
      '功能微名片描述 (Description)',
      '业务内容领域 (Content Domain)',
      '工具依托载体 (Tool Carrier)',
      '所属功能簇 (Clusters)',
      '必需参数槽位 (Required Slots)',
      '负向排除规则 (Negative Triggers)',
      '消歧专有特征 (Disambiguation)',
      '总调用次数 (Call Count)',
      '失败报错次数 (Error Count)',
      '报错率 (Error Rate)',
      '历史调用领域 (Domains Invoked)',
      '创建方式 (Created Via)',
    ];

    const escapeCSV = (val: any) => {
      if (val === null || val === undefined) return '""';
      const str = String(val).replace(/"/g, '""');
      return `"${str}"`;
    };

    const rows = list.map((s) => {
      const errorRate =
        s.call_count > 0
          ? ((s.error_count / s.call_count) * 100).toFixed(1) + '%'
          : '0.0%';
      return [
        escapeCSV(s.skill_id),
        escapeCSV(s.name),
        escapeCSV(s.display_name || s.name),
        escapeCSV(s.ecosystem || 'business'),
        escapeCSV(s.description),
        escapeCSV(s.content_domain || '通用内容'),
        escapeCSV(s.tool_carrier || '通用工具'),
        escapeCSV(s.clusters.join('; ')),
        escapeCSV(s.required_slots.join('; ')),
        escapeCSV(s.negative_triggers.join('; ')),
        escapeCSV(s.disambiguation_features || ''),
        escapeCSV(s.call_count),
        escapeCSV(s.error_count),
        escapeCSV(errorRate),
        escapeCSV(s.domains_invoked.join('; ')),
        escapeCSV(s.created_via === 'ai_natural_language' ? 'AI自然语言生成' : '手动配置'),
      ].join(',');
    });

    const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const timestamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    link.href = url;
    link.setAttribute('download', `skillpilot_skills_${timestamp}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    setShowExportMenu(false);
    setExportNotice(
      `已成功导出 ${list.length} 项技能数据至 CSV 文件 (UTF-8 BOM 编码，完美兼容 Excel / WPS 离线分析)！`
    );
    setTimeout(() => setExportNotice(null), 4000);
  };

  // 确认删除技能
  const handleConfirmDelete = () => {
    if (!deletingSkill || !onDeleteSkill) return;
    onDeleteSkill(deletingSkill.id);
    setActionNotice(`已成功删除技能 [${deletingSkill.name}]！`);
    setDeletingSkill(null);
    setTimeout(() => setActionNotice(null), 4000);
  };

  return (
    <div className="space-y-6">
      {/* 顶部理论解析栏与快捷扩充入口 */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <Layers className="w-4 h-4 text-sky-400" />
              多维技能索引图谱 (Two-Dimensional Facet Index)
            </h2>
            <p className="text-xs text-slate-400 mt-1.5 leading-relaxed max-w-3xl">
              解决成百上千技能下的上下文膨胀：将技能按照
              <strong className="text-sky-300">「业务内容领域 (天气、商业等)」</strong>与
              <strong className="text-indigo-300">「工具依托载体 (PDF、Word、代码等)」</strong>
              分两列独立选择初筛，有效防止语义贪婪与误命中。
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0 flex-wrap">
            <button
              type="button"
              onClick={() => setShowImporter(true)}
              className="px-3.5 py-2 rounded-lg bg-emerald-950/70 hover:bg-emerald-900/70 border border-emerald-800/80 text-emerald-300 text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer shadow-sm"
              title="接入 OpenAI, Claude, DeepSeek 技能库扩大样本"
            >
              <Bot className="w-4 h-4 text-emerald-400" />
              <span>接入模型生态库</span>
            </button>

            {onNavigateToGovernance && (
              <button
                type="button"
                onClick={onNavigateToGovernance}
                className="px-3 py-2 rounded-lg bg-rose-950/60 hover:bg-rose-900/60 border border-rose-800/80 text-rose-300 text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer shadow-sm"
              >
                <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
                <span>全库重复度审查</span>
              </button>
            )}

            <div className="bg-slate-950 border border-slate-800 px-3 py-1.5 rounded-lg text-right">
              <span className="text-[10px] text-slate-500 block">库内装载技能</span>
              <span className="text-sm font-bold font-mono text-sky-400">
                {skills.length} 项
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 技能删除与管理操作指引横幅 */}
      <div className="bg-indigo-950/30 border border-indigo-800/50 rounded-xl px-4 py-3 text-xs text-indigo-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Info className="w-4 h-4 text-indigo-400 shrink-0" />
          <span>
            <strong>💡 技能删除说明：</strong>
            您可以在下方任意技能卡片右上角直接点击红色的<strong>【删除图标】</strong>进行下线；
            或点击右上方<strong>【管理与删除】</strong>集中移除冗余技能。
          </span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {onDeleteSkill && (
            <button
              type="button"
              onClick={() => setShowManageModal(true)}
              className="px-2.5 py-1 text-xs bg-rose-950/60 hover:bg-rose-900/60 border border-rose-800 text-rose-300 rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
            >
              <Trash2 className="w-3 h-3 text-rose-400" />
              <span>集中管理/删除</span>
            </button>
          )}
        </div>
      </div>

      {/* 提示通知横幅 */}
      {exportNotice && (
        <div className="p-3 bg-emerald-950/60 border border-emerald-600/40 rounded-xl text-xs text-emerald-200 flex items-center justify-between gap-2 animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{exportNotice}</span>
          </div>
          <span className="text-[10px] text-emerald-400/80 font-mono">已生成下载</span>
        </div>
      )}

      {actionNotice && (
        <div className="p-3 bg-rose-950/60 border border-rose-600/40 rounded-xl text-xs text-rose-200 flex items-center justify-between gap-2 animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{actionNotice}</span>
          </div>
          <span className="text-[10px] text-rose-400/80 font-mono">已从库中移除</span>
        </div>
      )}

      {/* 核心双列索引选择器：左列【内容索引】 vs 右列【工具索引】 */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-800/80 pb-3">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-sky-400" />
            <h3 className="text-xs font-bold text-white uppercase tracking-wider">
              两列独立索引选择器 (内容领域 vs 工具载体)
            </h3>
          </div>

          <div className="flex items-center gap-2">
            {(selectedDomain !== 'all' || selectedToolCarrier !== 'all' || selectedEcosystem !== 'all') && (
              <button
                type="button"
                onClick={() => {
                  setSelectedDomain('all');
                  setSelectedToolCarrier('all');
                  setSelectedEcosystem('all');
                }}
                className="text-[11px] text-indigo-400 hover:text-indigo-300 transition-colors cursor-pointer flex items-center gap-1"
              >
                <RotateCcw className="w-3 h-3" />
                <span>重置双列筛选</span>
              </button>
            )}
          </div>
        </div>

        {/* 生态库快捷筛选标签 */}
        <div className="flex items-center gap-1.5 flex-wrap text-xs pb-1">
          <span className="text-[11px] text-slate-400 font-medium mr-1">模型生态归属:</span>
          <button
            type="button"
            onClick={() => setSelectedEcosystem('all')}
            className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
              selectedEcosystem === 'all'
                ? 'bg-slate-700 text-white'
                : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800'
            }`}
          >
            全部生态 ({skills.length})
          </button>
          <button
            type="button"
            onClick={() => setSelectedEcosystem('openai')}
            className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors flex items-center gap-1 cursor-pointer ${
              selectedEcosystem === 'openai'
                ? 'bg-emerald-600 text-white'
                : 'bg-slate-950 text-emerald-400 hover:text-emerald-300 border border-emerald-950'
            }`}
          >
            <Bot className="w-3 h-3" />
            OpenAI ({skills.filter((s) => s.ecosystem === 'openai').length})
          </button>
          <button
            type="button"
            onClick={() => setSelectedEcosystem('claude')}
            className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors flex items-center gap-1 cursor-pointer ${
              selectedEcosystem === 'claude'
                ? 'bg-amber-600 text-white'
                : 'bg-slate-950 text-amber-400 hover:text-amber-300 border border-amber-950'
            }`}
          >
            <Brain className="w-3 h-3" />
            Claude ({skills.filter((s) => s.ecosystem === 'claude').length})
          </button>
          <button
            type="button"
            onClick={() => setSelectedEcosystem('deepseek')}
            className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors flex items-center gap-1 cursor-pointer ${
              selectedEcosystem === 'deepseek'
                ? 'bg-blue-600 text-white'
                : 'bg-slate-950 text-blue-400 hover:text-blue-300 border border-blue-950'
            }`}
          >
            <Cpu className="w-3 h-3" />
            DeepSeek ({skills.filter((s) => s.ecosystem === 'deepseek').length})
          </button>
          <button
            type="button"
            onClick={() => setSelectedEcosystem('business')}
            className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors flex items-center gap-1 cursor-pointer ${
              selectedEcosystem === 'business'
                ? 'bg-indigo-600 text-white'
                : 'bg-slate-950 text-indigo-400 hover:text-indigo-300 border border-indigo-950'
            }`}
          >
            <Building className="w-3 h-3" />
            商业与办公 ({skills.filter((s) => s.ecosystem === 'business' || !s.ecosystem).length})
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* 第一列：业务内容索引 (Content Domains) */}
          <div className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-3.5 space-y-2.5">
            <div className="flex items-center justify-between text-xs font-semibold text-sky-300">
              <span className="flex items-center gap-1.5">
                <Compass className="w-3.5 h-3.5 text-sky-400" />
                第一列：内容领域索引 (天气、商业、办公等)
              </span>
              <span className="text-[10px] text-slate-500 font-mono">
                {selectedDomain === 'all' ? '全部领域' : selectedDomain}
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => setSelectedDomain('all')}
                className={`px-2.5 py-1 text-xs rounded-lg transition-colors font-medium cursor-pointer ${
                  selectedDomain === 'all'
                    ? 'bg-sky-600 text-white shadow-sm'
                    : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
                }`}
              >
                全部内容 ({skills.length})
              </button>
              {allContentDomains.map((domain) => {
                const count = skills.filter(
                  (s) => s.content_domain === domain || s.clusters.includes(domain)
                ).length;
                return (
                  <button
                    key={domain}
                    type="button"
                    onClick={() => setSelectedDomain(domain)}
                    className={`px-2.5 py-1 text-xs rounded-lg transition-colors font-medium cursor-pointer ${
                      selectedDomain === domain
                        ? 'bg-sky-600 text-white shadow-sm'
                        : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
                    }`}
                  >
                    {domain} ({count})
                  </button>
                );
              })}
            </div>
          </div>

          {/* 第二列：载体工具索引 (Tool Carriers) */}
          <div className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-3.5 space-y-2.5">
            <div className="flex items-center justify-between text-xs font-semibold text-indigo-300">
              <span className="flex items-center gap-1.5">
                <Wrench className="w-3.5 h-3.5 text-indigo-400" />
                第二列：工具载体索引 (PDF、Word、代码等)
              </span>
              <span className="text-[10px] text-slate-500 font-mono">
                {selectedToolCarrier === 'all' ? '全部工具' : selectedToolCarrier}
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => setSelectedToolCarrier('all')}
                className={`px-2.5 py-1 text-xs rounded-lg transition-colors font-medium cursor-pointer ${
                  selectedToolCarrier === 'all'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
                }`}
              >
                全部载体 ({skills.length})
              </button>
              {allToolCarriers.map((carrier) => {
                const count = skills.filter(
                  (s) => s.tool_carrier === carrier || s.clusters.includes(carrier)
                ).length;
                return (
                  <button
                    key={carrier}
                    type="button"
                    onClick={() => setSelectedToolCarrier(carrier)}
                    className={`px-2.5 py-1 text-xs rounded-lg transition-colors font-medium cursor-pointer ${
                      selectedToolCarrier === carrier
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
                    }`}
                  >
                    {carrier} ({count})
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* 搜索与工具控制器条 */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-4 shadow-sm">
        <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="搜索技能名称、描述、入参槽位..."
              className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3.5 py-2 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div className="flex items-center gap-2.5 w-full sm:w-auto justify-between sm:justify-end">
            <div className="text-xs text-slate-400">
              当前展示 <span className="font-mono text-white font-semibold">{filteredSkills.length}</span> / {skills.length} 项
            </div>

            {/* 集中管理 / 删除列表按钮 */}
            {onDeleteSkill && (
              <button
                type="button"
                onClick={() => setShowManageModal(true)}
                className="px-3 py-1.5 text-xs font-semibold text-rose-300 hover:text-rose-100 bg-rose-950/40 hover:bg-rose-900/40 border border-rose-800/60 rounded-lg transition-colors flex items-center gap-1.5 shadow-sm cursor-pointer"
                title="集中查看并删除技能"
              >
                <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                <span>管理与删除</span>
              </button>
            )}

            {/* CSV 导出操作组件 */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowExportMenu(!showExportMenu)}
                className="px-3 py-1.5 text-xs font-semibold text-slate-200 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-slate-600 rounded-lg transition-colors flex items-center gap-1.5 shadow-sm cursor-pointer"
                title="导出技能状态数据为 CSV 文件备份"
              >
                <Download className="w-3.5 h-3.5 text-sky-400" />
                <span>导出 CSV</span>
                <ChevronDown className="w-3 h-3 text-slate-400" />
              </button>

              {showExportMenu && (
                <div className="absolute right-0 mt-1.5 w-48 bg-slate-900 border border-slate-800 rounded-xl shadow-2xl p-1.5 z-20 space-y-1">
                  <button
                    type="button"
                    onClick={() => handleExportCSV(false)}
                    className="w-full text-left px-2.5 py-2 text-xs text-slate-200 hover:bg-slate-800 rounded-lg transition-colors flex items-center justify-between cursor-pointer"
                  >
                    <span className="flex items-center gap-1.5">
                      <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
                      导出当前筛选
                    </span>
                    <span className="text-[10px] font-mono text-slate-400">
                      {filteredSkills.length} 项
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleExportCSV(true)}
                    className="w-full text-left px-2.5 py-2 text-xs text-slate-200 hover:bg-slate-800 rounded-lg transition-colors flex items-center justify-between cursor-pointer"
                  >
                    <span className="flex items-center gap-1.5">
                      <FileSpreadsheet className="w-3.5 h-3.5 text-sky-400" />
                      导出全量技能库
                    </span>
                    <span className="text-[10px] font-mono text-slate-400">
                      {skills.length} 项
                    </span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 技能卡片网格 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredSkills.map((skill) => {
          const isExpanded = expandedSkillId === skill.skill_id;
          const isOverlapping = skill.clusters.length > 1;

          const ecoTag =
            skill.ecosystem === 'openai'
              ? { label: 'OpenAI', cls: 'bg-emerald-950/60 text-emerald-300 border-emerald-800/80' }
              : skill.ecosystem === 'claude'
              ? { label: 'Claude', cls: 'bg-amber-950/60 text-amber-300 border-amber-800/80' }
              : skill.ecosystem === 'deepseek'
              ? { label: 'DeepSeek', cls: 'bg-blue-950/60 text-blue-300 border-blue-800/80' }
              : { label: 'Business', cls: 'bg-indigo-950/60 text-indigo-300 border-indigo-800/80' };

          return (
            <div
              key={skill.skill_id}
              className="bg-slate-900 border border-slate-800 rounded-xl p-5 hover:border-slate-700 transition-all flex flex-col justify-between group shadow-sm"
            >
              <div>
                {/* 标题与右上角删除按钮 */}
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded border ${ecoTag.cls}`}>
                        {ecoTag.label}
                      </span>
                      <h3 className="text-sm font-bold text-white font-mono flex items-center gap-1.5 truncate">
                        {skill.display_name || skill.name}
                      </h3>
                      {skill.display_name && (
                        <span className="text-[10px] font-mono text-slate-400 bg-slate-950 px-1.5 py-0.5 rounded border border-slate-800 truncate max-w-[120px]">
                          {skill.name}
                        </span>
                      )}
                      {skill.created_via === 'ai_natural_language' && (
                        <span className="text-[9px] font-semibold text-amber-300 bg-amber-950/60 border border-amber-800/80 px-1.5 py-0.5 rounded flex items-center gap-1">
                          <Sparkles className="w-2.5 h-2.5 text-amber-400" />
                          AI 生成
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 text-xs text-slate-400 mt-1 flex-wrap">
                      {skill.content_domain && (
                        <span className="text-sky-300 bg-sky-950/50 px-1.5 py-0.2 rounded border border-sky-900/60 text-[10px]">
                          {skill.content_domain}
                        </span>
                      )}
                      {skill.tool_carrier && (
                        <span className="text-indigo-300 bg-indigo-950/50 px-1.5 py-0.2 rounded border border-indigo-900/60 text-[10px]">
                          {skill.tool_carrier}
                        </span>
                      )}
                      {isOverlapping && (
                        <span className="text-[10px] text-slate-500">
                          (共 {skill.clusters.length} 个簇)
                        </span>
                      )}
                    </div>
                  </div>

                  {/* 显眼直接的删除按钮 (红色 trash 图标) */}
                  {onDeleteSkill && (
                    <button
                      type="button"
                      onClick={() =>
                        setDeletingSkill({
                          id: skill.skill_id,
                          name: skill.display_name || skill.name,
                        })
                      }
                      className="p-1.5 text-slate-400 hover:text-white bg-slate-950 hover:bg-rose-600 border border-slate-800 hover:border-rose-500 rounded-lg transition-colors cursor-pointer shrink-0 shadow-sm"
                      title={`从库中删除技能 [${skill.display_name || skill.name}]`}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* 描述 */}
                <p className="text-xs text-slate-300 line-clamp-2 mt-2 leading-relaxed">
                  {skill.description}
                </p>

                {/* 槽位与负向规避摘要 */}
                <div className="mt-3 pt-3 border-t border-slate-800/80 text-[11px] space-y-1.5">
                  <div className="flex items-start gap-1.5 text-slate-400">
                    <Hash className="w-3.5 h-3.5 text-indigo-400 shrink-0 mt-0.5" />
                    <span className="truncate">
                      参数槽位:{' '}
                      <span className="font-mono text-slate-300">
                        {skill.required_slots.join(', ') || '无'}
                      </span>
                    </span>
                  </div>

                  {skill.negative_triggers.length > 0 && (
                    <div className="flex items-start gap-1.5 text-slate-400">
                      <Shield className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                      <span className="truncate">
                        负向规避: <span className="text-slate-300">{skill.negative_triggers[0]}</span>
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* 卡片底栏指标与展开控制 */}
              <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
                <div className="flex items-center gap-2 text-[11px] font-mono">
                  <span>调用: {skill.call_count}</span>
                  <span>·</span>
                  <span className={skill.error_count > 0 ? 'text-rose-400' : 'text-slate-400'}>
                    报错: {skill.error_count}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    setExpandedSkillId(isExpanded ? null : skill.skill_id)
                  }
                  className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1 font-medium transition-colors cursor-pointer"
                >
                  <Eye className="w-3.5 h-3.5" />
                  {isExpanded ? '收起完整规范' : '查看详情'}
                </button>
              </div>

              {/* 渐进式披露详情面板 */}
              {isExpanded && (
                <div className="mt-4 p-3 bg-slate-950 rounded-lg border border-slate-800 text-xs space-y-2.5 animate-in fade-in">
                  <div className="flex items-center gap-1.5 text-indigo-300 font-semibold text-[11px]">
                    <FileText className="w-3.5 h-3.5" />
                    完整技能微名片深度规范
                  </div>

                  <div>
                    <span className="text-slate-500 text-[10px] block">消歧专有属性:</span>
                    <span className="text-slate-300 text-[11px] leading-relaxed">
                      {skill.disambiguation_features || '通用属性，暂无特殊消歧'}
                    </span>
                  </div>

                  <div>
                    <span className="text-slate-500 text-[10px] block">完整负向排除规则:</span>
                    <ul className="text-slate-300 text-[11px] list-disc list-inside space-y-0.5">
                      {skill.negative_triggers.map((neg, i) => (
                        <li key={i}>{neg}</li>
                      ))}
                    </ul>
                  </div>

                  <div>
                    <span className="text-slate-500 text-[10px] block">曾调用领域:</span>
                    <span className="text-slate-300 text-[11px] font-mono">
                      {skill.domains_invoked.length > 0
                        ? skill.domains_invoked.join(', ')
                        : '尚未跨域调用'}
                    </span>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* 单个技能删除确认弹窗 (Delete Confirmation Modal) */}
      {deletingSkill && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center gap-3 text-rose-400">
              <div className="w-10 h-10 rounded-xl bg-rose-600/20 border border-rose-600/40 flex items-center justify-center">
                <Trash2 className="w-5 h-5 text-rose-400" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">确认从库中下线并删除此技能？</h3>
                <p className="text-xs text-slate-400">此操作将移除该技能的索引、向量与两阶段调用路由</p>
              </div>
            </div>

            <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-xs">
              <div className="text-slate-400">待删除技能：</div>
              <div className="font-mono font-bold text-rose-300 text-sm mt-0.5">
                {deletingSkill.name} (ID: {deletingSkill.id})
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeletingSkill(null)}
                className="px-3.5 py-2 text-xs font-semibold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-xl transition-colors cursor-pointer"
              >
                取消
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-500 rounded-xl shadow-lg shadow-rose-950/60 transition-colors cursor-pointer"
              >
                确认下线删除
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 集中式技能管理抽屉/弹窗 (Skill Management & Batch Deletion) */}
      {showManageModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-3xl w-full p-6 shadow-2xl space-y-4 max-h-[85vh] flex flex-col animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Trash2 className="w-4 h-4 text-rose-400" />
                <h3 className="text-sm font-bold text-white">
                  已注册技能全量管理与删除列表 ({skills.length} 项)
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowManageModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed">
              在此处可以清晰查看库中所有已装配的技能，支持对不需要的冗余或测试技能执行一键删除。
            </p>

            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              {skills.map((s) => (
                <div
                  key={s.skill_id}
                  className="p-3 bg-slate-950 rounded-xl border border-slate-800 flex items-center justify-between gap-3 text-xs hover:border-slate-700 transition-colors"
                >
                  <div className="min-w-0">
                    <div className="font-mono font-bold text-white flex items-center gap-2">
                      <span>{s.display_name || s.name}</span>
                      <span className="text-[10px] text-slate-500 font-normal">({s.name})</span>
                      {s.content_domain && (
                        <span className="text-[10px] bg-sky-950 text-sky-400 px-1.5 py-0.2 rounded border border-sky-800">
                          {s.content_domain}
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-slate-400 truncate max-w-lg mt-0.5">
                      {s.description}
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-[10px] font-mono text-slate-500">
                      调用: {s.call_count} / 错: {s.error_count}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setDeletingSkill({ id: s.skill_id, name: s.display_name || s.name });
                        setShowManageModal(false);
                      }}
                      className="px-2.5 py-1 text-xs text-rose-400 hover:text-white bg-rose-950/40 hover:bg-rose-600 border border-rose-800/60 rounded-lg transition-colors cursor-pointer"
                    >
                      删除
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setShowManageModal(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-xl transition-colors cursor-pointer"
              >
                关闭
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 生态库接入导入器弹窗 */}
      <EcosystemImporterModal
        isOpen={showImporter}
        onClose={() => setShowImporter(false)}
        currentSkills={skills}
        onImportSkills={(newSkills) => {
          if (onAddSkills) {
            onAddSkills(newSkills);
          }
        }}
        onRestoreAllSkills={onRestoreAllSkills}
      />
    </div>
  );
};
