"""System health, hardware health, and log inspection tools."""

import os
import platform
import datetime
import subprocess
from pathlib import Path

try:
    import psutil
    HAS_PSUTIL = True
except ImportError:
    HAS_PSUTIL = False


def run_system_check() -> dict:
    """Comprehensive snapshot of CPU, RAM, disk, battery, and uptime."""
    result = {
        "os": platform.system(),
        "os_release": platform.release(),
        "os_version": platform.version()[:120],
        "hostname": platform.node(),
        "machine": platform.machine(),
        "python_version": platform.python_version(),
    }

    if not HAS_PSUTIL:
        result["error"] = "psutil not installed. Run: pip install psutil"
        return result

    # CPU
    cpu_pct = psutil.cpu_percent(interval=0.2, percpu=True)
    result["cpu_count_logical"] = psutil.cpu_count()
    result["cpu_count_physical"] = psutil.cpu_count(logical=False)
    result["cpu_usage_per_core"] = cpu_pct
    result["cpu_usage_avg"] = round(sum(cpu_pct) / len(cpu_pct), 1)
    freq = psutil.cpu_freq()
    result["cpu_freq_mhz"] = {"current": round(freq.current), "max": round(freq.max)} if freq else None

    # RAM
    ram = psutil.virtual_memory()
    result["ram_total_gb"] = round(ram.total / 1e9, 2)
    result["ram_used_gb"] = round(ram.used / 1e9, 2)
    result["ram_available_gb"] = round(ram.available / 1e9, 2)
    result["ram_percent"] = ram.percent

    # Swap
    swap = psutil.swap_memory()
    result["swap_total_gb"] = round(swap.total / 1e9, 2)
    result["swap_used_gb"] = round(swap.used / 1e9, 2)
    result["swap_percent"] = swap.percent

    # Disks
    disks = []
    for part in psutil.disk_partitions():
        if any(x in part.device for x in ["loop", "snap"]):
            continue
        if part.fstype in ("squashfs", "tmpfs", "devtmpfs", "proc", "sysfs", ""):
            continue
        try:
            usage = psutil.disk_usage(part.mountpoint)
            disks.append({
                "device": part.device,
                "mountpoint": part.mountpoint,
                "fstype": part.fstype,
                "total_gb": round(usage.total / 1e9, 2),
                "used_gb": round(usage.used / 1e9, 2),
                "free_gb": round(usage.free / 1e9, 2),
                "percent": usage.percent,
            })
        except (PermissionError, OSError):
            pass
    result["disks"] = disks

    # Battery
    result["battery"] = None
    if hasattr(psutil, "sensors_battery"):
        batt = psutil.sensors_battery()
        if batt:
            secs = batt.secsleft
            if secs == psutil.POWER_TIME_UNLIMITED or batt.power_plugged:
                time_left = "Charging"
            elif secs > 0:
                time_left = str(datetime.timedelta(seconds=secs))
            else:
                time_left = "Unknown"
            result["battery"] = {
                "percent": round(batt.percent, 1),
                "plugged_in": batt.power_plugged,
                "time_remaining": time_left,
            }

    # Uptime
    boot_dt = datetime.datetime.fromtimestamp(psutil.boot_time())
    result["boot_time"] = boot_dt.strftime("%Y-%m-%d %H:%M:%S")
    result["uptime"] = str(datetime.datetime.now() - boot_dt).split(".")[0]

    # Alerts
    alerts = []
    if result["cpu_usage_avg"] > 90:
        alerts.append(f"❌ CPU usage critical: {result['cpu_usage_avg']}%")
    elif result["cpu_usage_avg"] > 75:
        alerts.append(f"⚠️ CPU usage high: {result['cpu_usage_avg']}%")
    if result["ram_percent"] > 90:
        alerts.append(f"❌ RAM usage critical: {result['ram_percent']}%")
    elif result["ram_percent"] > 80:
        alerts.append(f"⚠️ RAM usage high: {result['ram_percent']}%")
    for d in disks:
        if d["percent"] > 90:
            alerts.append(f"❌ Disk {d['mountpoint']} nearly full: {d['percent']}%")
        elif d["percent"] > 80:
            alerts.append(f"⚠️ Disk {d['mountpoint']} usage high: {d['percent']}%")
    if result["battery"] and not result["battery"]["plugged_in"] and result["battery"]["percent"] < 20:
        alerts.append(f"⚠️ Battery low: {result['battery']['percent']}%")

    result["alerts"] = alerts
    result["status"] = "⚠️ Issues detected" if alerts else "✅ System healthy"
    return result


