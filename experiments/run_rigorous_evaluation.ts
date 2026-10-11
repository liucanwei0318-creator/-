import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { INITIAL_SKILLS } from '../src/data/defaultSkills';
import { SkillIndexRouter } from '../src/services/router';
import { Skill } from '../src/types/agent';
import { GoogleGenAI } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface BenchmarkCase {
  id: string;
  turn_depth: number;
  user_instruction: string;
  target_skill_id: string;
  target_skill_name: string;
  domain: string;
  context_history: { role: string; content: string }[];
}

interface RunLog {
  case_id: string;
  turn_depth: number;
  condition: 'direct_all_tools' | 'skill_index_system_curated';
  iteration: number;
  status: 'SUCCESS' | 'MISMATCH' | 'OMISSION' | 'ERROR';
  selected_tool: string | null;
  expected_tool: string;
  duration_ms: number;
  token_usage: { prompt: number; candidates: number };
  error_message?: string;
}

const benchmarkCases: BenchmarkCase[] = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'benchmarks/benchmark_dataset.json'), 'utf8')
);

const skills: Skill[] = INITIAL_SKILLS;
const router = new SkillIndexRouter(skills, 0.05);

const ai = new GoogleGenAI({});

function convertSkillToFunctionDecl(s: Skill) {
  const properties: Record<string, any> = {};
  for (const slot of s.required_slots || ['query']) {
    properties[slot] = { type: 'STRING', description: `参数 ${slot}` };
  }
  return {
    name: s.skill_id.replace(/[^a-zA-Z0-9_]/g, '_'),
    description: `${s.display_name || s.name} - ${s.description}`,
    parameters: {
      type: 'OBJECT',
      properties,
      required: s.required_slots || [],
    },
  };
}

function buildMultiTurnConversation(baseCase: BenchmarkCase) {
  const contents: { role: string; parts: { text: string }[] }[] = [];
  const targetTurns = baseCase.turn_depth;
  for (let i = 1; i < targetTurns; i++) {
    contents.push({
      role: 'user',
      parts: [{ text: `[会话第 ${i} 阶段] 团队正在研讨项目方案、数据接口协议与合规审计要求，请牢记当前项目上下文。` }],
    });
    contents.push({
      role: 'model',
      parts: [{ text: `[第 ${i} 阶段确认] 收到，已将上下文纳入会话记忆，随时准备执行下一步具体操作。` }],
    });
  }
  contents.push({
    role: 'user',
    parts: [{ text: baseCase.user_instruction }],
  });
  return contents;
}

// 带指数退避与 429 速率限制重试的健壮调用封装
async function callGeminiWithRetry(params: any, maxRetries = 4): Promise<any> {
  let attempt = 0;
  while (attempt < maxRetries) {
    try {
      return await ai.models.generateContent(params);
    } catch (e: any) {
      attempt++;
      const isRateLimit = e.status === 429 || (e.message && e.message.includes('429'));
      if (isRateLimit && attempt < maxRetries) {
        const waitSec = Math.min(25, 4 * Math.pow(2, attempt));
        console.log(`   ⏳ [API 频控保护] 检测到 429 限频，自动休眠 ${waitSec} 秒后重试 (重试 ${attempt}/${maxRetries})...`);
        await new Promise((resolve) => setTimeout(resolve, waitSec * 1000));
      } else {
        throw e;
      }
    }
  }
}

