# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

AutoGLM-GUI is a modern web-based graphical interface for AutoGLM Phone Agent, enabling AI-powered Android device automation through a conversational interface with real-time screen monitoring.

**Key Technologies:**
- **Backend**: FastAPI (Python 3.10+) with WebSocket support
- **Frontend**: React 19 + TanStack Router + Tailwind CSS 4
- **Phone Integration**: ADB (Android Debug Bridge) + scrcpy for video streaming
- **Package Manager**: `uv` for Python, `pnpm` for frontend

## Development Commands

### Backend Development

All Python commands MUST use `uv run python` in the project root directory. Never execute `python` directly.

```bash
# Install dependencies
uv sync

# Run backend with auto-reload (development)
uv run autoglm-gui --base-url http://localhost:8080/v1 --reload

# Run backend (production mode)
uv run autoglm-gui --base-url https://open.bigmodel.cn/api/paas/v4 \
  --model autoglm-phone \
  --apikey sk-xxxxx

# Run with custom log level (DEBUG, INFO, WARNING, ERROR, CRITICAL)
uv run autoglm-gui --base-url http://localhost:8080/v1 --log-level DEBUG

# Disable file logging (console only)
uv run autoglm-gui --base-url http://localhost:8080/v1 --no-log-file

# Custom log file path
uv run autoglm-gui --base-url http://localhost:8080/v1 --log-file logs/custom.log
```

### Frontend Development

```bash
# Install dependencies
cd frontend && pnpm install

# Development server (runs on port 3000)
cd frontend && pnpm dev

# Type checking
cd frontend && pnpm type-check

# Linting
cd frontend && pnpm lint
cd frontend && pnpm lint:fix

# Format code
cd frontend && pnpm format
cd frontend && pnpm format:check
```

### Building and Packaging

```bash
# Build frontend only (required before running backend)
uv run python scripts/build.py

# Build frontend + create Python package
uv run python scripts/build.py --pack

# Test built package locally
uvx --from dist/autoglm_gui-*.whl autoglm-gui

# Publish to PyPI
uv publish
```

## Configuration Management

### Configuration File

AutoGLM-GUI supports persistent configuration stored in `~/.config/autoglm/config.json`:

```json
{
  "base_url": "http://localhost:8080/v1",
  "model_name": "autoglm-phone-9b",
  "api_key": "sk-xxxxx"
}
```

### Configuration Priority

Configuration is loaded with the following priority (highest to lowest):

1. **CLI Arguments** (highest priority) - Override everything else
2. **Config File** (`~/.config/autoglm/config.json`) - Persistent settings
3. **Default Values** (lowest priority) - Built-in defaults

### Usage Examples

**First Time Setup (via Frontend)**:
1. Start: `uv run autoglm-gui`
2. Frontend opens config modal automatically (if no base_url configured)
3. Fill in `base_url`, `model_name`, `api_key`
4. Click "保存配置" (Save Configuration)
5. Configuration is saved to `~/.config/autoglm/config.json`

**Using Config File**:
```bash
# Start with saved configuration
uv run autoglm-gui

# The startup banner will show:
#   Configuration Source: config file (~/.config/autoglm/config.json)
```

**Using CLI Arguments (Override Config)**:
```bash
# CLI arguments override config file
uv run autoglm-gui --base-url http://localhost:8080/v1 --model autoglm-phone-9b

# The startup banner will show:
#   Configuration Source: CLI arguments
```

**Managing Config**:
- **View**: Click "全局配置" (Global Config) button in frontend sidebar
- **Edit**: Update via frontend modal and click "保存配置"
- **Delete**: Remove `~/.config/autoglm/config.json` manually
- **Check Current**: Backend startup banner shows config source

### Configuration API Endpoints

The frontend uses these API endpoints for configuration management:

- `GET /api/config` - Read current effective configuration
- `POST /api/config` - Save configuration to file
- `DELETE /api/config` - Delete configuration file

## Architecture

### Request Flow

1. **User Chat Request** → Frontend (`/chat` route) → WebSocket (`/ws/chat`) → Backend (`server.py`)
2. **Backend** → `PhoneAgent.run()` orchestrates the task
3. **PhoneAgent** → Uses `ModelClient` to call OpenAI-compatible LLM API with screenshots
4. **LLM Response** → `ActionHandler` executes phone actions via ADB
5. **Real-time Updates** → Streamed back through WebSocket to frontend

### Backend Architecture (`AutoGLM_GUI/`)

