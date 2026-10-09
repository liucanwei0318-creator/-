import express from 'express';
import path from 'path';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = parseInt(process.env.PORT || '3000', 10);

app.use(express.json());

// API 路由：智能体对话与技能驱动生成
app.post('/api/agent/chat', async (req, res) => {
  try {
    const { messages, systemInstruction, toolExecutionSummary, model = 'gemini-3.8-flash' } = req.body;
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
    
    // 转换消息格式为 Gemini API contents
    const rawMessages = Array.isArray(messages) ? [...messages] : [{ role: 'user', content: String(messages) }];

    // 如果包含工具执行产物，将真实结果作为上下文注入到最后一轮用户提问中
    const lastUserIdx = rawMessages.map((m) => m.role).lastIndexOf('user');
    if (lastUserIdx !== -1 && toolExecutionSummary) {
      rawMessages[lastUserIdx] = {
        role: 'user',
        content: `${rawMessages[lastUserIdx].content}\n\n【底层挂载技能真实执行产出 (Verified Tool Outputs)】:\n${toolExecutionSummary}\n\n【指示】：请以专业智能体的口吻，充分结合并直接呈现上述技能工具执行的真实结果，向用户作出详尽、准确、条理清晰的业务汇报与解答。`,
      };
    }

    const contents = rawMessages.map((m: { role: string; content: string }) => ({
      role: m.role === 'assistant' || m.role === 'model' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }));

    const validModel = model === 'gemini-3.1-pro-preview' ? 'gemini-3.1-pro-preview' : 'gemini-3.8-flash';

    const response = await ai.models.generateContent({
      model: validModel,
      contents,
      config: {
        systemInstruction: systemInstruction || '你是一个集成了技能索引与人机治理机制的专业 AI 智能体助手。当底层技能返回结果时，请以第一人称直接向用户报告结果。',
      },
    });

    const reply = response.text || '';
    return res.json({ reply, fallback: false });
  } catch (err: any) {
    console.error('Agent Chat Gemini API Error:', err);
    return res.json({
      fallback: true,
      error: err?.message || '调用大模型发生异常，已回退到本地逻辑引擎',
    });
  }
});

