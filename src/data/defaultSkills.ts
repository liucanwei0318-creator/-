import { Skill } from '../types/agent';
import { SimpleEmbeddingProvider } from '../services/embedding';

const rawSkills: Omit<Skill, 'embedding'>[] = [
  // 1. 文档与格式处理组 (Business/Office)
  {
    skill_id: 's1',
    name: 'PDF_Converter',
    display_name: 'PDF 便携式文档转码器',
    description: '用于将文本、Markdown及报表文件转换为高质量标准便携式 PDF 文件',
    clusters: ['文档处理', '文件格式', '办公协作', 'PDF工具'],
    content_domain: '办公协作',
    tool_carrier: 'PDF工具',
    ecosystem: 'business',
    required_slots: ['file_name', 'output_format'],
    negative_triggers: ['请勿用于视频或音频转码', '不要处理未排版的纯图片压缩'],
    disambiguation_features: '专注于将各种业务报告与排版内容高质量转换为标准 PDF/A 交付件',
    call_count: 14,
    error_count: 4, // 28.5% 错误率，用于演示治理告警
    domains_invoked: ['办公自动化', '金融风控', '法务审核'], // 3个领域，演示万金油语义贪婪告警
    mock_executor: (slots, prevOutput) => {
      const fileName = slots.file_name || 'report_summary';
      return `【PDF_Converter 完成】已将数据报告编译为标准化矢量文件: ${fileName}.pdf (大小: 1.4MB, 符合 PDF/A-1b 归档标准)。${prevOutput ? ` (依赖上游数据源: ${prevOutput.slice(0, 30)}...)` : ''}`;
    },
  },
  {
    skill_id: 'my_skill_01',
    name: 'PDF_Watermarker',
    display_name: 'PDF 防伪安全水印注入器',
    description: '为 PDF 文档批量覆加倾斜版权文字或企业机密防伪透明水印',
    clusters: ['文档处理', 'Office工具', '办公协作', 'PDF工具'],
    content_domain: '办公协作',
    tool_carrier: 'PDF工具',
    ecosystem: 'business',
    required_slots: ['file_path', 'watermark_text'],
    negative_triggers: ['请勿用于图片去水印或纯图片格式转换', '不要用于修改 PDF 正文文字内容'],
    disambiguation_features: '专门用于 PDF 加盖版权保护与公司机密水印，支持透明度调节与防伪微缩标',
    call_count: 8,
    error_count: 0,
    domains_invoked: ['办公自动化'],
    mock_executor: (slots, prevOutput) => {
      const text = slots.watermark_text || 'CONFIDENTIAL';
      const file = slots.file_path || 'document.pdf';
      return `【PDF_Watermarker 完成】已在目标文件 [${file}] 的所有页面覆加 45° 倾斜防伪半透明水印: "${text}"，加密图层不可直接复制。`;
    },
  },
  {
    skill_id: 's_word_01',
    name: 'Word_Doc_Formatter',
    display_name: 'Word 公文规范排版助手',
    description: '自动对 .docx 文档应用国家标准公文格式、多级标题层级与页眉页脚样式',
    clusters: ['文档处理', '办公协作', 'Word/Office'],
    content_domain: '办公协作',
    tool_carrier: 'Word/Office',
    ecosystem: 'business',
    required_slots: ['document_title', 'template_style'],
    negative_triggers: ['请勿用于直接编译可执行程序', '不要用于设计海报图片'],
    disambiguation_features: '专注于企业级标准红头文件与合同 Word 模板的一键排版与样式统一',
    call_count: 6,
    error_count: 0,
    domains_invoked: ['行政办公'],
    mock_executor: (slots) => {
      const title = slots.document_title || '立项汇报';
      return `【Word_Doc_Formatter 排版完毕】文档《${title}.docx》已按【三号仿宋_GB2312】公文国标完成正文排版，标题已挂载自动目录索引。`;
    },
  },
  {
    skill_id: 's_excel_01',
    name: 'Excel_Sheet_Pivot',
    display_name: 'Excel 数据透视与报表计算',
    description: '解析 .xlsx 表格多维字段，自动生成分组汇总、透视表与环比增长率函数公式',
    clusters: ['数据分析', '商业金融', 'Excel表格'],
    content_domain: '商业金融',
    tool_carrier: 'Excel表格',
    ecosystem: 'business',
    required_slots: ['sheet_name', 'pivot_dimensions'],
    negative_triggers: ['请勿用于底层分布式数据库集群迁移', '不要用于视频文件剪辑'],
    disambiguation_features: '专用于 Excel 离线工作簿的数据清洗、VLOOKUP 关联与透视表自动化构建',
    call_count: 9,
    error_count: 1,
    domains_invoked: ['商业金融'],
    mock_executor: (slots) => {
      return `【Excel_Sheet_Pivot 透视表生成】已完成对数据表的透视计算，生成【部门/月度/净额】交叉分析矩阵，输出 3 个汇总公式与动态迷你图。`;
    },
  },

  // 2. OpenAI 经典技能生态群 (OpenAI Ecosystem)
  {
    skill_id: 'openai_code_interpreter',
    name: 'OpenAI_Code_Interpreter',
    display_name: 'OpenAI 风格 Python 代码沙箱',
    description: '在隔离沙箱中执行 Python 代码，支持科学计算 NumPy/Pandas 与 Matplotlib 动态绘图',
    clusters: ['技术研发', '数据分析', '代码沙箱'],
    content_domain: '技术研发',
    tool_carrier: '代码沙箱',
    ecosystem: 'openai',
    required_slots: ['code_snippet', 'runtime_env'],
    negative_triggers: ['严禁访问宿主机网络底座与提权操作', '请勿用于物理硬件设备控制'],
    disambiguation_features: '提供带完整 Python 科学库环境的安全虚拟执行器，支持即时生成图表与统计分析',
    call_count: 22,
    error_count: 1,
    domains_invoked: ['技术研发', '算法工程'],
    author: 'OpenAI Ecosystem',
    mock_executor: (slots) => {
      return `【Python 沙箱执行成功】退出码 0，内存占用 42MB。执行耗时 180ms。已生成并保存渲染图表: chart_output.png (均值: 84.2, 标准差: 3.14)。`;
    },
  },
  {
    skill_id: 'openai_web_search',
    name: 'OpenAI_Web_Search',
    display_name: 'OpenAI 实时全网搜索检索',
    description: '连接全球权威搜索引擎，抓取并综合最新新闻动态、行业研报与实时事实数据',
    clusters: ['商业金融', '生活服务', '网络搜索'],
    content_domain: '商业金融',
    tool_carrier: '网络搜索',
    ecosystem: 'openai',
    required_slots: ['query_keyword', 'freshness_filter'],
    negative_triggers: ['请勿检索非公开内网私有凭据', '不要执行破坏性网络扫描探针'],
    disambiguation_features: '具备多网页源事实交叉验证与 URL 引用标记，提供时效性极高的实时信息支撑',
    call_count: 31,
    error_count: 0,
    domains_invoked: ['商业金融', '气象生活'],
    author: 'OpenAI Ecosystem',
    mock_executor: (slots) => {
      const q = slots.query_keyword || 'AI技术趋势';
      return `【Web Search 联网检索】已检索 8 个高权重权威来源。关于「${q}」的最新事实已提取完毕，附带 4 条来源引用标注与置信度评分 0.96。`;
    },
  },
  {
    skill_id: 'openai_vision_ocr',
    name: 'OpenAI_Vision_OCR',
    display_name: 'OpenAI 多模态视觉版面识别',
    description: '识别复杂图片中的手写体、印刷文字、多栏版面布局、印章标记与表格结构',
    clusters: ['办公协作', '视觉图像', '文档处理'],
    content_domain: '办公协作',
    tool_carrier: '视觉图像',
    ecosystem: 'openai',
    required_slots: ['image_url', 'detail_level'],
    negative_triggers: ['请勿处理高噪点损坏的纯音频文件', '不要用于生成虚假合成图像'],
    disambiguation_features: '支持高分辨率图文版面多模态结构化解析，精准输出 Markdown 与 JSON 树状层级',
    call_count: 15,
    error_count: 0,
    domains_invoked: ['办公协作'],
    author: 'OpenAI Ecosystem',
    mock_executor: (slots) => {
      return `【Vision OCR 识别完成】检测到清晰排版图像，提取出 4 段正文标题、2 张数据表格与 1 处红色骑缝章，置信度 99.2%。已转换为标准 Markdown 结构。`;
    },
  },
  {
    skill_id: 'openai_dalle_generator',
    name: 'OpenAI_DallE_Visualizer',
    display_name: 'OpenAI 商业视觉意象生图引擎',
    description: '依据文本描述生成 4K 商业概念图、产品渲染图与信息图表视觉素材',
    clusters: ['设计营销', '视觉图像'],
    content_domain: '市场营销',
    tool_carrier: '视觉图像',
    ecosystem: 'openai',
    required_slots: ['prompt_concept', 'aspect_ratio', 'visual_style'],
    negative_triggers: ['严禁生成违反公序良俗或侵犯他人肖像权的伪造素材', '不要用于生成纯矢量代码'],
    disambiguation_features: '基于 DALL-E 架构的艺术级视觉构想图渲染，支持写实风、扁平插画与 3D 渲染多风格切换',
    call_count: 14,
    error_count: 0,
    domains_invoked: ['市场营销'],
    author: 'OpenAI Ecosystem',
    mock_executor: (slots) => {
      const p = slots.prompt_concept || '未来科技城市';
      return `【DALL-E 视觉渲染成功】已生成高质量图像: "${p}" (分辨率: 1024x1024, 色彩空间: sRGB, 风格: 极简科技感)，已生成临时访问 CDN 链接。`;
    },
  },
  {
    skill_id: 'openai_rag_retriever',
    name: 'OpenAI_File_Search_RAG',
    display_name: 'OpenAI 知识库向量切片检索',
    description: '在私有向量文档库中执行混合语义检索 (Dense + BM25)，按相关性召回匹配文本段',
    clusters: ['文档处理', '网络搜索'],
    content_domain: '办公协作',
    tool_carrier: '网络搜索',
    ecosystem: 'openai',
    required_slots: ['vector_store_id', 'query_prompt'],
    negative_triggers: ['请勿用于直接覆写修改知识库底层源文件', '不要跨权限查询绝密未授权分卷'],
    disambiguation_features: '原生支持多格式分块切片重排序 (Rerank) 与最高相似度 Top-K 召回带页码溯源',
    call_count: 20,
    error_count: 0,
    domains_invoked: ['办公协作', '技术研发'],
    author: 'OpenAI Ecosystem',
    mock_executor: (slots) => {
      return `【File Search 召回完成】从向量库召回 3 段最相关内容块（相关性得分: 0.94, 0.89, 0.82），附带对应 PDF 原文页码 p.12 与 p.45 来源。`;
    },
  },
  {
    skill_id: 'openai_whisper_transcriber',
    name: 'OpenAI_Whisper_Transcriber',
    display_name: 'OpenAI Whisper 多语言语音转录',
    description: '高保真转录会议录音与音频播客，支持 98 种语言混杂识别与时间戳对齐 (VAD)',
    clusters: ['办公协作', '视觉图像'],
    content_domain: '办公协作',
    tool_carrier: '视觉图像',
    ecosystem: 'openai',
    required_slots: ['audio_file', 'language_hint'],
    negative_triggers: ['请勿用于高频超低延迟的单字唤醒词探测', '不要用于纯乐器声波混音合成'],
    disambiguation_features: '基于 Whisper Large-v3 模型的端到端鲁棒语音转录，自动剔除咳嗽背景杂音并生成精确 SRT 字幕',
    call_count: 12,
    error_count: 0,
    domains_invoked: ['办公协作'],
    author: 'OpenAI Ecosystem',
    mock_executor: (slots) => {
      return `【Whisper 转录完成】音频时长 18分30秒。语言自动识别为 zh-CN (置信度 99.4%)。已导出逐字稿与带毫秒级时间戳的 SRT 轨道。`;
    },
  },

  // 3. Claude 经典技能生态群 (Claude Ecosystem)
  {
    skill_id: 'claude_bash_executor',
    name: 'Claude_Bash_Executor',
    display_name: 'Claude 风格安全 Shell 命令行环境',
    description: '在安全隔离的 Linux 子系统中执行标准 Shell 指令、文件检索与环境变量检查',
    clusters: ['技术研发', '系统运维', '代码沙箱'],
    content_domain: '技术研发',
    tool_carrier: '代码沙箱',
    ecosystem: 'claude',
    required_slots: ['command', 'timeout_seconds'],
    negative_triggers: ['禁止执行 sudo rm -rf 等破坏性全盘抹除', '不要篡改安全内核策略'],
    disambiguation_features: '模拟 Anthropic Claude Computer Use 架构下的安全 POSIX Shell 沙箱上下文管理',
    call_count: 17,
    error_count: 2,
    domains_invoked: ['技术研发'],
    author: 'Claude Ecosystem',
    mock_executor: (slots) => {
      const cmd = slots.command || 'ls -la';
      return `【Claude Bash 终端】$ ${cmd}\n输出: total 12\ndrwxr-xr-x 3 user user 4096 Oct  9 07:00 src\n-rw-r--r-- 1 user user  892 Oct  9 07:00 package.json\n[Process completed with exit status 0]`;
    },
  },
  {
    skill_id: 'claude_contract_auditor',
    name: 'Claude_Contract_Auditor',
    display_name: 'Claude 长文本合同法律合规审计',
    description: '利用长上下文窗口深度比对商业合同条款，精准识别权责不对等、违约金陷阱与合规漏洞',
    clusters: ['法务合规', '文档处理', 'Word/Office'],
    content_domain: '法务合规',
    tool_carrier: 'Word/Office',
    ecosystem: 'claude',
    required_slots: ['contract_text', 'jurisdiction'],
    negative_triggers: ['请勿作为正式具有司法效力的法庭辩护词替代品', '不要用于编写恶意攻击代码'],
    disambiguation_features: '专为万字以上复杂法律合同条款审计设计，内置多法域劳动法、民法典与保密协议合规知识库',
    call_count: 13,
    error_count: 0,
    domains_invoked: ['法务合规'],
    author: 'Claude Ecosystem',
    mock_executor: (slots) => {
      return `【Claude 法律合规审计报告】审查完毕：合同共计 14,200 字。发现 2 处中度风险条款（第8.2条不可抗力定义偏窄、第12条违约责任赔偿上限缺失），建议按范本修改。`;
    },
  },
  {
    skill_id: 'claude_computer_use',
    name: 'Claude_Computer_Use_GUI',
    display_name: 'Claude 桌面 GUI 交互自动化',
    description: '基于 Anthropic Computer Use 规范，通过截屏感知视窗并模拟点击输入驱动桌面应用',
    clusters: ['技术研发', '办公协作', '系统运维'],
    content_domain: '技术研发',
    tool_carrier: '系统运维',
    ecosystem: 'claude',
    required_slots: ['target_action', 'coordinate_x', 'coordinate_y'],
    negative_triggers: ['禁止操作未经授权的支付网银密码键盘', '禁止绕过系统管理员 UAC 弹窗确认'],
    disambiguation_features: '原生适配 Anthropic OS-World 与屏幕坐标定位协议，支持像素级跨应用连续鼠标键盘事件流',
    call_count: 16,
    error_count: 1,
    domains_invoked: ['技术研发', '办公协作'],
    author: 'Claude Ecosystem',
    mock_executor: (slots) => {
      return `【Claude Computer Use 动作执行】截获当前 1920x1080 视窗。成功将光标移动至元素位置并在输入框完成填充，界面重绘就绪。`;
    },
  },
  {
    skill_id: 'claude_artifacts_builder',
    name: 'Claude_Artifacts_Builder',
    display_name: 'Claude 交互式 Artifacts 代码沙箱',
    description: '即时编译并运行 React、SVG、Mermaid 流程图与 HTML 单文件独立交互微应用',
    clusters: ['技术研发', '视觉图像', '代码沙箱'],
    content_domain: '技术研发',
    tool_carrier: '代码沙箱',
    ecosystem: 'claude',
    required_slots: ['artifact_type', 'code_payload', 'title'],
    negative_triggers: ['请勿注入外部恶意追踪 Cookie 或 XSS 脚本', '不要用于编写系统驱动二进制'],
    disambiguation_features: '提供独立的 iframe 隔离沙盒环境，即时渲染交互式图表与 UI 组件预览并支持一键下载',
    call_count: 19,
    error_count: 0,
    domains_invoked: ['技术研发'],
    author: 'Claude Ecosystem',
    mock_executor: (slots) => {
      return `【Artifacts 构建完成】组件已在隔离容器渲染成功，挂载 3 个可交互状态滑块，已生成纯净静态预览视窗。`;
    },
  },
  {
    skill_id: 'claude_multi_doc_synthesizer',
    name: 'Claude_Multi_Doc_Synthesizer',
    display_name: 'Claude 跨案卷多文档证据比对',
    description: '在 200k 上下文窗口中同时比对多份调查报告与证据陈述，自动提炼口径冲突与时间线偏差',
    clusters: ['法务合规', '办公协作', 'Word/Office'],
    content_domain: '法务合规',
    tool_carrier: 'Word/Office',
    ecosystem: 'claude',
    required_slots: ['documents_list', 'investigation_focus'],
    negative_triggers: ['请勿用于篡改原始证据文档的哈希校验值', '不要生成无来源支持的臆断推论'],
    disambiguation_features: '专精于跨案卷冲突分析 (Conflict Cross-Examination)，输出带引用溯源的精准对比矩阵',
    call_count: 11,
    error_count: 0,
    domains_invoked: ['法务合规'],
    author: 'Claude Ecosystem',
    mock_executor: (slots) => {
      return `【多文档交叉比对报告】比对 4 份证言与财务流水：在【2024-03-12 14:00】时间点发现 2 处陈述冲突（发票报销时间早于出行登机记录 3 小时）。`;
    },
  },

  // 4. DeepSeek 经典技能生态群 (DeepSeek Ecosystem)
  {
    skill_id: 'deepseek_math_prover',
    name: 'DeepSeek_Math_Prover',
    display_name: 'DeepSeek 深度数学定理与逻辑证明',
    description: '通过思维链强化推理解决高等数学、微积分、数论推导与概率统计复杂问题',
    clusters: ['技术研发', '算法推理', '代码沙箱'],
    content_domain: '技术研发',
    tool_carrier: '代码沙箱',
    ecosystem: 'deepseek',
    required_slots: ['problem_statement', 'proof_method'],
    negative_triggers: ['请勿用于撰写虚构谣言故事', '不要生成未经证明的玄学猜测'],
    disambiguation_features: '集成 DeepSeek-R1 风格的长思考链（Reasoning Chain）严密分步逻辑验证体系',
    call_count: 18,
    error_count: 0,
    domains_invoked: ['技术研发'],
    author: 'DeepSeek Ecosystem',
    mock_executor: (slots) => {
      return `【DeepSeek 推理证明完成】思考过程已自闭环：通过构造拉格朗日乘子与柯西不等式证明，确定极值点为 (x=2, y=3)，目标函数最优值已严格收敛。`;
    },
  },
  {
    skill_id: 'deepseek_sql_querier',
    name: 'DeepSeek_SQL_Querier',
    display_name: 'DeepSeek 企业级关系数据库查询器',
    description: '将自然语言业务指标转换为安全合规的只读 SQL 语句并查询数据库返回统计集',
    clusters: ['商业金融', '数据分析', 'SQL数据库'],
    content_domain: '商业金融',
    tool_carrier: 'SQL数据库',
    ecosystem: 'deepseek',
    required_slots: ['schema_context', 'natural_query'],
    negative_triggers: ['严禁执行 DROP, TRUNCATE, DELETE, ALTER 等破坏性DDL/DML操作', '禁止跨库越权读取密码哈希'],
    disambiguation_features: '严格遵循数据库只读安全沙箱规范，自带 SQL 注入静态语法树拦截与慢查询优化',
    call_count: 24,
    error_count: 1,
    domains_invoked: ['商业金融', '数据分析'],
    author: 'DeepSeek Ecosystem',
    mock_executor: (slots) => {
      return `【SQL 查询执行完毕】执行语句: SELECT region, SUM(amount) AS total FROM sales_order GROUP BY region ORDER BY total DESC LIMIT 5;\n返回 5 行记录，耗时 12ms。`;
    },
  },
  {
    skill_id: 'deepseek_r1_reasoner',
    name: 'DeepSeek_R1_Logic_Reasoner',
    display_name: 'DeepSeek-R1 复杂运筹逻辑与长链推理',
    description: '运用强化学习自进化推理模型，破解复杂运筹调度、博弈树极值与离散数学最优化决策',
    clusters: ['技术研发', '算法推理', '代码沙箱'],
    content_domain: '技术研发',
    tool_carrier: '代码沙箱',
    ecosystem: 'deepseek',
    required_slots: ['constraints_scenario', 'objective_function'],
    negative_triggers: ['请勿用于撰写无逻辑的纯娱乐八卦段子', '不要在无目标约束的场景下无效消耗算力'],
    disambiguation_features: '基于 DeepSeek-R1 纯强化学习反思架构，展示完整深度思考链 (CoT) 与动态回溯修正轨迹',
    call_count: 26,
    error_count: 0,
    domains_invoked: ['技术研发', '商业金融'],
    author: 'DeepSeek Ecosystem',
    mock_executor: (slots) => {
      return `【DeepSeek-R1 深度长链推理】<think>\n1. 建模为有向无环图最短路径问题...\n2. 发现分支节点 4 存在容量瓶颈，触发动态回溯剪枝...\n3. 得到全局帕累托最优解。</think>\n最优调度方案：流水线总耗时缩短 38.5%，达成资源均衡利用。`;
    },
  },
  {
    skill_id: 'deepseek_quant_finance',
    name: 'DeepSeek_Financial_Quant',
    display_name: 'DeepSeek 量化金融因子与对冲分析',
    description: '计算高频时间序列金融收益率因子、夏普比率、最大回撤与多资产对冲配对协整性',
    clusters: ['商业金融', '数据分析', 'Excel表格'],
    content_domain: '商业金融',
    tool_carrier: 'Excel表格',
    ecosystem: 'deepseek',
    required_slots: ['ticker_symbols', 'historical_window', 'factor_model'],
    negative_triggers: ['请勿提供不带合规风险揭示的投资包赚收益保证承诺', '严禁用于非法内幕交易预测'],
    disambiguation_features: '搭载 Barra 多因子风险模型与协整配对套利检验，输出严谨的置信区间与对冲压力测试指标',
    call_count: 15,
    error_count: 0,
    domains_invoked: ['商业金融'],
    author: 'DeepSeek Ecosystem',
    mock_executor: (slots) => {
      return `【量化分析完成】资产池 60 日动量因子回测：夏普比率 1.82，年化超额收益率 14.6%，最大回撤控制在 4.2% 以内。两资产残差平稳性 ADF 检验 p-value < 0.01。`;
    },
  },
  {
    skill_id: 'deepseek_system_disassembler',
    name: 'DeepSeek_System_Disassembler',
    display_name: 'DeepSeek 底层汇编与系统安全逆向',
    description: '反汇编 x86_64/ARM 二进制操作码，深度追踪函数调用栈帧、缓冲区溢出与内存泄露隐患',
    clusters: ['技术研发', '系统运维', '代码沙箱'],
    content_domain: '技术研发',
    tool_carrier: '代码沙箱',
    ecosystem: 'deepseek',
    required_slots: ['assembly_opcode', 'target_arch'],
    negative_triggers: ['严禁为未授权系统编写恶意勒索软件利用载荷', '禁止破解带有国家安全保护的保密芯片'],
    disambiguation_features: '精准定位 C/C++ 内存管理漏洞与指针悬挂风险，提供重构后的安全现代 Rust 语义等价实现建议',
    call_count: 10,
    error_count: 0,
    domains_invoked: ['技术研发'],
    author: 'DeepSeek Ecosystem',
    mock_executor: (slots) => {
      return `【汇编逆向剖析】分析 128 条指令：在 sub_4012A0 处检测到未受保护的 strcpy 栈溢出风险 (CWE-121)，已标记溢出偏移量并在报告中提供安全防御补丁。`;
    },
  },

  // 5. 常见企业垂直业务技能群 (Business / Vertical)
  {
    skill_id: 'hr_offer_courier',
    name: 'HR_Offer_Courier',
    display_name: 'HR 录用通知与 Offer 邮件管家',
    description: '自动对录用候选人的定薪方案与入职时间进行合规校验，安全生成录用函并发送邮件',
    clusters: ['人力行政', '邮件通讯'],
    content_domain: '人力行政',
    tool_carrier: '邮件通讯',
    ecosystem: 'business',
    required_slots: ['candidate_name', 'candidate_email', 'salary_package', 'start_date'],
    negative_triggers: ['请勿用于群发商业营销与垃圾推广广告', '请勿发送劳动解除争议通知'],
    disambiguation_features: '区别于通用群发工具，专为企业人事录用设计，自带薪资机密合规校验与标准劳动合同模板',
    call_count: 7,
    error_count: 0,
    domains_invoked: ['人力行政'],
    author: 'Enterprise HR Suite',
    mock_executor: (slots) => {
      const name = slots.candidate_name || '候选人';
      const email = slots.candidate_email || 'candidate@example.com';
      return `【Offer 邮件发送完成】已成功向 [${name} (${email})] 发送带数字签名的《正式录用通知书》，并同步抄送用人主管及 HR 归档库。`;
    },
  },
  {
    skill_id: 'finance_invoice_auditor',
    name: 'Finance_Invoice_Auditor',
    display_name: '财务发票验真与费用报销初审',
    description: '识别各类增值税电子发票代码、金额及纳税人识别号，对照预算标准自动完成合规初审',
    clusters: ['商业金融', '视觉图像'],
    content_domain: '商业金融',
    tool_carrier: '视觉图像',
    ecosystem: 'business',
    required_slots: ['invoice_file', 'department_name', 'expense_type'],
    negative_triggers: ['请勿处理未加盖财务专用章的私人白条收据', '禁止虚开发票金额篡改审核'],
    disambiguation_features: '专用于发票真伪查验与企业内部部门月度预算限额匹配，区别于单纯的 OCR 识字工具',
    call_count: 12,
    error_count: 0,
    domains_invoked: ['商业金融'],
    author: 'Finance Guard',
    mock_executor: (slots) => {
      return `【发票初审通过】发票代码校验一致，价税合计 ¥1,280.00，公司抬头税号比对无误，类目【差旅交通】在月度预算限额内，建议放行。`;
    },
  },
  {
    skill_id: 's3',
    name: 'Weather_Forecast',
    display_name: '全球城市实时天气与预警',
    description: '查询全球各城市实时气温、相对湿度、AQI 空气质量及未来多日降水概率趋势',
    clusters: ['气象生活', '生活服务', '网络搜索'],
    content_domain: '气象生活',
    tool_carrier: '网络搜索',
    ecosystem: 'business',
    required_slots: ['city', 'date'],
    negative_triggers: ['不要用我查询历史股票行情', '请勿用于订购机票或酒店行程'],
    disambiguation_features: '基于权威气象台雷达与卫星数据，提供分钟级降水预测与温度曲线',
    call_count: 19,
    error_count: 1,
    domains_invoked: ['气象生活'],
    mock_executor: (slots) => {
      const city = slots.city || '上海';
      const date = slots.date || '明天';
      return `【Weather_Forecast 气象站】${city} ${date}：秋高气爽，晴朗微风，气温 15℃ ~ 22℃，相对湿度 45%，空气质量优 (AQI: 28)。早晚温差明显，适宜出行。`;
    },
  },
  {
    skill_id: 's5',
    name: 'Email_Notifier',
    display_name: '企业级单发邮件通知网关',
    description: '通过内部邮件通道向团队或客户安全下发业务报告、系统警报与交付物附件',
    clusters: ['办公协作', '邮件通讯'],
    content_domain: '办公协作',
    tool_carrier: '邮件通讯',
    ecosystem: 'business',
    required_slots: ['recipient', 'subject'],
    negative_triggers: ['请勿用于营销垃圾邮件群发', '不要直接公开广播到社交媒体'],
    disambiguation_features: '提供带数字签名与加密附件的企业级单发/工作组邮件分发网关',
    call_count: 6,
    error_count: 0,
    domains_invoked: ['办公协作'],
    mock_executor: (slots, prevOutput) => {
      const recipient = slots.recipient || 'leads@company.internal';
      return `【Email_Notifier 发件箱】邮件已成功发往: [${recipient}]，主题: "最新业务报告归档已交付"。${prevOutput ? ` 已附带交付凭证。` : ''}`;
    },
  },
  {
    skill_id: 'ecommerce_refund_guard',
    name: 'Ecommerce_Refund_Guard',
    display_name: '电商售后退款物流风控拦截',
    description: '结合订单状态、逆向物流路由与买家信用等级，自动判定是否执行退款或拦截在途包裹',
    clusters: ['市场营销', '商业金融', '网络搜索'],
    content_domain: '市场营销',
    tool_carrier: '网络搜索',
    ecosystem: 'business',
    required_slots: ['order_id', 'refund_reason', 'logistics_status'],
    negative_triggers: ['货物已在途且未拦截成功时，请勿直接原路退款', '请勿用于高风险洗钱欺诈账户'],
    disambiguation_features: '融合了物流节点真实状态与售后风控规则，区别于普通的静态客服问答机器人',
    call_count: 10,
    error_count: 0,
    domains_invoked: ['市场营销'],
    mock_executor: (slots) => {
      const order = slots.order_id || 'ORD-889102';
      return `【电商风控审核结果】订单 [${order}] 逆向包裹已入仓质检合格，买家信誉分良好，已批准触发原路退款 ¥299.00。`;
    },
  },
  {
    skill_id: 'meeting_action_extractor',
    name: 'Meeting_Action_Extractor',
    display_name: '智能会议纪要与行动项提炼',
    description: '将长篇会议速记文本自动提炼为核心决议摘要、明确任务责任人与截止时间表',
    clusters: ['办公协作', 'Word/Office'],
    content_domain: '办公协作',
    tool_carrier: 'Word/Office',
    ecosystem: 'business',
    required_slots: ['meeting_transcript', 'project_name'],
    negative_triggers: ['请勿收录与会议决议无关的闲聊与个人隐私八卦', '非结论性探讨请勿标记为待办任务'],
    disambiguation_features: '专注于结构化行动项 (Action Items) 责任矩阵提取，非泛泛的全文翻译或普通摘要',
    call_count: 11,
    error_count: 0,
    domains_invoked: ['办公协作'],
    mock_executor: (slots) => {
      return `【会议行动项提炼完成】共识别 3 项关键战略决议、4 项跟进待办。主责任人：李工（10月15日前交付接口文档），已自动同步至待办看板。`;
    },
  },
  {
    skill_id: 'social_media_copywriter',
    name: 'Social_Media_Copywriter',
    display_name: '新媒体爆款种草文案创作者',
    description: '根据产品卖点和目标受众画像，快速生成符合社交平台调性的爆款标题与种草文案',
    clusters: ['市场营销', '网络搜索'],
    content_domain: '市场营销',
    tool_carrier: '网络搜索',
    ecosystem: 'business',
    required_slots: ['product_topic', 'target_audience', 'platform_style'],
    negative_triggers: ['请勿生成违反广告法的绝对化极限用词（如国家级、第一）', '请勿虚构无根据的医疗保健功效'],
    disambiguation_features: '自带平台算法合规敏感词自检，具备高点赞互动引导钩子与标签自动聚合',
    call_count: 8,
    error_count: 0,
    domains_invoked: ['市场营销'],
    mock_executor: (slots) => {
      return `【爆款文案已生成】标题：《打工人自救！桌面换了它，熬夜写代码眼睛再也没酸过🔥》内含 3 个互动痛点引导与热门高赞标签 #办公好物 #效率神器。`;
    },
  },
  {
    skill_id: 'git_repo_manager',
    name: 'Git_Repo_Auditor',
    display_name: 'Git 代码仓与分支冲突防护',
    description: '自动化审查 Pull Request 分支合并冲突、Git 规范提交日志与敏感密钥泄露拦截',
    clusters: ['技术研发', '系统运维', '代码沙箱'],
    content_domain: '技术研发',
    tool_carrier: '代码沙箱',
    ecosystem: 'business',
    required_slots: ['repo_url', 'target_branch', 'pr_number'],
    negative_triggers: ['严禁直接在主分支执行 force push 强制覆盖', '禁止向外暴露仓库私钥凭据'],
    disambiguation_features: '结合 CI/CD 质量流水线合规准则，对 Git 冲突文件自动输出重构方案',
    call_count: 12,
    error_count: 0,
    domains_invoked: ['技术研发'],
    author: 'DevOps Guard',
    mock_executor: (slots) => {
      return `【Git 分支审查通过】PR #42 分支合并检测无冲突。静态密钥扫描 0 泄露，代码符合 Conventional Commits 规范，准许合并。`;
    },
  },
  {
    skill_id: 'crm_lead_scorer',
    name: 'CRM_Customer_Scorer',
    display_name: 'CRM 销售潜客转化率加权评分',
    description: '综合客户互动频次、企业规模与预算周期，自动计算 B2B 意向转化概率并指派跟进',
    clusters: ['商业金融', '市场营销', 'Excel表格'],
    content_domain: '商业金融',
    tool_carrier: 'Excel表格',
    ecosystem: 'business',
    required_slots: ['company_size', 'annual_budget', 'contact_touchpoints'],
    negative_triggers: ['请勿向未达成合法授权的客户拨打违规骚扰电话', '不要私自泄露客户联系人隐私'],
    disambiguation_features: '专为 B2B 高客单价销售漏斗设计的意向加权评级模型，输出 1~100 意向分与最佳破冰切入点',
    call_count: 9,
    error_count: 0,
    domains_invoked: ['商业金融'],
    author: 'Sales CRM Cloud',
    mock_executor: (slots) => {
      return `【CRM 意向评分】该企业客户评分: 88分 (级别: Tier-1 高潜)。预算匹配度高，建议指派资深客户经理在 24 小时内跟进演示。`;
    },
  },
];

