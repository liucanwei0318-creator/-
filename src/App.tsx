import React, { useState, useMemo, useEffect } from 'react';
import { Skill, SessionContext, SkillInteractionLog } from './types/agent';
import { INITIAL_SKILLS } from './data/defaultSkills';
import { INITIAL_INTERACTION_LOGS } from './data/defaultInteractionLogs';
import { Header } from './components/Header';
import { GlobalGovernanceNotifier } from './components/GlobalGovernanceNotifier';
import { AgentChatView } from './components/AgentChatView';
import { OrchestratorView } from './components/OrchestratorView';
import { RegistrationGateView } from './components/RegistrationGateView';
import { SkillIndexView } from './components/SkillIndexView';
import { GovernanceView } from './components/GovernanceView';
import { EcosystemDatabaseView } from './components/EcosystemDatabaseView';
import { ExperimentBenchmarkView } from './components/ExperimentBenchmarkView';

const STORAGE_KEY = 'hitl_agent_skills_store_v2';
const DELETED_KEY = 'hitl_agent_deleted_skill_ids_v2';
const LOGS_STORAGE_KEY = 'hitl_agent_interaction_logs_v2';

function loadInitialInteractionLogs(): SkillInteractionLog[] {
  if (typeof window === 'undefined') return INITIAL_INTERACTION_LOGS;
  try {
    const raw = localStorage.getItem(LOGS_STORAGE_KEY);
    if (!raw) return INITIAL_INTERACTION_LOGS;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : INITIAL_INTERACTION_LOGS;
  } catch {
    return INITIAL_INTERACTION_LOGS;
  }
}

function loadInitialSkills(): Skill[] {
  if (typeof window === 'undefined') return INITIAL_SKILLS;
  try {
    const rawDeleted = localStorage.getItem(DELETED_KEY);
    const deletedIds = new Set<string>(rawDeleted ? JSON.parse(rawDeleted) : []);
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return INITIAL_SKILLS.filter((s) => !deletedIds.has(s.skill_id));
    }
    const parsed: Partial<Skill>[] = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) {
      return INITIAL_SKILLS.filter((s) => !deletedIds.has(s.skill_id));
    }

    const mergedList: Skill[] = [];
    const processedIds = new Set<string>();

    // 先保留用户已有的项 (过滤掉已被下线删除的项)
    parsed.forEach((item) => {
      if (!item.skill_id || deletedIds.has(item.skill_id)) return;
      const base = INITIAL_SKILLS.find((s) => s.skill_id === item.skill_id);
      mergedList.push({
        ...base,
        ...item,
        mock_executor:
          base?.mock_executor ||
          ((slots, prevOutput) =>
            `【${item.name || 'Skill'} 完成】已在沙箱环境中完成调度与输出。${
              prevOutput ? ` (上游输出已传递)` : ''
            }`),
      } as Skill);
      processedIds.add(item.skill_id);
    });

    // 仅在首次或缺失时平滑合入，但绝不复活用户已显式删除的技能 (Tombstone 保护)
    INITIAL_SKILLS.forEach((base) => {
      if (!processedIds.has(base.skill_id) && !deletedIds.has(base.skill_id)) {
        mergedList.push(base);
      }
    });

    return mergedList.length > 0 ? mergedList : INITIAL_SKILLS;
  } catch (err) {
    console.warn('Failed to parse cached skills from localStorage:', err);
    return INITIAL_SKILLS;
  }
}

