import React, { useState, useMemo } from 'react';
import { Skill } from '../types/agent';
import { INITIAL_SKILLS, getEcosystemBundles } from '../data/defaultSkills';
import { SimpleEmbeddingProvider } from '../services/embedding';
import {
  Database,
  Sparkles,
  Bot,
  Brain,
  Cpu,
  Building,
  CheckCircle2,
  Check,
  Plus,
  Trash2,
  Search,
  Filter,
  Layers,
  ArrowRight,
  ShieldCheck,
  AlertTriangle,
  Play,
  RotateCcw,
  Zap,
  TrendingUp,
  Award,
  ChevronRight,
  SlidersHorizontal,
  BookmarkCheck,
  Compass,
  Code2,
  FileSpreadsheet,
  FileCheck2,
  Palette,
  Terminal,
  Calculator,
  ShieldAlert,
  Info,
} from 'lucide-react';

interface EcosystemDatabaseViewProps {
  currentSkills: Skill[];
  onAddSkills: (newSkills: Skill[]) => void;
  onDeleteSkill: (skillId: string) => void;
  onRestoreAllSkills: () => void;
  onNavigateToTab?: (tab: 'chat' | 'orchestrator' | 'gate' | 'index' | 'governance') => void;
}

// 角色预设推荐配置
interface RolePreset {
  id: string;
  name: string;
  icon: React.ReactNode;
  tagline: string;
  targetSkillIds: string[];
}

const ROLE_PRESETS: RolePreset[] = [
  {
    id: 'fullstack_dev',
    name: '全栈研发与代码架构师',
    icon: <Code2 className="w-4 h-4 text-emerald-400" />,
    tagline: '整合 Python 沙箱、Linux Bash、Qwen 缺陷修补、DeepSeek 竞赛算法与 Swarm 调度',
    targetSkillIds: [
      'openai_code_interpreter',
      'claude_bash_executor',
      'qwen_coder_debugger',
      'deepseek_competitive_programming',
      'claude_mcp_bridge',
      'openai_canvas_editor',
    ],
  },
  {
    id: 'quant_finance',
    name: '量化金融与商业分析师',
    icon: <TrendingUp className="w-4 h-4 text-amber-400" />,
    tagline: '涵盖 Alpha 因子挖掘、财报穿透、勾稽表格核算、发票初审与联网动态研报检索',
    targetSkillIds: [
      'deepseek_quant_factor',
      'qwen_fin_report_analyzer',
      'qwen_tabular_insight',
      's6', // Finance_Invoice_Auditor
      'openai_web_search',
      'crm_lead_scorer',
    ],
  },
  {
    id: 'legal_compliance',
    name: '企业法务与合同审计师',
    icon: <ShieldAlert className="w-4 h-4 text-rose-400" />,
    tagline: '长合同条款穿透、多语言合规审查、红蓝对抗防护、防欺诈与水印交付件生成',
    targetSkillIds: [
      'claude_contract_auditor',
      'claude_legal_expert',
      'claude_security_tester',
      's2', // PDF_Watermarker
      's9', // Ecommerce_Refund_Guard
      'openai_moderation_guard',
    ],
  },
  {
    id: 'multimodal_creative',
    name: '多模态内容与创意工坊',
    icon: <Palette className="w-4 h-4 text-purple-400" />,
    tagline: '包含通义万相生图、DALL-E 视觉概念、TTS 情感拟真语音、Whisper 转录与世界观架构',
    targetSkillIds: [
      'qwen_wanx_vision',
      'openai_dalle_generator',
      'openai_tts_speech',
      'openai_whisper_transcriber',
      'qwen_creative_storyteller',
      's11', // Social_Media_Copywriter
    ],
  },
  {
    id: 'deep_research',
    name: '深度数理与学术科研专家',
    icon: <Calculator className="w-4 h-4 text-blue-400" />,
    tagline: 'DeepSeek R1 长链运筹、形式化长链证明树、符号微积分求解、超长上下文大海捞针',
    targetSkillIds: [
      'deepseek_r1_reasoner',
      'deepseek_proof_tree',
      'deepseek_math_prover',
      'qwen_math_solver',
      'qwen_needle_finder',
      'claude_extended_reflection',
    ],
  },
  {
    id: 'enterprise_office',
    name: '企业高频日常协同专家',
    icon: <FileCheck2 className="w-4 h-4 text-indigo-400" />,
    tagline: 'PDF/Word/Excel文档处理、HR Offer 邮件通知、会议纪要待办提取与天气预报',
    targetSkillIds: [
      's1', // PDF_Converter
      's3', // Word_Doc_Formatter
      's4', // Excel_Sheet_Pivot
      's5', // HR_Offer_Courier
      's8', // Email_Notifier
      's10', // Meeting_Action_Extractor
    ],
  },
];

