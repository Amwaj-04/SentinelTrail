SentinelTrail
Follow the evidence.


SentinelTrail is an educational cybersecurity web application that turns raw filesystem activity into structured incident-investigation case files.
Instead of stopping at “a suspicious event was detected,” SentinelTrail guides the investigation through:
SIGNAL → EVIDENCE → ANALYSIS → IMPACT → RESPONSE → OUTCOME

Each case connects the observed filesystem activity to the evidence behind it, an analyst-style interpretation, potential impact, recommended response, and the final evidence-integrity state.

The project also maintains a tamper-evident, hash-chained evidence trail. A recorded event can be deliberately modified to simulate post-event evidence tampering, after which the verification process detects the resulting hash mismatch.

SentinelTrail is a simulated learning environment and cybersecurity portfolio project. It is not a production SIEM, enterprise SOC platform, or digital forensics tool.
Its evidence storage is intentionally not immutable in the way a production system would require. See Known limitations for the exact scope and trade-offs.


What SentinelTrail is

Most junior security portfolios show a table of logs.

SentinelTrail instead asks:
If you found this file activity, how would you investigate it?

The project focuses on the investigation process rather than simply displaying events.

When filesystem activity matches one of the project's rule-based detectors, SentinelTrail creates a case file with a structured investigation narrative.
Routine filesystem activity remains in the evidence log without becoming a case, keeping the case list focused on detected signals.

The central principle is simple:
Follow the evidence.


The “Follow the evidence” concept

Every case follows the same six-stage investigation path:
SIGNAL → EVIDENCE → ANALYSIS → IMPACT → RESPONSE → OUTCOME

- Signal — what was detected and when
- Evidence — where the event sits in the evidence chain, including its block number and hash
- Analysis — why the activity may warrant investigation
- Impact — what could happen if the activity represents a real security incident
- Response — what an analyst should consider doing next
- Outcome — the case's current status, including whether its evidence has been verified

The investigation path is represented directly in the interface:
Horizontal stepper on desktop and tablet
Vertical investigation timeline on mobile

This keeps the technical event connected to the reasoning that follows it.

Investigation flow

SentinelTrail monitors a sandboxed directory:
demo_target/
The application includes a live filesystem watcher powered by watchdog.

When filesystem activity occurs, SentinelTrail evaluates the resulting events against a small set of transparent, rule-based heuristics.
Events that match a detector become investigation cases.
Routine activity can remain in the evidence log without creating a case.

Run Demo Incident

The Run Demo Incident action generates a short, simulated burst of filesystem activity inside the sandbox.
No real system files are targeted by the demo.
The generated activity is designed to exercise the project's detection and investigation flow so the entire scenario can be demonstrated from the browser.

Live filesystem monitoring

The watcher also monitors the sandbox in real time.
This means that manually adding or removing files from demo_target/ can produce the same underlying filesystem events that the application processes during the simulated incident.

Case investigation

Opening a case provides its investigation details, including:
- Evidence Trail
- What was observed
- Why it matters
- Simulated Indicator of Compromise (IoC)
- Analyst reasoning
- Recommended response
- Lessons learned
- Evidence Integrity
  
Each case's underlying evidence record can also be inspected and, for demonstration purposes, deliberately modified.
Verify Evidence Trail
Verify Evidence Trail recomputes the recorded event hashes and compares them with their stored values.

If a recorded event has been modified without updating its stored hash, the verification process detects the mismatch and reflects the result in the relevant case.


Reset Demo Data

Reset Demo Data clears the generated demo data, including the sandbox activity, allowing the scenario to be run again from a clean state.

Core features

Real-time filesystem monitoring of a sandboxed folder
Five rule-based filesystem activity detectors
Structured investigation writeups mapped to detected activity
Tamper-evident, hash-chained evidence log
SHA-256 hash verification
One-click integrity verification across the evidence chain
In-app evidence tampering simulation
Case-level integrity status
Evidence Trail with block and hash information
Responsive investigation interface
Side-by-side investigation layout on desktop
Stacked investigation layout on tablet
Single-column investigation timeline on mobile
In-app Demo Guide
Browser-based demonstration after application startup
Optional command-line demo entry point
No developer instructions embedded in the user-facing interface
Security concepts demonstrated
Rule-based filesystem activity detection