def check_hardware_health() -> dict:
    """Check CPU/GPU temperatures, fan speeds, and disk SMART status."""
    result = {}

    if HAS_PSUTIL:
        if hasattr(psutil, "sensors_temperatures"):
            temps = psutil.sensors_temperatures()
            if temps:
                result["temperatures"] = {
                    chip: [
                        {
                            "label": e.label or f"sensor_{i}",
                            "current_c": e.current,
                            "high_c": e.high,
                            "critical_c": e.critical,
                            "status": (
                                "❌ Critical" if e.critical and e.current >= e.critical else
                                "⚠️ High" if e.high and e.current >= e.high else
                                "✅ OK"
                            ),
                        }
                        for i, e in enumerate(entries)
                    ]
                    for chip, entries in temps.items()
                }

        if hasattr(psutil, "sensors_fans"):
            fans = psutil.sensors_fans()
            if fans:
                result["fans"] = {
                    chip: [{"label": e.label, "rpm": e.current} for e in entries]
                    for chip, entries in fans.items()
                }

    # Disk SMART (requires smartmontools)
    smart = []
    if HAS_PSUTIL:
        checked = set()
        for part in psutil.disk_partitions():
            dev = part.device
            # Normalise to base device (e.g. /dev/sda1 → /dev/sda)
            base = dev.rstrip("0123456789") if not dev.endswith(("sda", "sdb", "nvme0n1")) else dev
            if base in checked or "loop" in base:
                continue
            checked.add(base)
            try:
                proc = subprocess.run(
                    ["smartctl", "-H", base],
                    capture_output=True, text=True, timeout=10
                )
                out = proc.stdout
                status = "PASSED" if "PASSED" in out else ("FAILED" if "FAILED" in out else "Unknown")
                smart.append({"device": base, "smart_status": status})
            except (FileNotFoundError, subprocess.TimeoutExpired, PermissionError):
                smart.append({"device": base, "smart_status": "smartctl unavailable"})
            if len(checked) >= 3:
                break
    result["disk_smart"] = smart

    # dmesg hardware errors (Linux only)
    if platform.system() == "Linux":
        try:
            proc = subprocess.run(
                ["dmesg", "-T", "--level=err,crit"],
                capture_output=True, text=True, timeout=10
            )
            hw_keywords = ("error", "fail", "i/o", "ata", "nvme", "sata", "disk", "bad sector")
            errors = [
                l for l in proc.stdout.splitlines()
                if any(k in l.lower() for k in hw_keywords)
            ][-15:]
            result["dmesg_hw_errors"] = errors
        except (FileNotFoundError, PermissionError, subprocess.TimeoutExpired):
            result["dmesg_hw_errors"] = []
    elif platform.system() == "Windows":
        result["dmesg_hw_errors"] = []

    return result


def get_system_logs(log_type: str = "system", lines: int = 100, filter_keyword: str = None) -> dict:
    """Read recent system logs filtered by type and optional keyword."""
    result = {"log_type": log_type, "source": None, "entries": []}

    if platform.system() == "Linux":
        # Try journalctl
        try:
            cmd = ["journalctl", "-n", str(lines), "--no-pager", "--output=short-iso"]
            if log_type == "kernel":
                cmd += ["-k"]
            elif log_type == "auth":
                cmd += ["-u", "sshd", "-u", "sudo", "-u", "login", "-u", "systemd-logind"]
            elif log_type in ("application", "crash"):
                cmd += ["-p", "err..emerg"]
            else:
                cmd += ["-p", "warning..emerg"]

            if filter_keyword:
                cmd += ["--grep", filter_keyword]

            proc = subprocess.run(cmd, capture_output=True, text=True, timeout=20)
            result["entries"] = proc.stdout.strip().splitlines()
            result["source"] = "journalctl"
            return result
        except (FileNotFoundError, subprocess.TimeoutExpired):
            pass

        # Fallback to log files
        log_map = {
            "system": "/var/log/syslog",
            "kernel": "/var/log/kern.log",
            "auth": "/var/log/auth.log",
        }
        log_file = log_map.get(log_type, "/var/log/syslog")
        try:
            with open(log_file) as f:
                all_lines = f.readlines()
            entries = all_lines[-lines:]
            if filter_keyword:
                entries = [e for e in entries if filter_keyword.lower() in e.lower()]
            result["entries"] = [e.rstrip() for e in entries]
            result["source"] = log_file
        except (FileNotFoundError, PermissionError) as e:
            result["error"] = str(e)

    elif platform.system() == "Darwin":
        try:
            pred_map = {
                "kernel": 'subsystem == "com.apple.kernel"',
                "auth": 'subsystem == "com.apple.security.authorization"',
                "crash": 'messageType == fault OR messageType == error',
            }
            pred = pred_map.get(log_type, "messageType >= 2")
            cmd = ["log", "show", "--last", "1h", "--predicate", pred, "--style", "syslog"]
            if filter_keyword:
                cmd += ["--predicate", f'eventMessage CONTAINS "{filter_keyword}"']
            proc = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
            result["entries"] = proc.stdout.strip().splitlines()[-lines:]
            result["source"] = "macOS unified log"
        except Exception as e:
            result["error"] = str(e)

    elif platform.system() == "Windows":
        try:
            level_map = {
                "system": "System", "kernel": "System",
                "application": "Application", "crash": "Application",
                "auth": "Security"
            }
            log_name = level_map.get(log_type, "System")
            ps_cmd = (
                f"Get-EventLog -LogName {log_name} -Newest {lines} "
                f"| Select-Object TimeGenerated,EntryType,Source,Message "
                f"| Format-List"
            )
            if filter_keyword:
                ps_cmd = (
                    f"Get-EventLog -LogName {log_name} -Newest {lines} "
                    f"-Message '*{filter_keyword}*' "
                    f"| Select-Object TimeGenerated,EntryType,Source,Message "
                    f"| Format-List"
                )
            proc = subprocess.run(
                ["powershell", "-Command", ps_cmd],
                capture_output=True, text=True, timeout=20
            )
            result["entries"] = proc.stdout.strip().splitlines()[-lines:]
            result["source"] = f"Windows Event Log ({log_name})"
        except (FileNotFoundError, subprocess.TimeoutExpired) as e:
            result["error"] = str(e)

    return result
