# SentinelTrail

**Follow the evidence.**

SentinelTrail is an educational cybersecurity web application that turns raw filesystem activity into investigation case files — each one walking through a signal, the evidence behind it, an analyst's reasoning, its potential impact, a recommended response, and an outcome. It also keeps every recorded event in a tamper-evident hash chain, so you can simulate an attacker editing the evidence after the fact and watch the integrity check catch it.

> **This is a simulated learning environment**, built as a cybersecurity portfolio project. It is not a production SIEM, an enterprise SOC platform, or a digital forensics tool, and its evidence storage is not immutable in the way a production system would need. See [Known limitations](#known-limitations) below for exactly what that means and why.

## What SentinelTrail is

Most junior security portfolios show a table of logs. SentinelTrail instead asks: *if you found this file activity, how would you investigate it?* Every detected anomaly becomes a case file with a full investigation narrative, not just a row in a table — and the underlying evidence log is built so that tampering with it is detectable through integrity verification, which is a real, practical concern in incident response (attackers routinely try to edit logs to cover their tracks).

## The "Follow the evidence" concept

Every case in SentinelTrail follows the same six-stage path:

```
SIGNAL → EVIDENCE → ANALYSIS → IMPACT → RESPONSE → OUTCOME
```

- **Signal** — what was detected, and when
- **Evidence** — where it lives in the tamper-evident chain (block number, hash)
- **Analysis** — why an analyst would consider it suspicious
- **Impact** — what could happen if it's real
- **Response** — what to do about it
- **Outcome** — the case's current status, including whether its evidence has been verified intact

This path is the literal Evidence Trail shown on every case: a horizontal stepper on desktop and tablet, and a vertical investigation timeline on mobile — not the same layout simply shrunk down.

## Investigation flow

1. **Run Demo Incident** generates a short, realistic burst of filesystem activity in a sandboxed folder (`demo_target/`) — no real system access involved. A live filesystem watcher (`watchdog`) also monitors that folder in real time, so genuinely dragging a file in or out works exactly the same way.
2. Every event is scored against a small set of heuristics. Events that trip one become a **case file**; routine background activity stays in the evidence log without becoming a case, so the case list reflects signal, not noise.
3. Opening a case shows its full investigation: the Evidence Trail, what was observed, why it matters, the simulated indicator of compromise, analyst reasoning, recommended response, and lessons learned.
4. Each case's underlying record can be inspected (and, for demonstration, tampered with) under **Evidence Integrity**.
5. **Verify Evidence Trail** checks each record's own hash independently and also checks chain continuity. A tampered record is flagged as `TAMPERED`; later records can remain individually intact while the dashboard still reports a broken chain link.
6. **Reset demo data** clears everything, including the sandbox folder, for a clean re-run.

## Core features

- Real-time filesystem monitoring of a sandboxed folder
- Five behavioral detectors (see below), each mapped to an analyst-style investigation writeup
- A tamper-evident, hash-chained evidence log
- One-click integrity verification across the whole chain
- An in-app tamper simulation to demonstrate detection, no terminal required
- Fully responsive case-file / investigation-view layout: side-by-side on desktop, stacked on tablet, single-column vertical timeline on mobile
- Automatic light/dark appearance that follows the user's operating-system preference
- An in-app Demo Guide — the interface has no developer instructions embedded in it

## Security concepts demonstrated

- **Behavioral, rule-based anomaly detection** — using five explainable detectors:
  
1.Suspicious-extension drops

2.Hidden-file staging

3.Deletion bursts

4.Rapid modification bursts (a simple ransomware-pattern heuristic)

5.Off-hours activity

- **Hash chaining for tamper evidence** — each event's hash is derived from the previous event's hash (`SHA-256(prev_hash + timestamp + type + path + detail + severity + reason)`). This demonstrates a common integrity pattern used in systems such as blockchain data structures, version-control systems, and forensic evidence workflows. Editing a past record makes its own stored hash stop matching a fresh recomputation, which Verify Evidence Trail catches immediately.
- **Indicators of Compromise (IoC)** framing for detected anomalies, and a structured investigation writeup (analysis / impact / response / lessons learned) per detector, modeled loosely on how a junior analyst would document a finding.

## Technical stack

- **Backend:** Python 3, Flask (REST API + static file serving)
- **Filesystem monitoring:** `watchdog`
- **Storage:** SQLite (evidence chain), plain files (sandboxed demo folder)
- **Hashing:** SHA-256 via the Python standard library
- **Frontend:** vanilla HTML/CSS/JavaScript — no framework, no build step
- **Content:** a small static "analyst knowledge base" (`investigation_kb.js`) mapping each detector to its investigation writeup

## Project structure

```
sentineltrail/
├── app.py                    # Flask app: API + serves the dashboard, starts the watcher
├── chain.py                  # Hash-chain storage + the 5 anomaly detectors
├── watcher.py                 # Real-time filesystem watcher (watchdog)
├── incident_sim.py            # Shared demo-incident logic (used by the API and the CLI script)
├── requirements.txt
├── tests/
│   └── test_chain.py         # integrity regression tests
├── LICENSE                   # MIT license
├── .gitignore                # local/runtime files excluded from Git
├── scripts/
│   └── demo_attack.py        # CLI entry point for the same demo incident, for the README/terminal
└── static/
    ├── index.html
    ├── style.css
    ├── script.js              # Case rendering, investigation view, verification, tamper flow
    └── investigation_kb.js    # Static analyst knowledge base
```

Running the app creates two things at runtime (not checked into the repo):
- `demo_target/` — the sandboxed folder that gets monitored; the app does not watch arbitrary system paths
- `data/trail.db` — the SQLite evidence chain

## Installation

Requires Python 3.9+.

```bash
git clone <your-repo-url>
cd sentineltrail
pip install -r requirements.txt
```

## Running the application

```bash
python app.py
```

Then open **http://localhost:5050**.

## Demo flow

Everything below can be done entirely from the browser — no terminal needed after startup (there's also an in-app **Demo guide** button with the same steps):

1. Click **Run Demo Incident**. Within a few seconds, exactly four distinct case files appear on the left: hidden-file staging, a suspicious script drop, rapid mass modification, and a mass-deletion burst. The demo is deterministic and the button is idempotent, so repeated clicks do not create duplicate cases.
2. Click a case to open its investigation on the right and read through the Evidence Trail and the full writeup.
3. Open **Evidence Integrity** at the bottom of a case, note its block number and hash.
4. Type something in the tamper box and click **Overwrite & save** — this edits the stored record directly, without recomputing its hash, exactly like an attacker editing a log after the fact.
5. Click **Verify Evidence Trail**. The case's status flips to *Integrity alert*, its Outcome stage turns into a violation state, and the top bar reports exactly which case failed.
6. Click **Reset demo data** to start over.

If you'd rather trigger the same scenario from a terminal (e.g. to watch the underlying filesystem events happen), run:

```bash
python scripts/demo_attack.py
```

## Integrity verification

`GET /api/verify` performs two checks for every event: (1) record integrity — whether the stored hash still matches the record's own fields, and (2) chain continuity — whether its `prev_hash` still points to the actual stored hash of the preceding event. A record is marked `TAMPERED` only when its own integrity check fails. The overall chain can still be invalid because an earlier record or link was altered, without falsely labeling untouched downstream records as tampered. The UI re-checks automatically after a demo run or reset, and provides an explicit **Verify Evidence Trail** action after a tamper simulation.

## Tamper simulation

`POST /api/tamper/<id>` writes a new `detail` value directly into a record **without** touching its hash — deliberately reproducing what an attacker with write access to a log file or database would do. Nothing here modifies the verification logic; it only demonstrates that the *existing* verification catches it. Attempting to tamper with a non-existent record correctly returns `404`.

## Known limitations

This is a portfolio-scale demo, and a few things are intentionally simplified:

- **The hash chain is self-contained.** The verifier distinguishes record integrity from chain continuity. An attacker with full read/write access to the SQLite database could still recompute and replace the entire chain, making it internally self-consistent again. Production systems address this with an external append-only anchor or remote log destination. That remains a deliberate portfolio-scale limitation.
- **The detectors are simple, fixed heuristics** (extension checks, rate thresholds, time-of-day windows), not statistical or learned models. That's a deliberate scope choice, not an oversight — it keeps the reasoning fully explainable, which is the point of a portfolio project like this.
- **Single-process, single-user demo.** There is no authentication or multi-user case ownership. The state-changing demo endpoints require a custom same-origin request header to reduce simple CSRF, but this is not an authentication boundary; the application is intentionally a public portfolio demo.
- **Render storage is ephemeral on the free tier.** SQLite data and the sandbox folder can be reset when the service is restarted/redeployed. The application therefore treats the four-case demo as reproducible portfolio data rather than production persistence.
- **Cases are derived directly from severity**, not from a separate incident-management workflow — there's no case reassignment, closing, or multi-case correlation.

## Future improvements

- External append-only anchor log for the hash chain (see above)
- Case correlation (grouping multiple related events into a single incident)
- Configurable detector thresholds
- A persisted case status workflow (open → investigating → closed) instead of deriving status purely from the latest verification pass

## Testing

The repository includes a small standard-library test suite covering clean-chain verification, record-specific tamper detection, and restoration. Run:

```bash
python -m unittest discover -s tests -v
```

The final portfolio build was also checked with Python bytecode compilation and JavaScript syntax validation.

## Deployment

The repository includes `render.yaml` for a small Render deployment:

```bash
gunicorn --workers 1 --threads 4 --timeout 30 app:app
```

The watcher is started lazily on the first request so it also works when Flask is served by Gunicorn. A single worker is intentional: the evidence chain is a local SQLite sequence and the demo sensor should not be duplicated across worker processes.

A health endpoint is available at `/api/health`.

## License

MIT — do whatever you like with it.
