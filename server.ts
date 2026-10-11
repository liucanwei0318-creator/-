import express from 'express';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';
import { createServer as createViteServer } from 'vite';
import {
  startNewExperiment,
  getExperimentStatus,
  cancelRunningExperiment,
} from './experiments/experimentService.ts';
import { buildBenchmarkDocxReport } from './experiments/reportDocxGenerator.ts';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = parseInt(process.env.PORT || '3000', 10);

  app.use(express.json());

  // API: 获取长对话错误率对比实验数据 (支持指定历史轮次 runId 或全部汇总)
  app.get('/api/experiment/results', (req, res) => {
    try {
      const summaryPath = path.join(__dirname, 'experiments/results/evaluation_summary.json');
      const tracesPath = path.join(__dirname, 'experiments/results/evaluation_traces.json');
      const reportPath = path.join(__dirname, 'experiments/reports/EXPERIMENT_REPORT_BENCHMARK.md');
      const benchmarkPath = path.join(__dirname, 'experiments/benchmarks/benchmark_dataset.json');
      const historyPath = path.join(__dirname, 'experiments/results/experiment_history.json');

      if (fs.existsSync(summaryPath) && fs.existsSync(tracesPath)) {
        let summary = JSON.parse(fs.readFileSync(summaryPath, 'utf8'));
        let traces = JSON.parse(fs.readFileSync(tracesPath, 'utf8'));
        const reportMarkdown = fs.existsSync(reportPath) ? fs.readFileSync(reportPath, 'utf8') : '';
        const benchmark = fs.existsSync(benchmarkPath) ? JSON.parse(fs.readFileSync(benchmarkPath, 'utf8')) : [];
        const history = fs.existsSync(historyPath) ? JSON.parse(fs.readFileSync(historyPath, 'utf8')) : [];

        const requestedRunId = req.query.runId as string | undefined;

        // 如果用户指定了特定历史轮次
        if (requestedRunId && requestedRunId !== 'all') {
          const runRecord = history.find((h: any) => h.run_id === requestedRunId);
          if (runRecord && runRecord.summary) {
            summary = runRecord.summary;
          }
          traces = traces.filter((t: any) => t.run_id === requestedRunId);
        }

        return res.json({
          success: true,
          summary,
          traces,
          benchmark,
          reportMarkdown,
          history,
          activeRunId: requestedRunId || 'all',
        });
      } else {
        return res.status(404).json({ success: false, message: '尚未生成实验结果' });
      }
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  // API: 触发运行新一轮对比实验
  app.post('/api/experiment/run', async (req, res) => {
    try {
      const { mode = 'quick', iterationsPerCase = 1 } = req.body || {};
      const result = await startNewExperiment({ mode, iterationsPerCase });
      if (!result.success) {
        return res.status(400).json(result);
      }
      return res.json({ success: true, message: '新一轮实验已启动', status: getExperimentStatus() });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  // API: 轮询查询实验运行状态与实时日志
  app.get('/api/experiment/status', (req, res) => {
    return res.json({ success: true, status: getExperimentStatus() });
  });

  // API: 取消正在进行的实验
  app.post('/api/experiment/cancel', (req, res) => {
    const cancelled = cancelRunningExperiment();
    return res.json({ success: true, cancelled, status: getExperimentStatus() });
  });

  // API: 手动重新生成 Word 报告 (.docx)
  app.post('/api/experiment/regenerate-docx', async (req, res) => {
    try {
      const summaryPath = path.join(__dirname, 'experiments/results/evaluation_summary.json');
      const tracesPath = path.join(__dirname, 'experiments/results/evaluation_traces.json');
      const benchmarkPath = path.join(__dirname, 'experiments/benchmarks/benchmark_dataset.json');
      const historyPath = path.join(__dirname, 'experiments/results/experiment_history.json');

      const summary = fs.existsSync(summaryPath) ? JSON.parse(fs.readFileSync(summaryPath, 'utf8')) : {};
      const traces = fs.existsSync(tracesPath) ? JSON.parse(fs.readFileSync(tracesPath, 'utf8')) : [];
      const benchmark = fs.existsSync(benchmarkPath) ? JSON.parse(fs.readFileSync(benchmarkPath, 'utf8')) : [];
      const history = fs.existsSync(historyPath) ? JSON.parse(fs.readFileSync(historyPath, 'utf8')) : [];

      const docxBuffer = await buildBenchmarkDocxReport(summary, traces, benchmark, history);
      const docxPath = path.join(__dirname, 'experiments/reports/Skill_Index_System_Benchmark_Report.docx');
      fs.writeFileSync(docxPath, docxBuffer);

      return res.json({ success: true, message: 'Word 报告已重新生成', size: docxBuffer.length });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  // API: 直接下载 Word 文档 (.docx)
  app.get('/api/experiment/download/docx', async (req, res) => {
    const docxPath = path.join(__dirname, 'experiments/reports/Skill_Index_System_Benchmark_Report.docx');
    if (!fs.existsSync(docxPath)) {
      // 如果不存在则自动现算并生成一份
      try {
        const summaryPath = path.join(__dirname, 'experiments/results/evaluation_summary.json');
        const tracesPath = path.join(__dirname, 'experiments/results/evaluation_traces.json');
        const benchmarkPath = path.join(__dirname, 'experiments/benchmarks/benchmark_dataset.json');
        const historyPath = path.join(__dirname, 'experiments/results/experiment_history.json');

        const summary = fs.existsSync(summaryPath) ? JSON.parse(fs.readFileSync(summaryPath, 'utf8')) : {};
        const traces = fs.existsSync(tracesPath) ? JSON.parse(fs.readFileSync(tracesPath, 'utf8')) : [];
        const benchmark = fs.existsSync(benchmarkPath) ? JSON.parse(fs.readFileSync(benchmarkPath, 'utf8')) : [];
        const history = fs.existsSync(historyPath) ? JSON.parse(fs.readFileSync(historyPath, 'utf8')) : [];

        const docxBuffer = await buildBenchmarkDocxReport(summary, traces, benchmark, history);
        fs.writeFileSync(docxPath, docxBuffer);
      } catch (e: any) {
        return res.status(500).json({ error: 'Word 文档生成失败: ' + e.message });
      }
    }

    res.setHeader('Content-Disposition', 'attachment; filename="Skill_Index_System_Benchmark_Report.docx"');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    return fs.createReadStream(docxPath).pipe(res);
  });

  // API: 直接下载存储的 JSON 文件
  app.get('/api/experiment/download/:fileKey', (req, res) => {
    const { fileKey } = req.params;
    const fileMap: Record<string, { path: string; filename: string }> = {
      summary: {
        path: path.join(__dirname, 'experiments/results/evaluation_summary.json'),
        filename: 'evaluation_summary.json',
      },
      traces: {
        path: path.join(__dirname, 'experiments/results/evaluation_traces.json'),
        filename: 'evaluation_traces.json',
      },
      benchmark: {
        path: path.join(__dirname, 'experiments/benchmarks/benchmark_dataset.json'),
        filename: 'benchmark_dataset.json',
      },
      history: {
        path: path.join(__dirname, 'experiments/results/experiment_history.json'),
        filename: 'experiment_history.json',
      },
    };

    const fileConfig = fileMap[fileKey];
    if (!fileConfig || !fs.existsSync(fileConfig.path)) {
      return res.status(404).json({ error: 'File not found' });
    }

    res.setHeader('Content-Disposition', `attachment; filename="${fileConfig.filename}"`);
    res.setHeader('Content-Type', 'application/json');
    return fs.createReadStream(fileConfig.path).pipe(res);
  });

  // API 路由：智能体对话与技能驱动生成
  app.post('/api/agent/chat', async (req, res) => {
    try {
      const { messages, systemInstruction, toolExecutionSummary, model = 'gemini-3.1-flash-lite' } = req.body;
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return res.json({
          fallback: true,
          message: '系统当前未注入 GEMINI_API_KEY，自动启用内置的高保真 Agent 逻辑引擎。',
        });
      }

      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          },
        },
      });

      const rawMessages = Array.isArray(messages) ? [...messages] : [{ role: 'user', content: String(messages) }];
      const lastUserIdx = rawMessages.map((m) => m.role).lastIndexOf('user');

      if (lastUserIdx !== -1 && toolExecutionSummary) {
        rawMessages[lastUserIdx] = {
          role: 'user',
          content: `${rawMessages[lastUserIdx].content}\n\n【底层挂载技能真实执行产出 (Verified Tool Outputs)】:\n${toolExecutionSummary}\n\n【指示】：请以专业智能体的口吻，充分结合并直接呈现上述技能工具执行的真实结果，向用户作出详尽、准确、条理清晰的业务汇报与解答。`,
        };
      }

      const contents = rawMessages.map((m: any) => ({
        role: m.role === 'agent' ? 'model' : m.role === 'model' ? 'model' : 'user',
        parts: [{ text: m.content || m.text || '' }],
      }));

      const response = await ai.models.generateContent({
        model: 'gemini-3.1-flash-lite',
        contents,
        config: {
          systemInstruction:
            systemInstruction ||
            '你是一个由 Skill Index System（技能索引系统）赋能的高级智能体。请以专业、可靠、严谨的口吻回答用户提问。',
        },
      });

      return res.json({
        fallback: false,
        message: response.text || '（Agent 已处理指令但无直接文本反馈）',
      });
    } catch (err: any) {
      console.error('Agent chat error:', err);
      return res.json({
        fallback: true,
        error: err.message,
        message: `与底层大模型通信时发生异常（${err.message?.slice(0, 80)}），已回退至本地可信工作流引擎保障业务连续性。`,
      });
    }
  });

  const isProduction = process.env.NODE_ENV === 'production';
  if (!isProduction) {
    // 开发环境挂载 Vite middlewares
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // 生产环境托管构建产物
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`SIS Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
});
