# feishu-claude-bot

飞书机器人 + Claude Code CLI 自动化调度服务。

通过飞书长连接（WebSocket）接收群聊消息，在本地驱动 Claude Code CLI 子进程执行任务——让 AI 在飞书群内为你工作。

## 特性

- **零公网暴露**：飞书长连接（WebSocket），无需 ngrok/内网穿透
- **灵活能力控制**：通过 `.env` 配置工具白名单和行为指令，随时切换机器人的能力边界
- **会话模式**：支持 `!session start` 开启多轮对话上下文
- **任务队列**：单 worker 串行执行，排队状态透明，支持取消
- **开机自启**：可注册为 Windows 任务计划程序，后台静默运行

## 架构

```
飞书用户 @机器人 发消息
       │
       ▼
┌─────────────────────────────────────────────────────┐
│  本地服务 (Python)                                    │
│                                                      │
│  ┌──────────┐    ┌──────────┐    ┌───────────────┐  │
│  │ 飞书 WS   │───▶│ 任务队列  │───▶│ Claude Code    │  │
│  │ 长连接    │    │ (asyncio │    │ CLI 子进程     │  │
│  │ 事件接收  │    │  Queue)  │    │ -p 非交互模式  │  │
│  └──────────┘    └──────────┘    └───────┬───────┘  │
│       │                                  │          │
│       │            ┌──────────┐          │          │
│       ◀────────────│ 飞书 API │◀─────────┘          │
│                    │ 消息回复 │                      │
│                    └──────────┘                      │
└─────────────────────────────────────────────────────┘
```

## 快速开始

### 环境要求

- Python 3.11+
- [Claude Code CLI](https://docs.anthropic.com/en/docs/claude-code) 已安装并可用
- 飞书企业自建应用（搭建步骤见 [FEISHU_SETUP.md](./FEISHU_SETUP.md)）

### 安装

```bash
git clone https://github.com/your-username/feishu-claude-bot.git
cd feishu-claude-bot

# 创建虚拟环境
python -m venv venv
source venv/bin/activate  # Linux/Mac
# venv\Scripts\activate   # Windows

# 安装依赖
pip install -r requirements.txt
```

### 配置

```bash
cp .env.template .env
```

编辑 `.env`，填入飞书应用凭证（详见 [FEISHU_SETUP.md](./FEISHU_SETUP.md)）：

| 变量 | 说明 | 必填 |
|---|---|---|
| `FEISHU_APP_ID` | 飞书应用 App ID | ✅ |
| `FEISHU_APP_SECRET` | 飞书应用 App Secret | ✅ |
| `FEISHU_ENCRYPT_KEY` | 事件订阅 Encrypt Key | ✅ |
| `FEISHU_VERIFICATION_TOKEN` | 事件订阅 Verification Token | ✅ |
| `ANTHROPIC_API_KEY` | Anthropic API Key（用 DeepSeek 等可留空） | ❌ |
| `CLAUDE_WORKING_DIR` | Claude Code 可操作目录 | ✅ |
| `CLAUDE_ALLOWED_TOOLS` | 工具白名单 | ✅ |
| `CLAUDE_CUSTOM_INSTRUCTION` | 行为指令 | ❌ |
| `ALLOWED_USERS` | 用户白名单 | ❌ |
| `TASK_TIMEOUT` | 单任务超时秒数 | ❌ |

### 启动

```bash
python main.py
```

看到 `✅ 飞书长连接已建立，等待消息...` 即成功。

### 开机自启（Windows）

```powershell
powershell -ExecutionPolicy Bypass -File setup-task.ps1
```

任务计划程序会在系统启动时自动运行，后台无窗口。

## 使用

### 无状态模式（默认）

群聊 @机器人 发送指令，每次独立处理。

### 会话模式

```
@机器人 !session start     # 开启上下文会话
@机器人 !session status    # 查看会话状态
@机器人 !session stop      # 结束会话
```

### 取消

```
@机器人 取消    # 取消排队中的任务
```

### 能力控制

编辑 `.env` 中的两个字段来定制机器人行为：

**`CLAUDE_ALLOWED_TOOLS`** — 允许使用哪些 Claude Code 工具：

| 值 | 能力 |
|---|---|
| `Read,Glob,Grep` | 只读（最安全） |
| `Read,Glob,Grep,Write` | 可读写文件 |
| `Bash,Read,Write,Edit,Glob,Grep` | 完整开发能力 |

**`CLAUDE_CUSTOM_INSTRUCTION`** — 注入行为约束。例如灵感记录助手：

```
你是一个灵感记录助手。用户通过关键词触发你的 skill...
```

## 目录结构

```
feishu-claude-bot/
├── main.py
├── settings.py
├── core/
│   ├── feishu_ws.py        # 飞书长连接 WSClient
│   ├── task_queue.py       # 任务队列 + Worker
│   └── claude_cli.py       # Claude Code CLI 子进程
├── handler/
│   └── reply.py            # 消息回复（含分片）
├── db/
│   ├── database.py         # aiosqlite 连接
│   └── models.py           # 会话映射 + 日志
├── skills/                 # 示例 Skill 提示词
├── docs/
│   └── architecture.md     # 架构文档
├── setup-task.ps1          # Windows 开机自启脚本
├── .env.template
├── requirements.txt
├── FEISHU_SETUP.md         # 飞书机器人搭建指南
├── LICENSE
└── README.md
```

## 安全

- `--add-dir` 限制 Claude Code 访问范围
- `--allowedTools` 白名单控制工具
- 白名单用户可交互
- 敏感文件不入 git

## License

MIT
