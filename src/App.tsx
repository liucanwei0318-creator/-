import React, { useState, useMemo } from 'react';
import { Skill, SessionContext } from './types/agent';
import { INITIAL_SKILLS } from './data/defaultSkills';
import { Header } from './components/Header';
import { GlobalGovernanceNotifier } from './components/GlobalGovernanceNotifier';
import { AgentChatView } from './components/AgentChatView';
import { OrchestratorView } from './components/OrchestratorView';
import { RegistrationGateView } from './components/RegistrationGateView';
import { SkillIndexView } from './components/SkillIndexView';
import { GovernanceView } from './components/GovernanceView';

export default function App() {
  const [skills, setSkills] = useState<Skill[]>(INITIAL_SKILLS);
  const [activeTab, setActiveTab] = useState<
    'chat' | 'orchestrator' | 'gate' | 'index' | 'governance'
  >('chat');

  const [session, setSession] = useState<SessionContext>({
    active_skill: null,
    active_slots: {},
    last_query: '',
    last_output: '',
    domain_history: [],
  });

  // 计算超阈值的异常技能数 (调用 >= 3 且 错误率 >= 20%)
  const governanceAlertCount = useMemo(() => {
    return skills.filter((s) => {
      const errorRate = s.call_count > 0 ? s.error_count / s.call_count : 0;
      return s.call_count >= 3 && errorRate >= 0.20;
    }).length;
  }, [skills]);

  // 注册新技能
  const handleRegisterSkill = (newSkill: Skill) => {
    setSkills((prev) => [newSkill, ...prev]);
    setActiveTab('index'); // 注册成功后跳转至多维索引图谱查看
  };

  // 删除技能
  const handleDeleteSkill = (skillId: string) => {
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

  // 恢复全套丰富样本库 (24+ 项模型生态预置技能)
  const handleRestoreAllSkills = () => {
    setSkills(INITIAL_SKILLS);
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
            onAddSkills={handleAddSkills}
            onRestoreAllSkills={handleRestoreAllSkills}
          />
        )}

        {activeTab === 'index' && (
          <SkillIndexView
            skills={skills}
            onDeleteSkill={handleDeleteSkill}
            onNavigateToGovernance={() => setActiveTab('governance')}
            onAddSkills={handleAddSkills}
            onRestoreAllSkills={handleRestoreAllSkills}
          />
        )}

        {activeTab === 'governance' && (
          <GovernanceView
            skills={skills}
            onUpdateSkill={handleUpdateSkill}
            onAddSkills={handleAddSkills}
            onDeleteSkill={handleDeleteSkill}
          />
        )}
      </main>

      {/* 简约页脚 */}
      <footer className="border-t border-slate-900 bg-slate-950 py-4 text-center text-xs text-slate-500">
        MVP - Agent技能索引与人机治理工作台 · AI-assisted Skill Indexing + Human-in-the-loop Governance
      </footer>
    </div>
  );
}
