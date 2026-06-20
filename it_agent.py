#!/usr/bin/env python3
"""
IT Support Agent — personal laptop assistant powered by Claude.

Features
--------
• System health check (CPU / RAM / disk / battery / uptime)
• Software update detection (apt / brew / pip / npm)
• Storage analysis — find large files, clean temp/cache
• Security scan — malware indicators, suspicious processes, ports, crons
• Network inspection — active connections, DNS, suspicious endpoints
• Hardware health — temperatures, fan speeds, disk SMART
• System logs — journalctl / syslog with keyword filtering
• Terminal — run diagnostic commands safely
• Auto-fixes — clear temp files, clear cache, fix permissions, free RAM

Usage
-----
    python it_agent.py                   # interactive chat
    python it_agent.py --scan            # run a full system scan immediately
    ANTHROPIC_API_KEY=sk-... python it_agent.py
"""

import argparse
import json
import os
import sys

import anthropic
from rich.console import Console
from rich.markdown import Markdown
from rich.panel import Panel
from rich.prompt import Prompt

from tools.system import check_hardware_health, get_system_logs, run_system_check
from tools.security import check_network, check_security, get_running_processes
from tools.storage import get_storage_info
from tools.updates import check_software_updates
from tools.terminal import run_terminal_command
from tools.fixes import fix_issue

console = Console()

# ── Tool schemas (sent to Claude) ─────────────────────────────────────────────

TOOLS: list[dict] = [
    {
        "name": "run_system_check",
        "description": (
            "Comprehensive snapshot of system health: CPU usage per core, RAM/swap, "
            "disk usage per partition, battery level, uptime, OS info, and auto-detected alerts. "
            "Always start here when diagnosing slowness or general issues."
        ),
        "input_schema": {"type": "object", "properties": {}, "required": []},
    },
    {
        "name": "check_software_updates",
        "description": (
            "Check for available updates using the system package manager "
            "(apt/dnf/pacman on Linux, brew/softwareupdate on macOS, winget on Windows) "
            "plus pip and npm global packages."
        ),
        "input_schema": {"type": "object", "properties": {}, "required": []},
    },
    {
        "name": "get_storage_info",
        "description": (
            "Analyse disk space: partition usage with status flags, files over 100 MB, "
            "top directories by size, and sizes of temp/cache/downloads folders."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "scan_path": {
                    "type": "string",
                    "description": "Directory to scan for large files. Defaults to the home directory.",
                },
                "find_large_files": {
                    "type": "boolean",
                    "description": "Whether to search for files over 100 MB. Default: true.",
                },
            },
        },
    },
    {
        "name": "run_terminal_command",
        "description": (
            "Execute a shell command and return stdout, stderr, and exit code. "
            "Use for diagnostics, configuration checks, and system administration. "
            "Destructive commands (rm -rf, mkfs, dd, etc.) are blocked automatically."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "command": {"type": "string", "description": "Shell command to execute."},
                "timeout": {
                    "type": "integer",
                    "description": "Timeout in seconds (1-120). Default: 30.",
                },
            },
            "required": ["command"],
        },
    },
    {
        "name": "check_security",
        "description": (
            "Multi-layer security scan: suspicious process names, cron jobs, "
            "listening ports, /etc/hosts hijack detection, recently modified /etc files, "
            "and SSH authorized_keys review."
        ),
        "input_schema": {"type": "object", "properties": {}, "required": []},
    },
    {
        "name": "get_running_processes",
        "description": (
            "List running processes ranked by CPU or memory usage. "
            "Useful for finding resource hogs and investigating slowness."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "sort_by": {
                    "type": "string",
                    "enum": ["cpu", "memory", "name"],
                    "description": "Sort order. Default: cpu.",
                },
                "top_n": {
                    "type": "integer",
                    "description": "Number of processes to return. Default: 20.",
                },
            },
        },
    },
    {
        "name": "check_network",
        "description": (
            "Inspect active network connections, listening ports, DNS servers, "
            "and flag connections to known suspicious ports."
        ),
        "input_schema": {"type": "object", "properties": {}, "required": []},
    },
    {
        "name": "check_hardware_health",
        "description": (
            "Hardware diagnostics: CPU/GPU sensor temperatures with threshold warnings, "
            "fan speeds, disk S.M.A.R.T. status (requires smartmontools), "
            "and hardware error messages from dmesg."
        ),
        "input_schema": {"type": "object", "properties": {}, "required": []},
    },
    {
        "name": "get_system_logs",
        "description": (
            "Read recent system logs to find errors, crashes, login events, and hardware issues. "
            "Supports journalctl (Linux), syslog files, and macOS unified log."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "log_type": {
                    "type": "string",
                    "enum": ["system", "kernel", "auth", "application", "crash"],
                    "description": "Log category. Default: system.",
                },
                "lines": {
                    "type": "integer",
                    "description": "Number of log lines to retrieve. Default: 100.",
                },
                "filter_keyword": {
                    "type": "string",
                    "description": "Optional keyword to filter log entries.",
                },
            },
        },
    },
    {
        "name": "fix_issue",
        "description": (
            "Apply an automated fix for common issues:\n"
            "• clear_temp — delete old files from /tmp and empty the Trash\n"
            "• clear_cache — remove browser caches and thumbnail cache\n"
            "• fix_permissions — correct .ssh and shell config file permissions\n"
            "• free_memory — sync buffers and drop kernel page cache (Linux, needs sudo)"
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "fix_type": {
                    "type": "string",
                    "enum": ["clear_temp", "clear_cache", "fix_permissions", "free_memory"],
                    "description": "Which fix to apply.",
                }
            },
            "required": ["fix_type"],
        },
    },
]