export const INITIAL_SKILLS: Skill[] = rawSkills.map((s) => {
  const text = `${s.name} ${s.description} ${s.clusters.join(' ')}`;
  return {
    ...s,
    embedding: SimpleEmbeddingProvider.getEmbedding(text),
  };
});

// 生态包定义，便于用户一键扩展与单项导入
export interface EcosystemBundle {
  id: 'all' | 'openai' | 'claude' | 'deepseek' | 'business';
  name: string;
  tagline: string;
  provider: string;
  count: number;
  badgeColor: string;
  skills: Skill[];
}

export const getEcosystemBundles = (): EcosystemBundle[] => {
  return [
    {
      id: 'openai',
      name: 'OpenAI 经典技能生态库',
      tagline: 'Code Interpreter 代码沙箱、Web Search 联网检索、Vision OCR、DALL-E生图、RAG知识库与Whisper转录',
      provider: 'OpenAI Ecosystem',
      count: INITIAL_SKILLS.filter((s) => s.ecosystem === 'openai').length,
      badgeColor: 'border-emerald-500/40 bg-emerald-950/40 text-emerald-300',
      skills: INITIAL_SKILLS.filter((s) => s.ecosystem === 'openai'),
    },
    {
      id: 'claude',
      name: 'Claude 深度技能生态库',
      tagline: 'Bash 安全 Shell、Computer Use 视窗操作、长合同法律审计、Artifacts 交互沙箱与多卷宗比对',
      provider: 'Anthropic Claude',
      count: INITIAL_SKILLS.filter((s) => s.ecosystem === 'claude').length,
      badgeColor: 'border-amber-500/40 bg-amber-950/40 text-amber-300',
      skills: INITIAL_SKILLS.filter((s) => s.ecosystem === 'claude'),
    },
    {
      id: 'deepseek',
      name: 'DeepSeek 强化推理技能库',
      tagline: 'R1 长链思维运筹、数学定理证明、安全只读 SQL 查询、量化金融因子计算与系统底层逆向',
      provider: 'DeepSeek AI',
      count: INITIAL_SKILLS.filter((s) => s.ecosystem === 'deepseek').length,
      badgeColor: 'border-blue-500/40 bg-blue-950/40 text-blue-300',
      skills: INITIAL_SKILLS.filter((s) => s.ecosystem === 'deepseek'),
    },
    {
      id: 'business',
      name: '通用办公与商业垂直技能库',
      tagline: 'PDF/Word/Excel文档处理、发票初审、HR Offer邮件、电商风控、天气预报与CRM评分',
      provider: 'Enterprise Workflow',
      count: INITIAL_SKILLS.filter((s) => s.ecosystem === 'business').length,
      badgeColor: 'border-indigo-500/40 bg-indigo-950/40 text-indigo-300',
      skills: INITIAL_SKILLS.filter((s) => s.ecosystem === 'business'),
    },
  ];
};
