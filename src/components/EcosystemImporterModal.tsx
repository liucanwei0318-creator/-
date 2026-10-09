import React, { useState } from 'react';
import { Skill } from '../types/agent';
import { getEcosystemBundles, EcosystemBundle, INITIAL_SKILLS } from '../data/defaultSkills';
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
    'all' | 'openai' | 'claude' | 'deepseek' | 'business'
  >('openai');
  const [importedNotice, setImportedNotice] = useState<string | null>(null);

  if (!isOpen) return null;

  const bundles = getEcosystemBundles();
  const currentSkillIds = new Set(currentSkills.map((s) => s.skill_id));

  // 当前所选包中的技能
  const activeBundle = bundles.find((b) => b.id === selectedBundleId);
  const displayedSkills =
    selectedBundleId === 'all'
      ? INITIAL_SKILLS
      : activeBundle
      ? activeBundle.skills
      : INITIAL_SKILLS;

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

  // 导入单个技能
  const handleImportSingle = (skill: Skill) => {
    if (currentSkillIds.has(skill.skill_id)) return;
    onImportSkills([skill]);
    setImportedNotice(`已成功添加技能 [${skill.display_name || skill.name}]！`);
    setTimeout(() => setImportedNotice(null), 3000);
  };

  // 一键恢复全部 24+ 预置生态技能
  const handleRestoreFullLibrary = () => {
    if (onRestoreAllSkills) {
      onRestoreAllSkills();
    } else {
      const missing = INITIAL_SKILLS.filter((s) => !currentSkillIds.has(s.skill_id));
      if (missing.length > 0) {
        onImportSkills(missing);
      }
    }
    setImportedNotice(`已恢复并接入全部 ${INITIAL_SKILLS.length} 项 OpenAI / Claude / DeepSeek 及业务生态技能！`);
    setTimeout(() => setImportedNotice(null), 3500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
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
                  OpenAI · Claude · DeepSeek
                </span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                扩充技能样本库：一键接入业界标杆智能体工具，支持单项挑选与整套生态包极速导入
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
              Claude 生态库 ({INITIAL_SKILLS.filter((s) => s.ecosystem === 'claude').length})
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
              一键导入该生态 ({newSkillsInBundle.length} 项待导入)
            </button>

            <button
              onClick={handleRestoreFullLibrary}
              title="载入全部 24+ 预置生态技能，大幅扩大测试样本"
              className="px-3 py-1.5 rounded-lg bg-indigo-950 hover:bg-indigo-900 border border-indigo-800 text-indigo-300 text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              一键接入全部大模型技能
            </button>
          </div>
        </div>

        {/* 技能卡片列表展示区 */}
        <div className="p-6 overflow-y-auto space-y-3.5 flex-1 max-h-[60vh]">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {displayedSkills.map((skill) => {
              const isAlreadyLoaded = currentSkillIds.has(skill.skill_id);
              const badgeStyle =
                skill.ecosystem === 'openai'
                  ? 'text-emerald-400 border-emerald-800/60 bg-emerald-950/30'
                  : skill.ecosystem === 'claude'
                  ? 'text-amber-400 border-amber-800/60 bg-amber-950/30'
                  : skill.ecosystem === 'deepseek'
                  ? 'text-blue-400 border-blue-800/60 bg-blue-950/30'
                  : 'text-indigo-400 border-indigo-800/60 bg-indigo-950/30';

              const ecoName =
                skill.ecosystem === 'openai'
                  ? 'OpenAI'
                  : skill.ecosystem === 'claude'
                  ? 'Claude'
                  : skill.ecosystem === 'deepseek'
                  ? 'DeepSeek'
                  : 'Enterprise';

              return (
                <div
                  key={skill.skill_id}
                  className={`p-4 rounded-xl border transition-all ${
                    isAlreadyLoaded
                      ? 'bg-slate-950/50 border-slate-800/80 opacity-80'
                      : 'bg-slate-900/90 border-slate-700/80 hover:border-slate-600 shadow-sm'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${badgeStyle}`}
                        >
                          {ecoName}
                        </span>
                        <span className="font-bold text-sm text-white">
                          {skill.display_name || skill.name}
                        </span>
                      </div>
                      <span className="text-[11px] font-mono text-slate-400 block mt-0.5">
                        {skill.name}
                      </span>
                    </div>

                    {isAlreadyLoaded ? (
                      <span className="px-2 py-1 rounded text-[11px] font-medium bg-slate-800 text-slate-400 border border-slate-700 flex items-center gap-1 shrink-0">
                        <Check className="w-3 h-3 text-emerald-400" />
                        已在库中
                      </span>
                    ) : (
                      <button
                        onClick={() => handleImportSingle(skill)}
                        className="px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center gap-1 transition-colors shrink-0 cursor-pointer shadow-sm"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        接入此技能
                      </button>
                    )}
                  </div>

                  <p className="text-xs text-slate-300 leading-relaxed line-clamp-2 mb-2.5">
                    {skill.description}
                  </p>

                  <div className="space-y-1 text-[11px] text-slate-400 border-t border-slate-800/80 pt-2">
                    <div className="flex items-center gap-1.5">
                      <span className="text-slate-500">双轴特征:</span>
                      <span className="text-sky-300">{skill.content_domain || '通用内容'}</span>
                      <span className="text-slate-600">·</span>
                      <span className="text-indigo-300">{skill.tool_carrier || '通用工具'}</span>
                    </div>
                    <div className="flex items-start gap-1.5">
                      <span className="text-slate-500 shrink-0">参数槽位:</span>
                      <span className="font-mono text-slate-300 truncate">
                        {skill.required_slots.join(', ')}
                      </span>
                    </div>
                    {skill.disambiguation_features && (
                      <div className="text-[10px] text-emerald-400/90 truncate">
                        消歧: {skill.disambiguation_features}
                      </div>
                    )}
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
              (样本库最大容量: <strong className="text-sky-400 font-mono">{INITIAL_SKILLS.length}+</strong> 项)
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
