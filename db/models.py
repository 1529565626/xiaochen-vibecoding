"""
数据访问层
"""
import uuid
from datetime import datetime
from db.database import get_db


# ── 会话管理 ──

async def get_session(chat_id: str) -> str | None:
    db = await get_db()
    cursor = await db.execute("SELECT session_id FROM sessions WHERE chat_id = ?", (chat_id,))
    row = await cursor.fetchone()
    return row[0] if row else None


async def create_session(chat_id: str) -> str:
    db = await get_db()
    session_id = str(uuid.uuid4())
    await db.execute(
        "INSERT OR REPLACE INTO sessions (chat_id, session_id, updated_at) VALUES (?, ?, ?)",
        (chat_id, session_id, datetime.utcnow().isoformat()),
    )
    await db.commit()
    return session_id


async def delete_session(chat_id: str):
    db = await get_db()
    await db.execute("DELETE FROM sessions WHERE chat_id = ?", (chat_id,))
    await db.commit()


async def touch_session(chat_id: str):
    """更新会话最后活跃时间"""
    db = await get_db()
    await db.execute(
        "UPDATE sessions SET updated_at = ? WHERE chat_id = ?",
        (datetime.utcnow().isoformat(), chat_id),
    )
    await db.commit()


# ── 任务日志 ──

async def log_task(chat_id: str, user_id: str, message: str) -> int:
    db = await get_db()
    cursor = await db.execute(
        "INSERT INTO task_logs (chat_id, user_id, message, status) VALUES (?, ?, ?, 'processing')",
        (chat_id, user_id, message),
    )
    await db.commit()
    return cursor.lastrowid


async def update_task_result(task_id: int, result: str, status: str = "done", error: str = None):
    db = await get_db()
    await db.execute(
        "UPDATE task_logs SET result = ?, status = ?, error = ?, finished_at = ? WHERE id = ?",
        (result, status, error, datetime.utcnow().isoformat(), task_id),
    )
    await db.commit()


async def get_recent_tasks(chat_id: str, limit: int = 10) -> list[dict]:
    db = await get_db()
    cursor = await db.execute(
        "SELECT * FROM task_logs WHERE chat_id = ? ORDER BY created_at DESC LIMIT ?",
        (chat_id, limit),
    )
    return [dict(row) for row in await cursor.fetchall()]
