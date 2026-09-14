"""Safe terminal command execution with a blocklist for destructive patterns."""

import re
import subprocess

# Patterns that could cause irreversible damage — blocked outright
_BLOCKED = [
    r"\brm\s+.*-[a-z]*r[a-z]*f",       # rm -rf / rm -fr
    r"\bdd\s+.*of=/dev/",               # dd to block device
    r"\bmkfs\b",                        # format filesystem
    r"\bshred\b",                       # shred files
    r">\s*/dev/sd[a-z]",               # redirect to disk
    r">\s*/dev/nvme",
    r"\bformat\b.*[cC]:\\",            # Windows format
    r":()\s*\{.*\|.*:.*&\s*\}",        # fork bomb
    r">\s*/etc/passwd",
    r">\s*/etc/shadow",
    r"curl\s+.*\|\s*(ba)?sh",          # curl-pipe-to-shell
    r"wget\s+.*\|\s*(ba)?sh",
    r"chmod\s+-?R\s+777\s+/\s*$",     # chmod 777 /
]


def run_terminal_command(command: str, timeout: int = 30) -> dict:
    """Execute a shell command and return stdout, stderr, and exit code."""
    for pattern in _BLOCKED:
        if re.search(pattern, command, re.IGNORECASE):
            return {
                "success": False,
                "blocked": True,
                "reason": (
                    f"Command blocked: matches dangerous pattern. "
                    f"Run it manually if you're sure it's safe."
                ),
                "stdout": "",
                "stderr": "",
                "exit_code": -1,
                "command": command,
            }

    timeout = min(max(timeout, 1), 120)

    try:
        proc = subprocess.run(
            command,
            shell=True,
            capture_output=True,
            text=True,
            timeout=timeout,
        )
        return {
            "success": proc.returncode == 0,
            "stdout": proc.stdout[:12000],
            "stderr": proc.stderr[:3000],
            "exit_code": proc.returncode,
            "command": command,
        }
    except subprocess.TimeoutExpired:
        return {
            "success": False,
            "error": f"Command timed out after {timeout}s",
            "stdout": "",
            "stderr": "",
            "exit_code": -1,
            "command": command,
        }
    except Exception as exc:
        return {
            "success": False,
            "error": str(exc),
            "stdout": "",
            "stderr": "",
            "exit_code": -1,
            "command": command,
        }