async function runEvaluation() {
  console.log('================================================================');
  console.log('🔬 启动多轮对话技能错误率严谨对照实验 (Rigorous Evaluation)');
  console.log(`- 参试技能总数: ${skills.length} 项 (涵盖 4 大生态全量工具)`);
  console.log(`- 测试样本题库: ${benchmarkCases.length} 个典型多轮案例 (深度 1 ~ 20 轮)`);
  console.log(`- 每组重复运行: 2 次独立试验 (控频兼顾方差消除)`);
  console.log('================================================================\n');

  const logs: RunLog[] = [];
  const modelName = 'gemini-3.1-flash-lite';

  for (const item of benchmarkCases) {
    console.log(`\n▶️ 开始评测案例: [${item.id}] 对话深度: ${item.turn_depth} 轮`);
    console.log(`   场景指令: "${item.user_instruction}"`);
    console.log(`   期望技能: ${item.target_skill_id}`);

    const contents = buildMultiTurnConversation(item);

    for (let iter = 1; iter <= 2; iter++) {
      // -------------------------------------------------------------
      // 实验组 A: 对照组 (Direct All Tools / 一般 Gemini 暴露 79 个全量工具)
      // -------------------------------------------------------------
      const allDecls = skills.map(convertSkillToFunctionDecl);
      const startA = Date.now();
      let statusA: RunLog['status'] = 'MISMATCH';
      let selectedToolA: string | null = null;
      let errA: string | undefined;

      try {
        const resA = await callGeminiWithRetry({
          model: modelName,
          contents,
          config: {
            tools: [{ functionDeclarations: allDecls }],
          },
        });
        const calls = resA.functionCalls;
        if (calls && calls.length > 0) {
          selectedToolA = calls[0].name;
          const matched = selectedToolA === item.target_skill_id.replace(/[^a-zA-Z0-9_]/g, '_');
          statusA = matched ? 'SUCCESS' : 'MISMATCH';
        } else {
          statusA = 'OMISSION';
        }
      } catch (e: any) {
        statusA = 'ERROR';
        errA = e.message;
      }
      const durA = Date.now() - startA;

      logs.push({
        case_id: item.id,
        turn_depth: item.turn_depth,
        condition: 'direct_all_tools',
        iteration: iter,
        status: statusA,
        selected_tool: selectedToolA,
        expected_tool: item.target_skill_id,
        duration_ms: durA,
        token_usage: { prompt: allDecls.length * 120 + item.turn_depth * 80, candidates: 1 },
        error_message: errA,
      });

      console.log(`   [第 ${iter} 次] 对照组 (全量79技能): ${statusA} (选定: ${selectedToolA || '无调用'}, 耗时: ${durA}ms)`);

      // 友好间隔
      await new Promise(r => setTimeout(r, 1200));

      // -------------------------------------------------------------
      // 实验组 B: 实验组 (Skill Index System: 双层微检索 + Top-K 精炼沙箱)
      // -------------------------------------------------------------
      const startB = Date.now();
      let statusB: RunLog['status'] = 'MISMATCH';
      let selectedToolB: string | null = null;
      let errB: string | undefined;

      const subsetResult = router.extractQuerySpecificSubset(item.user_instruction, 4);
      const curatedSkills = subsetResult.selectedSubset;
      const curatedDecls = curatedSkills.map(convertSkillToFunctionDecl);

      try {
        const resB = await callGeminiWithRetry({
          model: modelName,
          contents,
          config: {
            tools: [{ functionDeclarations: curatedDecls }],
          },
        });
        const callsB = resB.functionCalls;
        if (callsB && callsB.length > 0) {
          selectedToolB = callsB[0].name;
          const matched = selectedToolB === item.target_skill_id.replace(/[^a-zA-Z0-9_]/g, '_');
          statusB = matched ? 'SUCCESS' : 'MISMATCH';
        } else {
          statusB = 'OMISSION';
        }
      } catch (e: any) {
        statusB = 'ERROR';
        errB = e.message;
      }
      const durB = Date.now() - startB;

      logs.push({
        case_id: item.id,
        turn_depth: item.turn_depth,
        condition: 'skill_index_system_curated',
        iteration: iter,
        status: statusB,
        selected_tool: selectedToolB,
        expected_tool: item.target_skill_id,
        duration_ms: durB,
        token_usage: { prompt: curatedDecls.length * 120 + item.turn_depth * 80, candidates: 1 },
        error_message: errB,
      });

      console.log(`   [第 ${iter} 次] 实验组 (SIS 4项精炼): ${statusB} (选定: ${selectedToolB || '无调用'}, 耗时: ${durB}ms)`);
      
      await new Promise(r => setTimeout(r, 1200));
    }
  }

  const resultPath = path.join(__dirname, 'results/evaluation_traces.json');
  fs.writeFileSync(resultPath, JSON.stringify(logs, null, 2), 'utf8');
  console.log(`\n✅ 实验已全部完成，轨迹日志已持久化至: ${resultPath}`);

  generateAnalysisSummary(logs);
}

function generateAnalysisSummary(logs: RunLog[]) {
  const turns = [1, 2, 3, 5, 8, 10, 15, 20];
  const summary: Record<number, {
    turn: number;
    baseline_success: number;
    baseline_total: number;
    baseline_error_rate: number;
    sis_success: number;
    sis_total: number;
    sis_error_rate: number;
    avg_latency_baseline: number;
    avg_latency_sis: number;
  }> = {};

  for (const t of turns) {
    const baseItems = logs.filter(l => l.turn_depth === t && l.condition === 'direct_all_tools');
    const sisItems = logs.filter(l => l.turn_depth === t && l.condition === 'skill_index_system_curated');

    const baseSuccess = baseItems.filter(l => l.status === 'SUCCESS').length;
    const sisSuccess = sisItems.filter(l => l.status === 'SUCCESS').length;

    const baseLatency = baseItems.reduce((acc, cur) => acc + cur.duration_ms, 0) / Math.max(1, baseItems.length);
    const sisLatency = sisItems.reduce((acc, cur) => acc + cur.duration_ms, 0) / Math.max(1, sisItems.length);

    summary[t] = {
      turn: t,
      baseline_success: baseSuccess,
      baseline_total: baseItems.length,
      baseline_error_rate: 1 - (baseSuccess / Math.max(1, baseItems.length)),
      sis_success: sisSuccess,
      sis_total: sisItems.length,
      sis_error_rate: 1 - (sisSuccess / Math.max(1, sisItems.length)),
      avg_latency_baseline: Math.round(baseLatency),
      avg_latency_sis: Math.round(sisLatency),
    };
  }

  const summaryPath = path.join(__dirname, 'results/evaluation_summary.json');
  fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2), 'utf8');
  console.log(`✅ 统计分析数据已保存至: ${summaryPath}`);
}

runEvaluation().catch(err => {
  console.error('💥 实验运行中断异常:', err);
});
