"""
飞书长连接客户端
使用 lark-oapi v2 WSClient 接收事件，WS 回调在 SDK 内部线程，通过
run_coroutine_threadsafe 将消息安全投递到主事件循环的任务队列。
"""
import asyncio
import json
import logging
import time
import threading
from dataclasses import dataclass

from lark_oapi.ws import Client as WSClient
from lark_oapi.event.dispatcher_handler import EventDispatcherHandlerBuilder
from lark_oapi.api.im.v1.model.p2_im_message_receive_v1 import P2ImMessageReceiveV1

from settings import settings

logger = logging.getLogger("feishu_ws")

# 消息去重缓存
_dedup_cache: dict[str, float] = {}
_dedup_ttl = 60
_dedup_lock = threading.Lock()


@dataclass
class IncomingMessage:
    msg_id: str
    chat_id: str
    chat_type: str
    user_id: str
    user_name: str
    content: str


def _is_duplicate(msg_id: str) -> bool:
    now = time.time()
    with _dedup_lock:
        expired = [mid for mid, ts in _dedup_cache.items() if ts < now]
        for mid in expired:
            del _dedup_cache[mid]
        if msg_id in _dedup_cache:
            return True
        _dedup_cache[msg_id] = now + _dedup_ttl
        return False


def _parse_message(event: P2ImMessageReceiveV1) -> IncomingMessage | None:
    msg = event.event.message
    content_text = ""
    try:
        content_json = json.loads(msg.content)
        content_text = content_json.get("text", "").strip()
    except (json.JSONDecodeError, TypeError):
        return None

    if not content_text:
        return None

    # 群聊：去掉 @机器人 部分
    if msg.chat_type == "group":
        mentions = msg.mentions or []
        for m in mentions:
            content_text = content_text.replace(f"@{m.name}", "").strip()

    # 白名单校验
    sender = event.event.sender
    allowed = settings.allowed_users
    if allowed:
        uid = sender.sender_id.open_id or sender.sender_id.user_id or ""
        if uid not in allowed:
            logger.info(f"用户 {uid} 不在白名单，忽略")
            return None

    return IncomingMessage(
        msg_id=msg.message_id,
        chat_id=msg.chat_id,
        chat_type=msg.chat_type,
        user_id=sender.sender_id.open_id or sender.sender_id.user_id or "",
        user_name="",
        content=content_text,
    )


class FeishuWSClient:
    def __init__(self, task_queue):
        self.queue = task_queue
        self._ws_client = None
        self._main_loop: asyncio.AbstractEventLoop | None = None

    def _on_message(self, event: P2ImMessageReceiveV1):
        """WS 回调（运行在 SDK 内部线程），同步方法"""
        if _is_duplicate(event.event.message.message_id):
            return

        parsed = _parse_message(event)
        if parsed is None:
            return

        logger.info(f"[{parsed.chat_type}] {parsed.user_id}: {parsed.content[:80]}")

        if self._main_loop:
            asyncio.run_coroutine_threadsafe(
                self.queue.enqueue(parsed), self._main_loop
            )

    def _run_sync(self):
        logger.info("📡 飞书长连接启动中...")
        handler = (
            EventDispatcherHandlerBuilder(
                encrypt_key=settings.encrypt_key,
                verification_token=settings.verification_token,
            )
            .register_p2_im_message_receive_v1(self._on_message)
            .build()
        )
        self._ws_client = WSClient(
            app_id=settings.app_id,
            app_secret=settings.app_secret,
            event_handler=handler,
        )
        logger.info("✅ 飞书长连接已建立，等待消息...")
        self._ws_client.start()

    async def start(self):
        from db.database import init_db

        await init_db()
        logger.info("✅ 数据库初始化完成")

        self._main_loop = asyncio.get_running_loop()

        thread = threading.Thread(target=self._run_sync, daemon=True, name="feishu-ws")
        thread.start()

        while thread.is_alive():
            await asyncio.sleep(1)

        logger.warning("飞书 WS 线程已退出")
