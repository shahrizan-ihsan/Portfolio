"""Disk usage analysis and storage monitoring."""

import os
import platform
import subprocess
from pathlib import Path

try:
    import psutil
    HAS_PSUTIL = True
except ImportError:
    HAS_PSUTIL = False


def get_storage_info(scan_path: str = None, find_large_files: bool = True) -> dict:
    """Disk partition usage, largest files/folders, and temp file sizes."""
    result = {
        "partitions": [],
        "large_files": [],
        "large_directories": [],
        "temp_sizes": {},
        "summary": "",
    }

    home = str(Path.home())
    scan_path = scan_path or home

    # ── Partition overview ────────────────────────────────────────────────────
    if HAS_PSUTIL:
        for part in psutil.disk_partitions():
            if any(x in part.device for x in ("loop", "snap")):
                continue
            if part.fstype in ("squashfs", "tmpfs", "devtmpfs", "proc", "sysfs", ""):
                continue
            try:
                usage = psutil.disk_usage(part.mountpoint)
                result["partitions"].append({
                    "device": part.device,
                    "mountpoint": part.mountpoint,
                    "fstype": part.fstype,
                    "total_gb": round(usage.total / 1e9, 2),
                    "used_gb": round(usage.used / 1e9, 2),
                    "free_gb": round(usage.free / 1e9, 2),
                    "percent_used": usage.percent,
                    "status": (
                        "❌ Critical (>90%)" if usage.percent > 90 else
                        "⚠️ High (>80%)" if usage.percent > 80 else
                        "✅ OK"
                    ),
                })
            except (PermissionError, OSError):
                pass

    # ── Large files (>100 MB) — pure Python, cross-platform ──────────────────
    if find_large_files and os.path.isdir(scan_path):
        files = []
        skip_dirs = {".git", "__pycache__", "node_modules", "proc", "sys"}
        try:
            for root, dirs, filenames in os.walk(scan_path, followlinks=False):
                dirs[:] = [d for d in dirs if d not in skip_dirs]
                for fname in filenames:
                    fpath = os.path.join(root, fname)
                    try:
                        size = os.path.getsize(fpath)
                        if size > 100 * 1024 * 1024:
                            files.append({"path": fpath, "size_mb": round(size / 1e6, 1)})
                    except (OSError, PermissionError):
                        pass
                if len(files) > 50:
                    break
        except Exception:
            pass
        files.sort(key=lambda x: x["size_mb"], reverse=True)
        result["large_files"] = files[:20]

    # ── Top directories by size — pure Python ────────────────────────────────
    try:
        dirs_size = []
        for entry in os.scandir(scan_path):
            if entry.is_dir(follow_symlinks=False):
                total = 0
                try:
                    for r, _, fs in os.walk(entry.path, followlinks=False):
                        for f in fs:
                            try:
                                total += os.path.getsize(os.path.join(r, f))
                            except (OSError, PermissionError):
                                pass
                except (OSError, PermissionError):
                    pass
                dirs_size.append({"path": entry.path, "size": total, "size_str": _fmt(total)})
        dirs_size.sort(key=lambda x: x["size"], reverse=True)
        result["large_directories"] = [{"path": d["path"], "size": d["size_str"]} for d in dirs_size[:10]]
    except Exception:
        pass

    # ── Temp / cache sizes ────────────────────────────────────────────────────
    home = str(Path.home())
    candidates = {
        "downloads": str(Path.home() / "Downloads"),
        "user_cache": str(Path.home() / ".cache"),
    }
    if platform.system() == "Windows":
        candidates["appdata_temp"] = os.environ.get("TEMP", "")
        candidates["appdata_local"] = str(Path.home() / "AppData" / "Local" / "Temp")
    else:
        candidates["system_tmp"] = "/tmp"
        candidates["var_tmp"] = "/var/tmp"
    if platform.system() == "Darwin":
        candidates["macos_tmp"] = "/private/var/folders"

    for label, path in candidates.items():
        if path and os.path.isdir(path):
            total = 0
            try:
                for r, _, fs in os.walk(path, followlinks=False):
                    for f in fs:
                        try:
                            total += os.path.getsize(os.path.join(r, f))
                        except (OSError, PermissionError):
                            pass
            except Exception:
                pass
            result["temp_sizes"][label] = {"path": path, "size": _fmt(total)}

    # ── Summary ──────────────────────────────────────────────────────────────
    critical_disks = [p for p in result["partitions"] if p["percent_used"] > 90]
    total_free = sum(p["free_gb"] for p in result["partitions"])
    result["summary"] = (
        f"{'❌ ' + str(len(critical_disks)) + ' disk(s) critically full! ' if critical_disks else '✅ Storage OK — '}"
        f"Total free: {total_free:.1f} GB | "
        f"{len(result['large_files'])} file(s) over 100 MB found"
    )
    return result


def _fmt(size_bytes: float) -> str:
    for unit in ("B", "KB", "MB", "GB", "TB"):
        if size_bytes < 1024:
            return f"{size_bytes:.1f} {unit}"
        size_bytes /= 1024
    return f"{size_bytes:.1f} PB"