SentinelTrail uses transparent, explainable rules to identify filesystem activity that may warrant investigation.
The five detectors cover:
- Suspicious file extensions
- Hidden-file activity
- Bursts of file deletions
- Rapid file modifications
- Off-hours activity

The detectors rely on simple conditions such as extension checks, event-rate thresholds, and time-of-day windows.

The rapid-modification detector provides a simple ransomware-pattern heuristic. It does not attempt to identify ransomware itself.

This approach is intentional: each detection decision can be explained and traced during an investigation without relying on statistical or machine-learning models.


Hash chaining for tamper evidence

Each recorded event is stored as part of a hash chain.

An event hash is derived from the previous event hash and the event's recorded fields using SHA-256:
SHA-256(prev_hash + timestamp + type + path + detail + severity + reason)

Each record therefore depends on the content of the current event as well as the previous hash in the chain.

If a previously recorded event is modified without updating its stored hash, a fresh recomputation produces a mismatch that the verification process can detect.
This demonstrates the basic principle of tamper-evident chained records without claiming that the local database itself is immutable.

Indicators of Compromise (IoC) framing

Detected anomalies are presented using an IoC-oriented investigation structure.
The project connects an observed technical signal with:
Evidence → Analysis → Impact → Response → Lessons Learned

This helps demonstrate how a technical finding can be interpreted and documented as part of an investigation rather than treated as an isolated log entry.


Structured investigation documentation

Each detector is mapped to an investigation writeup covering:
Analysis → Impact → Response → Lessons Learned

The structure is modeled loosely on how a junior security analyst might document and reason through a finding.
The goal is not to reproduce a production incident-management platform, but to make the investigation reasoning visible, structured, and explainable.


Technical stack

Area Technology
Backend Python 3, Flask
API Flask REST API
Filesystem monitoring watchdog
Evidence storage SQLite
Demo sandbox Plain files in demo_target/
Hashing SHA-256 via Python standard library
Frontend Vanilla HTML, CSS, JavaScript
Frontend framework None
Build step None
Investigation content investigation_kb.js

The project intentionally uses a small, understandable stack so the security concepts remain the focus rather than framework complexity.


API surface

The application exposes a small Flask API for the main demonstration flow:
GET /api/events

Returns recorded filesystem events used by the application and investigation interface.
GET /api/stats

Returns dashboard statistics used to summarize the current demo state.
GET /api/verify

Recomputes recorded event hashes and checks the integrity of the evidence chain.
POST /api/simulate-incident

Triggers the simulated incident activity used by the browser demo.
POST /api/tamper/<id>

Deliberately modifies the detail field of an existing evidence record without updating its stored hash.
This endpoint exists specifically for demonstrating evidence-integrity detection.
POST /api/reset

Clears generated demo data and resets the sandbox for another clean run.


Project structure

sentineltrail/
├── app.py                    # Flask app, API, dashboard, and watcher startup
├── chain.py                  # Hash-chain storage and anomaly detectors
├── watcher.py                # Real-time filesystem watcher using watchdog
├── incident_sim.py           # Shared simulated-incident logic
├── requirements.txt
├── scripts/
│   └── demo_attack.py        # CLI entry point for the simulated incident
└── static/
    ├── index.html             # Main application interface
    ├── style.css              # Application styling
    ├── script.js              # Case rendering, investigation, verification, and tamper flow
    └── investigation_kb.js    # Static investigation knowledge base
    
  That external anchoring mechanism is deliberately not implemented in this version so the project can remain focused on explainable incident investigation and evidence-integrity concepts.

  
Simple detection logic

The detectors use fixed, rule-based heuristics such as:
- Extension checks
- Event-rate thresholds
- Time-of-day windows
They are not statistical or machine-learning models.
This is intentional.
The project prioritizes transparent detection logic that can be explained and traced during an investigation.


Single-process, single-user environment

The project does not include:
Authentication
Multi-user access
Case ownership
Production-grade deployment
Production traffic handling

