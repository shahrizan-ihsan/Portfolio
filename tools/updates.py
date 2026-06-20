"""Software update detection across package managers."""

import json
import platform
import shutil
import subprocess


def check_software_updates() -> dict:
    """Check system packages, pip, and npm for available updates."""
    result = {
        "os": platform.system(),
        "package_manager": None,
        "system_updates": [],
        "pip_outdated": [],
        "npm_outdated": [],
        "error": None,
        "summary": "",
    }

    system = platform.system()
    if system == "Linux":
        _linux_updates(result)
    elif system == "Darwin":
        _macos_updates(result)
    elif system == "Windows":
        _windows_updates(result)

    _pip_updates(result)
    _npm_updates(result)

    total = (
        len(result["system_updates"])
        + len(result["pip_outdated"])
        + len(result["npm_outdated"])
    )
    result["summary"] = (
        f"⚠️ {total} update(s) available across system, pip, and npm"
        if total
        else "✅ Everything appears up to date"
    )
    return result


def _linux_updates(result: dict):
    # apt (Debian/Ubuntu)
    if shutil.which("apt"):
        result["package_manager"] = "apt"
        try:
            subprocess.run(
                ["apt-get", "update", "-qq"],
                capture_output=True, timeout=60,
            )
        except (subprocess.TimeoutExpired, PermissionError):
            pass
        try:
            proc = subprocess.run(
                ["apt", "list", "--upgradable"],
                capture_output=True, text=True, timeout=30,
            )
            lines = [l for l in proc.stdout.splitlines() if "/" in l]
            result["system_updates"] = [{"name": l.split("/")[0], "info": l} for l in lines[:50]]
            return
        except subprocess.TimeoutExpired:
            pass

    # dnf (Fedora/RHEL)
    if shutil.which("dnf"):
        result["package_manager"] = "dnf"
        try:
            proc = subprocess.run(
                ["dnf", "check-update", "--quiet"],
                capture_output=True, text=True, timeout=60,
            )
            lines = [l for l in proc.stdout.splitlines() if l.strip() and not l.startswith("Last")]
            result["system_updates"] = [{"name": l.split()[0], "info": l} for l in lines[:50]]
            return
        except subprocess.TimeoutExpired:
            pass

    # pacman (Arch)
    if shutil.which("pacman"):
        result["package_manager"] = "pacman"
        try:
            proc = subprocess.run(
                ["pacman", "-Qu"],
                capture_output=True, text=True, timeout=30,
            )
            lines = proc.stdout.strip().splitlines()
            result["system_updates"] = [{"name": l.split()[0], "info": l} for l in lines[:50]]
            return
        except subprocess.TimeoutExpired:
            pass

    if not result["package_manager"]:
        result["error"] = "No supported package manager found (apt / dnf / pacman)"


def _macos_updates(result: dict):
    result["package_manager"] = "softwareupdate"
    try:
        proc = subprocess.run(
            ["softwareupdate", "-l"],
            capture_output=True, text=True, timeout=90,
        )
        updates = [l.strip() for l in proc.stdout.splitlines() if l.strip().startswith("*")]
        result["system_updates"] = [{"name": u, "info": u, "source": "softwareupdate"} for u in updates]
    except (FileNotFoundError, subprocess.TimeoutExpired):
        pass

    if shutil.which("brew"):
        result["package_manager"] = "brew + softwareupdate"
        try:
            proc = subprocess.run(
                ["brew", "outdated"],
                capture_output=True, text=True, timeout=30,
            )
            for line in proc.stdout.splitlines():
                line = line.strip()
                if line:
                    result["system_updates"].append({"name": line.split()[0], "info": line, "source": "brew"})
        except subprocess.TimeoutExpired:
            pass


def _windows_updates(result: dict):
    result["package_manager"] = "winget"
    if shutil.which("winget"):
        try:
            proc = subprocess.run(
                ["winget", "upgrade", "--include-unknown"],
                capture_output=True, text=True, timeout=60,
            )
            lines = proc.stdout.splitlines()[2:52]
            result["system_updates"] = [{"name": l.split()[0], "info": l} for l in lines if l.strip()]
        except subprocess.TimeoutExpired:
            pass


def _pip_updates(result: dict):
    pip = shutil.which("pip3") or shutil.which("pip")
    if not pip:
        return
    try:
        proc = subprocess.run(
            [pip, "list", "--outdated", "--format=json"],
            capture_output=True, text=True, timeout=30,
        )
        packages = json.loads(proc.stdout) if proc.stdout.strip() else []
        result["pip_outdated"] = packages[:20]
    except (subprocess.TimeoutExpired, Exception):
        pass


def _npm_updates(result: dict):
    if not shutil.which("npm"):
        return
    try:
        proc = subprocess.run(
            ["npm", "outdated", "-g", "--json"],
            capture_output=True, text=True, timeout=30,
        )
        packages = json.loads(proc.stdout) if proc.stdout.strip() else {}
        result["npm_outdated"] = [
            {"name": k, "current": v.get("current"), "latest": v.get("latest")}
            for k, v in packages.items()
        ][:20]
    except (subprocess.TimeoutExpired, Exception):
        pass
