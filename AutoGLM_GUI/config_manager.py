"""配置文件管理模块."""

import json
from pathlib import Path

from AutoGLM_GUI.logger import logger

# 默认配置
DEFAULT_CONFIG = {"base_url": "", "model_name": "autoglm-phone-9b", "api_key": "EMPTY"}


def get_config_path() -> Path:
    """获取配置文件路径.

    Returns:
        Path: 配置文件路径 (~/.config/autoglm/config.json)
    """
    config_dir = Path.home() / ".config" / "autoglm"
    return config_dir / "config.json"


def load_config_file() -> dict | None:
    """从文件加载配置.

    Returns:
        dict | None: 配置字典，如果文件不存在或加载失败则返回 None
    """
    config_path = get_config_path()

    # 文件不存在（首次运行）
    if not config_path.exists():
        logger.debug(f"Config file not found at {config_path}")
        return None

    try:
        with open(config_path, "r", encoding="utf-8") as f:
            config = json.load(f)
            logger.info(f"Loaded configuration from {config_path}")
            return config
    except json.JSONDecodeError as e:
        logger.warning(f"Failed to parse config file {config_path}: {e}")
        return None
    except Exception as e:
        logger.error(f"Failed to read config file {config_path}: {e}")
        return None


def save_config_file(config: dict) -> bool:
    """保存配置到文件（原子写入）.

    Args:
        config: 配置字典

    Returns:
        bool: 成功返回 True，失败返回 False
    """
    config_path = get_config_path()

    try:
        # 确保目录存在
        config_path.parent.mkdir(parents=True, exist_ok=True)

        # 原子写入：先写入临时文件，然后重命名
        temp_path = config_path.with_suffix(".tmp")
        with open(temp_path, "w", encoding="utf-8") as f:
            json.dump(config, f, indent=2, ensure_ascii=False)

        # 重命名（原子操作）
        temp_path.replace(config_path)

        logger.info(f"Configuration saved to {config_path}")
        return True
    except Exception as e:
        logger.error(f"Failed to save config file {config_path}: {e}")
        return False


def delete_config_file() -> bool:
    """删除配置文件.

    Returns:
        bool: 成功返回 True，失败返回 False
    """
    config_path = get_config_path()

    if not config_path.exists():
        logger.debug(f"Config file does not exist: {config_path}")
        return True

    try:
        config_path.unlink()
        logger.info(f"Configuration deleted: {config_path}")
        return True
    except Exception as e:
        logger.error(f"Failed to delete config file {config_path}: {e}")
        return False


def merge_configs(file_config: dict | None, cli_config: dict | None) -> dict:
    """合并配置（优先级：CLI > 文件 > 默认值）.

    Args:
        file_config: 从文件加载的配置（可为 None）
        cli_config: CLI 参数配置（可为 None）

    Returns:
        dict: 合并后的配置字典
    """
    # 从默认配置开始
    merged = DEFAULT_CONFIG.copy()

    # 应用文件配置（如果存在）
    if file_config:
        for key in DEFAULT_CONFIG.keys():
            if key in file_config:
                merged[key] = file_config[key]

    # 应用 CLI 配置（最高优先级）
    if cli_config:
        for key in DEFAULT_CONFIG.keys():
            if key in cli_config:
                merged[key] = cli_config[key]

    return merged
