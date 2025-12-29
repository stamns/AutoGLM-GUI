"""MCP (Model Context Protocol) tools for AutoGLM-GUI."""

from typing import Any, Dict, List

from fastmcp import FastMCP

from AutoGLM_GUI.logger import logger
from AutoGLM_GUI.prompts import MCP_SYSTEM_PROMPT_ZH

# 创建 MCP 服务器实例
mcp = FastMCP("AutoGLM-GUI MCP Server")


@mcp.tool()
def chat(device_id: str, message: str) -> Dict[str, Any]:
    """
    Send a task to the AutoGLM Phone Agent for execution.

    The agent will be automatically initialized with global configuration
    if not already initialized.

    Args:
        device_id: Device identifier (e.g., "192.168.1.100:5555" or serial)
        message: Natural language task (e.g., "打开微信", "发送消息")

    Returns:
        {
            "result": str,    # Task execution result
            "steps": int,     # Number of steps taken
            "success": bool   # Success flag
        }
    """
    from AutoGLM_GUI.config_manager import config_manager
    from AutoGLM_GUI.exceptions import DeviceBusyError
    from AutoGLM_GUI.phone_agent_manager import PhoneAgentManager
    from phone_agent.agent import AgentConfig
    from phone_agent.model import ModelConfig

    logger.info(f"[MCP] chat tool called: device_id={device_id}")

    manager = PhoneAgentManager.get_instance()

    # Auto-initialize agent if not already initialized
    if not manager.is_initialized(device_id):
        logger.info(f"[MCP] Auto-initializing agent for device {device_id}")

        # Import the shared initialization function
        from AutoGLM_GUI.api.agents import _initialize_agent_with_config

        # Get effective config from config_manager
        effective_config = config_manager.get_effective_config()

        # Check if base_url is configured
        if not effective_config.base_url:
            raise RuntimeError(
                "Model configuration not set. Please configure via Settings or "
                "start with --base-url parameter."
            )

        # Create model config from global config
        model_config = ModelConfig(
            base_url=effective_config.base_url,
            api_key=effective_config.api_key,
            model_name=effective_config.model_name,
        )

        # Create agent config with device_id, MCP-specific 5-step limit, and MCP prompt
        agent_config = AgentConfig(
            device_id=device_id,
            lang="cn",  # Default language
            max_steps=5,  # MCP-specific step limit
            system_prompt=MCP_SYSTEM_PROMPT_ZH,  # MCP-specific Fail-Fast prompt
        )

        try:
            # Use shared initialization function (includes ADB Keyboard setup)
            _initialize_agent_with_config(device_id, model_config, agent_config)
            logger.info(f"[MCP] Agent auto-initialized successfully for {device_id}")
        except Exception as e:
            logger.error(f"[MCP] Failed to auto-initialize agent: {e}")
            raise RuntimeError(f"Failed to initialize agent: {str(e)}")

    # 使用上下文管理器获取 agent（自动管理锁）
    try:
        with manager.use_agent(device_id, timeout=None) as agent:
            # Temporarily override max_steps for MCP (thread-safe within device lock)
            original_max_steps = agent.agent_config.max_steps
            agent.agent_config.max_steps = 5

            try:
                # Reset agent before each chat to ensure clean state
                agent.reset()

                result = agent.run(message)
                steps = agent.step_count

                # Check if 5-step MCP limit was reached
                if steps >= 5 and result == "Max steps reached":
                    return {
                        "result": (
                            "已达到 MCP 最大步数限制（5步）。任务可能未完成，"
                            "建议将任务拆分为更小的子任务。"
                        ),
                        "steps": 5,
                        "success": False,
                    }

                return {"result": result, "steps": steps, "success": True}

            finally:
                # Restore original max_steps
                agent.agent_config.max_steps = original_max_steps

    except DeviceBusyError:
        raise RuntimeError(f"Device {device_id} is busy. Please wait.")
    except Exception as e:
        logger.error(f"[MCP] chat tool error: {e}")
        return {"result": str(e), "steps": 0, "success": False}


@mcp.tool()
def list_devices() -> List[Dict[str, Any]]:
    """
    List all connected ADB devices and their agent status.

    Returns:
        List of devices, each containing:
        - id: Device identifier for API calls
        - serial: Hardware serial number
        - model: Device model name
        - status: Connection status
        - connection_type: "usb" | "wifi" | "remote"
        - state: "online" | "offline" | "disconnected"
        - agent: Agent status (if initialized)
    """
    from AutoGLM_GUI.api.devices import _build_device_response_with_agent
    from AutoGLM_GUI.device_manager import DeviceManager
    from AutoGLM_GUI.phone_agent_manager import PhoneAgentManager

    logger.info("[MCP] list_devices tool called")

    device_manager = DeviceManager.get_instance()
    agent_manager = PhoneAgentManager.get_instance()

    # Fallback: 如果轮询未启动，执行同步刷新
    if not device_manager._poll_thread or not device_manager._poll_thread.is_alive():
        logger.warning("Polling not started, performing sync refresh")
        device_manager.force_refresh()

    managed_devices = device_manager.get_devices()

    # 重用现有的聚合逻辑
    devices_with_agents = [
        _build_device_response_with_agent(d, agent_manager) for d in managed_devices
    ]

    return devices_with_agents


def get_mcp_asgi_app():
    """
    Get the MCP server's ASGI app for mounting in FastAPI.

    Returns:
        ASGI app that handles MCP protocol requests
    """
    # 创建 MCP HTTP app with /mcp path prefix
    # This will create routes under /mcp when mounted at root
    return mcp.http_app(path="/mcp")
