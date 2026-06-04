"""
单 worker 串行任务队列
每个任务 = 一个飞书消息，执行 = 启动 Claude Code CLI 子进程
"""
import asyncio
import logging

from core.claude_cli import ClaudeCLI
from core.feishu_ws import IncomingMessage
from handler.reply import send_reply, send_queued_status, send_error
from db.models import (
    log_task,
    update_task_result,
    get_session,
    create_session,
    delete_session,
)

logger = logging.getLogger("task_queue")

# 指令前缀
CMD_SESSION_START = "!session start"
CMD_SESSION_STOP = "!session stop"
CMD_SESSION_STATUS = "!session status"
CMD_CANCEL = "取消"


class TaskQueue:
    def __init__(self):
        self._queue: asyncio.Queue[IncomingMessage] = asyncio.Queue()
        self._cli = ClaudeCLI()
        self._cancel_ids: set[str] = set()

    async def enqueue(self, message: IncomingMessage):
        text = message.content.strip()

        # 取消指令（即时处理，不入队）
        if text == CMD_CANCEL:
            self._cancel_ids.add(message.chat_id)
            await send_reply(message.chat_id, "✅ 已取消该群在当前队列中等待的任务")
            return

        # 会话指令（即时处理，不入队）
        if text.startswith("!session"):
            await self._handle_session_cmd(message)
            return

        await self._queue.put(message)
        pos = self._queue.qsize()
        if pos > 1:
            await send_queued_status(message.chat_id, pos)

    async def run_worker(self):
        logger.info("🔧 任务队列 worker 已启动")
        while True:
            message = await self._queue.get()
            try:
                await self._process_one(message)
            except Exception as e:
                logger.exception(f"任务处理异常: {e}")
                await send_error(message.chat_id, str(e))
            finally:
                self._queue.task_done()

    async def _process_one(self, message: IncomingMessage):
        chat_id = message.chat_id

        # 检查取消标记
        if chat_id in self._cancel_ids:
            self._cancel_ids.discard(chat_id)
            await send_reply(chat_id, "🚫 任务已取消")
            return

        # 记录日志
        task_id = await log_task(chat_id, message.user_id, message.content)

        # 选择模式
        session_id = await get_session(chat_id)
        if session_id:
            result = await self._cli.process_with_session(message, session_id)
        else:
            result = await self._cli.process(message)

        if result:
            await update_task_result(task_id, result, "done")

        await send_reply(chat_id, result)

    async def _handle_session_cmd(self, message: IncomingMessage):
        """处理会话管理指令"""
        text = message.content.strip()
        chat_id = message.chat_id

        if text.startswith(CMD_SESSION_START):
            session_id = await create_session(chat_id)
            await send_reply(
                chat_id,
                f"✅ 会话模式已开启\n"
                f"会话 ID: `{session_id[:8]}...`\n"
                f"后续消息将保持上下文，发送 `!session stop` 结束会话。",
            )

        elif text.startswith(CMD_SESSION_STOP):
            existing = await get_session(chat_id)
            if existing:
                await delete_session(chat_id)
                await send_reply(chat_id, "✅ 会话模式已关闭，后续消息将以无状态模式处理。")
            else:
                await send_reply(chat_id, "当前没有活跃的会话，无需关闭。")

        elif text.startswith(CMD_SESSION_STATUS):
            existing = await get_session(chat_id)
            if existing:
                await send_reply(
                    chat_id, f"🟢 会话模式已开启\n会话 ID: `{existing[:8]}...`"
                )
            else:
                await send_reply(
                    chat_id, "⚪ 当前为无状态模式。发送 `!session start` 开启会话。"
                )
