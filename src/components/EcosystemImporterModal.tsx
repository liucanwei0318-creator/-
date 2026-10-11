import React, { useState, useMemo } from 'react';
import { Skill } from '../types/agent';
import { getEcosystemBundles, INITIAL_SKILLS } from '../data/defaultSkills';
import {
  Download,
  CheckCircle2,
  Sparkles,
  Bot,
  Brain,
  Cpu,
  Building,
  Layers,
  X,
  Plus,
  ArrowRight,
  ShieldCheck,
  Check,
  RotateCcw,
  Search,
  Award,
  Zap,
} from 'lucide-react';

interface EcosystemImporterModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentSkills: Skill[];
  onImportSkills: (newSkills: Skill[]) => void;
  onRestoreAllSkills?: () => void;
}

export const EcosystemImporterModal: React.FC<EcosystemImporterModalProps> = ({
  isOpen,
  onClose,
  currentSkills,
  onImportSkills,
  onRestoreAllSkills,
}) => {
  const [selectedBundleId, setSelectedBundleId] = useState<
    'all' | 'openai' | 'claude' | 'qwen' | 'deepseek' | 'business'
  >('openai');
  const [searchFilter, setSearchFilter] = useState('');
  const [selectedSkillIds, setSelectedSkillIds] = useState<Set<string>>(new Set());
  const [importedNotice, setImportedNotice] = useState<string | null>(null);

  if (!isOpen) return null;

  const bundles = getEcosystemBundles();
  const currentSkillIds = new Set(currentSkills.map((s) => s.skill_id));

  // 当前所选包中的技能
  const activeBundle = bundles.find((b) => b.id === selectedBundleId);
  const rawDisplayedSkills =
    selectedBundleId === 'all'
      ? INITIAL_SKILLS
      : activeBundle
      ? activeBundle.skills
      : INITIAL_SKILLS;

  // 关键词过滤
  const displayedSkills = rawDisplayedSkills.filter((s) => {
    if (!searchFilter.trim()) return true;
    const q = searchFilter.toLowerCase().trim();
    return (
      s.name.toLowerCase().includes(q) ||
      (s.display_name && s.display_name.toLowerCase().includes(q)) ||
      s.description.toLowerCase().includes(q) ||
      s.clusters.some((c) => c.toLowerCase().includes(q))
    );
  });

  // 计算所选包中有多少项是库中尚未存在的
  const newSkillsInBundle = displayedSkills.filter((s) => !currentSkillIds.has(s.skill_id));

  // 批量导入当前分类的所有新技能
  const handleImportBundle = (skillsToImport: Skill[]) => {
    const toAdd = skillsToImport.filter((s) => !currentSkillIds.has(s.skill_id));
    if (toAdd.length === 0) {
      setImportedNotice('所选分类中的技能已全部存在于库中，无需重复导入！');
      setTimeout(() => setImportedNotice(null), 3000);
      return;
    }
    onImportSkills(toAdd);
    setImportedNotice(`已成功接入并导入 ${toAdd.length} 项全新生态技能！`);
    setTimeout(() => setImportedNotice(null), 3500);
  };

  // 勾选操作：切换单个选择
  const toggleSelect = (skillId: string) => {
    setSelectedSkillIds((prev) => {
      const next = new Set(prev);
      if (next.has(skillId)) {
        next.delete(skillId);
      } else {
        next.add(skillId);
      }
      return next;
    });
  };

  // 全选当前分类未添加技能
  const handleSelectAllUninstalled = () => {
    const uninstalledIds = displayedSkills
      .filter((s) => !currentSkillIds.has(s.skill_id))
      .map((s) => s.skill_id);
    setSelectedSkillIds(new Set(uninstalledIds));
  };

  // 批量导入自主勾选的技能
  const handleImportSelected = () => {
    const toAdd = INITIAL_SKILLS.filter(
      (s) => selectedSkillIds.has(s.skill_id) && !currentSkillIds.has(s.skill_id)
    );
    if (toAdd.length === 0) {
      setImportedNotice('请先勾选尚未加入工作台的技能！');
      setTimeout(() => setImportedNotice(null), 3000);
      return;
    }
    onImportSkills(toAdd);
    setImportedNotice(`已成功将自主勾选的 ${toAdd.length} 项生态技能添加至工作台！`);
    setSelectedSkillIds(new Set());
    setTimeout(() => setImportedNotice(null), 3500);
  };

  // 导入单个技能
  const handleImportSingle = (skill: Skill) => {
    if (currentSkillIds.has(skill.skill_id)) return;
    onImportSkills([skill]);
    setImportedNotice(`已成功添加技能 [${skill.display_name || skill.name}]！`);
    setTimeout(() => setImportedNotice(null), 3000);
  };

  // 一键恢复全部 79 项预置生态技能
  const handleRestoreFullLibrary = () => {
    if (onRestoreAllSkills) {
      onRestoreAllSkills();
    } else {
      const missing = INITIAL_SKILLS.filter((s) => !currentSkillIds.has(s.skill_id));
      if (missing.length > 0) {
        onImportSkills(missing);
      }
    }
    setImportedNotice(`已恢复并接入全部 ${INITIAL_SKILLS.length} 项 OpenAI / Claude / Qwen / DeepSeek 及业务生态技能！`);
    setTimeout(() => setImportedNotice(null), 3500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-5xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
        {/* 弹窗顶栏 */}
        <div className="px-6 py-4 border-b border-slate-800 bg-slate-950 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-600/20 border border-indigo-500/40 flex items-center justify-center text-indigo-400">
              <Sparkles className="w-5 h-5 text-indigo-300" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                主流大模型生态技能库接入器 (Ecosystem Skills Importer)
                <span className="text-[11px] font-normal px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  OpenAI · Claude · Qwen · DeepSeek ({INITIAL_SKILLS.length}项)
                </span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                支持<strong>自主勾选选择添加</strong>或<strong>一键接入生态包</strong>，扩展智能体调度样本库
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 提示通知 */}
        {importedNotice && (
          <div className="px-6 py-2.5 bg-emerald-950/80 border-b border-emerald-800/60 text-xs text-emerald-200 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{importedNotice}</span>
            </div>
          </div>
        )}

        {/* 快速分类标签选择 */}
        <div className="px-6 py-3 border-b border-slate-800 bg-slate-900/60 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setSelectedBundleId('openai')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
                selectedBundleId === 'openai'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700'
              }`}
            >
              <Bot className="w-3.5 h-3.5" />
              OpenAI 生态库 ({INITIAL_SKILLS.filter((s) => s.ecosystem === 'openai').length})
            </button>

            <button
              onClick={() => setSelectedBundleId('claude')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
                selectedBundleId === 'claude'
                  ? 'bg-amber-600 text-white shadow-sm'
                  : 'bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700'
              }`}
            >
              <Brain className="w-3.5 h-3.5" />
              Claude 深度库 ({INITIAL_SKILLS.filter((s) => s.ecosystem === 'claude').length})
            </button>

            <button
              onClick={() => setSelectedBundleId('qwen')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
                selectedBundleId === 'qwen'
                  ? 'bg-purple-600 text-white shadow-sm'
                  : 'bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-purple-300" />
              Qwen 通义千问 ({INITIAL_SKILLS.filter((s) => s.ecosystem === 'qwen').length})
            </button>

            <button
              onClick={() => setSelectedBundleId('deepseek')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
                selectedBundleId === 'deepseek'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700'
              }`}
            >
              <Cpu className="w-3.5 h-3.5" />
              DeepSeek 推理库 ({INITIAL_SKILLS.filter((s) => s.ecosystem === 'deepseek').length})
            </button>

            <button
              onClick={() => setSelectedBundleId('business')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
                selectedBundleId === 'business'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700'
              }`}
            >
              <Building className="w-3.5 h-3.5" />
              商业与办公库 ({INITIAL_SKILLS.filter((s) => s.ecosystem === 'business').length})
            </button>

            <button
              onClick={() => setSelectedBundleId('all')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
                selectedBundleId === 'all'
                  ? 'bg-slate-700 text-white shadow-sm'
                  : 'bg-slate-800/60 text-slate-400 hover:text-white hover:bg-slate-700'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              全景样本 ({INITIAL_SKILLS.length})
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => handleImportBundle(displayedSkills)}
              disabled={newSkillsInBundle.length === 0}
              className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-500 text-white text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              一键导入该生态 ({newSkillsInBundle.length} 项)
            </button>

            <button
              onClick={handleRestoreFullLibrary}
              title="载入全部 79 项大模型预置生态技能"
              className="px-3 py-1.5 rounded-lg bg-indigo-950 hover:bg-indigo-900 border border-indigo-800 text-indigo-300 text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              一键接入全部 79 项
            </button>
          </div>
        </div>

        {/* 搜索与自主多选控制栏 */}
        <div className="px-6 py-2.5 bg-slate-950 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-1.5 cursor-pointer text-slate-300 hover:text-white">
              <input
                type="checkbox"
                checked={
                  newSkillsInBundle.length > 0 &&
                  newSkillsInBundle.every((s) => selectedSkillIds.has(s.skill_id))
                }
                onChange={(e) => {
                  if (e.target.checked) {
                    handleSelectAllUninstalled();
                  } else {
                    setSelectedSkillIds(new Set());
                  }
                }}
                className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-700 bg-slate-900"
              />
              <span>全选待接入项</span>
            </label>

            <span className="text-slate-600">|</span>

            <span className="text-slate-400">
              已勾选: <strong className="text-sky-400 font-mono">{selectedSkillIds.size}</strong> 项
            </span>
          </div>

          <div className="flex items-center gap-2 flex-1 max-w-sm justify-end">
            <div className="relative w-full max-w-xs">
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                placeholder="筛选名称、领域或槽位..."
                className="w-full pl-8 pr-3 py-1 bg-slate-900 border border-slate-800 rounded-lg text-white text-xs placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              />
            </div>

            <button
              onClick={handleImportSelected}
              disabled={selectedSkillIds.size === 0}
              className="px-3 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-xs font-semibold whitespace-nowrap cursor-pointer transition-colors"
            >
              添加勾选项 ({selectedSkillIds.size})
            </button>
          </div>
        </div>

        {/* 技能卡片列表展示区 */}
        <div className="p-6 overflow-y-auto space-y-3.5 flex-1 max-h-[60vh]">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {displayedSkills.map((skill) => {
              const isAlreadyLoaded = currentSkillIds.has(skill.skill_id);
              const isSelected = selectedSkillIds.has(skill.skill_id);

              const badgeStyle =
                skill.ecosystem === 'openai'
                  ? 'text-emerald-400 border-emerald-800/60 bg-emerald-950/30'
                  : skill.ecosystem === 'claude'
                  ? 'text-amber-400 border-amber-800/60 bg-amber-950/30'
                  : skill.ecosystem === 'qwen'
                  ? 'text-purple-400 border-purple-800/60 bg-purple-950/30'
                  : skill.ecosystem === 'deepseek'
                  ? 'text-blue-400 border-blue-800/60 bg-blue-950/30'
                  : 'text-indigo-400 border-indigo-800/60 bg-indigo-950/30';

              const ecoName =
                skill.ecosystem === 'openai'
                  ? 'OpenAI'
                  : skill.ecosystem === 'claude'
                  ? 'Claude'
                  : skill.ecosystem === 'qwen'
                  ? 'Qwen'
                  : skill.ecosystem === 'deepseek'
                  ? 'DeepSeek'
                  : 'Enterprise';

              return (
                <div
                  key={skill.skill_id}
                  className={`p-3.5 rounded-xl border transition-all flex flex-col justify-between ${
                    isSelected
                      ? 'ring-2 ring-indigo-500 bg-slate-900 border-indigo-500/80 shadow-md'
                      : isAlreadyLoaded
                      ? 'bg-slate-950/50 border-slate-800/80 opacity-75'
                      : 'bg-slate-900/90 border-slate-700/80 hover:border-slate-600 shadow-sm'
                  }`}
                >
                  <div>
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2">
                        {!isAlreadyLoaded ? (
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelect(skill.skill_id)}
                            className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-700 bg-slate-800 cursor-pointer shrink-0 mt-0.5"
                          />
                        ) : null}
                        <div>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span
                              className={`text-[10px] font-mono px-1.5 py-0.2 rounded border ${badgeStyle}`}
                            >
                              {ecoName}
                            </span>
                            <span className="font-bold text-xs text-white">
                              {skill.display_name || skill.name}
                            </span>
                          </div>
                          <span className="text-[10px] font-mono text-slate-400 block mt-0.5">
                            {skill.name}
                          </span>
                        </div>
                      </div>

                      {isAlreadyLoaded ? (
                        <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-slate-800 text-slate-400 border border-slate-700 flex items-center gap-1 shrink-0">
                          <Check className="w-3 h-3 text-emerald-400" />
                          已在库中
                        </span>
                      ) : (
                        <button
                          onClick={() => handleImportSingle(skill)}
                          className="px-2 py-0.5 rounded bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] font-semibold flex items-center gap-1 transition-colors shrink-0 cursor-pointer shadow-sm"
                        >
                          <Plus className="w-3 h-3" />
                          接入
                        </button>
                      )}
                    </div>

                    <p className="text-[11px] text-slate-300 leading-relaxed line-clamp-2 mb-2">
                      {skill.description}
                    </p>
                  </div>

                  <div className="space-y-1 text-[10px] text-slate-400 border-t border-slate-800/80 pt-2 mt-1">
                    <div className="flex items-center gap-1">
                      <span className="text-slate-500">双轴特征:</span>
                      <span className="text-sky-300">{skill.content_domain || '通用内容'}</span>
                      <span className="text-slate-600">·</span>
                      <span className="text-indigo-300">{skill.tool_carrier || '通用工具'}</span>
                    </div>
                    <div className="flex items-start gap-1">
                      <span className="text-slate-500 shrink-0">槽位:</span>
                      <span className="font-mono text-slate-300 truncate">
                        {skill.required_slots.join(', ')}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 弹窗底栏 */}
        <div className="px-6 py-3.5 border-t border-slate-800 bg-slate-950 flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>
              当前工作台技能总量: <strong className="text-white font-mono">{currentSkills.length}</strong> 项
              (四大模型数据库总量: <strong className="text-sky-400 font-mono">{INITIAL_SKILLS.length}</strong> 项)
            </span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium transition-colors"
          >
            完成并关闭
          </button>
        </div>
      </div>
    </div>
  );
};
