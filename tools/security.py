"""Security checks: process analysis, network inspection, malware indicators."""

import os
import platform
import subprocess
from pathlib import Path

try:
    import psutil
    HAS_PSUTIL = True
except ImportError:
    HAS_PSUTIL = False

# Known crypto-miner / RAT process names (educational reference only)
_SUSPICIOUS_NAMES = {
    "xmrig", "minerd", "cpuminer", "cgminer", "nbminer",
    "ethminer", "t-rex", "lolminer",
}

# Well-known backdoor/C2 ports worth flagging
_SUSPICIOUS_PORTS = {4444, 1234, 31337, 4445, 5554, 5555, 6666, 6667, 7777, 8888, 9999, 65535}


def get_running_processes(sort_by: str = "cpu", top_n: int = 20) -> dict:
    """Return a ranked list of running processes with CPU and memory usage."""
    if not HAS_PSUTIL:
        return {"error": "psutil not installed. Run: pip install psutil"}

    procs = []
    for p in psutil.process_iter(["pid", "name", "username", "cpu_percent",
                                   "memory_percent", "status", "cmdline"]):
        try:
            info = p.info
            procs.append({
                "pid": info["pid"],
                "name": info["name"] or "(no name)",
                "user": info["username"] or "",
                "cpu_percent": info["cpu_percent"] or 0.0,
                "mem_percent": round(info["memory_percent"] or 0.0, 2),
                "status": info["status"],
                "cmdline": " ".join((info["cmdline"] or [])[:6]) or info["name"],
            })
        except (psutil.NoSuchProcess, psutil.AccessDenied):
            pass

    sort_key = {"cpu": "cpu_percent", "memory": "mem_percent", "name": "name"}.get(sort_by, "cpu_percent")
    procs.sort(key=lambda x: x[sort_key], reverse=(sort_by != "name"))

    return {
        "total_processes": len(procs),
        "sorted_by": sort_by,
        "top_processes": procs[:top_n],
    }


def check_security() -> dict:
    """Run multi-layer security scan: processes, crons, ports, hosts file, recent /etc changes."""
    result = {
        "suspicious_processes": [],
        "cron_jobs": [],
        "open_ports": [],
        "host_file_anomalies": [],
        "recent_etc_changes": [],
        "warnings": [],
        "summary": "",
    }

    # ── 1. Suspicious process names ───────────────────────────────────────────
    if HAS_PSUTIL:
        for p in psutil.process_iter(["pid", "name", "username", "exe"]):
            try:
                name_lower = (p.info["name"] or "").lower()
                if name_lower in _SUSPICIOUS_NAMES:
                    result["suspicious_processes"].append({
                        "pid": p.info["pid"],
                        "name": p.info["name"],
                        "user": p.info["username"],
                        "exe": p.info["exe"],
                        "reason": "Matches known crypto-miner / malware process name",
                    })
                if not p.info["name"] or p.info["name"].strip() in ("", "."):
                    result["suspicious_processes"].append({
                        "pid": p.info["pid"],
                        "name": "(empty)",
                        "user": p.info["username"],
                        "reason": "Process has no visible name (possible hidden process)",
                    })
            except (psutil.NoSuchProcess, psutil.AccessDenied):
                pass

    # ── 2. Cron jobs ──────────────────────────────────────────────────────────
    if platform.system() in ("Linux", "Darwin"):
        cron_sources = ["/etc/crontab"]
        if platform.system() == "Linux":
            cron_sources.append("/etc/cron.d/")

        for src in cron_sources:
            _read_cron(src, result["cron_jobs"])

        try:
            proc = subprocess.run(["crontab", "-l"], capture_output=True, text=True, timeout=5)
            for line in proc.stdout.splitlines():
                line = line.strip()
                if line and not line.startswith("#"):
                    result["cron_jobs"].append({"source": "user crontab", "entry": line})
        except (FileNotFoundError, subprocess.TimeoutExpired):
            pass

    # ── 3. Open / listening ports ─────────────────────────────────────────────
    if HAS_PSUTIL:
        try:
            for conn in psutil.net_connections(kind="inet"):
                if conn.status == "LISTEN" and conn.laddr:
                    entry = {
                        "proto": "tcp",
                        "local": f"{conn.laddr.ip}:{conn.laddr.port}",
                        "pid": conn.pid,
                        "process": None,
                    }
                    if conn.pid:
                        try:
                            entry["process"] = psutil.Process(conn.pid).name()
                        except (psutil.NoSuchProcess, psutil.AccessDenied):
                            pass
                    result["open_ports"].append(entry)
        except psutil.AccessDenied:
            result["open_ports"].append({"note": "Access denied — try running as root"})

    # ── 4. /etc/hosts anomalies ────────────────────────────────────────────────
    hosts_path = "/etc/hosts" if platform.system() != "Windows" else r"C:\Windows\System32\drivers\etc\hosts"
    _check_hosts_file(hosts_path, result)

    # ── 5. Recently modified /etc files (Linux) ────────────────────────────────
    if platform.system() == "Linux":
        try:
            proc = subprocess.run(
                ["find", "/etc", "-maxdepth", "2", "-mtime", "-7", "-type", "f",
                 "-not", "-path", "*/.*"],
                capture_output=True, text=True, timeout=15,
            )
            result["recent_etc_changes"] = proc.stdout.strip().splitlines()[:20]
        except (subprocess.TimeoutExpired, PermissionError):
            pass

    # ── 6. SSH authorized_keys ────────────────────────────────────────────────
    auth_keys = Path.home() / ".ssh" / "authorized_keys"
    if auth_keys.exists():
        try:
            keys = [l.strip() for l in auth_keys.read_text().splitlines() if l.strip() and not l.startswith("#")]
            if keys:
                result["warnings"].append({
                    "type": "ssh_authorized_keys",
                    "severity": "info",
                    "detail": f"{len(keys)} key(s) in ~/.ssh/authorized_keys — verify they're all yours",
                    "keys_preview": [k[:80] + "..." for k in keys[:5]],
                })
        except PermissionError:
            pass

    # ── Summary ────────────────────────────────────────────────────────────────
    critical = len(result["suspicious_processes"]) + len(
        [w for w in result["warnings"] if w.get("severity") == "high"]
    )
    result["summary"] = (
        f"⚠️ {critical} security concern(s) require attention"
        if critical else
        "✅ No obvious security threats detected"
    )
    return result