The included Flask development server is intended for local demonstration and learning, not production use.


Simplified case management

Cases are derived directly from detected activity and severity rather than a separate incident-management workflow.

There is currently no:
Case reassignment
Dedicated case-closing workflow
Multi-case correlation


Future improvements

Possible future extensions include:
External append-only anchoring for the evidence chain
Case correlation for related events

Configurable detector thresholds
Persisted case-status workflow such as open → investigating → closed

These are intentionally outside the current project scope.


Portfolio focus

SentinelTrail was built to demonstrate practical understanding of several entry-level cybersecurity concepts in one explainable workflow:
Filesystem monitoring → Detection → Evidence collection → Investigation → Integrity verification → Response reasoning

The project emphasizes understanding and traceability over complexity.

Every major feature exists to support the same question:
If you found this activity, how would you investigate it?

License
MIT — do whatever you like with it.

Runtime-generated files

Running the application creates local runtime data that is not stored in the repository:
demo_target/      # Sandboxed directory monitored by SentinelTrail
data/trail.db     # SQLite evidence chain
These files are generated locally when the application runs.
Installation
Requirements
Python 3.9 or newer
pip
Clone the repository
git clone https://github.com/Amwaj-04/SentinelTrail.git
cd SentinelTrail
Install dependencies
pip install -r requirements.txt
Running the application
Start the Flask application:
python app.py
Then open:
http://127.0.0.1:5050

Once the application is running, the main demonstration workflow can be completed entirely through the browser.

Demo flow

The same workflow is also available through the in-app Demo Guide.

1. Generate a simulated incident
Click:
Run Demo Incident
Within a few seconds, SentinelTrail generates filesystem activity inside the sandbox and the resulting detections appear as case files.
2. Open a case
Select a case to view its investigation.
Follow the Evidence Trail through:
Signal → Evidence → Analysis → Impact → Response → Outcome
3. Inspect evidence integrity
Open Evidence Integrity at the bottom of a case.
Review the record’s block number, stored hash, and current integrity state.
4. Simulate evidence tampering
Enter a new value in the tamper field and select:
Overwrite & Save
This deliberately modifies the stored record without recomputing its hash.
The purpose is to demonstrate what happens when previously recorded evidence is changed after the event was stored.
5. Verify the evidence trail
Click:
Verify Evidence Trail

The application recomputes the event hashes and compares them with the stored values.

If a record was modified without updating its hash, the affected case is reported as an integrity violation and the corresponding Outcome stage reflects the failed verification.

7. Reset the demo
Click:
Reset Demo Data

This clears the generated evidence and sandbox activity and returns the application to a clean state.


Running the demo from the terminal

The same simulated incident can also be triggered from the command line:
python scripts/demo_attack.py
This is optional.

After starting the application, the complete demonstration can be performed through the browser.
Integrity verification
The verification endpoint is:
GET /api/verify

It recomputes each recorded event’s hash and compares it with the stored value.

When a mismatch is found, the verification result identifies the affected record as tampered and reports the first break in the chain.
The interface performs verification after relevant actions such as:
Running the demo incident
Resetting demo data
Simulating tampering

Verification can also be triggered manually using:
Verify Evidence Trail
Tamper simulation
The tamper endpoint is:
POST /api/tamper/<id>
It writes a new detail value directly into an existing record without updating its stored hash.

This deliberately simulates a situation where someone with write access to the evidence storage modifies a previously recorded event.
The verification logic itself is not changed during this simulation.

Attempting to tamper with a non-existent record correctly returns:
404
The purpose of this feature is educational: to make the relationship between stored evidence, hashing, modification, and verification visible through the application interface.


Known limitations

SentinelTrail is intentionally a portfolio-scale demonstration, so several areas are simplified.
Self-contained evidence chain

The hash chain is stored locally in SQLite.
Verification proves that each stored hash matches the content currently associated with that record.
However, an attacker with full read/write access to the SQLite database could theoretically modify a record and then recompute subsequent hashes, making the local chain internally consistent again.

Production systems can address this limitation by anchoring hashes to an external, append-only source such as:
A write-once log
A separate logging destination
External timestamping
A notary service
