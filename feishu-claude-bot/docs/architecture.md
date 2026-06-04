# 架构文档

## 系统架构

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

## 核心流程

### 1. 消息接收

1. 飞书 SDK `WSClient` 在后台线程建立 WebSocket 长连接
2. 收到 `im_message_receive_v1` 事件后，回调 `_on_message`
3. 消息去重（msg_id + 60s TTL 内存缓存）
4. 解析消息内容（提取文本、移除 @机器人 前缀）
5. 白名单校验（通过则继续）
6. `asyncio.run_coroutine_threadsafe()` 跨线程投递到任务队列

### 2. 任务调度

1. `TaskQueue` 维护 `asyncio.Queue`，单 worker 串行消费
2. 特殊指令（`!session`、`取消`）在 `enqueue()` 阶段即时处理，不入队
3. 入队时返回排队位置（`asyncio.Queue.qsize()`）
4. 取消消息将 `chat_id` 加入 `_cancel_ids` 集合，worker 取出时检查并跳过
5. 单个任务失败不影响后续任务

### 3. Claude Code 执行

1. `asyncio.create_subprocess_exec` 启动 `claude -p` 子进程
2. 默认参数：`--permission-mode auto`、`--output-format stream-json`、`--max-budget-usd 2`、`--no-session-persistence`、`--add-dir`、`--allowedTools`
3. 流式读取 stdout，逐行解析 JSON
4. 收集 `type=assistant` 的消息作为回复内容
5. 超时 300 秒后 `proc.kill()` 并回复超时提示
6. 任务结果记录到 SQLite `task_logs` 表

### 4. 消息回复

1. 通过飞书 REST API (`POST /open-apis/im/v1/messages`) 发送回复
2. 发送调用跑在 `asyncio.to_thread()` 中以非阻塞方式执行
3. 超长消息（>15000 字符）自动分片发送

## 数据模型

### sessions 表

| 字段 | 类型 | 说明 |
|---|---|---|
| chat_id | TEXT PK | 飞书群聊 ID |
| session_id | TEXT UNIQUE | Claude Code session UUID |
| created_at | TIMESTAMP | 创建时间 |
| updated_at | TIMESTAMP | 最后活跃时间 |

### task_logs 表

| 字段 | 类型 | 说明 |
|---|---|---|
| id | INTEGER PK | 自增 ID |
| chat_id | TEXT | 飞书群聊 ID |
| user_id | TEXT | 发送者 ID |
| message | TEXT | 用户消息原文 |
| result | TEXT | Claude Code 返回结果 |
| status | TEXT | pending/processing/done/error |
| error | TEXT | 错误信息 |
| created_at | TIMESTAMP | 创建时间 |
| finished_at | TIMESTAMP | 完成时间 |

## 线程模型

```
┌─ 主线程 (asyncio event loop) ─┐
│  • TaskQueue.run_worker()     │
│  • ClaudeCLI.process()        │
│  • reply.send_reply()         │
│  • DB 操作                     │
└────────────────────────────────┘

┌─ 飞书 WS 线程 (daemon) ───────┐
│  • WSClient.start() (阻塞)    │
│  • Handler 回调 (_on_message) │
│  • 跨线程投递消息               │
└────────────────────────────────┘
```

两个线程通过 `asyncio.run_coroutine_threadsafe()` 安全通信。

## 安全设计

1. **目录沙箱**：`--add-dir` 限制 Claude Code 只能访问指定目录
2. **工具白名单**：`--allowedTools` 禁用 WebSearch、WebFetch 等，只保留文件操作和 Bash
3. **预算上限**：`--max-budget-usd` 单次不超过 $2
4. **用户白名单**：`ALLOWED_USERS` 限制可交互的飞书用户
5. **子进程权限**：`--permission-mode auto` 自动批准安全操作
