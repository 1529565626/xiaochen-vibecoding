# xiaochen-vibecoding

小陈的 AI 自动化工具集。用 Claude Code 驱动各种效率场景，通过飞书/其他平台接入，让 AI 融入日常工作流。

## 项目列表

| 项目 | 说明 |
|---|---|
| [feishu-claude-bot](./feishu-claude-bot/) | 飞书机器人 + Claude Code CLI，通过长连接在群聊中调度 AI 任务 |

## 目录结构

```
xiaochen-vibecoding/
├── README.md
└── feishu-claude-bot/    ← 飞书 Claude 机器人
```

## 技术栈

- Python 3.11+ / asyncio
- Claude Code CLI
- 飞书开放平台 SDK (lark-oapi)
- SQLite (aiosqlite)

## License

MIT
