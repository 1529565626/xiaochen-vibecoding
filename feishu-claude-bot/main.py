"""
飞书长连接 + Claude Code CLI 调度服务
启动后建立飞书 WebSocket 连接，接收消息事件并调度 Claude Code 执行
"""
import asyncio
import logging
import signal
import sys

from settings import settings
from core.feishu_ws import FeishuWSClient
from core.task_queue import TaskQueue

logging.basicConfig(
    level=getattr(logging, settings.log_level),
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger("main")


async def main():
    settings.validate()
    logger.info("✅ 配置校验通过")
    logger.info(f"工作目录: {settings.working_dirs}")
    logger.info(f"白名单用户: {settings.allowed_users if settings.allowed_users else '不限制'}")

    queue = TaskQueue()
    worker = asyncio.create_task(queue.run_worker(), name="task-worker")

    client = FeishuWSClient(queue)

    loop = asyncio.get_event_loop()

    def shutdown(sig=None):
        logger.info("收到退出信号，正在关闭...")
        worker.cancel()
        sys.exit(0)

    for sig in (signal.SIGINT, signal.SIGTERM):
        try:
            loop.add_signal_handler(sig, shutdown)
        except NotImplementedError:
            # Windows 不支持 add_signal_handler，用 signal.signal 替代
            signal.signal(sig, lambda s, f: shutdown())

    await client.start()


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        logger.info("服务已停止")
