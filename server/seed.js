import crypto from 'node:crypto'

export const CATEGORY_META = {
  'AI 应用': { color: '#c8ff5c', soft: 'rgba(200, 255, 92, .13)', icon: 'sparkles' },
  '智能体': { color: '#7aa7ff', soft: 'rgba(122, 167, 255, .13)', icon: 'bot' },
  '开发工具': { color: '#ffb86b', soft: 'rgba(255, 184, 107, .13)', icon: 'terminal' },
  '基础设施': { color: '#65d9d4', soft: 'rgba(101, 217, 212, .13)', icon: 'server' },
  '数据与搜索': { color: '#c4a7ff', soft: 'rgba(196, 167, 255, .13)', icon: 'database' },
  '设计前端': { color: '#ff8fa3', soft: 'rgba(255, 143, 163, .13)', icon: 'palette' }
}

const LANGUAGE_COLORS = {
  TypeScript: '#3178c6',
  JavaScript: '#f1e05a',
  Python: '#3572A5',
  Go: '#00ADD8',
  Rust: '#dea584',
  Java: '#b07219',
  Zig: '#ec915c',
  Svelte: '#ff3e00'
}

const DAY = 86_400_000
const NOW = Date.now()

function daysAgo(days) {
  return new Date(NOW - days * DAY).toISOString()
}

function hoursAgo(hours) {
  return new Date(NOW - hours * 3_600_000).toISOString()
}

