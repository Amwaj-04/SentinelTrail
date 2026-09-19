SentinelTrail

Follow the evidence.


SentinelTrail is an educational cybersecurity web application that turns raw filesystem activity into investigation case files. Each case walks through a signal, the evidence behind it, an analyst’s reasoning, its potential impact, a recommended response, and an outcome.
It also maintains a tamper-evident hash chain for recorded events, allowing you to simulate an evidence record being modified after the fact and verify that the integrity check detects the change.
Note: SentinelTrail is a simulated learning environment built as a cybersecurity portfolio project. It is not a production SIEM, enterprise SOC platform, or digital forensics tool. Its evidence storage is not immutable in the way a production system would require. See Known limitations for the exact scope and trade-offs.




What SentinelTrail is
Most junior security portfolios show a table of logs.
SentinelTrail instead asks:
If you found this file activity, how would you investigate it?
Every detected anomaly becomes a case file with a structured investigation narrative rather than just another row in a table. The underlying evidence log is also designed so that unauthorized modification of a recorded event becomes detectable through hash verification.
The project focuses on a simple investigation principle:
Follow the evidence.




The “Follow the evidence” concept
Every case in SentinelTrail follows the same six-stage investigation path:
SIGNAL → EVIDENCE → ANALYSIS → IMPACT → RESPONSE → OUTCOME
Signal — what was detected and when
Evidence — where the event sits in the evidence chain, including its block number and hash
Analysis — why an analyst would consider the activity suspicious
Impact — what could happen if the activity represents a real security incident
Response — what an analyst should consider doing next
Outcome — the case’s current status, including whether its evidence has been verified
This path is represented directly in the investigation interface. It appears as a horizontal stepper on desktop and tablet, and as a vertical investigation timeline on mobile.




Investigation flow
Run Demo Incident generates a short, realistic burst of filesystem activity inside a sandboxed folder (demo_target/). No real system access is involved.
A live filesystem watcher powered by watchdog also monitors the folder in real time, so manually adding or removing a file produces the same type of underlying filesystem events.
Every event is evaluated against a small set of rule-based heuristics.
Events that trigger a detector become case files, while routine background activity remains in the evidence log without becoming a case. This keeps the case list focused on detected signals rather than general filesystem noise.
Opening a case provides its full investigation:
- Evidence Trail
- What was observed
- Why it matters
- Simulated Indicator of Compromise (IoC)
- Analyst reasoning
- Recommended response
- Lessons learned
- Evidence Integrity
Each case’s underlying evidence record can also be inspected and, for demonstration purposes, deliberately modified.
Verify Evidence Trail re-checks the recorded hashes and reflects the verification result back into the relevant case status and Outcome stage.
Reset Demo Data clears the generated demo data, including the sandbox folder, so the scenario can be run again from a clean state.




Core features
- Real-time filesystem monitoring of a sandboxed folder
- Five rule-based filesystem activity detectors
- Analyst-style investigation writeups mapped to each detector
- Tamper-evident, hash-chained evidence log
- One-click integrity verification across the evidence chain
- In-app tamper simulation demonstrating evidence-integrity detection
- Responsive case-file and investigation-view layout
- Side-by-side investigation interface on desktop
- Stacked investigation layout on tablet
- Single-column investigation timeline on mobile
- In-app Demo Guide
- No developer instructions embedded in the user-facing interface



Security concepts demonstrated
Rule-based filesystem activity detection
SentinelTrail uses transparent, explainable rules to identify filesystem activity that may warrant investigation, including:
Suspicious file extensions
Hidden-file activity
Bursts of file deletions
Rapid file modifications
Off-hours activity
The detectors use simple thresholds and conditions rather than statistical or machine-learning models. This keeps each detection decision traceable and explainable during an investigation.




Integrity verification
The verification endpoint:
GET /api/verify
recomputes each recorded event’s hash and compares it with the stored value.
When a mismatch is found, the verification result identifies the affected record as tampered and reports the first break in the chain.
The interface checks verification after relevant actions such as:
Running the demo incident
Resetting demo data
Simulating tampering
Verification can also be triggered manually using Verify Evidence Trail.




Tamper simulation
The tamper endpoint:
POST /api/tamper/<id>
writes a new detail value directly into an existing record without updating its stored hash.
This deliberately simulates a situation where someone with write access to the evidence storage modifies a previously recorded event.
The verification logic itself is not changed during this simulation.
Attempting to tamper with a non-existent record correctly returns:
404




Known limitations
SentinelTrail is intentionally a portfolio-scale demonstration, so several areas are simplified.
Self-contained evidence chain
The hash chain is stored locally in SQLite.
Verification proves that each stored hash matches the content currently associated with that record. However, an attacker with full read/write access to the SQLite database could theoretically modify a record and then recompute subsequent hashes, making the local chain internally consistent again.
Production systems can address this limitation by anchoring hashes to an external, append-only source such as a write-once log, separate logging destination, or external timestamping/notary service.
That external anchoring mechanism is deliberately not implemented in this version so the project can remain focused on explainable incident investigation and evidence-integrity concepts.
Simple detection logic
The detectors use fixed, rule-based heuristics such as:
Extension checks
Event-rate thresholds
Time-of-day windows
They are not statistical or machine-learning models.
This is intentional: the project prioritizes transparent detection logic that can be explained and traced during an investigation.
Single-process, single-user environment
The project does not include:
Authentication
Multi-user access
Case ownership
Production-grade deployment
Production traffic handling
The included Flask development server is intended for local demonstration and learning, not production use.
Simplified case management
Cases are derived directly from detected severity rather than a separate incident-management workflow.
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



License
MIT — do whatever you like with it.
