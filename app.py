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
from pathlib import Path
from flask import Flask, jsonify, request, send_from_directory

import chain
import watcher
from incident_sim import run_simulated_incident

BASE_DIR = Path(__file__).parent
DEMO_TARGET = BASE_DIR / "demo_target"

app = Flask(__name__, static_folder="static", static_url_path="")


@app.route("/")
def index():
    return send_from_directory(app.static_folder, "index.html")


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
    body = request.get_json(silent=True) or {}
    new_detail = body.get("detail", "*** LOG EDITED BY ATTACKER ***")
    found = chain.tamper_event(event_id, new_detail)
    if not found:
        return jsonify({"ok": False, "error": f"No event with id {event_id}"}), 404
    return jsonify({"ok": True, "id": event_id, "new_detail": new_detail})


@app.route("/api/reset", methods=["POST"])
def api_reset():
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
def api_simulate_incident(): """Runs a short, realistic sequence of file operations against the sandboxed demo folder so the dashboard has something to show without requiring a terminal. Takes ~2-3 seconds; the watcher picks up each operation live as it happens.""" 
result = run_simulated_incident(DEMO_TARGET) 
return jsonify(result)

#Start the filesystem watcher when the Flask app is loaded.
#This is required for both local execution and Gunicorn/Render.
DEMO_TARGET.mkdir(exist_ok=True) 
watcher.start_watching(str(DEMO_TARGET))
if __name__ == "__main__": 
port = int(os.environ.get("PORT", 5050)) 
app.run(host="0.0.0.0", port=port, debug=False)

  
