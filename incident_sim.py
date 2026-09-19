"""
incident_sim.py
----------------
The actual sequence of filesystem operations used to generate a realistic,
demoable Evidence Trail. Used by two entry points:
  1. scripts/demo_attack.py -- a CLI script for people reading the README
  2. app.py's /api/simulate-incident route -- an in-app "Run Demo Incident"
     button, so a visitor never has to open a terminal to see the product
     work.

Every action here is a harmless filesystem operation on a sandboxed demo
folder. There is no exploit code -- this only exercises the detectors in
chain.py.
"""

import time
from pathlib import Path

import chain

STEP_DELAY = 0.15          # seconds between rapid operations (well inside detector windows)
BASELINE_DELAY = 0.4


def run_simulated_incident(target_dir: Path):
    """Runs a short, realistic sequence of file operations against
    target_dir designed to trip every anomaly detector once. Returns a
    small summary dict."""
    target_dir = Path(target_dir)
    target_dir.mkdir(exist_ok=True)

    def touch(name, content="normal content"):
        (target_dir / name).write_text(content)

    # The demo already ends with one clearly-labeled synthetic off-hours
    # event (step 6 below). Suppress the real-time off-hours check for the
    # scripted steps in between so the demo reads the same regardless of
    # what time of day it's actually run -- see chain.py for why.
    chain.pause_offhours_detection()
    try:
        # 1. Baseline activity
        touch("notes.txt", "quarterly notes")
        time.sleep(BASELINE_DELAY)
        touch("report.docx.txt", "draft report")
        time.sleep(BASELINE_DELAY)

        # 2. Hidden file created (staging)
        touch(".cache_tmp", "hidden staging data")
        time.sleep(STEP_DELAY)

        # 3. Suspicious script dropped
        touch("update_service.sh", "#!/bin/sh\necho fake-payload")
        time.sleep(STEP_DELAY)

        # 4. Rapid mass modification (ransomware-like)
        for i in range(6):
            touch(f"doc_{i}.txt", f"contents-{i}-{time.time()}")
            time.sleep(STEP_DELAY)

        # 5. Mass deletion burst
        for i in range(5):
            f = target_dir / f"doc_{i}.txt"
            if f.exists():
                f.unlink()
            time.sleep(STEP_DELAY)
    finally:
        chain.resume_offhours_detection()

    # 6. Synthetic off-hours event (clearly labeled as simulated, still
    # goes through the real hash chain so it's just as verifiable)
    chain.append_manual_event(
        "MODIFIED",
        str(target_dir / "payroll_export.csv"),
        "SIMULATED FOR DEMO: file accessed outside business hours",
        "WARNING",
        "Off-hours activity (simulated: 03:00 local)"
    )

    return {"ok": True}