function dayKey(date) {
  const pad = (value) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

function mulberry32(seed) {
  return function random() {
    let t = (seed += 0x6d2b79f5)
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296
  }
}

function buildHistory(stars, weeklyGrowth, seed, days = 30) {
  const random = mulberry32(seed * 7919)
  const values = new Array(days)
  values[days - 1] = stars
  for (let i = days - 2; i >= 0; i -= 1) {
    const daily = weeklyGrowth / 7
    const factor = 0.55 + random() * 0.9
    values[i] = Math.max(0, Math.round(values[i + 1] - daily * factor))
  }
  return values.map((value, index) => ({
    date: dayKey(new Date(NOW - (days - 1 - index) * DAY)),
    stars: value
  }))
}

const defs = [
  {
    owner: 'langgenius', name: 'dify', category: 'AI 应用', language: 'TypeScript',
    stars: 129480, weekly: 4820, forks: 19640, issues: 521, contributors: 1120,
    license: 'Apache-2.0', version: 'v1.9.2', score: 98, tracked: true, status: '重点关注',
    description: '生产级的开源 LLM 应用开发平台，把 Agent 工作流、RAG 与模型管理收进一个可视化画布。',
    summary: '从原型到生产的最短路径。可视化编排、内置 RAG 和可观测性，让它成为团队搭建 AI 应用时的默认底座。',
    highlights: ['拖拽式 Agent 工作流，支持条件分支与循环', '内置 RAG 管线、文档解析与召回测试', '多模型接入，可私有化部署并细粒度观测'],
    topics: ['llm', 'rag', 'agent', 'workflow', 'low-code'], tags: ['RAG', 'Agent', '低代码'],
    aliases: '本地部署 知识库 工作流 低代码 AI 应用开发', createdDaysAgo: 1250
  },
  {
    owner: 'open-webui', name: 'open-webui', category: 'AI 应用', language: 'Svelte',
    stars: 118260, weekly: 3640, forks: 16780, issues: 186, contributors: 340,
    license: 'BSD-3-Clause', version: 'v0.6.41', score: 95, tracked: true, status: '重点关注',
    description: '为 Ollama 与 OpenAI 兼容接口打造的离线优先 Web 界面，数据完全留在自己的服务器。',
    summary: '最成熟的自托管 AI 聊天前端。多用户、RBAC、联网搜索和语音能力齐全，适合把模型能力直接交付给团队。',
    highlights: ['完全离线运行，支持多用户与权限管理', '内置 RAG 文档对话、联网搜索与语音输入', '适配 Ollama、OpenAI 兼容 API 和多种推理后端'],
    topics: ['ollama', 'webui', 'self-hosted', 'rag', 'llm'], tags: ['自托管', 'RAG', '隐私'],
    aliases: '本地部署 聊天界面 Ollama 隐私 离线 ChatGPT', createdDaysAgo: 1080
  },
  {
    owner: 'comfyanonymous', name: 'ComfyUI', category: 'AI 应用', language: 'Python',
    stars: 88920, weekly: 1980, forks: 9810, issues: 1920, contributors: 250,
    license: 'GPL-3.0', version: 'v0.3.62', score: 90, tracked: true, status: '观察中',
    description: '基于节点图的生成式图像工作流引擎，用可复现的管线控制从模型到后处理的每一步。',
    summary: '图像生成领域的「可视化编程」。节点式工作流带来极强可控性，生态插件增长仍是最大信号。',
    highlights: ['节点图编排，完整掌控采样与后处理链路', '社区节点生态庞大，新模型适配速度快', '支持 API 化调用与批量工作流'],
    topics: ['stable-diffusion', 'image-generation', 'workflow', 'nodes'], tags: ['AIGC', '图像生成'],
    aliases: '图像生成 工作流 节点 Stable Diffusion 本地部署', createdDaysAgo: 1380
  },
  {
    owner: 'deepseek-ai', name: 'DeepSeek-R1', category: 'AI 应用', language: 'Python',
    stars: 92400, weekly: 2670, forks: 12600, issues: 540, contributors: 60,
    license: 'MIT', version: 'v1.0.0', score: 92, tracked: false, status: null,
    description: '以强化学习驱动推理能力的开源大模型，公开了训练方法与多个蒸馏版本。',
    summary: '开源推理模型的重要里程碑。完整的蒸馏家族让小团队也能在消费级硬件上实验强推理能力。',
    highlights: ['RL 驱动的长链推理能力', '从 1.5B 到 671B 的完整蒸馏家族', 'MIT 许可，研究与应用限制少'],
    topics: ['reasoning', 'llm', 'deepseek', 'model'], tags: ['大模型', '推理'],
    aliases: '推理模型 开源大模型 中文 蒸馏 本地', createdDaysAgo: 630
  },
  {
    owner: 'menloresearch', name: 'jan', category: 'AI 应用', language: 'TypeScript',
    stars: 41760, weekly: 1120, forks: 2340, issues: 260, contributors: 120,
    license: 'Apache-2.0', version: 'v0.6.7', score: 82, tracked: true, status: '评估中',
    description: '离线优先的桌面 AI 助手，在本地运行开源模型，断网也能继续工作。',
    summary: '把「隐私优先」做成产品体验的桌面客户端。适合作为个人离线 Copilot，以及本地模型的日常入口。',
    highlights: ['下载即用的桌面客户端，支持 Windows / macOS / Linux', '本地模型与远程 API 可自由切换', '对话、文件与设置全部存储在本地'],
    topics: ['offline', 'desktop', 'llm', 'privacy'], tags: ['离线', '桌面端', '隐私'],
    aliases: '本地部署 桌面应用 离线 隐私 个人开发者 ChatGPT', createdDaysAgo: 760
  },
  {
    owner: 'QwenLM', name: 'Qwen3', category: 'AI 应用', language: 'Python',
    stars: 43210, weekly: 3130, forks: 5810, issues: 470, contributors: 80,
    license: 'Apache-2.0', version: 'v3.0.1', score: 93, tracked: false, status: null,
    description: '通义千问新一代开源模型家族，在推理、多语言与 Agent 能力上全面升级。',
    summary: '中文社区最活跃的开源模型家族之一。密集模型与 MoE 模型覆盖不同显存预算，部署选择丰富。',
    highlights: ['覆盖 0.6B 到 235B 的完整模型矩阵', '中英文与代码能力均衡', '原生支持工具调用与思考模式'],
    topics: ['llm', 'qwen', 'moe', 'multilingual'], tags: ['大模型', '中文', 'MoE'],
    aliases: '中文大模型 推理 部署 阿里 通义千问', createdDaysAgo: 520
  },
  {
    owner: 'n8n-io', name: 'n8n', category: '智能体', language: 'TypeScript',
    stars: 137840, weekly: 4210, forks: 43200, issues: 380, contributors: 600,
    license: 'Sustainable Use', version: 'v1.103.2', score: 97, tracked: true, status: '重点关注',
    description: '源码可得的自动化工作流平台，把 400+ 集成、AI 节点与人工审批串成一条流程。',
    summary: 'AI 工作流领域增长最稳的基础设施。自托管、公平代码许可和庞大的集成库，让自动化真正可落地。',
    highlights: ['400+ 服务集成，HTTP 与代码节点兜底', '原生 AI Agent 节点与向量数据库连接器', '可自托管，支持队列模式与细粒度权限'],
    topics: ['automation', 'workflow', 'integrations', 'ai'], tags: ['自动化', '自托管', '集成'],
    aliases: '自动化 工作流 集成 低代码 自托管 AI Agent', createdDaysAgo: 1800
  },
  {
    owner: 'browser-use', name: 'browser-use', category: '智能体', language: 'Python',
    stars: 78350, weekly: 4670, forks: 8900, issues: 312, contributors: 210,
    license: 'MIT', version: 'v0.5.11', score: 96, tracked: true, status: '重点关注',
    description: '让 AI Agent 像人一样操作浏览器：理解页面、点击、填表并完成真实任务。',
    summary: '浏览器自动化从脚本时代跨向 Agent 时代的代表项目。网页任务覆盖面广，是本周增长最快的项目之一。',
    highlights: ['自然语言驱动，无需编写选择器', '支持多标签页、表单与文件上传', '可与 Playwright 和主流 LLM 快速组合'],
    topics: ['browser', 'automation', 'agent', 'playwright'], tags: ['浏览器', 'Agent', '自动化'],
    aliases: '浏览器 AI 自动化 爬虫 agent 网页操作', createdDaysAgo: 620
  },
  {
    owner: 'modelcontextprotocol', name: 'servers', category: '智能体', language: 'TypeScript',
    stars: 72480, weekly: 3260, forks: 7820, issues: 290, contributors: 210,
    license: 'MIT', version: 'v2025.7.1', score: 94, tracked: true, status: '观察中',
    description: 'Model Context Protocol 官方服务器集合，为模型连接文件、数据库与外部工具提供标准接口。',
    summary: 'Agent 工具层的事实标准正在形成。MCP 把「模型如何接工具」变成可复用的协议，生态扩张速度值得持续跟踪。',
    highlights: ['官方维护的文件、Git、数据库等参考服务器', '统一工具描述与调用协议，客户端即插即用', '支持本地进程与远程传输两种模式'],
    topics: ['mcp', 'protocol', 'tools', 'context'], tags: ['MCP', '协议', '工具生态'],
    aliases: '工具连接 上下文 协议 Claude MCP Agent', createdDaysAgo: 420
  },
  {
    owner: 'microsoft', name: 'autogen', category: '智能体', language: 'Python',
    stars: 48700, weekly: 1210, forks: 7300, issues: 390, contributors: 330,
    license: 'MIT', version: 'v0.7.4', score: 84, tracked: false, status: null,
    description: '面向多智能体应用的事件驱动框架，支持复杂协作、工具调用与可观测性。',
    summary: '微软系多智能体框架。v0.4 之后重构为异步事件驱动架构，更适合构建生产级 Agent 团队。',
    highlights: ['多 Agent 协作与会话编排', '异步事件驱动运行时', '内置代码执行与可观测组件'],
    topics: ['multi-agent', 'framework', 'orchestration'], tags: ['多智能体', '框架'],
    aliases: '多智能体 编排 框架 微软 agent', createdDaysAgo: 1120
  },
  {
    owner: 'crewAIInc', name: 'crewAI', category: '智能体', language: 'Python',
    stars: 41380, weekly: 1890, forks: 5600, issues: 240, contributors: 190,
    license: 'MIT', version: 'v0.193.0', score: 86, tracked: false, status: null,
    description: '以角色与任务为核心的多智能体编排框架，用「团队」的方式组织 AI 协作。',
    summary: '心智模型最直观的 Agent 框架。角色、任务、流程三段式设计降低了多智能体系统的心智负担。',
    highlights: ['角色化 Agent 与任务委派', '顺序、层级两种协作流程', '独立于底层模型，接入成本低'],
    topics: ['multi-agent', 'crew', 'orchestration'], tags: ['多智能体', '框架'],
    aliases: '多智能体 角色协作 编排 agent 团队', createdDaysAgo: 980
  },
  {
    owner: 'OpenHands', name: 'OpenHands', category: '智能体', language: 'Python',
    stars: 61790, weekly: 2570, forks: 7410, issues: 320, contributors: 280,
    license: 'MIT', version: 'v0.55.0', score: 91, tracked: true, status: '观察中',
    description: '能写代码、跑命令、浏览网页并提交 PR 的开源软件工程智能体。',
    summary: 'SWE-bench 时代的代表性 coding agent。完整沙箱环境让它不只是「补全」，而是能端到端完成工程任务。',
    highlights: ['一体化沙箱，可执行终端与浏览器操作', '支持 GitHub Issue 到 PR 的完整闭环', '开源可自托管，模型与运行时均可替换'],
    topics: ['coding-agent', 'swe', 'automation'], tags: ['编程智能体', '自动化'],
    aliases: '编程智能体 自动修 bug AI 开发 软件工程', createdDaysAgo: 820
  },
  {
    owner: 'zed-industries', name: 'zed', category: '开发工具', language: 'Rust',
    stars: 69180, weekly: 2180, forks: 5270, issues: 2380, contributors: 500,
    license: 'GPL-3.0', version: 'v0.203.3', score: 90, tracked: true, status: '重点关注',
    description: '用 Rust 从零构建的高性能协作编辑器，原生集成 AI 与多人实时协作。',
    summary: '编辑器赛道少见的性能派挑战者。GPU 渲染带来的顺滑感与 Agent 面板，让它持续吸走资深开发者的注意力。',
    highlights: ['GPU 加速渲染，大文件依旧轻快', '原生多人协作与共享终端', 'Agent Panel 支持上下文感知的代码修改'],
    topics: ['editor', 'rust', 'collaboration', 'ai'], tags: ['编辑器', '高性能', '协作'],
    aliases: '编辑器 高性能 协作 AI 编程 VS Code 替代', createdDaysAgo: 1450
  },
  {
    owner: 'microsoft', name: 'markitdown', category: '开发工具', language: 'Python',
    stars: 78930, weekly: 1560, forks: 3920, issues: 260, contributors: 90,
    license: 'MIT', version: 'v0.1.2', score: 83, tracked: true, status: '观察中',
    description: '把 PDF、Office、音频等格式转换为适合 LLM 消费的 Markdown 工具。',
    summary: 'RAG 数据准备环节的「小刀」。极简 API 把杂乱文档统一成 Markdown，直接喂给模型或知识库。',
    highlights: ['覆盖 PDF、Word、Excel、PPT 与音频', '保留标题、列表和表格结构', '既可 CLI 调用，也可作为 Python 库集成'],
    topics: ['markdown', 'converter', 'rag', 'documents'], tags: ['RAG', '文档处理', 'Markdown'],
    aliases: 'Markdown 文档转换 提取 LLM RAG 知识库', createdDaysAgo: 680
  },
  {
    owner: 'oven-sh', name: 'bun', category: '开发工具', language: 'Zig',
    stars: 83510, weekly: 1640, forks: 3110, issues: 2480, contributors: 420,
    license: 'MIT', version: 'v1.2.21', score: 85, tracked: false, status: null,
    description: '集运行时、打包器、测试器与包管理器于一体的 JavaScript 全栈工具链。',
    summary: '用 Zig 重写 JavaScript 工具链的性能实验，已经成长为可日常使用的运行时。兼容性与速度是持续观察点。',
    highlights: ['原生 TypeScript / JSX 执行', '内置测试、打包与包管理器', 'Node.js API 兼容层持续完善'],
    topics: ['javascript', 'runtime', 'bundler', 'zig'], tags: ['运行时', 'JavaScript', '性能'],
    aliases: 'JavaScript 运行时 打包 测试 Node 替代 极速', createdDaysAgo: 1320
  },
  {
    owner: 'Stirling-Tools', name: 'Stirling-PDF', category: '开发工具', language: 'Java',
    stars: 72460, weekly: 1320, forks: 6080, issues: 220, contributors: 180,
    license: 'MIT', version: 'v1.1.0', score: 80, tracked: false, status: null,
    description: '可自托管的 PDF 工具箱，在本地完成合并、拆分、OCR、签名与水印等常用操作。',
    summary: '隐私敏感场景里的 PDF 瑞士军刀。功能密度高、部署简单，是自托管工具类项目的增长范本。',
    highlights: ['50+ PDF 操作，浏览器内完成', 'Docker 一键自托管，文件不出内网', '支持 OCR、格式转换与批量处理'],
    topics: ['pdf', 'self-hosted', 'privacy', 'ocr'], tags: ['PDF', '自托管', '隐私'],
    aliases: 'PDF 本地 工具 隐私 文件处理 自托管', createdDaysAgo: 1020
  },
  {
    owner: 'astral-sh', name: 'uv', category: '开发工具', language: 'Rust',
    stars: 58360, weekly: 2040, forks: 1620, issues: 1140, contributors: 220,
    license: 'Apache-2.0', version: 'v0.8.13', score: 88, tracked: true, status: '观察中',
    description: '用 Rust 编写的极速 Python 包与项目管理器，正在重写 Python 开发体验。',
    summary: 'Python 工具链基础设施的换代信号。安装速度提升一个数量级，并逐步吞掉 pip、pipx、pyenv 的职责。',
    highlights: ['比 pip 快 10–100 倍的依赖解析与安装', '内置虚拟环境、Python 版本与工具管理', '兼容 pyproject.toml 与现有生态'],
    topics: ['python', 'package-manager', 'rust', 'tooling'], tags: ['Python', '包管理', '性能'],
    aliases: 'Python 包管理 极速 替代 pip 环境 工具链', createdDaysAgo: 700
  },
  {
    owner: 'ollama', name: 'ollama', category: '基础设施', language: 'Go',
    stars: 155280, weekly: 2960, forks: 13400, issues: 1360, contributors: 430,
    license: 'MIT', version: 'v0.11.3', score: 96, tracked: true, status: '重点关注',
    description: '一条命令在本地跑起大模型，把模型下载、量化推理与 OpenAI 兼容 API 封装成简单体验。',
    summary: '本地推理的默认入口。极低的上手成本与广泛生态，让它成为所有本地 AI 工具链的第一块积木。',
    highlights: ['一行命令运行 Llama、Qwen、DeepSeek 等模型', '自动适配 CPU / GPU 与量化格式', '提供 OpenAI 兼容 API 与丰富 SDK'],
    topics: ['llm', 'local', 'inference', 'golang'], tags: ['本地推理', '大模型', '开发者体验'],
    aliases: '本地大模型 推理 一行命令 离线 部署 Llama', createdDaysAgo: 1500
  },
  {
    owner: 'vllm-project', name: 'vllm', category: '基础设施', language: 'Python',
    stars: 62430, weekly: 1840, forks: 10600, issues: 1420, contributors: 710,
    license: 'Apache-2.0', version: 'v0.10.1', score: 90, tracked: true, status: '观察中',
    description: '高吞吐、低延迟的 LLM 推理与服务引擎，PagedAttention 的发明者。',
    summary: '生产环境推理服务的主力引擎。显存管理与批处理调度仍是它拉开差距的核心，版本迭代极快。',
    highlights: ['PagedAttention 显著提升显存利用率', '连续批处理与张量并行', '兼容 OpenAI API，支持多模态模型'],
    topics: ['inference', 'serving', 'gpu', 'llm'], tags: ['推理引擎', 'GPU', '服务化'],
    aliases: '推理引擎 高吞吐 GPU 部署 模型服务 vLLM', createdDaysAgo: 990
  },
  {
    owner: 'immich-app', name: 'immich', category: '基础设施', language: 'TypeScript',
    stars: 78620, weekly: 1750, forks: 3910, issues: 540, contributors: 380,
    license: 'AGPL-3.0', version: 'v1.137.3', score: 87, tracked: false, status: null,
    description: '高性能自托管照片与视频管理方案，把 iCloud / Google Photos 的体验搬回自己的服务器。',
    summary: '自托管消费级应用的天花板之一。移动端、机器学习与备份链路完整，社区增长一直很健康。',
    highlights: ['移动端自动备份与时间线浏览', '本地人脸识别、语义搜索', 'Docker 部署，支持外部存储与多用户'],
    topics: ['photos', 'self-hosted', 'backup', 'ml'], tags: ['自托管', '照片管理', '隐私'],
    aliases: '照片 备份 自托管 隐私 iCloud 替代 相册', createdDaysAgo: 1180
  },
  {
    owner: 'authelia', name: 'authelia', category: '基础设施', language: 'Go',
    stars: 24560, weekly: 420, forks: 1260, issues: 90, contributors: 190,
    license: 'Apache-2.0', version: 'v4.39.4', score: 74, tracked: false, status: null,
    description: '面向自托管服务的身份认证与单点登录网关，提供 2FA、OIDC 与细粒度访问策略。',
    summary: '自托管栈的安全门卫。把认证从每个应用里抽出来，用统一策略保护内网服务。',
    highlights: ['单点登录、2FA 与 WebAuthn', 'Forward-auth 接入现有反向代理', '基于用户、组和网络的细粒度策略'],
    topics: ['authentication', 'sso', 'security', 'self-hosted'], tags: ['身份认证', '安全', '自托管'],
    aliases: '身份认证 单点登录 安全 自托管 2FA SSO', createdDaysAgo: 1600
  },
  {
    owner: 'openobserve', name: 'openobserve', category: '基础设施', language: 'Rust',
    stars: 17930, weekly: 380, forks: 720, issues: 310, contributors: 120,
    license: 'AGPL-3.0', version: 'v0.16.0', score: 72, tracked: false, status: null,
    description: '用 Rust 构建的云原生可观测性平台，统一日志、指标、追踪与前端会话回放。',
    summary: '可观测性成本优化赛道的挑战者。列式存储与低资源占用，是替代重型 ELK 的主要卖点。',
    highlights: ['日志、指标、链路一体化存储', '单节点即可运行，资源占用低', '兼容 OpenTelemetry 与 S3 存储'],
    topics: ['observability', 'logs', 'rust', 'telemetry'], tags: ['可观测性', '日志', 'Rust'],
    aliases: '日志 可观测 搜索 自托管 监控 ELK 替代', createdDaysAgo: 1280
  },
  {
    owner: 'supabase', name: 'supabase', category: '数据与搜索', language: 'TypeScript',
    stars: 97410, weekly: 1820, forks: 9800, issues: 480, contributors: 780,
    license: 'Apache-2.0', version: 'v2.39.0', score: 91, tracked: true, status: '重点关注',
    description: '基于 Postgres 的开源 Firebase 替代品，提供数据库、认证、存储、实时订阅与向量检索。',
    summary: 'AI 应用后端的默认选项之一。pgvector 与 Edge Functions 让「数据库 + RAG + 鉴权」在一处完成。',
    highlights: ['Postgres 原生，支持 pgvector 向量检索', '认证、存储、实时订阅开箱即用', '可云端托管，也可完整自托管'],
    topics: ['postgres', 'backend', 'realtime', 'vector', 'auth'], tags: ['Postgres', '后端', '向量检索'],
    aliases: '数据库 后端 Postgres 实时 向量 RAG Firebase 替代', createdDaysAgo: 2100
  },
  {
    owner: 'unclecode', name: 'crawl4ai', category: '数据与搜索', language: 'Python',
    stars: 63770, weekly: 2620, forks: 6420, issues: 210, contributors: 180,
    license: 'Apache-2.0', version: 'v0.7.3', score: 89, tracked: true, status: '观察中',
    description: '为 LLM 优化的开源网页抓取器，把任意页面转成干净、结构化的 Markdown。',
    summary: 'RAG 数据采集层的高增长项目。异步抓取、浏览器渲染与 LLM 友好输出，直接击中知识库构建的痛点。',
    highlights: ['异步爬取，支持动态页面渲染', '自动提取正文、表格并输出 Markdown', '内置缓存、去重与 LLM 抽取策略'],
    topics: ['crawler', 'rag', 'scraping', 'markdown'], tags: ['爬虫', 'RAG', '数据采集'],
    aliases: '爬虫 LLM 网页 抓取 RAG 知识库 数据采集', createdDaysAgo: 760
  },
  {
    owner: 'labring', name: 'FastGPT', category: '数据与搜索', language: 'TypeScript',
    stars: 29640, weekly: 980, forks: 4600, issues: 330, contributors: 110,
    license: 'Apache-2.0', version: 'v4.9.5', score: 79, tracked: true, status: '评估中',
    description: '开箱即用的知识库问答平台，提供数据处理、RAG 检索、工作流编排与 API 发布能力。',
    summary: '中文 RAG 落地的快车道。知识库、流程编排和模型接入高度整合，适合企业内部问答快速上线。',
    highlights: ['文档自动分段、向量化与混合检索', '可视化工作流与问题分类', '一键发布为 API 或嵌入页面'],
    topics: ['rag', 'knowledge-base', 'workflow', 'llm'], tags: ['RAG', '知识库', '工作流'],
    aliases: '知识库 RAG 问答 工作流 中文 企业 检索', createdDaysAgo: 1050
  },
  {
    owner: 'meilisearch', name: 'meilisearch', category: '数据与搜索', language: 'Rust',
    stars: 52380, weekly: 760, forks: 2180, issues: 180, contributors: 240,
    license: 'MIT', version: 'v1.15.0', score: 81, tracked: false, status: null,
    description: '轻量、极速且对开发者友好的搜索引擎，内置容错、过滤与即时搜索能力。',
    summary: '搜索体验的即插即用方案。Rust 带来的低延迟与简单部署，让它成为应用内搜索的常见起点。',
    highlights: ['毫秒级即时搜索与拼写容错', '简单 REST API 与多语言 SDK', '支持向量检索与混合搜索'],
    topics: ['search', 'engine', 'rust', 'instant'], tags: ['搜索引擎', 'Rust', '即时搜索'],
    aliases: '搜索引擎 即时 轻量 全文检索 向量 search', createdDaysAgo: 1750
  },
  {
    owner: 'shadcn-ui', name: 'ui', category: '设计前端', language: 'TypeScript',
    stars: 104850, weekly: 1240, forks: 7300, issues: 610, contributors: 420,
    license: 'MIT', version: 'v3.4.0', score: 88, tracked: true, status: '观察中',
    description: '不是组件库，而是可复制进项目的组件源码集合，基于 Radix 与 Tailwind 构建。',
    summary: '改变了组件库的分发方式。把代码所有权交给开发者，同时保持设计语言一致，生态仍在快速扩张。',
    highlights: ['源码直接进入仓库，无版本锁定', '基于 Radix 的无障碍交互原语', '主题令牌可深度定制'],
    topics: ['react', 'tailwind', 'components', 'design-system'], tags: ['组件', '设计系统', 'React'],
    aliases: '组件 设计系统 Tailwind 前端 React 复制粘贴', createdDaysAgo: 930
  },
  {
    owner: 'vercel', name: 'next.js', category: '设计前端', language: 'JavaScript',
    stars: 138200, weekly: 870, forks: 29400, issues: 3100, contributors: 2900,
    license: 'MIT', version: 'v15.5.2', score: 84, tracked: false, status: null,
    description: 'React 全栈框架，以 App Router、Server Components 与流式渲染重塑前端架构。',
    summary: 'React 生态的引力中心。缓存模型与渲染边界仍在快速演进，是观察前端架构风向的必看项目。',
    highlights: ['App Router 与 React Server Components', '流式渲染、并行路由与增量缓存', '从页面到 API 的一体化全栈能力'],
    topics: ['react', 'framework', 'ssr', 'fullstack'], tags: ['React', '全栈', '框架'],
    aliases: 'React 框架 SSR 全栈 前端 Next.js', createdDaysAgo: 2900
  },
  {
    owner: 'astro', name: 'astro', category: '设计前端', language: 'TypeScript',
    stars: 56780, weekly: 760, forks: 3100, issues: 330, contributors: 780,
    license: 'MIT', version: 'v5.14.1', score: 80, tracked: false, status: null,
    description: '以内容为中心的 Web 框架，默认零 JavaScript，并用群岛架构按需水合交互组件。',
    summary: '内容站点的性能答案。岛屿架构与框架无关的组件支持，让 Astro 成为内容型产品的稳健选择。',
    highlights: ['默认输出零 JavaScript', '支持 React、Vue、Svelte 混合编写', '内容集合、图片优化与视图过渡'],
    topics: ['astro', 'content', 'ssg', 'islands'], tags: ['内容站点', '性能', '静态生成'],
    aliases: '内容站点 静态 岛屿 性能 博客 前端框架', createdDaysAgo: 1680
  },
  {
    owner: 'tailwindlabs', name: 'tailwindcss', category: '设计前端', language: 'TypeScript',
    stars: 91600, weekly: 640, forks: 4900, issues: 120, contributors: 900,
    license: 'MIT', version: 'v4.1.12', score: 83, tracked: false, status: null,
    description: '原子化 CSS 框架，用工具类与设计令牌组织样式，v4 带来了全新的引擎与配置方式。',
    summary: '原子化 CSS 的默认答案。v4 的 Rust 引擎与 CSS-first 配置显著提速，也重新定义了主题扩展方式。',
    highlights: ['按需生成，构建产物极小', 'CSS-first 配置与设计令牌', '与组件生态高度兼容'],
    topics: ['css', 'tailwind', 'design', 'frontend'], tags: ['CSS', '设计', '前端'],
    aliases: 'CSS 原子化 样式 前端 Tailwind 设计系统', createdDaysAgo: 2500
  }
]

const notifTemplates = [
  { rule: 'rule-daily-stars', type: 'growth' },
  { rule: 'rule-milestone', type: 'milestone' },
  { rule: 'rule-agent-heat', type: 'topic' }
]

export function buildSeedState() {
  const projects = defs.map((item, index) => {
    const history = buildHistory(item.stars, item.weekly, index + 1)
    const dailyGrowth = history.at(-1).stars - history.at(-2).stars
    const base = Math.max(1, item.stars - item.weekly)
    return {
      id: `${item.owner}--${item.name}`.toLowerCase().replace(/[^a-z0-9-]/g, '-'),
      name: item.name,
      owner: item.owner,
      fullName: `${item.owner}/${item.name}`,
      description: item.description,
      descriptionEn: `${item.name} — ${item.summary}`,
      summary: item.summary,
      highlights: item.highlights,
      category: item.category,
      language: item.language,
      languageColor: LANGUAGE_COLORS[item.language] || '#8b949e',
      stars: item.stars,
      weeklyGrowth: item.weekly,
      weeklyGrowthPct: Number(((item.weekly / base) * 100).toFixed(1)),
      dailyGrowth,
      forks: item.forks,
      issues: item.issues,
      contributors: item.contributors,
      license: item.license,
      version: item.version,
      trendingScore: item.score,
      topics: item.topics,
      aliases: item.aliases,
      tags: item.tags,
      tracked: item.tracked,
      status: item.status,
      origin: 'seed',
      homepage: `https://github.com/${item.owner}/${item.name}`,
      createdAt: daysAgo(item.createdDaysAgo),
      pushedAt: hoursAgo(1 + (index % 19)),
      releaseAt: daysAgo(2 + (index % 12)),
      syncedAt: hoursAgo(0.3),
      history
    }
  })

  const byName = Object.fromEntries(projects.map((project) => [project.fullName, project]))
  const dify = byName['langgenius/dify']
  const openWebui = byName['open-webui/open-webui']
  const browserUse = byName['browser-use/browser-use']
  const zed = byName['zed-industries/zed']
  const fastgpt = byName['labring/FastGPT']

  const rules = [
    {
      id: 'rule-daily-stars',
      name: 'AI 项目单日异动',
      description: 'AI 应用分类项目单日新增 Stars 超过 550 时提醒',
      enabled: true,
      metric: 'dailyStars',
      operator: '>',
      threshold: 550,
      window: '24h',
      scope: 'AI 应用',
      scopeLabel: 'AI 应用 · 全部项目',
      channels: ['inapp'],
      triggers: 18,
      lastTriggeredAt: hoursAgo(0.7),
      createdAt: daysAgo(42)
    },
    {
      id: 'rule-milestone',
      name: '十万星里程碑',
      description: '任意跟踪项目总 Stars 突破 100,000 时提醒',
      enabled: true,
      metric: 'stars',
      operator: '>',
      threshold: 100000,
      window: '即时',
      scope: '全部',
      scopeLabel: '全部跟踪项目',
      channels: ['inapp'],
      triggers: 6,
      lastTriggeredAt: hoursAgo(2.2),
      createdAt: daysAgo(67)
    },
    {
      id: 'rule-agent-heat',
      name: 'Agent 话题升温',
      description: '智能体分类周均增速高于全局均值 25% 时提醒',
      enabled: true,
      metric: 'topicGrowth',
      operator: '>',
      threshold: 25,
      window: '7d',
      scope: '智能体',
      scopeLabel: '智能体 · 话题热度',
      channels: ['inapp'],
      triggers: 9,
      lastTriggeredAt: hoursAgo(3.4),
      createdAt: daysAgo(28)
    },
    {
      id: 'rule-release',
      name: '跟踪项目活跃更新',
      description: '重点关注项目出现新的代码更新时提醒',
      enabled: false,
      metric: 'release',
      operator: '=',
      threshold: 1,
      window: '24h',
      scope: '重点关注',
      scopeLabel: '重点关注 · 全部项目',
      channels: ['inapp', 'webhook'],
      triggers: 31,
      lastTriggeredAt: hoursAgo(7.5),
      createdAt: daysAgo(55)
    }
  ]

  const events = [
    {
      id: crypto.randomUUID(),
      ruleId: 'rule-daily-stars',
      projectId: dify.id,
      severity: 'high',
      title: `${dify.name} 单日新增 ${dify.dailyGrowth.toLocaleString('en-US')} Stars`,
      message: `超过规则阈值 550，当前总 Star 数 ${dify.stars.toLocaleString('en-US')}，AI 应用分类排名第 1。`,
      read: false,
      createdAt: hoursAgo(0.7)
    },
    {
      id: crypto.randomUUID(),
      ruleId: 'rule-milestone',
      projectId: openWebui.id,
      severity: 'medium',
      title: `Open WebUI 突破 ${Math.round(openWebui.stars / 1000)}k Stars`,
      message: '里程碑已达成，近 7 日新增 3,640 Stars，自托管 AI 界面赛道持续升温。',
      read: false,
      createdAt: hoursAgo(2.2)
    },
    {
      id: crypto.randomUUID(),
      ruleId: 'rule-agent-heat',
      projectId: browserUse.id,
      severity: 'high',
      title: 'Browser Use 进入智能体增速榜首',
      message: `7 日增长 ${browserUse.weeklyGrowthPct}%，话题「浏览器自动化」热度环比上升 31%。`,
      read: false,
      createdAt: hoursAgo(3.4)
    },
    {
      id: crypto.randomUUID(),
      ruleId: 'rule-release',
      projectId: zed.id,
      severity: 'low',
      title: `Zed 发布 ${zed.version}`,
      message: '本次更新聚焦编辑性能与 Agent Panel，已自动收集 release notes。',
      read: true,
      createdAt: hoursAgo(7.5)
    },
    {
      id: crypto.randomUUID(),
      ruleId: 'rule-agent-heat',
      projectId: fastgpt.id,
      severity: 'low',
      title: 'FastGPT 新增 3 个知识库集成案例',
      message: '社区引用度上升，RAG 工具链正在向企业知识库场景集中。',
      read: true,
      createdAt: hoursAgo(11.2)
    }
  ]

  const activity = [
    {
      id: crypto.randomUUID(),
      type: 'alert',
      title: '发现高潜信号',
      detail: `${dify.fullName} 单日新增 ${dify.dailyGrowth.toLocaleString('en-US')} Stars`,
      projectId: dify.id,
      createdAt: hoursAgo(0.7)
    },
    {
      id: crypto.randomUUID(),
      type: 'sync',
      title: '趋势快照已完成',
      detail: '30 个项目的 Stars、Forks 与 Issue 数据已更新',
      createdAt: hoursAgo(1.8)
    },
    {
      id: crypto.randomUUID(),
      type: 'insight',
      title: 'AI 生成了一条主题洞察',
      detail: '「RAG + 自托管」组合热度连续 3 天高于基线',
      createdAt: hoursAgo(3.1)
    },
    {
      id: crypto.randomUUID(),
      type: 'track',
      title: '新增跟踪项目',
      detail: `已将 ${fastgpt.fullName} 加入「评估中」清单`,
      projectId: fastgpt.id,
      createdAt: hoursAgo(6.4)
    },
    {
      id: crypto.randomUUID(),
      type: 'sync',
      title: 'GitHub 数据源检查通过',
      detail: '演示数据源在线，可随时接入 GitHub Token 获取实时数据',
      createdAt: hoursAgo(9)
    }
  ]

  return {
    meta: {
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      lastSyncAt: new Date().toISOString(),
      lastSyncStatus: 'seed',
      autoSync: true,
      intervalMinutes: 30,
      syncRunning: false,
      dataMode: 'demo',
      owner: 'Lin',
      workspace: '个人工作区'
    },
    projects,
    alerts: { rules, events },
    activity,
    syncLogs: [
      {
        id: crypto.randomUUID(),
        at: new Date().toISOString(),
        status: 'success',
        source: 'seed',
        message: '载入 30 个项目的趋势基线',
        added: 30,
        updated: 0,
        duration: 864
      },
      {
        id: crypto.randomUUID(),
        at: daysAgo(1),
        status: 'success',
        source: 'seed',
        message: '生成 30 日 Stars 历史序列',
        added: 0,
        updated: 30,
        duration: 412
      }
    ],
    chat: { conversations: 0, messages: 0 }
  }
}

export { dayKey, buildHistory, notifTemplates }
