"""
demo_attack.py
--------------
CLI entry point for generating a demo incident from the terminal:

    python scripts/demo_attack.py

This is documented in README.md for people who want to see how it works
under the hood. The dashboard itself doesn't require this -- it has its
own "Run Demo Incident" button that calls the same underlying logic
through the API (see incident_sim.py).
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))
from incident_sim import run_simulated_incident  # noqa: E402

TARGET = Path(__file__).parent.parent / "demo_target"


def main():
    print(f"Running incident simulation against {TARGET} ...")
    run_simulated_incident(TARGET)
    print("Done. Open the dashboard and click 'Refresh Trail' to see the results.")


if __name__ == "__main__":
    main()