// 本地智能技能推断器（无 API Key 或网络异常时的坚固兜底引擎）
function generateLocalSkillFallback(userText: string, currentDraft?: any) {
  const text = (userText || '').trim();
  let name = 'Smart_Business_Tool';
  let displayName = '智能业务自动化助手';
  let description = '根据用户日常业务诉求，自动执行特定流程并产出标准化成果。';
  let clusters = ['办公协同', '自动化流程'];
  let required_slots = ['target_content', 'operator_note'];
  let slots_explanation: Record<string, string> = {
    target_content: '待处理的核心业务内容或文件链接',
    operator_note: '操作人备注与定制要求',
  };
  let negative_triggers = ['请勿在未经复核的情况下执行批量删除', '请勿用于非授权业务范围'];
  let disambiguation_features = '区别于通用脚本，专为业务人员定制，提供参数前置合规检测与可视化流转。';
  let mock_preview = '【业务流程执行完毕】已成功处理输入内容，数据已归档，状态：审核通过。';

  if (/offer|录用|入职|hr|人事|求职|招聘/i.test(text)) {
    name = 'HR_Offer_Courier';
    displayName = 'HR 录用 Offer 邮件智能发送';
    description = '专为企业招聘人事打造，根据录用参数自动生成合规 Offer 邮件并通知候选人与用人部门。';
    clusters = ['人力资源', '邮件通讯'];
    required_slots = ['candidate_name', 'candidate_email', 'salary_package', 'start_date'];
    slots_explanation = {
      candidate_name: '候选人真实姓名（例如：张三）',
      candidate_email: '候选人收件邮箱（例如：zhangsan@example.com）',
      salary_package: '核定薪酬福利方案（例如：25,000元/月 + 14薪）',
      start_date: '约定入职报到日期（例如：2026-11-01）',
    };
    negative_triggers = ['请勿用于群发营销广告与非招聘邮件', '请勿用于发送辞退或劳动争议解除通知'];
    disambiguation_features = '区别于普通邮件群发工具，本技能专为HR入职流程定制，自带密薪防泄密与法定劳动合同模板校验。';
    mock_preview = '【Offer 邮件发送成功】已向候选人 张三 (zhangsan@example.com) 发送《录用通知函》，薪资: 25k/月，入职日期: 2026-11-01，抄送用人部门经理。';
  } else if (/发票|报销|财务|报账|税务|账单/i.test(text)) {
    name = 'Finance_Invoice_Auditor';
    displayName = '财务发票合规初审与报销助手';
    description = '自动识别电子发票抬头、税号、金额与真伪，快速对照企业报销标准给出初审结论。';
    clusters = ['财务报销', '文档处理'];
    required_slots = ['invoice_file', 'department_name', 'expense_type'];
    slots_explanation = {
      invoice_file: '电子发票文件路径或发票代码/号码',
      department_name: '报销人所属部门（例如：产品研发部）',
      expense_type: '费用所属类目（例如：差旅交通、商务招待、办公用品）',
    };
    negative_triggers = ['请勿用于个人非因公消费报销入账', '请勿处理未加盖发票专用章的收据凭证'];
    disambiguation_features = '专用于发票真伪查验与企业内部限额匹配，区别于单纯的 OCR 识字工具。';
    mock_preview = '【发票初审通过】发票代码：011002300111，价税合计：¥1,280.00，公司税号校验一致，类目【差旅交通】在月度预算限额内，建议放行。';
  } else if (/退款|电商|订单|客服|售后|发货/i.test(text)) {
    name = 'Ecommerce_Refund_Guard';
    displayName = '电商售后退款风控拦截与审核';
    description = '对消费者的退款诉求进行物流节点比对、信用初筛与无理由退换货规则校验。';
    clusters = ['电商运营', '客户服务'];
    required_slots = ['order_id', 'refund_reason', 'logistics_status'];
    slots_explanation = {
      order_id: '电商平台交易订单号（例如：ORD-202610-9981）',
      refund_reason: '买家申请退款的理由（例如：商品与描述不符、未收到货）',
      logistics_status: '当前包裹物流状态（例如：已签收、运输途中、揽收失败）',
    };
    negative_triggers = ['货物已在途且未拦截成功时，请勿直接原路退款', '请勿用于高风险洗钱欺诈账户'];
    disambiguation_features = '融合了物流节点真实状态与售后风控规则，区别于普通的静态客服问答机器人。';
    mock_preview = '【退款工单审核建议】订单 ORD-202610-9981 买家信誉良好，物流已返回始发仓，同意退款申请并触发原路退款 ¥299.00。';
  } else if (/会议|纪要|备忘|决议|录音/i.test(text)) {
    name = 'Meeting_Action_Extractor';
    displayName = '智能会议纪要与待办决议提炼';
    description = '将冗长的会议录音转写文本，智能提炼为核心决议、责任人清单与截止日期。';
    clusters = ['办公协同', '文档处理'];
    required_slots = ['meeting_transcript', 'project_name'];
    slots_explanation = {
      meeting_transcript: '会议转写全文或主要发言速记',
      project_name: '关联的目标项目名称（例如：SkillPilot 2.0 升级）',
    };
    negative_triggers = ['请勿收录与会议决议无关的闲聊与个人隐私八卦', '非结论性探讨请勿标记为待办任务'];
    disambiguation_features = '专注于结构化行动项 (Action Items) 责任矩阵提取，非泛泛的全文翻译或普通摘要。';
    mock_preview = '【会议纪要提炼完毕】共识别 3 项核心决议、4 项待办任务。主要负责人：李工（10月15日前交付API规范），已同步至协同看板。';
  } else if (/小红书|文案|营销|朋友圈|自媒体|脚本/i.test(text)) {
    name = 'Social_Media_Copywriter';
    displayName = '新媒体爆款文案与脚本创作';
    description = '针对不同社交平台算法与受众风格，生成极具吸引力的标题、痛点段落与互动引导。';
    clusters = ['市场营销', '文案创作'];
    required_slots = ['product_topic', 'target_audience', 'platform_style'];
    slots_explanation = {
      product_topic: '要推广的产品或核心卖点（例如：护眼智能台灯）',
      target_audience: '目标受众群体（例如：备战考研学生、程序员、宝妈）',
      platform_style: '目标平台调性（例如：小红书干货风、抖音短剧口播、公众号深度种草）',
    };
    negative_triggers = ['请勿生成违反广告法的绝对化用语（如国家级、顶级、第一）', '请勿虚构无根据的医疗保健功效'];
    disambiguation_features = '自带平台算法合规敏感词自检，具备高点赞互动引导钩子。';
    mock_preview = '【爆款文案生成】标题：《打工人自救！桌面换了它，熬夜写代码眼睛再也没酸过🔥》内含3个互动提问与高赞标签 #程序员好物 #办公好物。';
  }

  const draft = {
    name,
    displayName,
    description,
    clusters,
    required_slots,
    slots_explanation,
    negative_triggers,
    disambiguation_features,
    mock_preview,
  };

  const reply = `你好！我已经理解了你的业务想法：“${text.slice(0, 40)}${text.length > 40 ? '...' : ''}”。

为了让你不需要写任何代码就能让智能体拥有这个能力，我为你精心架构并自动生成了一份标准的【技能蓝图（Skill Blueprint）】：

🌟 **技能名称**：${displayName} (\`${name}\`)
🎯 **解决什么问题**：${description}
🏷️ **所属领域分类**：${clusters.join(' / ')}
📋 **运行时需要提供的关键信息 (参数槽位)**：
${required_slots.map((s) => `  - **${s}**：${slots_explanation[s] || '必要输入项'}`).join('\n')}
🛡️ **防乱用/硬性排除规则 (负向触发条件)**：
${negative_triggers.map((n) => `  - ❌ ${n}`).join('\n')}
💎 **防冲突独特优势 (消歧特征)**：
  - ✨ ${disambiguation_features}

👉 **右侧面板已实时为你渲染出可视化的技能卡片！** 你可以直接查看门禁排他检查结果，如果觉得满意，点击**【一键注册并上线该技能】**即可立即生效；如果你还想增加参数或提出补充要求，随时在对话框里告诉我！

\`\`\`json
${JSON.stringify(draft, null, 2)}
\`\`\``;

  return { reply, draft };
}

