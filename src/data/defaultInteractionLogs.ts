import { SkillInteractionLog } from '../types/agent';

export const INITIAL_INTERACTION_LOGS: SkillInteractionLog[] = [
  // -------------------------------------------------------------
  // 1. s1 (PDF_Watermark_Stamper) - 典型高报错场景 (报错率高，缺少参数容错和描述声明)
  // -------------------------------------------------------------
  {
    id: 'log-s1-01',
    skill_id: 's1',
    skill_name: 'PDF_Watermark_Stamper',
    timestamp: '2026-10-10 02:14:22',
    user_query: '请给财务季报 PDF 盖上只读水印并输出',
    input_slots: { file_path: 'report_q3.pdf' },
    status: 'error',
    latency_ms: 140,
    error_category: 'slot_missing',
    error_reason: '必需入参槽位 watermark_text 未提供，且未设置默认备用文本，导致执行器抛出 NullPointerException。',
    suggested_adjustment: {
      description_refinement: '专注于为 PDF 电子文档加盖安全防伪与审计水印，支持自适应默认保密文字与旋转角度',
      slots_adjustment: ['file_path', 'watermark_text', 'opacity_level'],
      slots_rules: {
        file_path: '必需，目标 PDF 路径（格式以 .pdf 结尾）',
        watermark_text: '可选，缺省默认为 [机密文件·严禁外泄]，避免入参缺失报错',
        opacity_level: '可选，水印透明度浮点数 (0.1 ~ 0.9，默认 0.35)',
      },
    },
  },
  {
    id: 'log-s1-02',
    skill_id: 's1',
    skill_name: 'PDF_Watermark_Stamper',
    timestamp: '2026-10-10 03:08:15',
    user_query: '对扫描合同图片中的文字加盖红色公章',
    input_slots: { file_path: 'contract_scan.jpg', watermark_text: '财务专用章' },
    status: 'error',
    latency_ms: 210,
    error_category: 'domain_confusion',
    error_reason: '输入文件类型为非 PDF 图片 (.jpg)，本技能底层为 PyMuPDF/iText 引擎无法解析位图图层，发生格式解析崩溃。',
    suggested_adjustment: {
      negative_rule: {
        scenario: '用户要求处理图片/位图文件加盖图章或进行视觉图像修图',
        why_avoid: '当前为纯 PDF 矢量排版引擎，不支持位图像素级印章合成',
        divert_to_skill_id: 'openai_vision_ocr',
        divert_to_skill_name: 'OpenAI_Vision_OCR',
      },
    },
  },
  {
    id: 'log-s1-03',
    skill_id: 's1',
    skill_name: 'PDF_Watermark_Stamper',
    timestamp: '2026-10-10 04:32:09',
    user_query: '给公司员工手册加上水印',
    input_slots: { file_path: 'handbook.pdf', watermark_text: '' },
    status: 'error',
    latency_ms: 120,
    error_category: 'format_mismatch',
    error_reason: 'watermark_text 传递了空字符串，且无入参边界校验，引发空渲染异常。',
    suggested_adjustment: {
      slots_rules: {
        watermark_text: '需自动过滤空字符串并置入安全默认值 [内部借阅]',
      },
    },
  },
  {
    id: 'log-s1-04',
    skill_id: 's1',
    skill_name: 'PDF_Watermark_Stamper',
    timestamp: '2026-10-10 05:10:44',
    user_query: '将审计报告添加水印：绝密 2026',
    input_slots: { file_path: 'audit_2026.pdf', watermark_text: '绝密 2026' },
    status: 'success',
    latency_ms: 195,
  },

  // -------------------------------------------------------------
  // 2. openai_code_interpreter (OpenAI Python 代码沙箱)
  // -------------------------------------------------------------
  {
    id: 'log-py-01',
    skill_id: 'openai_code_interpreter',
    skill_name: 'OpenAI_Code_Interpreter',
    timestamp: '2026-10-10 01:45:10',
    user_query: '执行一段 Python 代码并返回图表',
    input_slots: { code_snippet: '' },
    status: 'error',
    latency_ms: 95,
    error_category: 'slot_missing',
    error_reason: '入参 code_snippet 为空，沙箱未能编译任何有效语法抽象树 (AST)。',
    suggested_adjustment: {
      description_refinement: '在受限 Docker 沙箱内执行合规 Python 科学计算脚本，提供语法前置静态校验与超时防御',
      slots_adjustment: ['code_snippet', 'runtime_env', 'timeout_seconds'],
      slots_rules: {
        code_snippet: '必需，严格合规的 Python 3 源代码片段',
        runtime_env: '可选，默认 python3.11-scientific-base',
        timeout_seconds: '可选，执行最长等待秒数 (默认 10s)',
      },
    },
  },
  {
    id: 'log-py-02',
    skill_id: 'openai_code_interpreter',
    skill_name: 'OpenAI_Code_Interpreter',
    timestamp: '2026-10-10 03:19:22',
    user_query: '用 Python 计算斐波那契数列第 20 项并统计',
    input_slots: { code_snippet: 'def fib(n): return n if n<=1 else fib(n-1)+fib(n-2); print(fib(20))' },
    status: 'success',
    latency_ms: 220,
  },

  // -------------------------------------------------------------
  // 3. claude_pdf_converter (Claude 风格 PDF 格式转换引擎)
  // -------------------------------------------------------------
  {
    id: 'log-cpdf-01',
    skill_id: 'claude_pdf_converter',
    skill_name: 'Claude_PDF_Converter',
    timestamp: '2026-10-10 02:45:30',
    user_query: '把这个音频录音转成 PDF 文件',
    input_slots: { source_file: 'meeting_record.mp3', target_format: 'pdf' },
    status: 'error',
    latency_ms: 180,
    error_category: 'domain_confusion',
    error_reason: '跨领域调用异常：试图对纯音频文件执行文档版面转换，缺少源文件 MIME-Type 防御。',
    suggested_adjustment: {
      description_refinement: '专注于 Markdown/Docx/HTML 结构化文字与版面至 PDF 的双向渲染转换',
      negative_rule: {
        scenario: '用户传递音频、视频等多媒体文件要求提取或转换',
        why_avoid: '本技能为文档格式解析器，无语音识别与音频流解码器',
        divert_to_skill_id: 'openai_vision_ocr',
        divert_to_skill_name: 'OpenAI_Vision_OCR',
      },
    },
  },
  {
    id: 'log-cpdf-02',
    skill_id: 'claude_pdf_converter',
    skill_name: 'Claude_PDF_Converter',
    timestamp: '2026-10-10 04:12:00',
    user_query: '将技术设计文档 Markdown 渲染为标准 PDF 格式',
    input_slots: { source_file: 'architecture.md', target_format: 'pdf' },
    status: 'success',
    latency_ms: 310,
  },

  // -------------------------------------------------------------
  // 4. deepseek_coder_sandbox (DeepSeek 极客编程环境)
  // -------------------------------------------------------------
  {
    id: 'log-ds-01',
    skill_id: 'deepseek_coder_sandbox',
    skill_name: 'DeepSeek_Coder_Sandbox',
    timestamp: '2026-10-10 03:50:11',
    user_query: '运行一段系统内核监控脚本并读取 /etc/shadow',
    input_slots: { bash_script: 'cat /etc/shadow' },
    status: 'error',
    latency_ms: 80,
    error_category: 'domain_confusion',
    error_reason: '沙箱安全防御触发：越权探测系统敏感凭据，底层安全拦截器强行终止进程。',
    suggested_adjustment: {
      description_refinement: '针对算法验证、单元测试与代码重构的高性能隔离运行沙箱，具备沙箱安全沙盒硬隔离防护',
      slots_adjustment: ['bash_script', 'safe_mode', 'resource_limit'],
      slots_rules: {
        bash_script: '必需，无提权风险的用户态测试脚本',
        safe_mode: '布尔值，默认开启严格权限沙盒',
      },
    },
  },
];
