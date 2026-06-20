"""IT Support Agent — Web Dashboard with integrated chat (Flask backend)."""

import json
import os
import sys
import threading
from concurrent.futures import ThreadPoolExecutor, TimeoutError as FutureTimeout
from datetime import datetime

import anthropic
from flask import Flask, jsonify, render_template, request, Response, stream_with_context

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from tools.system import run_system_check, check_hardware_health, get_system_logs
from tools.security import check_security, get_running_processes, check_network
from tools.storage import get_storage_info
from tools.updates import check_software_updates
from tools.terminal import run_terminal_command
from tools.fixes import fix_issue

app = Flask(__name__)

# ── Background cache ───────────────────────────────────────────────────────────
_cache: dict = {}
_cache_lock = threading.Lock()
_last_refresh: dict = {}


def _refresh(key, fn, *args, **kwargs):
    try:
        result = fn(*args, **kwargs)
        with _cache_lock:
            _cache[key] = result
            _last_refresh[key] = datetime.now().strftime("%H:%M:%S")
    except Exception as exc:
        with _cache_lock:
            _cache[key] = {"error": str(exc)}


def _get(key, fn, *args, ttl=30, **kwargs):
    with _cache_lock:
        cached = _cache.get(key)
        last = _last_refresh.get(key)
    stale = last is None or (datetime.now() - datetime.strptime(last, "%H:%M:%S")).seconds > ttl
    if cached is None:
        _refresh(key, fn, *args, **kwargs)
        with _cache_lock:
            return _cache.get(key, {})
    if stale:
        threading.Thread(target=_refresh, args=(key, fn) + args, kwargs=kwargs, daemon=True).start()
    return cached


# ── Agent chat tools ───────────────────────────────────────────────────────────
TOOLS = [
    {"name": "run_system_check", "description": "CPU, RAM, disk, battery, uptime snapshot with alerts.", "input_schema": {"type": "object", "properties": {}, "required": []}},
    {"name": "check_software_updates", "description": "Check for available system, pip, and npm updates.", "input_schema": {"type": "object", "properties": {}, "required": []}},
    {"name": "get_storage_info", "description": "Disk usage, large files, temp/cache sizes.", "input_schema": {"type": "object", "properties": {"scan_path": {"type": "string"}, "find_large_files": {"type": "boolean"}}}},
    {"name": "run_terminal_command", "description": "Run a shell command safely (destructive commands blocked).", "input_schema": {"type": "object", "properties": {"command": {"type": "string"}, "timeout": {"type": "integer"}}, "required": ["command"]}},
    {"name": "check_security", "description": "Security scan: suspicious processes, crons, ports, hosts file.", "input_schema": {"type": "object", "properties": {}, "required": []}},
    {"name": "get_running_processes", "description": "List processes by CPU or memory usage.", "input_schema": {"type": "object", "properties": {"sort_by": {"type": "string", "enum": ["cpu", "memory", "name"]}, "top_n": {"type": "integer"}}}},
    {"name": "check_network", "description": "Active connections, DNS, suspicious port detection.", "input_schema": {"type": "object", "properties": {}, "required": []}},
    {"name": "check_hardware_health", "description": "Temperatures, fan speeds, disk SMART status.", "input_schema": {"type": "object", "properties": {}, "required": []}},
    {"name": "get_system_logs", "description": "Read system/kernel/auth/crash logs.", "input_schema": {"type": "object", "properties": {"log_type": {"type": "string", "enum": ["system", "kernel", "auth", "application", "crash"]}, "lines": {"type": "integer"}, "filter_keyword": {"type": "string"}}}},
    {"name": "fix_issue", "description": "Auto-fix: clear_temp, clear_cache, fix_permissions, free_memory.", "input_schema": {"type": "object", "properties": {"fix_type": {"type": "string", "enum": ["clear_temp", "clear_cache", "fix_permissions", "free_memory"]}}, "required": ["fix_type"]}},
]

SYSTEM_PROMPT = """You are an expert IT support agent and personal laptop assistant embedded in a web dashboard.
Help the user monitor, diagnose, secure, and optimise their laptop.

Always use tools to get real data before giving advice. Be concise but thorough.
Use markdown: **bold**, bullet lists, `code`. Status: ✅ OK · ⚠️ Warning · ❌ Critical · 🔧 Fixing."""

_TOOL_MAP = {
    "run_system_check": lambda kw: run_system_check(),
    "check_software_updates": lambda kw: check_software_updates(),
    "get_storage_info": lambda kw: get_storage_info(**kw),
    "run_terminal_command": lambda kw: run_terminal_command(**kw),
    "check_security": lambda kw: check_security(),
    "get_running_processes": lambda kw: get_running_processes(**kw),
    "check_network": lambda kw: check_network(),
    "check_hardware_health": lambda kw: check_hardware_health(),
    "get_system_logs": lambda kw: get_system_logs(**kw),
    "fix_issue": lambda kw: fix_issue(**kw),
}