# ── System prompt ─────────────────────────────────────────────────────────────

SYSTEM_PROMPT = """You are an expert IT support agent and personal laptop assistant. \
Help the user monitor, diagnose, secure, and optimise their laptop.

Your capabilities:
1. **System health** — CPU, RAM, disk, battery, uptime
2. **Software updates** — detect outdated packages (system, pip, npm)
3. **Storage management** — find space hogs, suggest and apply cleanup
4. **Security checks** — detect malware indicators, suspicious processes, network anomalies
5. **Troubleshooting** — read logs, check hardware health, diagnose crashes
6. **Terminal** — run diagnostic commands on the user's behalf
7. **Auto-fixes** — clear temp/cache, fix permissions, free RAM

## Behaviour
- Always use tools to get real data before giving advice.
- Proactively flag issues found during any check, even if not explicitly asked.
- Prioritise findings: 🔴 Critical → 🟡 Warning → 🟢 OK
- When a problem is found, explain: what it is, why it matters, how to fix it.
- Before running a command that changes system state, briefly state what you are about to do.
- Give specific, actionable advice: exact commands, file paths, settings.

## Output style
- Use markdown formatting (headers, bullet lists, code blocks).
- Status indicators: ✅ OK · ⚠️ Warning · ❌ Critical · 🔍 Investigating · 🔧 Fixing
- Summarise first, then provide detail.
- If multiple issues are found, present them as a prioritised action list."""

# ── Tool dispatcher ───────────────────────────────────────────────────────────

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


def _call_tool(name: str, kwargs: dict) -> dict:
    fn = _TOOL_MAP.get(name)
    if fn is None:
        return {"error": f"Unknown tool: {name}"}
    try:
        return fn(kwargs)
    except Exception as exc:
        return {"error": f"{type(exc).__name__}: {exc}"}


# ── Startup health banner ─────────────────────────────────────────────────────

def _startup_banner() -> str:
    """Quick health check to display on launch."""
    try:
        data = run_system_check()
        alerts = data.get("alerts", [])
        if not alerts:
            return "✅ Quick health check passed — system looks good."
        return "**Startup alerts:**\n" + "\n".join(f"- {a}" for a in alerts)
    except Exception as exc:
        return f"⚠️ Startup check failed: {exc}"