// API 路由：AI 零代码技能架构师多轮对话
app.post('/api/skill/architect-chat', async (req, res) => {
  try {
    const {
      messages,
      currentDraft,
      existingSkills = [],
      model = 'gemini-3.5-flash',
    } = req.body;
    const apiKey = process.env.GEMINI_API_KEY;

    const rawMessages = Array.isArray(messages)
      ? [...messages]
      : [{ role: 'user', content: String(messages || '') }];
    const lastUserMessage = [...rawMessages].reverse().find((m) => m.role === 'user')?.content || '';

    // 若无 API Key，平滑回退至本地高质量架构生成器
    if (!apiKey) {
      const fallbackResult = generateLocalSkillFallback(lastUserMessage, currentDraft);
      return res.json({
        reply: fallbackResult.reply,
        draft: fallbackResult.draft,
        fallback: true,
        notice: '系统已启用内置高保真技能架构逻辑引擎为你极速解析生成。',
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

    const existingSkillsSummary = Array.isArray(existingSkills) && existingSkills.length > 0
      ? existingSkills
          .slice(0, 15)
          .map((s: any) => `- 名称: ${s.name}, 领域: [${(s.clusters || []).join(', ')}], 描述: ${s.description || ''}`)
          .join('\n')
      : '暂无冲突历史技能';

    const systemInstruction = `你是一名顶级且富有同理心的“AI Agent 技能架构大师（AI Skill Architect）”。
你的使命是帮助【完全没有任何编程基础、不会写代码】的普通业务人员（如HR、财务、行政、运营、电商卖家、教师、产品经理等），通过像朋友聊天一样通俗易懂的多轮对话，将他们用大白话或日常口语描述的工作需求，直接转化为高质量、严密规范的 Agent 可执行技能（Skill）。

【交互原则与沟通风格】：
1. 态度热情、鼓励性强、解答通俗。严禁使用技术黑话（如 REST API, Payload, JSON Schema, Regex, 数据库连接池等）。用“需要填写的参数信息”、“适用领域”、“防踩坑规则”、“特色消歧点”等普通人一秒能懂的话解释。
2. 即使用户的描述只有一句话或非常简短，你也要主动根据常理进行贴心的业务拓展，补齐其所需的完整参数与防错规则。
3. 系统库中现存的部分技能如下，请参考并避免与其直接同名或发生无意义冲突，必要时做好消歧区隔：
${existingSkillsSummary}

4. 格式要求（必须严格遵守）：
在你的自然语言回复正文的末尾，必须输出且仅输出一个合法的 JSON 代码块（用 \`\`\`json 和 \`\`\` 包裹），结构必须严格满足以下字段：
\`\`\`json
{
  "name": "英文下划线或大驼峰标识，如 HROfferSender",
  "displayName": "通俗中文名，如 HR 录用 Offer 邮件智能发送",
  "description": "2-3句话通俗说明该技能帮用户完成什么任务，适用于什么场景",
  "clusters": ["业务领域1", "业务领域2"],
  "required_slots": ["参数英文名1", "参数英文名2"],
  "slots_explanation": {
    "参数英文名1": "该参数的通俗人话解释与输入例子",
    "参数英文名2": "该参数的通俗人话解释与输入例子"
  },
  "negative_triggers": [
    "防乱用硬性规则1（以'请勿...'或'不要...'开头）",
    "防乱用硬性规则2"
  ],
  "disambiguation_features": "说明该技能与其它普通类似工具有什么不同，具备什么专业特性",
  "mock_preview": "执行成功的逼真业务成果展示文本"
}
\`\`\`
注意：该 JSON 将直接供前端系统解析并一键渲染为技能卡片，请确保 JSON 严格合法可被 JSON.parse 解析。`;

    const contents = rawMessages.map((m: { role: string; content: string }) => ({
      role: m.role === 'assistant' || m.role === 'model' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }));

    // 根据用户要求支持模型切换：gemini-3.1-pro-preview (复杂), gemini-3.5-flash (通用), gemini-3.1-flash-lite (极速)
    const validModel =
      model === 'gemini-3.1-pro-preview'
        ? 'gemini-3.1-pro-preview'
        : model === 'gemini-3.1-flash-lite'
        ? 'gemini-3.1-flash-lite'
        : 'gemini-3.5-flash';

    const response = await ai.models.generateContent({
      model: validModel,
      contents,
      config: {
        systemInstruction,
      },
    });

    const reply = response.text || '';
    
    // 从模型输出中提取 JSON 结构
    let extractedDraft: any = null;
    const jsonMatch = reply.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (jsonMatch && jsonMatch[1]) {
      try {
        extractedDraft = JSON.parse(jsonMatch[1]);
      } catch (e) {
        console.warn('Failed to parse draft JSON from Gemini reply, using fallback extractor', e);
      }
    }

    // 若未成功提取 JSON，用本地启发式兜底补充 draft 对象
    if (!extractedDraft) {
      const fallbackResult = generateLocalSkillFallback(lastUserMessage, currentDraft);
      extractedDraft = fallbackResult.draft;
    }

    return res.json({
      reply,
      draft: extractedDraft,
      fallback: false,
    });
  } catch (err: any) {
    console.error('Skill Architect Gemini API Error:', err);
    // 优雅回退
    const rawMessages = Array.isArray(req.body.messages) ? req.body.messages : [];
    const lastUserMessage = [...rawMessages].reverse().find((m: any) => m.role === 'user')?.content || '';
    const fallbackResult = generateLocalSkillFallback(lastUserMessage, req.body.currentDraft);
    return res.json({
      reply: fallbackResult.reply,
      draft: fallbackResult.draft,
      fallback: true,
      error: err?.message,
    });
  }
});

// 开发模式与生产模式中间件配置
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.resolve(__dirname, 'dist')));
  app.get('*', (_req, res) => {
    res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
  });
} else {
  const { createServer: createViteServer } = await import('vite');
  const vite = await createViteServer({
    server: { middlewareMode: true },
    appType: 'spa',
  });
  app.use(vite.middlewares);
}

app.listen(PORT, '0.0.0.0', () => {
  console.log(`SkillPilot Agent Server is running on port ${PORT}`);
});