def _call_tool(name, kwargs):
    fn = _TOOL_MAP.get(name)
    if not fn:
        return {"error": f"Unknown tool: {name}"}
    try:
        return fn(kwargs)
    except Exception as exc:
        return {"error": f"{type(exc).__name__}: {exc}"}


# ── Dashboard routes ───────────────────────────────────────────────────────────
@app.route("/")
def index():
    return render_template("index.html")


@app.route("/api/system")
def api_system():
    return jsonify(_get("system", run_system_check, ttl=10))


@app.route("/api/processes")
def api_processes():
    return jsonify(_get("processes", get_running_processes, sort_by="cpu", top_n=15, ttl=10))


@app.route("/api/storage")
def api_storage():
    return jsonify(_get("storage", get_storage_info, find_large_files=False, ttl=60))


@app.route("/api/security")
def api_security():
    return jsonify(_get("security", check_security, ttl=120))


@app.route("/api/network")
def api_network():
    return jsonify(_get("network", check_network, ttl=15))


@app.route("/api/hardware")
def api_hardware():
    return jsonify(_get("hardware", check_hardware_health, ttl=30))


@app.route("/api/updates")
def api_updates():
    return jsonify(_get("updates", check_software_updates, ttl=300))


@app.route("/api/fix/<fix_type>", methods=["POST"])
def api_fix(fix_type):
    allowed = {"clear_temp", "clear_cache", "fix_permissions", "free_memory"}
    if fix_type not in allowed:
        return jsonify({"error": "Unknown fix type"}), 400
    result = fix_issue(fix_type)
    with _cache_lock:
        _cache.pop("storage", None)
        _last_refresh.pop("storage", None)
    return jsonify(result)


@app.route("/api/all")
def api_all():
    with ThreadPoolExecutor(max_workers=4) as pool:
        fs = {
            "system":    pool.submit(_get, "system",    run_system_check, ttl=10),
            "processes": pool.submit(_get, "processes", get_running_processes, sort_by="cpu", top_n=15, ttl=10),
            "storage":   pool.submit(_get, "storage",   get_storage_info, find_large_files=False, ttl=60),
            "network":   pool.submit(_get, "network",   check_network, ttl=15),
        }
        out = {}
        for key, fut in fs.items():
            try:
                out[key] = fut.result(timeout=10)
            except FutureTimeout:
                out[key] = {"error": "timeout — data still loading"}
            except Exception as exc:
                out[key] = {"error": str(exc)}
    out["last_updated"] = datetime.now().strftime("%H:%M:%S")
    return jsonify(out)


# ── Chat route (streaming SSE) ─────────────────────────────────────────────────
@app.route("/api/chat", methods=["POST"])
def api_chat():
    data = request.json or {}
    messages = data.get("messages", [])
    if not messages:
        return jsonify({"error": "No messages provided"}), 400

    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        return jsonify({"error": "ANTHROPIC_API_KEY not set on server"}), 500

    def generate():
        client = anthropic.Anthropic(api_key=api_key)
        chat_messages = list(messages)

        while True:
            response = client.messages.create(
                model="claude-sonnet-4-6",
                max_tokens=4096,
                system=SYSTEM_PROMPT,
                tools=TOOLS,
                messages=chat_messages,
            )

            # Stream text blocks
            for block in response.content:
                if hasattr(block, "text") and block.text:
                    yield f"data: {json.dumps({'type': 'text', 'text': block.text})}\n\n"

            chat_messages.append({"role": "assistant", "content": response.content})

            if response.stop_reason == "end_turn":
                yield f"data: {json.dumps({'type': 'done'})}\n\n"
                break

            if response.stop_reason == "tool_use":
                tool_results = []
                for block in response.content:
                    if block.type == "tool_use":
                        yield f"data: {json.dumps({'type': 'tool', 'name': block.name})}\n\n"
                        result = _call_tool(block.name, block.input)
                        tool_results.append({
                            "type": "tool_result",
                            "tool_use_id": block.id,
                            "content": json.dumps(result, default=str),
                        })
                chat_messages.append({"role": "user", "content": tool_results})
            else:
                yield f"data: {json.dumps({'type': 'done'})}\n\n"
                break

    return Response(
        stream_with_context(generate()),
        mimetype="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


if __name__ == "__main__":
    print("\n🖥️  IT Support Dashboard → http://localhost:5000\n")
    for _k, _fn, _kw in [
        ("system",    run_system_check,    {}),
        ("processes", get_running_processes, {"sort_by": "cpu", "top_n": 15}),
        ("storage",   get_storage_info,    {"find_large_files": False}),
        ("network",   check_network,       {}),
    ]:
        threading.Thread(target=_refresh, args=(_k, _fn), kwargs=_kw, daemon=True).start()
    app.run(debug=False, host="0.0.0.0", port=5000, threaded=True)
