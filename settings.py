"""
配置管理：从 .env 加载并校验必填项
"""
import os
from dataclasses import dataclass, field
from dotenv import load_dotenv

load_dotenv()


class ConfigError(Exception):
    """配置错误"""


@dataclass
class Settings:
    app_id: str = field(default_factory=lambda: os.getenv("FEISHU_APP_ID", ""))
    app_secret: str = field(default_factory=lambda: os.getenv("FEISHU_APP_SECRET", ""))
    encrypt_key: str = field(default_factory=lambda: os.getenv("FEISHU_ENCRYPT_KEY", ""))
    verification_token: str = field(default_factory=lambda: os.getenv("FEISHU_VERIFICATION_TOKEN", ""))
    anthropic_api_key: str = field(default_factory=lambda: os.getenv("ANTHROPIC_API_KEY", ""))
    working_dir: str = field(default_factory=lambda: os.getenv("CLAUDE_WORKING_DIR", os.getcwd()))
    allowed_users: list[str] = field(default_factory=lambda: _parse_list(os.getenv("ALLOWED_USERS", "")))
    allowed_tools: str = field(default_factory=lambda: os.getenv("CLAUDE_ALLOWED_TOOLS", "Read,Glob,Grep"))
    custom_instruction: str = field(default_factory=lambda: os.getenv("CLAUDE_CUSTOM_INSTRUCTION", ""))
    task_timeout: int = field(default_factory=lambda: int(os.getenv("TASK_TIMEOUT", "300")))
    max_budget_usd: float = field(default_factory=lambda: float(os.getenv("MAX_BUDGET_USD", "2")))
    log_level: str = field(default_factory=lambda: os.getenv("LOG_LEVEL", "INFO"))

    @property
    def working_dirs(self) -> list[str]:
        """支持逗号分隔的多目录"""
        return [d.strip() for d in self.working_dir.split(",") if d.strip()]

    def validate(self):
        missing = []
        if not self.app_id:
            missing.append("FEISHU_APP_ID")
        if not self.app_secret:
            missing.append("FEISHU_APP_SECRET")
        if not self.encrypt_key:
            missing.append("FEISHU_ENCRYPT_KEY")
        if not self.verification_token:
            missing.append("FEISHU_VERIFICATION_TOKEN")
        if missing:
            raise ConfigError(
                f"缺少必要的环境变量: {', '.join(missing)}。"
                f"请复制 .env.template 为 .env 并填入真实值。"
            )


def _parse_list(value: str) -> list[str]:
    """逗号分隔字符串 → 去空格的列表"""
    return [v.strip() for v in value.split(",") if v.strip()]


settings = Settings()
