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

    # ── Large files (>100 MB) ─────────────────────────────────────────────────
    if find_large_files and os.path.isdir(scan_path):
        try:
            proc = subprocess.run(
                [
                    "find", scan_path, "-type", "f", "-size", "+100M",
                    "-not", "-path", "*/proc/*",
                    "-not", "-path", "*/sys/*",
                    "-not", "-path", "*/.git/objects/*",
                ],
                capture_output=True, text=True, timeout=45,
            )
            files = []
            for fpath in proc.stdout.strip().splitlines():
                fpath = fpath.strip()
                if not fpath:
                    continue
                try:
                    size = os.path.getsize(fpath)
                    files.append({"path": fpath, "size_mb": round(size / 1e6, 1)})
                except OSError:
                    pass
            files.sort(key=lambda x: x["size_mb"], reverse=True)
            result["large_files"] = files[:20]
        except subprocess.TimeoutExpired:
            result["large_files"] = [{"note": "Search timed out — try a smaller scan_path"}]

    # ── Top directories by size ───────────────────────────────────────────────
    try:
        proc = subprocess.run(
            f"du -sh -- {scan_path}/*/  2>/dev/null | sort -rh | head -15",
            shell=True, capture_output=True, text=True, timeout=30,
        )
        dirs = []
        for line in proc.stdout.strip().splitlines():
            parts = line.split("\t", 1)
            if len(parts) == 2:
                dirs.append({"size": parts[0], "path": parts[1]})
        result["large_directories"] = dirs
    except subprocess.TimeoutExpired:
        pass

    # ── Temp / cache sizes ────────────────────────────────────────────────────
    candidates = {
        "/tmp": "system_tmp",
        "/var/tmp": "var_tmp",
        str(Path.home() / ".cache"): "user_cache",
        str(Path.home() / "Downloads"): "downloads",
    }
    if platform.system() == "Darwin":
        candidates["/private/var/folders"] = "macos_tmp"

    for path, label in candidates.items():
        if os.path.isdir(path):
            try:
                proc = subprocess.run(
                    ["du", "-sh", path], capture_output=True, text=True, timeout=15
                )
                size = proc.stdout.split("\t")[0].strip() if proc.stdout else "?"
                result["temp_sizes"][label] = {"path": path, "size": size}
            except subprocess.TimeoutExpired:
                result["temp_sizes"][label] = {"path": path, "size": "timeout"}

    # ── Summary ──────────────────────────────────────────────────────────────
    critical_disks = [p for p in result["partitions"] if p["percent_used"] > 90]
    total_free = sum(p["free_gb"] for p in result["partitions"])
    result["summary"] = (
        f"{'❌ ' + str(len(critical_disks)) + ' disk(s) critically full! ' if critical_disks else '✅ Storage OK — '}"
        f"Total free: {total_free:.1f} GB | "
        f"{len(result['large_files'])} file(s) over 100 MB found"
    )
    return result