export default function App() {
  const [skills, setSkills] = useState<Skill[]>(loadInitialSkills);
  const [activeTab, setActiveTab] = useState<
    'chat' | 'orchestrator' | 'gate' | 'index' | 'governance' | 'ecosystem' | 'experiment'
  >('chat');

  // 持久化技能库变更，避免刷新或页面重挂载导致下线删除/精炼操作丢失回滚
  useEffect(() => {
    try {
      const serializable = skills.map(({ mock_executor, ...rest }) => rest);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(serializable));
    } catch (err) {
      console.warn('Failed to save skills to localStorage:', err);
    }
  }, [skills]);

  const [session, setSession] = useState<SessionContext>({
    active_skill: null,
    active_slots: {},
    last_query: '',
    last_output: '',
    domain_history: [],
  });

  // 计算超阈值的异常技能数 (调用 >= 3 且 错误率 >= 20% 且未标记自愈修复)
  const governanceAlertCount = useMemo(() => {
    return skills.filter((s) => {
      const errorRate = s.call_count > 0 ? s.error_count / s.call_count : 0;
      return s.call_count >= 3 && errorRate >= 0.20 && s.governance_status !== 'healed';
    }).length;
  }, [skills]);

  // 注册新技能
  const handleRegisterSkill = (newSkill: Skill) => {
    setSkills((prev) => [newSkill, ...prev]);
    setActiveTab('index');
  };

  // 删除技能 (记录墓碑标记，永久防止自动回滚复活)
  const handleDeleteSkill = (skillId: string) => {
    try {
      const raw = localStorage.getItem(DELETED_KEY);
      const deletedIds = new Set<string>(raw ? JSON.parse(raw) : []);
      deletedIds.add(skillId);
      localStorage.setItem(DELETED_KEY, JSON.stringify(Array.from(deletedIds)));
    } catch (e) {
      console.warn('Failed to update deleted IDs:', e);
    }
    setSkills((prev) => prev.filter((s) => s.skill_id !== skillId));
  };

  // 更新技能 (治理精炼等动作)
  const handleUpdateSkill = (updatedSkill: Skill) => {
    setSkills((prev) =>
      prev.map((s) => (s.skill_id === updatedSkill.skill_id ? updatedSkill : s))
    );
  };

  // 批量添加技能 (拆解万金油技能或导入生态包)
  const handleAddSkills = (newSkills: Skill[]) => {
    setSkills((prev) => [...newSkills, ...prev]);
  };

  // 恢复全套丰富样本库 (重置墓碑并完全恢复 79 项四大模型生态库)
  const handleRestoreAllSkills = () => {
    try {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(DELETED_KEY);
    } catch (e) {
      console.warn('Failed to clear storage:', e);
    }
    setSkills(INITIAL_SKILLS);
  };

  const [interactionLogs, setInteractionLogs] = useState<SkillInteractionLog[]>(loadInitialInteractionLogs);

  // 持久化交互日志
  useEffect(() => {
    try {
      localStorage.setItem(LOGS_STORAGE_KEY, JSON.stringify(interactionLogs.slice(0, 100)));
    } catch (e) {
      console.warn('Failed to save interaction logs:', e);
    }
  }, [interactionLogs]);

  const handleAddInteractionLog = (newLog: SkillInteractionLog) => {
    setInteractionLogs((prev) => [newLog, ...prev]);
  };

  // 技能运行时调用追踪
  const handleSkillCalled = (skillId: string, hadError: boolean = false) => {
    setSkills((prev) =>
      prev.map((s) => {
        if (s.skill_id === skillId) {
          const newCallCount = s.call_count + 1;
          const newErrorCount = hadError ? s.error_count + 1 : s.error_count;
          return {
            ...s,
            call_count: newCallCount,
            error_count: newErrorCount,
            error_rate: newCallCount > 0 ? newErrorCount / newCallCount : 0,
          };
        }
        return s;
      })
    );

    const target = skills.find((s) => s.skill_id === skillId);
    if (target) {
      const newLog: SkillInteractionLog = {
        id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        skill_id: skillId,
        skill_name: target.name,
        timestamp: new Date().toLocaleTimeString(),
        user_query: hadError ? `[模拟异常测试调用] ${target.name}` : `[Agent会话任务调度] ${target.name}`,
        input_slots: {
          test_param: hadError ? 'invalid_corrupted_data' : 'normal_payload',
          strict_check: true,
        },
        status: hadError ? 'error' : 'success',
        latency_ms: Math.floor(Math.random() * 200 + 80),
        error_category: hadError ? 'format_mismatch' : undefined,
        error_reason: hadError ? '入参格式校验异常: 参数包含非预期空值或非法特殊字符，触发保护拦截' : undefined,
      };
      setInteractionLogs((prev) => [newLog, ...prev]);
    }
  };

  // 治理模拟测试：手动注入报错调用
  const handleSimulateErrorCall = (skillId: string) => {
    handleSkillCalled(skillId, true);
  };

  // 治理模拟测试：清零恢复报错
  const handleResetSkillErrors = (skillId: string) => {
    setSkills((prev) =>
      prev.map((s) => {
        if (s.skill_id === skillId) {
          return {
            ...s,
            error_count: 0,
            error_rate: 0,
          };
        }
        return s;
      })
    );
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* 规范顶栏 */}
      <Header
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onOpenNewSkill={() => setActiveTab('gate')}
        governanceAlertCount={governanceAlertCount}
      />

      {/* 主工作区视图 */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* 全局治理告警通知组件 (当技能错误率超标时自动报警) */}
        <GlobalGovernanceNotifier
          skills={skills}
          activeTab={activeTab}
          onNavigateToGovernance={() => setActiveTab('governance')}
          onSimulateErrorCall={handleSimulateErrorCall}
          onResetSkillErrors={handleResetSkillErrors}
        />

        {activeTab === 'chat' && (
          <AgentChatView
            skills={skills}
            session={session}
            onUpdateSession={setSession}
            onSkillCalled={handleSkillCalled}
            onNavigateToTab={setActiveTab}
          />
        )}

        {activeTab === 'orchestrator' && (
          <OrchestratorView
            skills={skills}
            session={session}
            onUpdateSession={setSession}
            onSkillCalled={handleSkillCalled}
          />
        )}

        {activeTab === 'gate' && (
          <RegistrationGateView
            skills={skills}
            onRegisterSkill={handleRegisterSkill}
            onDeleteSkill={handleDeleteSkill}
            onNavigateToTab={setActiveTab}
            onAddSkills={handleAddSkills}
            onRestoreAllSkills={handleRestoreAllSkills}
          />
        )}

        {activeTab === 'index' && (
          <SkillIndexView
            skills={skills}
            onDeleteSkill={handleDeleteSkill}
            onNavigateToGovernance={() => setActiveTab('governance')}
            onNavigateToTab={setActiveTab}
            onAddSkills={handleAddSkills}
            onRestoreAllSkills={handleRestoreAllSkills}
          />
        )}

        {activeTab === 'ecosystem' && (
          <EcosystemDatabaseView
            currentSkills={skills}
            onAddSkills={handleAddSkills}
            onDeleteSkill={handleDeleteSkill}
            onRestoreAllSkills={handleRestoreAllSkills}
            onNavigateToTab={setActiveTab}
          />
        )}

        {activeTab === 'governance' && (
          <GovernanceView
            skills={skills}
            interactionLogs={interactionLogs}
            onUpdateSkill={handleUpdateSkill}
            onAddSkills={handleAddSkills}
            onDeleteSkill={handleDeleteSkill}
            onAddInteractionLog={handleAddInteractionLog}
          />
        )}

        {activeTab === 'experiment' && (
          <ExperimentBenchmarkView />
        )}
      </main>

      {/* 简约页脚 */}
      <footer className="border-t border-slate-900 bg-slate-950 py-4 text-center text-xs text-slate-500">
        Skill Index System · AI-assisted Skill Indexing + Human-in-the-loop Governance + Long-Context Benchmark
      </footer>
    </div>
  );
}
