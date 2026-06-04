"""
飞书消息回复
支持文本消息发送、超长分片
"""
import json
import logging
import asyncio

from lark_oapi import Client
from lark_oapi.api.im.v1 import CreateMessageRequest, CreateMessageRequestBody

from settings import settings

logger = logging.getLogger("reply")

MAX_CONTENT_LEN = 15000


def _build_client() -> Client:
    return Client.builder().app_id(settings.app_id).app_secret(settings.app_secret).build()


def _split_text(text: str, max_len: int = MAX_CONTENT_LEN) -> list[str]:
    if len(text) <= max_len:
        return [text]
    chunks = []
    remaining = text
    while len(remaining) > max_len:
        split_at = remaining.rfind("\n", 0, max_len)
        if split_at == -1:
            split_at = max_len
        chunks.append(remaining[:split_at])
        remaining = remaining[split_at:]
    chunks.append(remaining)
    return chunks


def _send_text(chat_id: str, content: str):
    client = _build_client()
    body = (
        CreateMessageRequestBody.builder()
        .content(json.dumps({"text": content}))
        .msg_type("text")
        .receive_id(chat_id)
        .build()
    )
    req = (
        CreateMessageRequest.builder()
        .receive_id_type("chat_id")
        .request_body(body)
        .build()
    )
    client.im.v1.message.create(req)


async def send_reply(chat_id: str, content: str):
    chunks = _split_text(content)
    for i, chunk in enumerate(chunks):
        prefix = f"({i+1}/{len(chunks)}) " if len(chunks) > 1 else ""
        await asyncio.to_thread(_send_text, chat_id, prefix + chunk)


async def send_queued_status(chat_id: str, position: int):
    await send_reply(chat_id, f"⏳ 排队中，前面还有 {position} 个任务，请稍候...")


async def send_processing(chat_id: str):
    await send_reply(chat_id, "⏳ Claude Code 正在处理...")


async def send_error(chat_id: str, error_msg: str):
    await send_reply(chat_id, f"❌ 处理出错：{error_msg}")


async def send_timeout(chat_id: str):
    await send_reply(chat_id, "⏰ 任务执行超时（5 分钟），已终止。请尝试拆分任务或简化指令。")