# ── Agentic conversation loop ─────────────────────────────────────────────────

def chat(client: anthropic.Anthropic, messages: list, user_input: str) -> None:
    messages.append({"role": "user", "content": user_input})

    while True:
        with console.status("[dim]Thinking…[/dim]", spinner="dots"):
            response = client.messages.create(
                model="claude-sonnet-4-6",
                max_tokens=4096,
                system=[
                    {
                        "type": "text",
                        "text": SYSTEM_PROMPT,
                        "cache_control": {"type": "ephemeral"},
                    }
                ],
                tools=TOOLS,
                messages=messages,
            )

        # Accumulate assistant turn
        messages.append({"role": "assistant", "content": response.content})

        # Display any text blocks
        for block in response.content:
            if hasattr(block, "text") and block.text:
                console.print()
                console.print(Markdown(block.text))

        if response.stop_reason == "end_turn":
            break

        if response.stop_reason == "tool_use":
            tool_results = []
            for block in response.content:
                if block.type == "tool_use":
                    with console.status(f"[dim]🔧 {block.name}…[/dim]", spinner="dots"):
                        result = _call_tool(block.name, block.input)
                    tool_results.append(
                        {
                            "type": "tool_result",
                            "tool_use_id": block.id,
                            "content": json.dumps(result, default=str),
                        }
                    )
            messages.append({"role": "user", "content": tool_results})
        else:
            break


# ── Full scan mode ────────────────────────────────────────────────────────────

def full_scan(client: anthropic.Anthropic) -> None:
    """Run a comprehensive scan and print a report."""
    console.print(Panel("[bold]Running full system scan…[/bold]", border_style="yellow"))
    prompt = (
        "Please perform a thorough laptop health check. Run these tools in sequence: "
        "run_system_check, check_software_updates, get_storage_info, check_security, "
        "check_network, check_hardware_health. "
        "Then provide a consolidated report with a prioritised list of findings and recommended actions."
    )
    chat(client, [], prompt)


# ── Entry point ───────────────────────────────────────────────────────────────

def main() -> None:
    parser = argparse.ArgumentParser(description="IT Support Agent")
    parser.add_argument(
        "--scan", action="store_true",
        help="Run a full system scan and exit",
    )
    args = parser.parse_args()

    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        console.print(
            "[red]Error:[/red] ANTHROPIC_API_KEY environment variable not set.\n"
            "Get your key at https://console.anthropic.com/ and run:\n"
            "  export ANTHROPIC_API_KEY=sk-ant-..."
        )
        sys.exit(1)

    client = anthropic.Anthropic(api_key=api_key)

    if args.scan:
        full_scan(client)
        return

    # Interactive mode
    console.print(
        Panel.fit(
            "[bold green]IT Support Agent[/bold green] 🖥️\n"
            "[dim]Powered by Claude · type [bold]exit[/bold] to quit · "
            "[bold]--scan[/bold] flag for a full report[/dim]\n\n"
            "Try asking:\n"
            '  • "Check my system health"\n'
            '  • "Why is my laptop slow?"\n'
            '  • "Scan for malware"\n'
            '  • "How\'s my storage?"\n'
            '  • "Check for software updates"\n'
            '  • "Show recent system errors"',
            border_style="green",
        )
    )

    with console.status("[dim]Running quick startup check…[/dim]"):
        banner = _startup_banner()
    console.print(f"\n{banner}\n")

    messages: list = []

    while True:
        try:
            user_input = Prompt.ask("[bold cyan]You[/bold cyan]")
        except (KeyboardInterrupt, EOFError):
            console.print("\n[yellow]Goodbye! 👋[/yellow]")
            break

        if not user_input.strip():
            continue
        if user_input.strip().lower() in ("exit", "quit", "q", "bye"):
            console.print("[yellow]Goodbye! 👋[/yellow]")
            break

        chat(client, messages, user_input)


if __name__ == "__main__":
    main()