- **`server.py`**: FastAPI application with REST and WebSocket endpoints
  - `/api/init` - Initialize agent with model/agent configs
  - `/api/chat` - Chat endpoint (REST fallback)
  - `/ws/chat` - WebSocket chat with streaming responses
  - `/api/screenshot` - Capture device screenshot
  - `/api/tap` - Send tap command to device
  - `/api/scrcpy/stream` - H.264 video stream endpoint
  - `/api/scrcpy/info` - Get device resolution info
- **`scrcpy_stream.py`**: `ScrcpyStreamer` class manages scrcpy server lifecycle and H.264 video streaming
  - Spawns scrcpy-server process on device
  - Handles TCP socket for video data
  - Caches SPS/PPS/IDR frames for new client connections
  - Critical: Uses bundled `scrcpy-server-v3.3.3` binary (must be in project root and package)
- **`logger.py`**: Centralized logging configuration using loguru
  - Provides colorized console output with timestamps, levels, and source locations
  - Automatic file logging with rotation (100MB) and retention (7 days)
  - Separate error log files (50MB rotation, 30 days retention)
  - Configurable via CLI parameters (--log-level, --log-file, --no-log-file)
  - Used throughout AutoGLM_GUI/ (phone_agent/ uses original print statements)
- **`adb_plus/`**: Extended ADB utilities (screenshot capture, etc.)

### Phone Agent (`phone_agent/`)

Core automation engine from Open-AutoGLM:

- **`agent.py`**: `PhoneAgent` class - main orchestrator
  - `run(task)` - Execute a natural language task
  - `_execute_step()` - Single step: screenshot → LLM call → action execution
  - Manages conversation context and step counting
- **`actions/handler.py`**: `ActionHandler` - executes actions from LLM output
  - `do()` - Generic actions: tap, swipe, type, launch app, etc.
  - `finish()` - Task completion
  - `takeover()` - Human intervention request (login, CAPTCHA)
  - Coordinate normalization (0-1000 range → actual device pixels)
- **`adb/`**: Low-level ADB operations
  - `connection.py` - Device connection management
  - `device.py` - Device info (screen size, current app)
  - `input.py` - Touch/keyboard input
  - `screenshot.py` - Screenshot capture with Pillow
- **`model/client.py`**: `ModelClient` - OpenAI-compatible API client
  - Handles vision messages (text + base64 images)
  - Streaming support
- **`config/`**: Prompts and app definitions
  - `prompts.py` - System prompts (Chinese/English)
  - `apps.py` - Common Chinese app package names and aliases
  - `i18n.py` - Internationalization utilities

### Frontend Architecture (`frontend/src/`)

- **`routes/chat.tsx`**: Main chat interface
  - WebSocket connection to `/ws/chat`
  - Real-time video player (`ScrcpyPlayer` component)
  - Message history display
  - Manual tap controls on video stream
- **`components/ScrcpyPlayer.tsx`**: Scrcpy video player component
  - Uses `jmuxer` for H.264 decoding and playback
  - Fetches device resolution from `/api/scrcpy/info`
  - Handles coordinate transformation for tap events
  - Letterbox calculation for proper click positioning
  - Ripple animation on tap
- **`api.ts`**: API client functions (uses `redaxios` - lightweight axios alternative)

## Critical Implementation Details

### Video Streaming (Scrcpy)

- **Server Binary**: `scrcpy-server-v3.3.3` must exist at project root
- **Deployment**: Binary is bundled in wheel via `pyproject.toml` force-include
- **Stream Format**: Raw H.264 NAL units over TCP socket (port 27183)
- **Parameter Sets**: SPS/PPS are cached on first capture and sent to new clients for immediate playback
- **Coordinate Mapping**: Frontend gets device resolution (e.g., 1080x2400) and video size (e.g., 576x1280), calculates letterbox offsets, transforms click coords back to device scale

### Model API Integration

- **Compatible APIs**: Any OpenAI-compatible endpoint (智谱 BigModel, ModelScope, vLLM, SGLang)
- **Vision Messages**: Each step sends current screenshot as base64 PNG in message content
- **Response Format**: LLM returns JSON with `thinking` and `action` fields
- **Action Schema**: `{type: "do"|"finish"|"takeover", ...params}` parsed by `ActionHandler`

### ADB Device Control

- **Connection**: Uses `adb` CLI tool (must be in PATH)
- **Coordinate System**: LLM outputs normalized coords (0-1000), converted to pixels based on device resolution
- **Keyboard Handling**: Temporarily switches to ADB keyboard for text input, restores original after
- **Screenshot**: Captures via ADB screencap, converts to PNG with Pillow

### Logging System

