"""
数据库连接管理
"""
import os
import aiosqlite

DB_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data.db")

_connection: aiosqlite.Connection | None = None


async def get_db() -> aiosqlite.Connection:
    global _connection
    if _connection is None:
        _connection = await aiosqlite.connect(DB_PATH)
        _connection.row_factory = aiosqlite.Row
        await _connection.execute("PRAGMA journal_mode=WAL")
        await _connection.execute("PRAGMA foreign_keys=ON")
    return _connection


async def init_db():
    """创建初始表结构"""
    db = await get_db()
    await db.executescript("""
        CREATE TABLE IF NOT EXISTS sessions (
            chat_id TEXT PRIMARY KEY,
            session_id TEXT NOT NULL UNIQUE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS task_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            chat_id TEXT NOT NULL,
            user_id TEXT NOT NULL DEFAULT '',
            message TEXT NOT NULL,
            result TEXT,
            status TEXT NOT NULL DEFAULT 'pending',
            error TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            finished_at TIMESTAMP
        );

        CREATE INDEX IF NOT EXISTS idx_task_logs_chat ON task_logs(chat_id);
        CREATE INDEX IF NOT EXISTS idx_task_logs_created ON task_logs(created_at);
    """)
    await db.commit()


async def close_db():
    global _connection
    if _connection:
        await _connection.close()
        _connection = None