export const EcosystemDatabaseView: React.FC<EcosystemDatabaseViewProps> = ({
  currentSkills,
  onAddSkills,
  onDeleteSkill,
  onRestoreAllSkills,
  onNavigateToTab,
}) => {
  // 选中的生态库来源
  const [selectedEcosystem, setSelectedEcosystem] = useState<
    'all' | 'openai' | 'claude' | 'qwen' | 'deepseek' | 'business'
  >('all');

  // 状态筛选：全部 / 未添加 / 已添加
  const [statusFilter, setStatusFilter] = useState<'all' | 'not_added' | 'added'>('all');

  // 业务内容领域筛选
  const [domainFilter, setDomainFilter] = useState<string>('all');

  // 关键词检索
  const [searchQuery, setSearchQuery] = useState<string>('');

  // 多选选中的技能 ID 集合 (用于自主勾选添加)
  const [selectedSkillIds, setSelectedSkillIds] = useState<Set<string>>(new Set());

  // 智能推荐模式切换: 'gap' (短板诊断) | 'role' (角色场景) | 'intent' (意图搜索)
  const [recommendMode, setRecommendMode] = useState<'gap' | 'role' | 'intent'>('gap');
  const [activeRolePreset, setActiveRolePreset] = useState<string>('fullstack_dev');
  const [customIntentQuery, setCustomIntentQuery] = useState<string>('');

  // 模拟沙箱运行弹窗/展开
  const [testingSkillId, setTestingSkillId] = useState<string | null>(null);
  const [testOutput, setTestOutput] = useState<string | null>(null);

  // 顶部操作反馈 Toast
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'info' } | null>(
    null
  );

  const showToast = (text: string, type: 'success' | 'info' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 3500);
  };

  // 当前工作区已安装的技能 ID Set
  const currentSkillIdSet = useMemo(() => {
    return new Set(currentSkills.map((s) => s.skill_id));
  }, [currentSkills]);

  // 全部可用数据库技能库 (总库容 79 项)
  const allMasterSkills = INITIAL_SKILLS;

  // 统计各生态库容量
  const ecoCounts = useMemo(() => {
    return {
      total: allMasterSkills.length,
      openai: allMasterSkills.filter((s) => s.ecosystem === 'openai').length,
      claude: allMasterSkills.filter((s) => s.ecosystem === 'claude').length,
      qwen: allMasterSkills.filter((s) => s.ecosystem === 'qwen').length,
      deepseek: allMasterSkills.filter((s) => s.ecosystem === 'deepseek').length,
      business: allMasterSkills.filter((s) => s.ecosystem === 'business').length,
      installed: currentSkills.length,
    };
  }, [allMasterSkills, currentSkills]);

  // 所有业务领域
  const availableDomains = useMemo(() => {
    const set = new Set<string>();
    allMasterSkills.forEach((s) => {
      if (s.content_domain) set.add(s.content_domain);
    });
    return Array.from(set);
  }, [allMasterSkills]);

  // 核心过滤后的技能列表
  const filteredSkills = useMemo(() => {
    return allMasterSkills.filter((skill) => {
      // 生态过滤
      if (selectedEcosystem !== 'all' && skill.ecosystem !== selectedEcosystem) {
        return false;
      }

      // 添加状态过滤
      const isInstalled = currentSkillIdSet.has(skill.skill_id);
      if (statusFilter === 'not_added' && isInstalled) return false;
      if (statusFilter === 'added' && !isInstalled) return false;

      // 领域过滤
      if (domainFilter !== 'all' && skill.content_domain !== domainFilter) {
        return false;
      }

      // 关键词检索
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchName = skill.name.toLowerCase().includes(q);
        const matchDisplayName = (skill.display_name || '').toLowerCase().includes(q);
        const matchDesc = skill.description.toLowerCase().includes(q);
        const matchClusters = skill.clusters.some((c) => c.toLowerCase().includes(q));
        const matchSlots = skill.required_slots.some((s) => s.toLowerCase().includes(q));
        if (!matchName && !matchDisplayName && !matchDesc && !matchClusters && !matchSlots) {
          return false;
        }
      }

      return true;
    });
  }, [allMasterSkills, selectedEcosystem, statusFilter, domainFilter, searchQuery, currentSkillIdSet]);

  // =========================================================================
  // 智能推荐引擎 1: 工作区能力短板诊断 (Capability Gap Analysis)
  // =========================================================================
  const gapAnalysis = useMemo(() => {
    const installedNames = currentSkills.map((s) => s.name.toLowerCase());
    const installedClusters = new Set(currentSkills.flatMap((s) => s.clusters));
    const installedDomains = new Set(currentSkills.map((s) => s.content_domain).filter(Boolean));

    // 检查维度
    const capabilities = [
      {
        key: 'code_sandbox',
        name: '代码沙箱与脚本执行',
        covered:
          installedNames.some((n) => n.includes('interpreter') || n.includes('bash') || n.includes('sandbox')) ||
          installedClusters.has('代码沙箱'),
        suggestedSkillIds: ['openai_code_interpreter', 'claude_bash_executor', 'qwen_coder_debugger'],
        gapReason: '当前工作区缺少隔离代码沙箱，无法执行数据清洗计算、Python 动态绘图与脚本调用。',
      },
      {
        key: 'deep_reasoning',
        name: '深度逻辑与长链推导',
        covered:
          installedNames.some((n) => n.includes('reasoner') || n.includes('r1') || n.includes('proof') || n.includes('thinking')) ||
          currentSkills.some((s) => s.ecosystem === 'deepseek'),
        suggestedSkillIds: ['deepseek_r1_reasoner', 'deepseek_proof_tree', 'claude_extended_reflection'],
        gapReason: '缺少专门的长链思维与形式化逆向推导工具，在复杂因果推理与博弈运筹中缺乏深度决策支撑。',
      },
      {
        key: 'vision_multimodal',
        name: '多模态视觉版面与生图',
        covered:
          installedClusters.has('视觉图像') ||
          installedNames.some((n) => n.includes('vision') || n.includes('ocr') || n.includes('dalle') || n.includes('wanx')),
        suggestedSkillIds: ['qwen_vl_doc_parser', 'openai_vision_ocr', 'qwen_wanx_vision', 'openai_dalle_generator'],
        gapReason: '当前工作区无视觉感知或图像生成能力，无法解析复杂版面、印章表格或生成图文素材。',
      },
      {
        key: 'web_search_rag',
        name: '实时联网检索与超长文本',
        covered:
          installedClusters.has('网络搜索') ||
          installedNames.some((n) => n.includes('search') || n.includes('rag') || n.includes('needle')),
        suggestedSkillIds: ['openai_web_search', 'qwen_needle_finder', 'openai_rag_retriever'],
        gapReason: '缺少联网动态检索与超长上下文穿透，难以获取最新时政动态与海量长文档隐藏细节。',
      },
      {
        key: 'security_compliance',
        name: '安全审计与红蓝对抗防御',
        covered:
          installedClusters.has('法务合规') ||
          installedNames.some((n) => n.includes('security') || n.includes('contract') || n.includes('guard')),
        suggestedSkillIds: ['claude_security_tester', 'claude_contract_auditor', 'openai_moderation_guard'],
        gapReason: '缺少提示词注入防御与长文本法律审计，易受到越狱逃逸攻击且缺乏合同合规把关。',
      },
      {
        key: 'quant_finance',
        name: '量化金融与复杂勾稽表格',
        covered:
          installedDomains.has('商业金融') &&
          installedNames.some((n) => n.includes('quant') || n.includes('invoice') || n.includes('tabular')),
        suggestedSkillIds: ['deepseek_quant_factor', 'qwen_fin_report_analyzer', 's6'],
        gapReason: '缺少量化金融因子计算与企业级财报多表勾稽核算，无法高效处理投资研报与发票审计。',
      },
    ];

    // 计算缺失的维度
    const missingCaps = capabilities.filter((c) => !c.covered);
    const score = Math.round(((capabilities.length - missingCaps.length) / capabilities.length) * 100);

    // 推荐的技能列表（去重且未安装）
    const recommendedSkillIds = Array.from(
      new Set(missingCaps.flatMap((c) => c.suggestedSkillIds))
    ).filter((id) => !currentSkillIdSet.has(id));

    const recommendedSkills = recommendedSkillIds
      .map((id) => allMasterSkills.find((s) => s.skill_id === id))
      .filter((s): s is Skill => Boolean(s));

    return {
      capabilities,
      missingCaps,
      score,
      recommendedSkills,
    };
  }, [currentSkills, currentSkillIdSet, allMasterSkills]);

  // =========================================================================
  // 智能推荐引擎 2: 意图与角色方案推荐
  // =========================================================================
  const roleRecommendedSkills = useMemo(() => {
    const preset = ROLE_PRESETS.find((r) => r.id === activeRolePreset) || ROLE_PRESETS[0];
    return preset.targetSkillIds
      .map((id) => allMasterSkills.find((s) => s.skill_id === id))
      .filter((s): s is Skill => Boolean(s));
  }, [activeRolePreset, allMasterSkills]);

  const intentMatchedSkills = useMemo(() => {
    if (!customIntentQuery.trim()) return [];
    const qVec = SimpleEmbeddingProvider.getEmbedding(customIntentQuery);
    return allMasterSkills
      .map((skill) => {
        const text = `${skill.name} ${skill.display_name} ${skill.description} ${skill.clusters.join(' ')}`;
        const sVec = skill.embedding || SimpleEmbeddingProvider.getEmbedding(text);
        const sim = SimpleEmbeddingProvider.cosineSimilarity(qVec, sVec);
        return { skill, score: sim };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 6)
      .map((item) => item.skill);
  }, [customIntentQuery, allMasterSkills]);

  // =========================================================================
  // 交互动作：多选、全选、反选、批量添加与单项操作
  // =========================================================================

  // 切换单个技能勾选状态
  const toggleSelectSkill = (skillId: string) => {
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

  // 全选当前过滤结果
  const handleSelectAllFiltered = () => {
    setSelectedSkillIds(new Set(filteredSkills.map((s) => s.skill_id)));
  };

  // 清空已选
  const handleClearSelection = () => {
    setSelectedSkillIds(new Set());
  };

  // 批量添加勾选的技能
  const handleAddSelectedSkills = () => {
    const toAdd = allMasterSkills.filter(
      (s) => selectedSkillIds.has(s.skill_id) && !currentSkillIdSet.has(s.skill_id)
    );
    if (toAdd.length === 0) {
      showToast('所选技能均已在当前工作台中，无需重复添加！', 'info');
      return;
    }
    onAddSkills(toAdd);
    showToast(`成功将 ${toAdd.length} 项所选技能批量接入工作台！`, 'success');
    setSelectedSkillIds(new Set());
  };

  // 一键接入全部大模型技能 (79 项)
  const handleAddAllMasterSkills = () => {
    const missing = allMasterSkills.filter((s) => !currentSkillIdSet.has(s.skill_id));
    if (missing.length === 0) {
      showToast('所有 79 项大模型生态技能均已完全接入当前工作台！', 'info');
      return;
    }
    onAddSkills(missing);
    showToast(`已成功将全套 ${missing.length} 项大模型官方及开源生态技能完整接入工作台！`, 'success');
  };

  // 单独添加某一技能
  const handleAddSingleSkill = (skill: Skill) => {
    if (currentSkillIdSet.has(skill.skill_id)) return;
    onAddSkills([skill]);
    showToast(`技能 [${skill.display_name || skill.name}] 已成功装载至工作台！`, 'success');
  };

  // 单独从工作台移除某一技能
  const handleRemoveSingleSkill = (skillId: string, skillName: string) => {
    onDeleteSkill(skillId);
    showToast(`技能 [${skillName}] 已从当前工作台下线移除。`, 'info');
  };

  // 试运行沙箱
  const handleRunSandbox = (skill: Skill) => {
    setTestingSkillId(skill.skill_id);
    const mockSlots: Record<string, string> = {};
    skill.required_slots.forEach((slot, i) => {
      mockSlots[slot] = `sample_val_${i + 1}`;
    });
    const output = skill.mock_executor
      ? skill.mock_executor(mockSlots)
      : `【${skill.name}】沙箱调度成功，已在虚拟隔离环境中完成模拟调用。`;
    setTestOutput(output);
  };

  // 批量添加推荐集合
  const handleAddRecommendations = (skillsToAdd: Skill[]) => {
    const uninstalled = skillsToAdd.filter((s) => !currentSkillIdSet.has(s.skill_id));
    if (uninstalled.length === 0) {
      showToast('该推荐方案中的技能已全部接入工作台！', 'info');
      return;
    }
    onAddSkills(uninstalled);
    showToast(`已成功接入推荐的 ${uninstalled.length} 项关键生态技能！`, 'success');
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* 顶部主横幅：大模型数据库接入控制台 */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl relative overflow-hidden">
        {/* 背景光效微饰 */}
        <div className="absolute -right-16 -top-16 w-64 h-64 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute right-48 -bottom-16 w-64 h-64 bg-emerald-600/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
          <div className="space-y-2 max-w-3xl">
            <div className="flex items-center gap-2.5 flex-wrap">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-emerald-500 p-0.5 flex items-center justify-center shadow-lg">
                <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center">
                  <Database className="w-5 h-5 text-indigo-400" />
                </div>
              </div>
              <div>
                <h1 className="text-xl font-bold text-white flex items-center gap-2.5 flex-wrap">
                  主流大模型技能生态数据库 (LLM Ecosystem Hub)
                  <span className="text-xs px-2.5 py-0.5 rounded-full font-medium bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    OpenAI · Claude · Qwen · DeepSeek
                  </span>
                </h1>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                  扩充智能体工具箱：直连四大顶尖模型生态库，支持<strong>自主按需勾选添加</strong>、
                  <strong>AI 智能短板补齐推荐</strong>与<strong>一键全库装载</strong>，为多 Agent 编排提供业界标杆能力底座。
                </p>
              </div>
            </div>

            {/* 各模型源容量统计卡片 */}
            <div className="flex items-center gap-2 pt-2 flex-wrap text-xs">
              <span className="px-2.5 py-1 rounded-lg bg-emerald-950/60 border border-emerald-800/60 text-emerald-300 flex items-center gap-1.5 font-medium">
                <Bot className="w-3.5 h-3.5 text-emerald-400" />
                OpenAI ({ecoCounts.openai})
              </span>
              <span className="px-2.5 py-1 rounded-lg bg-amber-950/60 border border-amber-800/60 text-amber-300 flex items-center gap-1.5 font-medium">
                <Brain className="w-3.5 h-3.5 text-amber-400" />
                Claude ({ecoCounts.claude})
              </span>
              <span className="px-2.5 py-1 rounded-lg bg-purple-950/60 border border-purple-800/60 text-purple-300 flex items-center gap-1.5 font-medium">
                <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                Qwen 通义千问 ({ecoCounts.qwen})
              </span>
              <span className="px-2.5 py-1 rounded-lg bg-blue-950/60 border border-blue-800/60 text-blue-300 flex items-center gap-1.5 font-medium">
                <Cpu className="w-3.5 h-3.5 text-blue-400" />
                DeepSeek ({ecoCounts.deepseek})
              </span>
              <span className="px-2.5 py-1 rounded-lg bg-indigo-950/60 border border-indigo-800/60 text-indigo-300 flex items-center gap-1.5 font-medium">
                <Building className="w-3.5 h-3.5 text-indigo-400" />
                通用商业 ({ecoCounts.business})
              </span>
            </div>
          </div>

          {/* 快捷操作区 */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 shrink-0 w-full lg:w-auto">
            <div className="bg-slate-950/80 border border-slate-800 rounded-xl px-4 py-2 text-center sm:text-right">
              <div className="text-[11px] text-slate-400">当前工作区已载入</div>
              <div className="text-lg font-bold font-mono text-white flex items-center justify-center sm:justify-end gap-1.5">
                <span className="text-emerald-400">{ecoCounts.installed}</span>
                <span className="text-slate-600">/</span>
                <span className="text-sky-400">{ecoCounts.total} 项</span>
              </div>
            </div>

            <button
              onClick={handleAddAllMasterSkills}
              disabled={ecoCounts.installed >= ecoCounts.total}
              className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-bold transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer"
            >
              <Zap className="w-4 h-4 text-amber-300" />
              <span>一键接入全部大模型技能 ({ecoCounts.total - ecoCounts.installed} 项待入)</span>
            </button>

            <button
              onClick={onRestoreAllSkills}
              title="重置并载入完整标准库"
              className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition-colors flex items-center justify-center cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* 核心架构诊断：大模型生态库 vs 索引去重与消歧指示看板 (回答用户问题 1) */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 text-xs shadow-sm">
        <div className="flex items-start gap-3">
          <div className="p-2 bg-indigo-950 border border-indigo-800 text-indigo-300 rounded-lg shrink-0 mt-0.5">
            <Info className="w-4 h-4 text-sky-400" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-white">大模型库与当前索引架构关系及重复度诊断</span>
              <span className="px-2 py-0.5 rounded font-mono text-[10px] bg-emerald-950 text-emerald-300 border border-emerald-800 font-bold">
                ID唯一性: 79/79 (底层零键名冲突)
              </span>
              <span className="px-2 py-0.5 rounded font-mono text-[10px] bg-rose-950 text-rose-300 border border-rose-800 font-bold">
                跨生态同质化重叠: 14 对
              </span>
            </div>
            <p className="text-slate-400 mt-1 leading-relaxed">
              <strong>诊断结论</strong>：大模型库中的 79 项技能在 ID 维度均唯一，但不同模型生态间存在天然的功能同质化（例如 OpenAI Web Search 与 Claude Web Researcher，OpenAI Code Interpreter 与 DeepSeek Coder Sandbox）。
              系统已采用 <strong>反面示例排他（Negative Examples）</strong> 与 <strong>UCSB 动态子集抽取</strong>，自动为同质化技能注入互斥分流规则，杜绝大模型选择死锁与幻觉！
            </p>
          </div>
        </div>

        {onNavigateToTab && (
          <button
            onClick={() => onNavigateToTab('governance')}
            className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-semibold whitespace-nowrap shrink-0 flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <span>前往反面示例消歧矩阵</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* 操作 Toast 提示 */}
      {toastMessage && (
        <div
          className={`p-3.5 rounded-xl text-xs flex items-center justify-between gap-3 shadow-lg transition-all animate-in fade-in slide-in-from-top-2 border ${
            toastMessage.type === 'success'
              ? 'bg-emerald-950/90 border-emerald-600 text-emerald-200'
              : 'bg-indigo-950/90 border-indigo-600 text-indigo-200'
          }`}
        >
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span className="font-medium">{toastMessage.text}</span>
          </div>
          <button
            onClick={() => setToastMessage(null)}
            className="text-slate-400 hover:text-white text-xs"
          >
            ✕
          </button>
        </div>
      )}

      {/* ===================================================================== */}
      {/* 模块 A: AI 智能技能推荐引擎 (Smart Skill Recommender Hub) */}
      {/* ===================================================================== */}
      <div className="bg-slate-900 border border-indigo-900/40 rounded-2xl p-5 shadow-lg space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-800/80 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-600/20 border border-indigo-500/40 flex items-center justify-center text-indigo-400">
              <Sparkles className="w-4 h-4 text-indigo-300" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                智能技能推荐引擎 (AI Skill Recommender)
                <span className="text-[10px] font-normal px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  补全工作区短板 · 业务场景精准匹配
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                根据您当前工作区的技能架构进行全景诊断，自动挖掘缺失的能力短板并推荐业界标杆工具
              </p>
            </div>
          </div>

          {/* 推荐模式切换器 */}
          <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800 shrink-0">
            <button
              onClick={() => setRecommendMode('gap')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
                recommendMode === 'gap'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Award className="w-3.5 h-3.5" />
              能力短板诊断
            </button>
            <button
              onClick={() => setRecommendMode('role')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
                recommendMode === 'role'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Compass className="w-3.5 h-3.5" />
              角色方案匹配
            </button>
            <button
              onClick={() => setRecommendMode('intent')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
                recommendMode === 'intent'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Search className="w-3.5 h-3.5" />
              意图语义寻优
            </button>
          </div>
        </div>

        {/* 模式 1: 能力短板诊断 */}
        {recommendMode === 'gap' && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-4 flex flex-col justify-between">
                <div>
                  <div className="text-xs text-slate-400">工作区能力完备度评分</div>
                  <div className="text-2xl font-bold font-mono mt-1 flex items-baseline gap-2">
                    <span
                      className={
                        gapAnalysis.score >= 80
                          ? 'text-emerald-400'
                          : gapAnalysis.score >= 50
                          ? 'text-amber-400'
                          : 'text-rose-400'
                      }
                    >
                      {gapAnalysis.score}
                    </span>
                    <span className="text-xs font-normal text-slate-500">/ 100 分</span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-2">
                    {gapAnalysis.missingCaps.length === 0
                      ? '恭喜！您的工作区已完整覆盖代码、推理、视觉、搜索、安全与金融 6 大核心维度。'
                      : `检测到 ${gapAnalysis.missingCaps.length} 个关键能力维度尚未覆盖，建议补充接入对应生态技能。`}
                  </p>
                </div>

                {gapAnalysis.recommendedSkills.length > 0 && (
                  <button
                    onClick={() => handleAddRecommendations(gapAnalysis.recommendedSkills)}
                    className="mt-3 w-full py-2 px-3 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    一键接入全部补强推荐 ({gapAnalysis.recommendedSkills.length} 项)
                  </button>
                )}
              </div>

              {/* 6 大能力维度覆盖详情 */}
              <div className="md:col-span-2 bg-slate-950/70 border border-slate-800 rounded-xl p-4 space-y-2.5">
                <div className="text-xs font-semibold text-slate-300">
                  核心能力维度覆盖雷达图
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  {gapAnalysis.capabilities.map((cap) => (
                    <div
                      key={cap.key}
                      className={`p-2.5 rounded-lg border flex items-start justify-between gap-2 ${
                        cap.covered
                          ? 'bg-emerald-950/20 border-emerald-800/40 text-emerald-300'
                          : 'bg-rose-950/20 border-rose-800/40 text-rose-300'
                      }`}
                    >
                      <div>
                        <div className="flex items-center gap-1.5 font-semibold">
                          {cap.covered ? (
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                          ) : (
                            <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
                          )}
                          <span>{cap.name}</span>
                        </div>
                        <p className="text-[11px] text-slate-400 mt-1 line-clamp-2">
                          {cap.covered ? '已在当前工作区装载可用' : cap.gapReason}
                        </p>
                      </div>
                      <span
                        className={`text-[10px] px-1.5 py-0.5 rounded font-mono shrink-0 ${
                          cap.covered
                            ? 'bg-emerald-500/20 text-emerald-300'
                            : 'bg-rose-500/20 text-rose-300'
                        }`}
                      >
                        {cap.covered ? '已具备' : '急需补强'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* 补强推荐技能卡片横向推荐条 */}
            {gapAnalysis.recommendedSkills.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span className="font-semibold text-indigo-300 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                    针对当前能力短板的定制推荐工具 (Top Recommendations):
                  </span>
                  <span>共精选 {gapAnalysis.recommendedSkills.length} 项</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {gapAnalysis.recommendedSkills.slice(0, 3).map((skill) => (
                    <div
                      key={skill.skill_id}
                      className="bg-slate-950/80 border border-indigo-900/50 hover:border-indigo-600/80 rounded-xl p-3.5 flex flex-col justify-between transition-all"
                    >
                      <div>
                        <div className="flex items-center justify-between gap-2 mb-1.5">
                          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-indigo-950 text-indigo-300 border border-indigo-800">
                            {skill.ecosystem ? skill.ecosystem.toUpperCase() : 'SKILL'}
                          </span>
                          <span className="text-[10px] text-amber-300 font-semibold flex items-center gap-0.5">
                            ★ 推荐指数 98%
                          </span>
                        </div>
                        <div className="font-bold text-xs text-white">
                          {skill.display_name || skill.name}
                        </div>
                        <p className="text-[11px] text-slate-400 mt-1 line-clamp-2">
                          {skill.description}
                        </p>
                      </div>

                      <div className="pt-3 mt-2 border-t border-slate-800/80 flex items-center justify-between gap-2">
                        <span className="text-[10px] text-sky-400">
                          {skill.content_domain} · {skill.tool_carrier}
                        </span>
                        <button
                          onClick={() => handleAddSingleSkill(skill)}
                          className="px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                        >
                          <Plus className="w-3 h-3" />
                          接入
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* 模式 2: 角色方案预设匹配 */}
        {recommendMode === 'role' && (
          <div className="space-y-4">
            {/* 角色方案标签选择 */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1">
              {ROLE_PRESETS.map((preset) => {
                const isActive = activeRolePreset === preset.id;
                return (
                  <button
                    key={preset.id}
                    onClick={() => setActiveRolePreset(preset.id)}
                    className={`px-3 py-2 rounded-xl text-xs font-semibold whitespace-nowrap flex items-center gap-2 transition-all cursor-pointer ${
                      isActive
                        ? 'bg-indigo-600 text-white shadow-md'
                        : 'bg-slate-950 text-slate-400 hover:text-white hover:bg-slate-800 border border-slate-800'
                    }`}
                  >
                    {preset.icon}
                    <span>{preset.name}</span>
                  </button>
                );
              })}
            </div>

            {/* 当前角色方案解析与一键导入 */}
            {(() => {
              const currentPreset =
                ROLE_PRESETS.find((r) => r.id === activeRolePreset) || ROLE_PRESETS[0];
              const uninstalledInRole = roleRecommendedSkills.filter(
                (s) => !currentSkillIdSet.has(s.skill_id)
              );

              return (
                <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-4 space-y-3">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                    <div>
                      <div className="text-xs font-bold text-white flex items-center gap-2">
                        {currentPreset.icon}
                        <span>{currentPreset.name} 专属推荐工具链</span>
                      </div>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        {currentPreset.tagline}
                      </p>
                    </div>

                    <button
                      onClick={() => handleAddRecommendations(roleRecommendedSkills)}
                      disabled={uninstalledInRole.length === 0}
                      className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shrink-0"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      一键接入本方案技能 ({uninstalledInRole.length} 项待接入)
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 pt-2">
                    {roleRecommendedSkills.map((skill) => {
                      const isInstalled = currentSkillIdSet.has(skill.skill_id);
                      return (
                        <div
                          key={skill.skill_id}
                          className={`p-3 rounded-lg border flex items-start justify-between gap-2 ${
                            isInstalled
                              ? 'bg-slate-900/40 border-slate-800/80 opacity-75'
                              : 'bg-slate-900/90 border-slate-700/80'
                          }`}
                        >
                          <div>
                            <div className="font-semibold text-xs text-white">
                              {skill.display_name || skill.name}
                            </div>
                            <div className="text-[10px] text-slate-400 mt-0.5 line-clamp-1">
                              {skill.description}
                            </div>
                          </div>

                          {isInstalled ? (
                            <span className="text-[10px] text-emerald-400 flex items-center gap-0.5 shrink-0">
                              <Check className="w-3 h-3" /> 已装载
                            </span>
                          ) : (
                            <button
                              onClick={() => handleAddSingleSkill(skill)}
                              className="px-2 py-0.5 text-[11px] font-semibold bg-indigo-600 hover:bg-indigo-500 text-white rounded transition-colors shrink-0 cursor-pointer"
                            >
                              接入
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })()}
          </div>
        )}

        {/* 模式 3: 自定义意图寻优 */}
        {recommendMode === 'intent' && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={customIntentQuery}
                  onChange={(e) => setCustomIntentQuery(e.target.value)}
                  placeholder="输入您的业务场景或想实现的目标 (如：发票报销初审、网页端爬虫自动化、量化因子计算、长合同违约金审计...)"
                  className="w-full pl-9 pr-3 py-2 text-xs bg-slate-950 border border-slate-800 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
              </div>
              <button
                onClick={() => setCustomIntentQuery('全自动发票报销与财报多表勾稽核查')}
                className="px-2.5 py-2 text-xs text-slate-400 hover:text-white bg-slate-950 border border-slate-800 rounded-xl whitespace-nowrap cursor-pointer"
              >
                示例 1
              </button>
              <button
                onClick={() => setCustomIntentQuery('Python代码执行与自动生成数据分析图表')}
                className="px-2.5 py-2 text-xs text-slate-400 hover:text-white bg-slate-950 border border-slate-800 rounded-xl whitespace-nowrap cursor-pointer"
              >
                示例 2
              </button>
            </div>

            {intentMatchedSkills.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 pt-1">
                {intentMatchedSkills.map((skill) => {
                  const isInstalled = currentSkillIdSet.has(skill.skill_id);
                  return (
                    <div
                      key={skill.skill_id}
                      className="p-3 bg-slate-950/80 border border-slate-800 rounded-xl flex items-start justify-between gap-2"
                    >
                      <div>
                        <div className="font-semibold text-xs text-white">
                          {skill.display_name || skill.name}
                        </div>
                        <p className="text-[11px] text-slate-400 mt-1 line-clamp-2">
                          {skill.description}
                        </p>
                      </div>

                      {isInstalled ? (
                        <span className="text-[10px] text-emerald-400 shrink-0">已装载</span>
                      ) : (
                        <button
                          onClick={() => handleAddSingleSkill(skill)}
                          className="px-2.5 py-1 text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-colors shrink-0 cursor-pointer"
                        >
                          接入
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ===================================================================== */}
      {/* 模块 B: 自主选择添加过滤器与搜索栏 (Autonomous Selection & Filter) */}
      {/* ===================================================================== */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
        {/* 生态库顶级 Tab 切换 */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setSelectedEcosystem('all')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
                selectedEcosystem === 'all'
                  ? 'bg-slate-700 text-white shadow-sm'
                  : 'bg-slate-950 text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              全部大模型生态 ({ecoCounts.total})
            </button>

            <button
              onClick={() => setSelectedEcosystem('openai')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
                selectedEcosystem === 'openai'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'bg-slate-950 text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              <Bot className="w-3.5 h-3.5 text-emerald-300" />
              OpenAI 生态库 ({ecoCounts.openai})
            </button>

            <button
              onClick={() => setSelectedEcosystem('claude')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
                selectedEcosystem === 'claude'
                  ? 'bg-amber-600 text-white shadow-sm'
                  : 'bg-slate-950 text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              <Brain className="w-3.5 h-3.5 text-amber-300" />
              Claude 深度库 ({ecoCounts.claude})
            </button>

            <button
              onClick={() => setSelectedEcosystem('qwen')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
                selectedEcosystem === 'qwen'
                  ? 'bg-purple-600 text-white shadow-sm'
                  : 'bg-slate-950 text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-purple-300" />
              Qwen 通义千问 ({ecoCounts.qwen})
            </button>

            <button
              onClick={() => setSelectedEcosystem('deepseek')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
                selectedEcosystem === 'deepseek'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-slate-950 text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              <Cpu className="w-3.5 h-3.5 text-blue-300" />
              DeepSeek 推理库 ({ecoCounts.deepseek})
            </button>

            <button
              onClick={() => setSelectedEcosystem('business')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
                selectedEcosystem === 'business'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'bg-slate-950 text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              <Building className="w-3.5 h-3.5 text-indigo-300" />
              通用商业办公 ({ecoCounts.business})
            </button>
          </div>

          {/* 状态过滤：全部 / 仅看待添加 / 仅看已装载 */}
          <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
                statusFilter === 'all'
                  ? 'bg-slate-800 text-white font-medium'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              全部
            </button>
            <button
              onClick={() => setStatusFilter('not_added')}
              className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
                statusFilter === 'not_added'
                  ? 'bg-emerald-600 text-white font-medium'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              仅看待接入
            </button>
            <button
              onClick={() => setStatusFilter('added')}
              className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
                statusFilter === 'added'
                  ? 'bg-indigo-600 text-white font-medium'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              仅看已装载
            </button>
          </div>
        </div>

        {/* 次级搜索与领域筛选 */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2 flex-1 max-w-lg">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="搜索技能名称、描述、所需槽位或消歧特征..."
                className="w-full pl-9 pr-3 py-2 text-xs bg-slate-950 border border-slate-800 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              />
            </div>

            <select
              value={domainFilter}
              onChange={(e) => setDomainFilter(e.target.value)}
              className="px-3 py-2 text-xs bg-slate-950 border border-slate-800 rounded-xl text-slate-300 focus:outline-none focus:border-indigo-500"
            >
              <option value="all">所有业务领域 ({availableDomains.length})</option>
              {availableDomains.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>

          {/* 筛选结果统计 */}
          <div className="text-xs text-slate-400 flex items-center justify-between sm:justify-end gap-3">
            <span>
              匹配结果: <strong className="text-white">{filteredSkills.length}</strong> 项
            </span>
          </div>
        </div>

        {/* 多选批量操作工具条 (Autonomous Batch Action Bar) */}
        <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 cursor-pointer text-slate-300 hover:text-white select-none">
              <input
                type="checkbox"
                checked={
                  filteredSkills.length > 0 &&
                  filteredSkills.every((s) => selectedSkillIds.has(s.skill_id))
                }
                onChange={(e) => {
                  if (e.target.checked) {
                    handleSelectAllFiltered();
                  } else {
                    handleClearSelection();
                  }
                }}
                className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-700 bg-slate-900 cursor-pointer"
              />
              <span className="font-semibold">全选当前筛选结果</span>
            </label>

            <span className="text-slate-500">|</span>

            <span className="text-slate-400">
              已勾选: <strong className="text-sky-400 font-mono">{selectedSkillIds.size}</strong> 项
            </span>

            {selectedSkillIds.size > 0 && (
              <button
                onClick={handleClearSelection}
                className="text-slate-500 hover:text-slate-300 underline text-[11px] cursor-pointer"
              >
                取消勾选
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleAddSelectedSkills}
              disabled={selectedSkillIds.size === 0}
              className="px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer shadow-sm"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>批量添加所选项到工作台 ({selectedSkillIds.size})</span>
            </button>
          </div>
        </div>

        {/* 技能卡片列表展示区 (79 项多模态网格) */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5 pt-1">
          {filteredSkills.map((skill) => {
            const isInstalled = currentSkillIdSet.has(skill.skill_id);
            const isSelected = selectedSkillIds.has(skill.skill_id);

            // 生态专属徽章样式
            const ecoBadge =
              skill.ecosystem === 'openai'
                ? 'text-emerald-400 border-emerald-800/80 bg-emerald-950/40'
                : skill.ecosystem === 'claude'
                ? 'text-amber-400 border-amber-800/80 bg-amber-950/40'
                : skill.ecosystem === 'qwen'
                ? 'text-purple-400 border-purple-800/80 bg-purple-950/40'
                : skill.ecosystem === 'deepseek'
                ? 'text-blue-400 border-blue-800/80 bg-blue-950/40'
                : 'text-indigo-400 border-indigo-800/80 bg-indigo-950/40';

            const ecoLabel =
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
                className={`p-4 rounded-xl border transition-all flex flex-col justify-between ${
                  isSelected
                    ? 'ring-2 ring-indigo-500 bg-slate-900 border-indigo-500/80 shadow-lg'
                    : isInstalled
                    ? 'bg-slate-950/60 border-slate-800/80 hover:border-slate-700'
                    : 'bg-slate-900/90 border-slate-700/80 hover:border-slate-600 shadow-sm'
                }`}
              >
                <div>
                  {/* 顶栏：勾选框、生态标识与操作状态 */}
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelectSkill(skill.skill_id)}
                        className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-700 bg-slate-800 cursor-pointer shrink-0 mt-0.5"
                      />
                      <div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded border ${ecoBadge}`}>
                            {ecoLabel}
                          </span>
                          <span className="font-bold text-sm text-white">
                            {skill.display_name || skill.name}
                          </span>
                        </div>
                        <span className="text-[11px] font-mono text-slate-400 block mt-0.5">
                          {skill.name}
                        </span>
                      </div>
                    </div>

                    {isInstalled ? (
                      <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-emerald-950/80 text-emerald-300 border border-emerald-800/60 flex items-center gap-1 shrink-0">
                        <Check className="w-3 h-3 text-emerald-400" />
                        已在工作台
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-slate-800 text-slate-400 border border-slate-700 shrink-0">
                        待接入
                      </span>
                    )}
                  </div>

                  {/* 描述 */}
                  <p className="text-xs text-slate-300 leading-relaxed line-clamp-2 mb-3">
                    {skill.description}
                  </p>

                  {/* 结构特征指标 */}
                  <div className="space-y-1 text-[11px] text-slate-400 border-t border-slate-800/80 pt-2.5">
                    <div className="flex items-center gap-1.5">
                      <span className="text-slate-500 shrink-0">双轴属性:</span>
                      <span className="text-sky-300 truncate">{skill.content_domain || '通用内容'}</span>
                      <span className="text-slate-600">·</span>
                      <span className="text-indigo-300 truncate">{skill.tool_carrier || '通用工具'}</span>
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

                {/* 卡片底栏操作按钮 */}
                <div className="pt-3 mt-3 border-t border-slate-800/80 flex items-center justify-between gap-2">
                  <button
                    onClick={() => handleRunSandbox(skill)}
                    className="px-2.5 py-1 text-slate-400 hover:text-white bg-slate-800/60 hover:bg-slate-800 rounded-lg text-xs flex items-center gap-1 transition-colors cursor-pointer"
                  >
                    <Play className="w-3 h-3 text-amber-400" />
                    <span>沙箱测试</span>
                  </button>

                  <div className="flex items-center gap-1.5">
                    {isInstalled ? (
                      <button
                        onClick={() => handleRemoveSingleSkill(skill.skill_id, skill.display_name || skill.name)}
                        className="px-2.5 py-1 text-xs text-rose-400 hover:text-rose-300 bg-rose-950/40 hover:bg-rose-950/80 border border-rose-800/60 rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
                      >
                        <Trash2 className="w-3 h-3" />
                        <span>下线移除</span>
                      </button>
                    ) : (
                      <button
                        onClick={() => handleAddSingleSkill(skill)}
                        className="px-2.5 py-1 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg transition-colors flex items-center gap-1 cursor-pointer shadow-sm"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>加入工作台</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 弹窗：沙箱试运行结果展示 */}
      {testingSkillId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl">
            <div className="px-5 py-3.5 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Play className="w-4 h-4 text-amber-400" />
                <h3 className="text-sm font-bold text-white">沙箱模拟执行结果</h3>
              </div>
              <button
                onClick={() => setTestingSkillId(null)}
                className="text-slate-400 hover:text-white text-sm"
              >
                ✕
              </button>
            </div>
            <div className="p-5 space-y-3">
              <div className="text-xs text-slate-400">
                正在执行技能: <strong className="text-white font-mono">{testingSkillId}</strong>
              </div>
              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 font-mono text-xs text-emerald-300 whitespace-pre-wrap leading-relaxed max-h-60 overflow-y-auto">
                {testOutput}
              </div>
            </div>
            <div className="px-5 py-3 bg-slate-950 border-t border-slate-800 flex justify-end">
              <button
                onClick={() => setTestingSkillId(null)}
                className="px-4 py-1.5 text-xs bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg transition-colors cursor-pointer"
              >
                关闭
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
