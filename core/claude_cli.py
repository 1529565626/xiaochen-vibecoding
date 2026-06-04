"""
Claude Code CLI 子进程管理
通过 asyncio subprocess 启动 claude -p，流式读取 stream-json 输出
"""
import asyncio
import json
import logging
import os

from settings import settings
from handler.reply import send_processing, send_error, send_timeout

logger = logging.getLogger("claude_cli")


class ClaudeCLI:
    def __init__(self):
        self._working_dirs = settings.working_dirs if settings.working_dirs else [os.getcwd()]

    def _build_prompt(self, user_msg: str) -> str:
        """构建最终 prompt，拼接自定义指令"""
        if settings.custom_instruction:
            return f"{settings.custom_instruction}\n\n---\n用户消息：{user_msg}"
        return user_msg

    def _build_base_cmd(self, prompt: str) -> list[str]:
        """构建基础命令，支持多个 --add-dir"""
        cmd = [
            "claude", "-p", prompt,
            "--permission-mode", "auto",
            "--output-format", "stream-json",
            "--verbose",
            "--max-budget-usd", str(settings.max_budget_usd),
            "--allowedTools", settings.allowed_tools,
        ]
        for d in self._working_dirs:
            cmd.extend(["--add-dir", d])
        return cmd

    async def process(self, message) -> str:
        """无状态模式：单次独立执行"""
        prompt = self._build_prompt(message.content)
        cmd = self._build_base_cmd(prompt) + ["--no-session-persistence"]
        return await self._run(cmd, message.chat_id)

    async def process_with_session(self, message, session_id: str) -> str:
        """会话模式：携带 session-id 保持上下文"""
        prompt = self._build_prompt(message.content)
        cmd = self._build_base_cmd(prompt) + [
            "--session-id", session_id,
            "--resume",
        ]
        return await self._run(cmd, message.chat_id)

    async def _run(self, cmd: list[str], chat_id: str) -> str:
        """执行子进程并解析 stream-json 输出"""
        logger.info(f"🚀 启动 Claude Code CLI: {' '.join(cmd[:4])}...")

        env = os.environ.copy()
        if settings.anthropic_api_key:
            env["ANTHROPIC_API_KEY"] = settings.anthropic_api_key

        try:
            proc = await asyncio.create_subprocess_exec(
                *cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
                env=env,
            )
        except FileNotFoundError:
            await send_error(chat_id, "未找到 claude 命令，请确认已安装 Claude Code CLI")
            return ""

        output_parts = []
        try:
            async with asyncio.timeout(settings.task_timeout):
                while True:
                    line = await proc.stdout.readline()
                    if not line:
                        break
                    try:
                        data = json.loads(line)
                        t = data.get("type", "")

                        if t == "assistant":
                            for block in data.get("message", {}).get("content", []):
                                if isinstance(block, dict) and block.get("type") == "text":
                                    output_parts.append(block.get("text", ""))
                        elif t == "result":
                            break
                        elif t == "tool_use":
                            logger.debug(f"  🔧 工具调用: {data.get('name', 'unknown')}")
                    except json.JSONDecodeError:
                        continue
        except TimeoutError:
            proc.kill()
            await proc.wait()
            await send_timeout(chat_id)
            return ""

        await proc.wait()

        stderr = await proc.stderr.read()
        if stderr:
            logger.warning(f"Claude CLI stderr: {stderr.decode()[:200]}")

        result = "\n".join(output_parts).strip()
        if not result:
            result = "Claude Code 未返回有效输出，请检查指令是否正确。"

        logger.info(f"✅ 任务完成，输出 {len(result)} 字符")
        return result
