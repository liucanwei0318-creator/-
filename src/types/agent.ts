export interface Skill {
  skill_id: string;
  name: string;
  description: string;
  clusters: string[]; // 业务领域与工具载体 (如: ["文档处理", "Office工具"])
  required_slots: string[]; // 必需关键参数槽位 (如: ["file_path", "watermark_text"])
  negative_triggers: string[]; // 负向排除规则 (如: "请勿用于图片去水印")
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
  created_via?: 'manual' | 'ai_natural_language';
  content_domain?: string; // 业务内容领域（如：商业金融、气象生活、技术研发、人力行政、法务合规、办公协作）
  tool_carrier?: string;   // 工具依托载体（如：PDF工具、Word/Office、代码沙箱、网络搜索、邮件通讯、SQL数据库、视觉多模态）
  ecosystem?: 'openai' | 'claude' | 'deepseek' | 'business' | 'other';
}

export interface SkillDuplicatePair {
  id: string;
  skillA: Skill;
  skillB: Skill;
  similarity: number;
  slotOverlap: string[];
  riskLevel: 'high' | 'medium' | 'low';
  reason: string;
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
}

export interface RegistrationCheckResult {
  allowed: boolean;
  message: string;
  collidingSkill?: Skill;
  similarity?: number;
  missingDisambiguation?: boolean;
}

export interface SessionContext {
  active_skill: Skill | null;
  active_slots: Record<string, any>;
  last_query: string;
  last_output: string;
  domain_history: string[];
}
