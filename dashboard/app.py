"""IT Support Agent — Web Dashboard (Flask backend)."""

import json
import threading
import time
from datetime import datetime
from flask import Flask, jsonify, render_template

import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from tools.system import run_system_check, check_hardware_health
from tools.security import check_security, get_running_processes, check_network
from tools.storage import get_storage_info
from tools.updates import check_software_updates
from tools.fixes import fix_issue

app = Flask(__name__)

# ── Cache: refresh data in background every 30 seconds ───────────────────────
_cache: dict = {}
_cache_lock = threading.Lock()
_last_refresh: dict = {}


def _refresh(key: str, fn, *args, **kwargs):
    try:
        result = fn(*args, **kwargs)
        with _cache_lock:
            _cache[key] = result
            _last_refresh[key] = datetime.now().strftime("%H:%M:%S")
    except Exception as exc:
        with _cache_lock:
            _cache[key] = {"error": str(exc)}


def _get(key: str, fn, *args, ttl: int = 30, **kwargs):
    """Return cached value, refreshing in background if stale."""
    with _cache_lock:
        cached = _cache.get(key)
        last = _last_refresh.get(key)

    stale = last is None or (
        (datetime.now() - datetime.strptime(last, "%H:%M:%S")).seconds > ttl
    )

    if cached is None:
        # First call — fetch synchronously
        _refresh(key, fn, *args, **kwargs)
        with _cache_lock:
            return _cache.get(key, {})

    if stale:
        threading.Thread(target=_refresh, args=(key, fn) + args, kwargs=kwargs, daemon=True).start()

    return cached


# ── Routes ────────────────────────────────────────────────────────────────────

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
def api_fix(fix_type: str):
    allowed = {"clear_temp", "clear_cache", "fix_permissions", "free_memory"}
    if fix_type not in allowed:
        return jsonify({"error": "Unknown fix type"}), 400
    result = fix_issue(fix_type)
    # Invalidate storage cache after cleanup
    with _cache_lock:
        _cache.pop("storage", None)
        _last_refresh.pop("storage", None)
    return jsonify(result)


@app.route("/api/all")
def api_all():
    """Return all dashboard data in one request."""
    system = _get("system", run_system_check, ttl=10)
    procs  = _get("processes", get_running_processes, sort_by="cpu", top_n=15, ttl=10)
    storage = _get("storage", get_storage_info, find_large_files=False, ttl=60)
    network = _get("network", check_network, ttl=15)
    return jsonify({
        "system": system,
        "processes": procs,
        "storage": storage,
        "network": network,
        "last_updated": datetime.now().strftime("%H:%M:%S"),
    })


if __name__ == "__main__":
    print("\n🖥️  IT Support Dashboard → http://localhost:5000\n")
    # Pre-warm cache
    threading.Thread(target=_refresh, args=("system", run_system_check), daemon=True).start()
    app.run(debug=False, host="0.0.0.0", port=5000)
