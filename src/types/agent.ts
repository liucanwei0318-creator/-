export interface NegativeExampleRule {
  scenario: string; // 易混淆负面场景 (如: "用户要求对图片/PDF进行视觉文字提取与排版解析")
  why_avoid: string; // 排除原因 (如: "当前为纯代码沙箱，无视觉渲染解码器，极易发生参数幻觉")
  divert_to_skill_id: string; // 分流至正确定向技能 ID (如: "openai_vision_ocr")
  divert_to_skill_name: string; // 分流技能名称
}

export interface Skill {
  skill_id: string;
  name: string;
  description: string;
  clusters: string[]; // 业务领域与工具载体 (如: ["文档处理", "Office工具"])
  required_slots: string[]; // 必需关键参数槽位 (如: ["file_path", "watermark_text"])
  negative_triggers: string[]; // 负向排除规则 (如: "请勿用于图片去水印")
  negative_examples?: NegativeExampleRule[]; // 结构化反面示例 (解决论文中多技能干扰与混淆)
  disambiguation_features: string; // 消歧专有属性
  call_count: number;
  error_count: number;
  error_rate?: number;
  domains_invoked: string[];
  embedding: Record<string, number>;
  author?: string;
  version?: string;
  mock_executor?: (slots: Record<string, any>, prevOutput?: string) => string;
  display_name?: string;
  slots_explanation?: Record<string, string>;
  created_via?: 'manual' | 'ai_natural_language' | 'meta_skill_healer' | 'claude_recorder';
  content_domain?: string; // 业务内容领域（如：商业金融、气象生活、技术研发、人力行政、法务合规、办公协作）
  tool_carrier?: string;   // 工具依托载体（如：PDF工具、Word/Office、代码沙箱、网络搜索、邮件通讯、SQL数据库、视觉多模态）
  ecosystem?: 'openai' | 'claude' | 'qwen' | 'deepseek' | 'business' | 'other';
  is_meta_skill?: boolean; // 是否属于元技能 (Meta-skill)
  governance_status?: 'healthy' | 'refining' | 'quarantined' | 'healed';
  healed_at?: string;
  primary_alias_for?: string[]; // 跨生态同质化合并别名 (例如合并了 deepseek_coder_sandbox)
}

export interface MetaSkill {
  id: string;
  name: string;
  target_type: 'prompt_refinement' | 'slot_alignment' | 'negative_rule_injection' | 'split_expert' | 'error_self_healing';
  description: string;
  trigger_condition: string; // 激活条件 (如: "报错率 > 15% 自动激活巡检自愈")
  created_at: string;
  source: 'claude_record' | 'openai_skill_creator' | 'governance_audit';
  learned_rules: string[];
  activation_count: number;
  last_activated?: string;
  status: 'active' | 'standby';
}

export interface RecordedAction {
  id: string;
  timestamp: string;
  action_type: 'prompt_adjust' | 'slot_tweak' | 'error_diagnosis' | 'negative_add' | 'split_expert';
  skill_id: string;
  skill_name: string;
  detail: string;
  before_state?: string;
  after_state?: string;
  admin_note?: string;
}

export interface SkillInteractionLog {
  id: string;
  skill_id: string;
  skill_name: string;
  timestamp: string;
  user_query: string;
  input_slots: Record<string, any>;
  status: 'success' | 'error';
  latency_ms: number;
  error_reason?: string;
  error_category?: 'slot_missing' | 'format_mismatch' | 'domain_confusion' | 'runtime_timeout';
  suggested_adjustment?: {
    description_refinement?: string;
    slots_adjustment?: string[];
    slots_rules?: Record<string, string>;
    negative_rule?: NegativeExampleRule;
  };
}

export interface SkillDuplicatePair {
  id: string;
  skillA: Skill;
  skillB: Skill;
  similarity: number;
  slotOverlap: string[];
  riskLevel: 'high' | 'medium' | 'low';
  reason: string;
  suggested_divert_rule?: NegativeExampleRule;
}

export type TransitionDecision = 'RETAIN' | 'REROUTE';

export interface TransitionEvaluation {
  decision: TransitionDecision;
  reason: string;
  similarityToActive: number;
  isZeroContextDependent: boolean;
  hasSlotOverlap: boolean;
  matchedTrigger?: string;
}

export interface OrchestrationStep {
  step_id: string;
  title: string;
  target_cluster: string;
  skill_id?: string;
  skill_name?: string;
  required_slots: string[];
  extracted_slots: Record<string, any>;
  status: 'pending' | 'routing' | 'running' | 'completed' | 'failed';
  output?: string;
  error_message?: string;
  input_from_step?: string;
  routing_score?: number;
  negative_diverted_from?: string; // 若因反面示例从其他技能重定向至此
  token_budget: {
    traditional: number;
    indexed: number;
  };
}

export interface OrchestrationPlan {
  plan_id: string;
  query: string;
  intent_type: 'single' | 'composite';
  detected_domain: string;
  steps: OrchestrationStep[];
  transition_evaluation?: TransitionEvaluation;
  total_token_traditional: number;
  total_token_indexed: number;
  token_savings_percent: number;
  status: 'idle' | 'running' | 'completed' | 'failed';
  created_at: string;
}

export interface GovernanceAlert {
  id: string;
  type: 'high_error_rate' | 'semantic_greed' | 'collision_risk' | 'low_refinement';
  skill_id: string;
  skill_name: string;
  message: string;
  severity: 'high' | 'medium' | 'info';
  suggested_action: string;
  can_auto_heal?: boolean;
}

export interface RegistrationCheckResult {
  allowed: boolean;
  message: string;
  collidingSkill?: Skill;
  similarity?: number;
  missingDisambiguation?: boolean;
}

export interface CanonicalMemory {
  active_intent: string;
  tracked_slots: Record<string, any>;
  key_entities: string[];
  recent_turns_summary: string;
  token_usage_saved: number;
  distractor_pruning_log: string[];
  last_updated: string;
}

export interface SessionContext {
  active_skill: Skill | null;
  active_slots: Record<string, any>;
  last_query: string;
  last_output: string;
  domain_history: string[];
  canonical_memory?: CanonicalMemory;
}

