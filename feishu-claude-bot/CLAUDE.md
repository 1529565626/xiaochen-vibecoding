# feishu-claude-bot 开发规范

## 项目定位
飞书机器人 + Claude Code CLI 的自动化调度服务。通过飞书长连接接收群聊消息，在本地驱动 Claude Code CLI 子进程执行开发任务。

## 技术栈
- Python 3.11+、asyncio
- lark-oapi（飞书 WS 长连接）
- aiosqlite（本地持久化）
- Claude Code CLI（子进程调用）

## 代码风格
- 所有网络 I/O 使用 asyncio 异步，不阻塞事件循环
- 类/函数命名：PascalCase / snake_case，内部方法以 `_` 开头
- 日志使用 `logging` 模块，按 LOG_LEVEL 控制级别
- 异常处理：关键路径 try/except + 日志，不吞异常
- 类型注解：核心函数加参数类型和返回类型
- 文件编码：UTF-8，换行符 LF

## 目录约定
- `core/` — 核心逻辑：WS 连接、任务队列、CLI 调用
- `handler/` — 业务处理：消息路由、回复发送
- `db/` — 数据访问层：表定义、CRUD
- `docs/` — 项目文档
- `tests/` — 测试文件

## 安全红线
- `.env` 已在 .gitignore，永不提交
- 白名单机制默认开启
- `--add-dir` 限制 Claude Code 访问范围
- `--allowedTools` 白名单限制可用工具
