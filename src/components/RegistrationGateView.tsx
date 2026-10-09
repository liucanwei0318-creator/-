import React, { useState, useMemo } from 'react';
import { Skill, RegistrationCheckResult } from '../types/agent';
import { SkillRegistrationGate } from '../services/registrationGate';
import { SimpleEmbeddingProvider } from '../services/embedding';
import { AISkillCreatorChat, SkillDraft } from './AISkillCreatorChat';
import { EcosystemImporterModal } from './EcosystemImporterModal';
import {
  ShieldAlert,
  ShieldCheck,
  Plus,
  AlertCircle,
  Sparkles,
  Info,
  Sliders,
  Bot,
  Trash2,
  Search,
  CheckCircle2,
  Download,
  X,
  Layers,
} from 'lucide-react';

interface RegistrationGateViewProps {
  skills: Skill[];
  onRegisterSkill: (skill: Skill) => void;
  onDeleteSkill: (skillId: string) => void;
  onAddSkills?: (skills: Skill[]) => void;
  onRestoreAllSkills?: () => void;
}

export const RegistrationGateView: React.FC<RegistrationGateViewProps> = ({
  skills,
  onRegisterSkill,
  onDeleteSkill,
  onAddSkills,
  onRestoreAllSkills,
}) => {
  const [mode, setMode] = useState<'ai' | 'manual'>('ai');
  const [showImporter, setShowImporter] = useState(false);
  const [tableSearch, setTableSearch] = useState('');
  const [deleteConfirmSkill, setDeleteConfirmSkill] = useState<{ id: string; name: string } | null>(null);
  const [deleteToast, setDeleteToast] = useState<string | null>(null);

  // 手动表单字段
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [clustersStr, setClustersStr] = useState('文档处理, Office工具');
  const [slotsStr, setSlotsStr] = useState('file_path, output_format');
  const [disambiguation, setDisambiguation] = useState('');
  const [negativeTriggersStr, setNegativeTriggersStr] = useState('');
  const [lastSubmitResult, setLastSubmitResult] = useState<RegistrationCheckResult | null>(null);

  // 解析数组
  const parsedClusters = useMemo(
    () =>
      clustersStr
        .split(/[,，]/)
        .map((s) => s.trim())
        .filter(Boolean),
    [clustersStr]
  );

  const parsedSlots = useMemo(
    () =>
      slotsStr
        .split(/[,，]/)
        .map((s) => s.trim())
        .filter(Boolean),
    [slotsStr]
  );

  const parsedNegativeTriggers = useMemo(
    () =>
      negativeTriggersStr
        .split(/[\n,，]/)
        .map((s) => s.trim())
        .filter(Boolean),
    [negativeTriggersStr]
  );

  // 从 AI 蓝图草案带入传统表单
  const handleSwitchToManual = (draft: Partial<SkillDraft>) => {
    if (draft.name) setName(draft.name);
    if (draft.description) setDescription(draft.description);
    if (draft.clusters && draft.clusters.length > 0) setClustersStr(draft.clusters.join(', '));
    if (draft.required_slots && draft.required_slots.length > 0) setSlotsStr(draft.required_slots.join(', '));
    if (draft.disambiguation_features) setDisambiguation(draft.disambiguation_features);
    if (draft.negative_triggers && draft.negative_triggers.length > 0) {
      setNegativeTriggersStr(draft.negative_triggers.join('\n'));
    }
    setMode('manual');
  };

  // 实时预检测
  const candidateSkill: Partial<Skill> = {
    name,
    description,
    clusters: parsedClusters,
    required_slots: parsedSlots,
    disambiguation_features: disambiguation,
    negative_triggers: parsedNegativeTriggers,
  };

  const collisionResult: RegistrationCheckResult = useMemo(() => {
    if (!name.trim() || !description.trim()) {
      return {
        allowed: true,
        message: '请填写技能名称与描述以进行防碰撞实时雷达扫描。',
      };
    }
    return SkillRegistrationGate.checkCollision(candidateSkill, skills);
  }, [name, description, parsedClusters, disambiguation, parsedNegativeTriggers, skills]);

  // 计算与各库中技能的相似度排行
  const similarityRank = useMemo(() => {
    if (!name.trim() || !description.trim()) return [];
    const candText = `${name} ${description} ${parsedClusters.join(' ')}`;
    const candVec = SimpleEmbeddingProvider.getEmbedding(candText);

    return skills
      .map((s) => ({
        skill: s,
        sim: SimpleEmbeddingProvider.cosineSimilarity(candVec, s.embedding),
      }))
      .sort((a, b) => b.sim - a.sim);
  }, [name, description, parsedClusters, skills]);

  // 快捷填入论文冲突用例 (PDF_Tool_Pro)
  const handleLoadCollisionExample = () => {
    setName('PDF_Tool_Pro');
    setDescription('用于将文档转为 PDF 文件的处理工具');
    setClustersStr('文档处理, 文件格式');
    setSlotsStr('file_name, output_format');
    setDisambiguation('');
    setNegativeTriggersStr('');
    setLastSubmitResult(null);
  };

  // 快捷补充消歧与负向规则以通过门禁
  const handleFixCollision = () => {
    setDisambiguation('专门针对带密码保护的文档解密并转为高保真 PDF 交付件');
    setNegativeTriggersStr('请勿处理未加密的普通文本转换, 不要用于视频字幕生成');
  };

  // 提交注册
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !description.trim()) return;

    const check = SkillRegistrationGate.checkCollision(candidateSkill, skills);
    setLastSubmitResult(check);

    if (!check.allowed) {
      return;
    }

    const newSkill: Skill = {
      skill_id: `skill_${Date.now().toString(36)}`,
      name: name.trim(),
      description: description.trim(),
      clusters: parsedClusters.length > 0 ? parsedClusters : ['通用工具'],
      required_slots: parsedSlots,
      negative_triggers: parsedNegativeTriggers,
      disambiguation_features: disambiguation.trim(),
      call_count: 0,
      error_count: 0,
      domains_invoked: [],
      embedding: SimpleEmbeddingProvider.getEmbedding(
        `${name} ${description} ${parsedClusters.join(' ')}`
      ),
      mock_executor: (slots) => {
        return `【${name.trim()} 执行完毕】已处理完成，参数: ${JSON.stringify(slots)}`;
      },
    };

    onRegisterSkill(newSkill);

    // 重置表单
    setName('');
    setDescription('');
    setDisambiguation('');
    setNegativeTriggersStr('');
  };

  // 确认删除技能
  const handleConfirmDelete = () => {
    if (!deleteConfirmSkill) return;
    onDeleteSkill(deleteConfirmSkill.id);
    setDeleteToast(`已成功删除技能 [${deleteConfirmSkill.name}]！`);
    setDeleteConfirmSkill(null);
    setTimeout(() => setDeleteToast(null), 3500);
  };

  // 筛选档案列表
  const filteredArchive = useMemo(() => {
    if (!tableSearch.trim()) return skills;
    const q = tableSearch.toLowerCase();
    return skills.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        (s.display_name && s.display_name.toLowerCase().includes(q)) ||
        s.description.toLowerCase().includes(q) ||
        s.clusters.some((c) => c.toLowerCase().includes(q))
    );
  }, [skills, tableSearch]);

  return (
    <div className="space-y-6">
      {/* 注册模式导航与快捷扩充栏 */}
      <div className="bg-slate-900/90 border border-slate-800 p-2 rounded-2xl flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 shadow-sm">
        <div className="flex items-center gap-1.5 w-full sm:w-auto">
          <button
            type="button"
            onClick={() => setMode('ai')}
            className={`flex-1 sm:flex-none px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
              mode === 'ai'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <Sparkles className="w-4 h-4 text-amber-300" />
            AI 对话式注册 (自然语言推荐)
          </button>

          <button
            type="button"
            onClick={() => setMode('manual')}
            className={`flex-1 sm:flex-none px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
              mode === 'manual'
                ? 'bg-slate-800 text-white shadow-sm border border-slate-700'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <Sliders className="w-4 h-4 text-slate-400" />
            手动表单录入 (高级专家)
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowImporter(true)}
            className="px-3.5 py-1.5 text-xs font-semibold text-emerald-300 bg-emerald-950/60 hover:bg-emerald-900/60 border border-emerald-800/80 rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer shadow-sm"
          >
            <Bot className="w-4 h-4 text-emerald-400" />
            <span>接入生态技能库 (OpenAI · Claude · DeepSeek)</span>
          </button>
        </div>
      </div>

      {/* 删除成功通知 */}
      {deleteToast && (
        <div className="p-3 bg-rose-950/70 border border-rose-800/60 rounded-xl text-xs text-rose-200 flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-rose-400 shrink-0" />
          <span>{deleteToast}</span>
        </div>
      )}

      {/* AI 对话式注册视图 (默认统一工作台) */}
      {mode === 'ai' && (
        <AISkillCreatorChat
          skills={skills}
          onRegisterSkill={onRegisterSkill}
          onSwitchToManualForm={handleSwitchToManual}
        />
      )}

      {/* 传统手动表单视图 */}
      {mode === 'manual' && (
        <>
          {/* 顶部防碰撞理论说明栏 */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-sm font-bold text-white flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  注册防碰撞排他检查 (Registration Collision Gate)
                </h2>
                <p className="text-xs text-slate-400 mt-1.5 leading-relaxed max-w-3xl">
                  当技能库规模扩大时，语义宽泛的技能会导致“高权重但并不适合的技能长期霸占调用权”。
                  系统在注册阶段实时比对候选名片余弦向量相似度。若与现有技能相似度
                  <strong className="text-rose-400 font-mono"> ≥ 0.90</strong>
                  ，系统将<strong>拒绝直接上线</strong>，并强制要求开发者填写
                  <strong> 消歧专有属性 (Disambiguation Features)</strong> 与
                  <strong> 负向触发条件 (Negative Triggers)</strong>。
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setMode('ai')}
                  className="px-3 py-1.5 text-xs font-semibold text-indigo-300 bg-indigo-950/60 border border-indigo-800 rounded-lg hover:bg-indigo-900/60 transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                  切换 AI 对话注册
                </button>
                <button
                  type="button"
                  onClick={handleLoadCollisionExample}
                  className="px-3 py-1.5 text-xs font-semibold text-amber-300 bg-amber-950/50 border border-amber-800/80 rounded-lg hover:bg-amber-900/50 transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  载入论文冲突案例 (PDF_Tool_Pro)
                </button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* 左侧表单 */}
            <div className="lg:col-span-7 bg-slate-900 border border-slate-800 rounded-xl p-6">
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1.5">
                      技能唯一英文标识 / 名称 (Skill Name) *
                    </label>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="如: Contract_Auditor"
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 font-mono"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1.5">
                      所属功能簇 (Clusters，逗号分隔) *
                    </label>
                    <input
                      type="text"
                      value={clustersStr}
                      onChange={(e) => setClustersStr(e.target.value)}
                      placeholder="如: 文档处理, Office工具"
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    功能微名片描述 (Description) *
                  </label>
                  <textarea
                    rows={2}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="精炼阐述本技能的核心解决场景与交付能力..."
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    必需关键参数槽位 (Required Slots，逗号分隔)
                  </label>
                  <input
                    type="text"
                    value={slotsStr}
                    onChange={(e) => setSlotsStr(e.target.value)}
                    placeholder="如: file_path, target_format"
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 font-mono"
                  />
                </div>

                <div className="p-3.5 bg-slate-950/60 border border-slate-800 rounded-lg space-y-3">
                  <div className="text-xs font-semibold text-indigo-300 flex items-center gap-1.5">
                    <Info className="w-3.5 h-3.5 text-indigo-400" />
                    排他门禁核心约束 (当与现有技能相似度 ≥ 0.90 时必须填写):
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">
                      消歧专有属性 (Disambiguation Features)
                    </label>
                    <input
                      type="text"
                      value={disambiguation}
                      onChange={(e) => setDisambiguation(e.target.value)}
                      placeholder="阐明与潜在同类技能的本质区别与独特优势..."
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">
                      负向触发条件 / 排除规则 (Negative Triggers，支持换行或逗号)
                    </label>
                    <textarea
                      rows={2}
                      value={negativeTriggersStr}
                      onChange={(e) => setNegativeTriggersStr(e.target.value)}
                      placeholder="明确声明本技能绝不处理的边界（如：请勿用于图片去水印）..."
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>

                <div className="pt-2 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={handleFixCollision}
                    className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors flex items-center gap-1 cursor-pointer"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    一键注入排他消歧配置
                  </button>

                  <button
                    type="submit"
                    disabled={!collisionResult.allowed}
                    className={`px-4 py-2 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-all ${
                      collisionResult.allowed
                        ? 'bg-indigo-600 hover:bg-indigo-500 text-white cursor-pointer shadow-md'
                        : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                    }`}
                  >
                    <Plus className="w-3.5 h-3.5" />
                    立即注册并上线技能
                  </button>
                </div>
              </form>
            </div>

            {/* 右侧实时碰撞雷达 */}
            <div className="lg:col-span-5 bg-slate-900 border border-slate-800 rounded-xl p-6">
              <h3 className="text-xs font-bold text-slate-300 mb-3 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-indigo-400" />
                排他门禁实时雷达 (Collision Radar)
              </h3>

              {/* 实时门禁判定状态 */}
              <div
                className={`p-3 rounded-xl border text-xs mb-4 ${
                  collisionResult.allowed
                    ? 'bg-emerald-950/20 border-emerald-800/40 text-emerald-300'
                    : 'bg-rose-950/30 border-rose-800/60 text-rose-300'
                }`}
              >
                <div className="font-semibold flex items-center gap-1.5 mb-1">
                  {collisionResult.allowed ? (
                    <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  ) : (
                    <ShieldAlert className="w-4 h-4 text-rose-400" />
                  )}
                  {collisionResult.allowed ? '门禁状态: 准许发布' : '门禁状态: 触发碰撞拦截！'}
                </div>
                <p className="text-[11px] leading-relaxed opacity-90">
                  {collisionResult.message}
                </p>
              </div>

              {/* 与库内既有技能相似度排行 */}
              <div>
                <span className="text-[11px] text-slate-400 font-medium block mb-2">
                  与库内实体余弦相似度排查 (Top Similarity):
                </span>

                {similarityRank.length === 0 ? (
                  <div className="text-center py-6 text-xs text-slate-500">
                    填写左侧技能信息后自动展开相似度分析
                  </div>
                ) : (
                  <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                    {similarityRank.slice(0, 5).map(({ skill, sim }) => {
                      const isCollision = sim >= 0.90;
                      return (
                        <div
                          key={skill.skill_id}
                          className={`p-2.5 rounded-lg border text-xs flex items-center justify-between gap-3 ${
                            isCollision
                              ? 'bg-rose-950/20 border-rose-800/60'
                              : 'bg-slate-950/50 border-slate-800/70'
                          }`}
                        >
                          <div>
                            <div className="font-semibold text-slate-200 font-mono flex items-center gap-2">
                              {skill.name}
                              {isCollision && (
                                <span className="text-[10px] text-rose-400 border border-rose-800 px-1.5 py-0.2 rounded font-sans">
                                  碰撞排他预警
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-slate-400 line-clamp-1 mt-0.5">
                              {skill.description}
                            </div>
                          </div>

                          <div className="text-right shrink-0">
                            <span
                              className={`font-mono font-bold tabular-nums text-xs ${
                                isCollision
                                  ? 'text-rose-400'
                                  : sim > 0.5
                                  ? 'text-amber-400'
                                  : 'text-slate-400'
                              }`}
                            >
                              {(sim * 100).toFixed(1)}%
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {/* 库内现有技能管理与删除档案列表 */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4">
          <div>
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <Layers className="w-4 h-4 text-sky-400" />
              已注册技能库档案 ({skills.length} 项)
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              💡 技能管理与安全删除：点击每行右侧「删除」按钮可即时下线并移除技能
            </p>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-64">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={tableSearch}
                onChange={(e) => setTableSearch(e.target.value)}
                placeholder="搜索技能名称或描述..."
                className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500"
              />
            </div>
            {onRestoreAllSkills && (
              <button
                type="button"
                onClick={onRestoreAllSkills}
                title="恢复全套 24+ 预置样本技能"
                className="px-2.5 py-1.5 text-xs text-slate-300 hover:text-white bg-slate-800 border border-slate-700 rounded-lg transition-colors whitespace-nowrap cursor-pointer"
              >
                恢复全套样本
              </button>
            )}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-950 text-slate-400 border-b border-slate-800">
              <tr>
                <th className="py-2.5 px-3 font-semibold">技能标识与生态</th>
                <th className="py-2.5 px-3 font-semibold">中文名称</th>
                <th className="py-2.5 px-3 font-semibold">功能簇</th>
                <th className="py-2.5 px-3 font-semibold">消歧专有属性</th>
                <th className="py-2.5 px-3 font-semibold text-right">调用/报错</th>
                <th className="py-2.5 px-3 font-semibold text-right">管理操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {filteredArchive.map((s) => {
                const ecoTag =
                  s.ecosystem === 'openai'
                    ? { label: 'OpenAI', cls: 'bg-emerald-950/60 text-emerald-400 border-emerald-800/60' }
                    : s.ecosystem === 'claude'
                    ? { label: 'Claude', cls: 'bg-amber-950/60 text-amber-400 border-amber-800/60' }
                    : s.ecosystem === 'deepseek'
                    ? { label: 'DeepSeek', cls: 'bg-blue-950/60 text-blue-400 border-blue-800/60' }
                    : { label: 'Enterprise', cls: 'bg-indigo-950/60 text-indigo-400 border-indigo-800/60' };

                return (
                  <tr key={s.skill_id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="py-2.5 px-3">
                      <div className="flex items-center gap-1.5">
                        <span className={`text-[10px] font-mono px-1 py-0.2 rounded border ${ecoTag.cls}`}>
                          {ecoTag.label}
                        </span>
                        <span className="font-mono font-semibold text-indigo-300">
                          {s.name}
                        </span>
                      </div>
                    </td>
                    <td className="py-2.5 px-3 text-slate-200 font-medium">
                      {s.display_name || s.name}
                    </td>
                    <td className="py-2.5 px-3 text-slate-300">
                      {s.clusters.join(' · ')}
                    </td>
                    <td className="py-2.5 px-3 text-slate-400 max-w-xs truncate">
                      {s.disambiguation_features || '-'}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-300">
                      {s.call_count} / {s.error_count}
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <button
                        type="button"
                        onClick={() =>
                          setDeleteConfirmSkill({
                            id: s.skill_id,
                            name: s.display_name || s.name,
                          })
                        }
                        className="px-2 py-1 rounded bg-rose-950/40 hover:bg-rose-900/60 border border-rose-800/60 text-rose-300 hover:text-white transition-colors flex items-center gap-1 ml-auto cursor-pointer"
                        title="删除该技能"
                      >
                        <Trash2 className="w-3 h-3 text-rose-400" />
                        <span>删除</span>
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* 技能删除确认弹窗 */}
      {deleteConfirmSkill && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl animate-in fade-in">
            <div className="w-10 h-10 rounded-full bg-rose-950/80 border border-rose-800/80 flex items-center justify-center text-rose-400 mb-3">
              <Trash2 className="w-5 h-5" />
            </div>
            <h4 className="text-base font-bold text-white">确认下线并删除此技能？</h4>
            <p className="text-xs text-slate-300 mt-2 leading-relaxed">
              确定要从当前系统两阶段路由索引库中移除技能{' '}
              <strong className="text-white font-mono bg-slate-800 px-1.5 py-0.5 rounded">
                [{deleteConfirmSkill.name}]
              </strong>{' '}
              吗？删除后此技能将不再参与意图分发或任务编排。
            </p>
            <div className="mt-5 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setDeleteConfirmSkill(null)}
                className="px-3.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition-colors cursor-pointer"
              >
                取消
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="px-4 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold transition-colors cursor-pointer shadow-md"
              >
                确认删除
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 生态技能库扩充接入弹窗 */}
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
