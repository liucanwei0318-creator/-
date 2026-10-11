import { INITIAL_SKILLS } from '../src/data/defaultSkills';
import { SkillIndexRouter } from '../src/services/router';

const router = new SkillIndexRouter(INITIAL_SKILLS, 0);
const queries = [
  { label: 'T1: 数据折线图', q: '请分析这份各季度市场销售业绩数据，计算各区域增长率并绘制同比走势折线图。' },
  { label: 'T2: 排版导出Markdown', q: '把刚生成的折线图和统计表格整合并排版，转换导出为标准的带排版 Markdown 文档格式。' },
  { label: 'T3: 水印防泄露', q: '为了防止该文档在外部合作伙伴审计流转过程中被截屏未授权泄漏，请在文档每页斜向添加内部绝密半透明盲水印。' },
  { label: 'T5: 西雅图天气', q: '下周我们团队要出差去西雅图参加云原生峰会，请获取西雅图未来5天的逐日天气气温和降水概率。' },
  { label: 'T8: 股票行情', q: '我们打算在西雅图期间跟华尔街机构沟通，请调取英伟达（NVDA）最新的盘中实时股票行情。' },
  { label: 'T10: 邮件通知', q: '请向团队核心人员发出一封包含西雅图每日议程与天气提醒的内部日程确认邮件，抄送运营团队。' },
  { label: 'T15: 容器沙箱', q: '回国后我们要在内网搭建自动化测试集群，请为我构建一个预装 Python 3.11 与 PyTorch 的隔离轻量 Linux 容器沙箱。' },
  { label: 'T20: 协同看板', q: '最后，根据我们在过去 20 轮对话中讨论的所有技术方案与参会纪要，在团队工作群组中生成并同步一个可交互的协作看板。' }
];

for (const item of queries) {
  const r = router.extractQuerySpecificSubset(item.q, 4);
  console.log(`[${item.label}] Top 1: ${r.selectedSubset[0]?.skill_id} (${r.selectedSubset[0]?.display_name})`);
  console.log(`       子集 Top-4: ${r.selectedSubset.map(s => s.skill_id).join(', ')}`);
}
