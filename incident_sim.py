"""
incident_sim.py
---------------
Deterministic portfolio demo. The live watchdog remains a real sensor, but
the one-click demo deliberately records four curated findings instead of
turning every low-level create/modify/delete callback into a separate case.
"""

import time
import threading
from pathlib import Path

import chain

BASELINE_DELAY = 0.25
_DEMO_LOCK = threading.Lock()


def run_simulated_incident(target_dir: Path):
    """Create harmless sandbox activity, then append exactly four distinct
    investigation findings to the real hash chain.

    The watcher is paused only while the scripted filesystem burst runs;
    this prevents watchdog's create+modify callback pairs from becoming
    duplicate cases. Live monitoring resumes immediately afterwards.
    """
    with _DEMO_LOCK:
        target_dir = Path(target_dir)
        target_dir.mkdir(parents=True, exist_ok=True)

        if chain.has_demo_cases():
            return {
                "ok": True,
                "already_exists": True,
                "message": "The demo incident is already loaded. Reset demo data before running it again.",
            }

        chain.pause_demo_capture()
        try:
            # Harmless sandbox activity that a real filesystem watcher would see.
            (target_dir / "notes.txt").write_text("quarterly notes", encoding="utf-8")
            time.sleep(BASELINE_DELAY)

            (target_dir / ".cache_tmp").write_text("hidden staging data", encoding="utf-8")
            time.sleep(BASELINE_DELAY)

            (target_dir / "update_service.sh").write_text(
                "#!/bin/sh\necho simulated-payload", encoding="utf-8"
            )
            time.sleep(BASELINE_DELAY)

            for i in range(6):
                (target_dir / f"doc_{i}.txt").write_text(
                    f"simulated-content-{i}-{time.time()}",
                    encoding="utf-8",
                )
            time.sleep(BASELINE_DELAY)

            for i in range(5):
                f = target_dir / f"doc_{i}.txt"
                if f.exists():
                    f.unlink()
        finally:
            chain.resume_demo_capture()

        now_label = time.strftime("%H:%M", time.localtime())

        chain.append_manual_event(
            "CREATED",
            str(target_dir / ".cache_tmp"),
            "SIMULATED FOR DEMO: hidden staging file detected",
            "WARNING",
            "Hidden file created (possible staging/exfil prep)",
        )
        chain.append_manual_event(
            "CREATED",
            str(target_dir / "update_service.sh"),
            "SIMULATED FOR DEMO: suspicious script dropped",
            "CRITICAL",
            "Suspicious executable/script dropped (.sh)",
        )
        chain.append_manual_event(
            "MODIFIED",
            str(target_dir / "doc_0.txt"),
            "SIMULATED FOR DEMO: six files modified within a 10-second window",
            "CRITICAL",
            "Rapid mass modification detected (6 files in 10s) - ransomware-like pattern",
        )
        chain.append_manual_event(
            "DELETED",
            str(target_dir / "doc_0.txt"),
            "SIMULATED FOR DEMO: five files deleted within a 15-second window",
            "CRITICAL",
            "Mass deletion burst detected (5 deletes in 15s)",
        )

        return {
            "ok": True,
            "already_exists": False,
            "cases_created": 4,
            "time": now_label,
        }