def check_network() -> dict:
    """Inspect active connections, listening ports, DNS config, and flag suspicious endpoints."""
    if not HAS_PSUTIL:
        return {"error": "psutil not installed. Run: pip install psutil"}

    result = {
        "established_connections": [],
        "listening_ports": [],
        "suspicious_connections": [],
        "dns_servers": [],
        "summary": "",
    }

    try:
        for conn in psutil.net_connections(kind="inet"):
            entry = {
                "proto": "tcp" if conn.type == 1 else "udp",
                "local": f"{conn.laddr.ip}:{conn.laddr.port}" if conn.laddr else None,
                "remote": f"{conn.raddr.ip}:{conn.raddr.port}" if conn.raddr else None,
                "status": conn.status,
                "pid": conn.pid,
                "process": None,
            }
            if conn.pid:
                try:
                    entry["process"] = psutil.Process(conn.pid).name()
                except (psutil.NoSuchProcess, psutil.AccessDenied):
                    pass

            if conn.status == "LISTEN":
                result["listening_ports"].append(entry)
            elif conn.status == "ESTABLISHED" and conn.raddr:
                result["established_connections"].append(entry)
                if conn.raddr.port in _SUSPICIOUS_PORTS:
                    result["suspicious_connections"].append({
                        **entry,
                        "reason": f"Outbound connection to known backdoor port {conn.raddr.port}",
                    })
    except psutil.AccessDenied:
        result["error"] = "Access denied — try running as root for full details"

    # DNS servers
    resolv = Path("/etc/resolv.conf")
    if resolv.exists():
        try:
            for line in resolv.read_text().splitlines():
                if line.startswith("nameserver"):
                    parts = line.split()
                    if len(parts) >= 2:
                        result["dns_servers"].append(parts[1])
        except PermissionError:
            pass

    suspicious_count = len(result["suspicious_connections"])
    result["summary"] = (
        f"⚠️ {suspicious_count} suspicious connection(s) detected!"
        if suspicious_count else
        f"✅ No suspicious connections | "
        f"{len(result['established_connections'])} established, "
        f"{len(result['listening_ports'])} listening"
    )
    return result


# ── Helpers ────────────────────────────────────────────────────────────────────

def _read_cron(path: str, output: list):
    if os.path.isfile(path):
        try:
            with open(path) as f:
                for line in f:
                    line = line.strip()
                    if line and not line.startswith("#"):
                        output.append({"source": path, "entry": line})
        except (PermissionError, OSError):
            pass
    elif os.path.isdir(path):
        try:
            for fname in os.listdir(path):
                _read_cron(os.path.join(path, fname), output)
        except PermissionError:
            pass


def _check_hosts_file(hosts_path: str, result: dict):
    trusted_domains = [
        "google.com", "microsoft.com", "apple.com", "github.com",
        "paypal.com", "amazon.com", "facebook.com",
    ]
    try:
        with open(hosts_path) as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith("#"):
                    continue
                parts = line.split()
                if len(parts) >= 2:
                    ip, *domains = parts
                    for d in domains:
                        for td in trusted_domains:
                            if td in d and ip not in ("127.0.0.1", "::1", "0.0.0.0"):
                                result["host_file_anomalies"].append({
                                    "entry": line,
                                    "concern": f"{d} redirected to {ip}",
                                })
                                result["warnings"].append({
                                    "type": "hosts_hijack",
                                    "severity": "high",
                                    "detail": f"/etc/hosts redirects {d} → {ip}",
                                })
    except (FileNotFoundError, PermissionError):
        pass