- **Library**: loguru - modern Python logging with zero configuration
- **Scope**: Only AutoGLM_GUI/ directory (phone_agent/ keeps original print statements for compatibility)
- **Console Output**:
  - Colorized output with timestamps, log levels, and source locations
  - Default level: INFO (adjustable via --log-level)
  - Format: `YYYY-MM-DD HH:mm:ss.SSS | LEVEL | module:function:line - message`
- **File Output**:
  - Main log: `logs/autoglm_{time:YYYY-MM-DD}.log` (all levels ≥ DEBUG)
  - Error log: `logs/errors_{time:YYYY-MM-DD}.log` (only ERROR and above)
  - Rotation: 100MB for main log, 50MB for error log
  - Retention: 7 days for main log, 30 days for error log
  - Compression: zip format for rotated logs
- **Usage in Code**:
  ```python
  from AutoGLM_GUI.logger import logger

  logger.debug("Detailed information for debugging")
  logger.info("Normal operation messages")
  logger.warning("Warning messages")
  logger.error("Error messages")
  logger.exception("Exception with full stack trace")
  ```
- **Log Levels**:
  - DEBUG: NAL unit caching, initialization data details, sent NAL counts
  - INFO: Server startup, device connections, stream lifecycle events
  - WARNING: Retries, failed operations with recovery, takeover requests
  - ERROR: Failed starts, connection errors, unexpected exceptions

## Configuration

### Environment Variables

```bash
# Optional defaults (overridden by CLI args)
AUTOGLM_BASE_URL=http://localhost:8080/v1
AUTOGLM_MODEL_NAME=autoglm-phone-9b
AUTOGLM_API_KEY=EMPTY

# Optional scrcpy server path
SCRCPY_SERVER_PATH=/path/to/scrcpy-server
```

### CLI Arguments

See `AutoGLM_GUI/__main__.py` for full list. Key args:
- `--base-url` (required): Model API endpoint
- `--model`: Model name (default: autoglm-phone-9b)
- `--apikey`: API key
- `--host`: Server host (default: 127.0.0.1)
- `--port`: Server port (default: 8000, auto-finds if occupied)
- `--log-level`: Console log level - DEBUG, INFO, WARNING, ERROR, CRITICAL (default: INFO)
- `--log-file`: Log file path (default: logs/autoglm_{time:YYYY-MM-DD}.log)
- `--no-log-file`: Disable file logging (console only)
- `--no-browser`: Skip auto-opening browser
- `--reload`: Enable uvicorn auto-reload (development only)

## Package Structure

```
AutoGLM_GUI/           # Backend FastAPI app (entry point)
  __main__.py          # CLI entry point
  server.py            # FastAPI routes and WebSocket
  scrcpy_stream.py     # Scrcpy video streaming
  adb_plus/            # Extended ADB utilities
  static/              # Built frontend (copied from frontend/dist)

phone_agent/           # Core automation engine
  agent.py             # PhoneAgent orchestrator
  actions/handler.py   # Action execution
  adb/                 # Low-level ADB operations
  model/client.py      # LLM API client
  config/              # Prompts and app definitions

frontend/              # React frontend
  src/
    routes/chat.tsx    # Main UI
    components/ScrcpyPlayer.tsx
    api.ts             # API client
  dist/                # Build output (not in git)

scrcpy-server-v3.3.3   # Scrcpy server binary (bundled)
scripts/build.py       # Build automation
```

## Common Pitfalls

1. **Missing scrcpy-server**: Video streaming fails if binary is missing or not bundled correctly in wheel
2. **Coordinate Mismatch**: Frontend must fetch actual device resolution via `/api/scrcpy/info` before sending taps
3. **Python Execution**: Always use `uv run python`, never plain `python`
4. **Frontend Not Built**: Backend serves static files from `AutoGLM_GUI/static/` - must run `scripts/build.py` first
5. **ADB Not in PATH**: All ADB operations will fail silently or with cryptic errors
6. **Model API Compatibility**: LLM must support vision inputs (base64 images) and follow action schema conventions

## Development Workflow

1. Make frontend changes → `cd frontend && pnpm dev` (hot reload)
2. Make backend changes → `uv run autoglm-gui --reload` (auto-reload enabled)
3. Before committing code, run backend linting: `uv run python scripts/lint.py`
4. Before package release:
   - Build frontend: `uv run python scripts/build.py`
   - Test locally: `uv run autoglm-gui`
   - Build package: `uv run python scripts/build.py --pack`
   - Test wheel: `uvx --from dist/autoglm_gui-*.whl autoglm-gui`
   - Publish: `uv publish`
- phone_agent 下面是第三方的代码，目前通过直接拷贝代码的情况下进行引用，为了保持兼容性，任何时候不能修改里面的代码