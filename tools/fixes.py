"""Automated fixes for common laptop issues."""

import os
import platform
import shutil
import subprocess
from pathlib import Path


def fix_issue(fix_type: str) -> dict:
    """Apply an automated fix. Supported: clear_temp, clear_cache, fix_permissions, free_memory."""
    dispatch = {
        "clear_temp": _clear_temp,
        "clear_cache": _clear_cache,
        "fix_permissions": _fix_permissions,
        "free_memory": _free_memory,
    }
    if fix_type not in dispatch:
        return {
            "success": False,
            "error": f"Unknown fix type '{fix_type}'. Choose from: {list(dispatch)}",
        }
    return dispatch[fix_type]()


def _clear_temp() -> dict:
    cleared, errors = [], []
    freed_bytes = 0

    temp_dirs = ["/tmp", "/var/tmp"]
    if platform.system() == "Darwin":
        temp_dirs += ["/private/tmp", "/private/var/tmp"]

    for d in temp_dirs:
        if os.path.isdir(d):
            try:
                before = _dir_size(d)
                proc = subprocess.run(
                    f"find {d} -maxdepth 1 -not -name '.' -mtime +1 -exec rm -rf {{}} \\;",
                    shell=True, capture_output=True, timeout=30,
                )
                after = _dir_size(d)
                freed_bytes += max(before - after, 0)
                cleared.append(d)
            except Exception as exc:
                errors.append(f"{d}: {exc}")

    # Trash
    trash = Path.home() / ".local" / "share" / "Trash"
    if trash.exists():
        try:
            freed_bytes += _dir_size(str(trash))
            shutil.rmtree(str(trash / "files"), ignore_errors=True)
            shutil.rmtree(str(trash / "info"), ignore_errors=True)
            (trash / "files").mkdir(parents=True, exist_ok=True)
            (trash / "info").mkdir(parents=True, exist_ok=True)
            cleared.append("~/.local/share/Trash")
        except Exception as exc:
            errors.append(f"Trash: {exc}")

    return {
        "success": bool(cleared),
        "cleared_paths": cleared,
        "freed_mb": round(freed_bytes / 1e6, 1),
        "errors": errors,
    }


def _clear_cache() -> dict:
    cleared, freed_bytes = [], 0
    cache_root = Path.home() / ".cache"

    browser_paths = [
        cache_root / "google-chrome" / "Default" / "Cache",
        cache_root / "google-chrome" / "Default" / "Code Cache",
        cache_root / "chromium" / "Default" / "Cache",
        cache_root / "BraveSoftware",
        cache_root / "mozilla" / "firefox",
        cache_root / "thumbnails",
    ]

    for p in browser_paths:
        if p.exists():
            try:
                freed_bytes += _dir_size(str(p))
                shutil.rmtree(str(p), ignore_errors=True)
                cleared.append(str(p))
            except Exception:
                pass

    # macOS Safari cache
    if platform.system() == "Darwin":
        safari_cache = Path.home() / "Library" / "Caches" / "com.apple.Safari"
        if safari_cache.exists():
            try:
                freed_bytes += _dir_size(str(safari_cache))
                shutil.rmtree(str(safari_cache), ignore_errors=True)
                cleared.append(str(safari_cache))
            except Exception:
                pass

    return {
        "success": True,
        "cleared_paths": cleared,
        "freed_mb": round(freed_bytes / 1e6, 1),
        "note": "Browser caches and thumbnails cleared. Restart browsers if open.",
    }


def _fix_permissions() -> dict:
    fixed, errors = [], []
    home = Path.home()

    # SSH keys
    ssh = home / ".ssh"
    if ssh.exists():
        try:
            os.chmod(str(ssh), 0o700)
            fixed.append(".ssh/ → 700")
            for f in ssh.iterdir():
                if f.suffix == ".pub":
                    os.chmod(str(f), 0o644)
                    fixed.append(f"{f.name} → 644")
                elif f.name in ("id_rsa", "id_ed25519", "id_ecdsa", "config", "known_hosts"):
                    os.chmod(str(f), 0o600)
                    fixed.append(f"{f.name} → 600")
        except Exception as exc:
            errors.append(f".ssh: {exc}")

    # Shell rc files
    for rc in (".bashrc", ".zshrc", ".profile", ".bash_profile", ".bash_logout"):
        rc_path = home / rc
        if rc_path.exists():
            try:
                os.chmod(str(rc_path), 0o644)
                fixed.append(f"{rc} → 644")
            except Exception as exc:
                errors.append(f"{rc}: {exc}")

    return {"success": True, "fixed": fixed, "errors": errors}


def _free_memory() -> dict:
    result = {"success": False, "actions": [], "note": ""}

    if platform.system() != "Linux":
        result["note"] = "Memory cache dropping is only supported on Linux."
        return result

    try:
        subprocess.run(["sync"], timeout=5)
        result["actions"].append("Filesystem buffers synced")
    except Exception:
        pass

    try:
        proc = subprocess.run(
            ["sudo", "-n", "sh", "-c", "echo 3 > /proc/sys/vm/drop_caches"],
            capture_output=True, text=True, timeout=10,
        )
        if proc.returncode == 0:
            result["actions"].append("Kernel page/slab caches dropped")
            result["success"] = True
        else:
            result["note"] = (
                "Requires root. Run manually: "
                "sudo sh -c 'echo 3 > /proc/sys/vm/drop_caches'"
            )
    except Exception as exc:
        result["note"] = str(exc)

    return result


def _dir_size(path: str) -> float:
    total = 0.0
    try:
        for root, _, files in os.walk(path, followlinks=False):
            for name in files:
                try:
                    total += os.path.getsize(os.path.join(root, name))
                except (OSError, PermissionError):
                    pass
    except Exception:
        pass
    return total
