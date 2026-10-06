"""
app.py
------
SentinelTrail web dashboard.

Serves:
  GET  /                  -> dashboard (static/index.html)
  GET  /api/events        -> full evidence chain (JSON)
  GET  /api/verify        -> recomputes + verifies the hash chain
  GET  /api/stats         -> counts by severity
  POST /api/tamper/<id>   -> DEMO: mutate an event's detail without
                              rehashing, to demonstrate tamper detection
  POST /api/reset         -> DEMO: wipe the chain and start fresh

On startup, also launches the live filesystem watcher against demo_target/.
"""

import os
import time
import threading
from pathlib import Path
from flask import Flask, jsonify, request, send_from_directory

import chain
import watcher
from incident_sim import run_simulated_incident

BASE_DIR = Path(__file__).parent
DEMO_TARGET = BASE_DIR / "demo_target"

app = Flask(__name__, static_folder="static", static_url_path="")

_services_started = False
_services_lock = threading.Lock()


def _ensure_services_started():
    global _services_started
    if _services_started:
        return
    with _services_lock:
        if _services_started:
            return
        DEMO_TARGET.mkdir(parents=True, exist_ok=True)
        # Never inherit a stale demo-capture pause after a process restart.
        chain.resume_demo_capture()
        watcher.start_watching(str(DEMO_TARGET))
        _services_started = True


@app.before_request
def ensure_services():
    _ensure_services_started()


@app.after_request
def add_security_headers(response):
    response.headers.setdefault("X-Content-Type-Options", "nosniff")
    response.headers.setdefault("X-Frame-Options", "SAMEORIGIN")
    response.headers.setdefault("Referrer-Policy", "strict-origin-when-cross-origin")
    response.headers.setdefault(
        "Permissions-Policy",
        "camera=(), microphone=(), geolocation=()",
    )
    return response


def _demo_action_allowed():
    # The dashboard is intentionally public, so this is not authentication.
    # It prevents the state-changing demo endpoints from being triggered by
    # a simple cross-site POST (CSRF) from another page.
    return request.headers.get("X-SentinelTrail-Demo") == "1"


@app.route("/")
def index():
    return send_from_directory(app.static_folder, "index.html")


@app.route("/api/health")
def api_health():
    return jsonify({"ok": True, "service": "sentineltrail"})


@app.route("/api/events")
def api_events():
    return jsonify(chain.get_all_events())


@app.route("/api/verify")
def api_verify():
    return jsonify(chain.verify_chain())


@app.route("/api/stats")
def api_stats():
    return jsonify(chain.get_stats())


@app.route("/api/tamper/<int:event_id>", methods=["POST"])
def api_tamper(event_id):
    if not _demo_action_allowed():
        return jsonify({"ok": False, "error": "Demo action header required"}), 403
    body = request.get_json(silent=True) or {}
    new_detail = body.get("detail", "*** LOG EDITED BY ATTACKER ***")
    if not isinstance(new_detail, str):
        return jsonify({"ok": False, "error": "detail must be a string"}), 400
    new_detail = new_detail.strip()[:500]
    found = chain.tamper_event(event_id, new_detail)
    if not found:
        return jsonify({"ok": False, "error": f"No event with id {event_id}"}), 404
    return jsonify({"ok": True, "id": event_id, "new_detail": new_detail})


@app.route("/api/restore/<int:event_id>", methods=["POST"])
def api_restore(event_id):
    if not _demo_action_allowed():
        return jsonify({"ok": False, "error": "Demo action header required"}), 403
    restored = chain.restore_event(event_id)
    if not restored:
        return jsonify({"ok": False, "error": f"No stored original for event {event_id}"}), 404
    return jsonify({"ok": True, "id": event_id})


@app.route("/api/reset", methods=["POST"])
def api_reset():
    if not _demo_action_allowed():
        return jsonify({"ok": False, "error": "Demo action header required"}), 403
    chain.resume_demo_capture()
    # Clear the sandbox folder FIRST (so a re-run of the demo incident
    # produces a clean, deterministic sequence of CREATED events rather
    # than MODIFIED events on files left over from a previous run), then
    # wipe the chain -- this order ensures the cleanup's own DELETE
    # events get wiped too, rather than reappearing in a freshly reset
    # "empty" chain.
    for item in DEMO_TARGET.glob("*"):
        if item.is_file():
            item.unlink()
    time.sleep(0.3)  # let the watcher thread catch up before wiping
    chain.reset_chain()
    return jsonify({"ok": True})


@app.route("/api/simulate-incident", methods=["POST"])
def api_simulate_incident():
    """Generate the deterministic four-case portfolio demo."""
    if not _demo_action_allowed():
        return jsonify({"ok": False, "error": "Demo action header required"}), 403
    result = run_simulated_incident(DEMO_TARGET)
    return jsonify(result)


if __name__ == "__main__":
    _ensure_services_started()
    port = int(os.environ.get("PORT", 5050))
    app.run(host="0.0.0.0", port=port, debug=False)
