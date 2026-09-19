"""
chain.py
---------
The core of SentinelTrail's "Evidence Trail": a tamper-evident,
hash-chained log of filesystem security events.

Design idea (borrowed from blockchains / git / forensic chain-of-custody):
Every event is hashed together with the hash of the PREVIOUS event.
    hash_N = SHA256(hash_{N-1} + timestamp + type + path + detail + severity + reason)

Because each hash depends on the one before it, editing or deleting a
past event (e.g. an attacker trying to cover their tracks by editing
the log) breaks every hash after the edited point. Verification simply
recomputes the chain and compares it to what's stored -- if a single
byte was changed anywhere in history, the chain "snaps" at that point
and everything downstream is provably invalid.

This mirrors how real-world forensic evidence logs and some SIEM /
audit-log products use hash chaining to prove log integrity in court
or in an incident response report.
"""

import sqlite3
import hashlib
import time
from datetime import datetime
from pathlib import Path
from contextlib import contextmanager

DB_PATH = Path(__file__).parent / "data" / "trail.db"
GENESIS_HASH = "0" * 64

SUSPICIOUS_EXTENSIONS = {".exe", ".sh", ".bat", ".ps1", ".dll", ".scr", ".vbs"}
OFF_HOURS_RANGE = range(0, 6)  # 00:00 - 05:59 local time counts as "off hours"

MASS_DELETE_THRESHOLD = 4     # events
MASS_DELETE_WINDOW_SEC = 15
RAPID_MODIFY_THRESHOLD = 5
RAPID_MODIFY_WINDOW_SEC = 10

# The scripted "Run Demo Incident" already injects one clearly-labeled
# synthetic off-hours event (see incident_sim.py). Without this flag, the
# real-time off-hours check below would ALSO fire on every other scripted
# event whenever the demo happens to be run late at night, swamping the
# more interesting signals (ransomware-like pattern, mass deletion) with
# repetitive off-hours tags. Live monitoring of real activity always keeps
# the real-time check active -- this only affects the deterministic demo.
#
# This is a FILE-based flag rather than an in-memory one on purpose: the
# demo can be triggered either in-process (the "Run Demo Incident" button,
# handled by the Flask process that also runs the watcher) or out-of-process
# (running scripts/demo_attack.py in a separate terminal against an
# already-running server). An in-memory flag set by the CLI script's own
# process would be invisible to the server process's watcher thread, which
# is what's actually recording events -- a file on shared disk works for
# both cases.
_SUPPRESS_FLAG_PATH = Path(__file__).parent / "data" / ".suppress_offhours"


def pause_offhours_detection():
    _SUPPRESS_FLAG_PATH.parent.mkdir(parents=True, exist_ok=True)
    _SUPPRESS_FLAG_PATH.touch()


def resume_offhours_detection():
    _SUPPRESS_FLAG_PATH.unlink(missing_ok=True)


def _offhours_suppressed():
    return _SUPPRESS_FLAG_PATH.exists()


def _ensure_db():
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    with _conn() as c:
        c.execute("""
            CREATE TABLE IF NOT EXISTS events (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                ts TEXT NOT NULL,
                event_type TEXT NOT NULL,
                filepath TEXT NOT NULL,
                detail TEXT NOT NULL,
                severity TEXT NOT NULL,
                anomaly_reason TEXT,
                prev_hash TEXT NOT NULL,
                event_hash TEXT NOT NULL,
                tampered_manually INTEGER NOT NULL DEFAULT 0
            )
        """)
        # Seed genesis block if empty
        cur = c.execute("SELECT COUNT(*) FROM events")
        if cur.fetchone()[0] == 0:
            ts = datetime.utcnow().isoformat()
            genesis_hash = _compute_hash(
                GENESIS_HASH, ts, "GENESIS", "-", "SentinelTrail evidence chain initialized", "INFO", None
            )
            c.execute(
                "INSERT INTO events (ts, event_type, filepath, detail, severity, anomaly_reason, prev_hash, event_hash) "
                "VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                (ts, "GENESIS", "-", "SentinelTrail evidence chain initialized", "INFO", None, GENESIS_HASH, genesis_hash)
            )


@contextmanager
def _conn():
    conn = sqlite3.connect(DB_PATH, timeout=10)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
        conn.commit()
    finally:
        conn.close()


def _compute_hash(prev_hash, ts, event_type, filepath, detail, severity, anomaly_reason):
    payload = "|".join([
        prev_hash, ts, event_type, filepath, detail, severity, anomaly_reason or ""
    ])
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


def _last_event(c):
    row = c.execute("SELECT * FROM events ORDER BY id DESC LIMIT 1").fetchone()
    return row


def _detect_anomaly(c, event_type, filepath, now_ts):
    """
    Runs lightweight heuristics against recent history to decide
    severity + a human-readable reason. Returns (severity, reason_or_None).
    """
    ext = Path(filepath).suffix.lower()
    name = Path(filepath).name

    # 1. Suspicious executable / script dropped
    if event_type == "CREATED" and ext in SUSPICIOUS_EXTENSIONS:
        return "CRITICAL", f"Suspicious executable/script dropped ({ext})"

    # 2. Hidden / dotfile creation (possible staging or trace-covering)
    if event_type == "CREATED" and name.startswith(".") and name not in (".", ".."):
        return "WARNING", "Hidden file created (possible staging/exfil prep)"

    # 3. Off-hours activity
    hour = datetime.fromisoformat(now_ts).hour
    off_hours = hour in OFF_HOURS_RANGE

    # 4. Mass deletion burst
    if event_type == "DELETED":
        window_start = time.time() - MASS_DELETE_WINDOW_SEC
        rows = c.execute(
            "SELECT ts FROM events WHERE event_type='DELETED'"
        ).fetchall()
        recent = [r for r in rows if _to_epoch(r["ts"]) >= window_start]
        if len(recent) + 1 >= MASS_DELETE_THRESHOLD:
            return "CRITICAL", f"Mass deletion burst detected ({len(recent)+1} deletes in {MASS_DELETE_WINDOW_SEC}s)"

    # 5. Rapid mass modification (ransomware-like pattern)
    if event_type == "MODIFIED":
        window_start = time.time() - RAPID_MODIFY_WINDOW_SEC
        rows = c.execute(
            "SELECT ts FROM events WHERE event_type='MODIFIED'"
        ).fetchall()
        recent = [r for r in rows if _to_epoch(r["ts"]) >= window_start]
        if len(recent) + 1 >= RAPID_MODIFY_THRESHOLD:
            return "CRITICAL", f"Rapid mass modification detected ({len(recent)+1} files in {RAPID_MODIFY_WINDOW_SEC}s) - ransomware-like pattern"

    if off_hours and not _offhours_suppressed():
        return "WARNING", f"Off-hours activity ({hour:02d}:00 local)"

    return "INFO", None


def _to_epoch(iso_ts):
    try:
        return datetime.fromisoformat(iso_ts).timestamp()
    except Exception:
        return 0


def append_event(event_type, filepath, detail):
    """Append a new filesystem event to the evidence chain, running anomaly
    detection first. This is the single entry point used by both the live
    watcher and the demo-attack script."""
    _ensure_db()
    ts = datetime.utcnow().isoformat()
    with _conn() as c:
        severity, reason = _detect_anomaly(c, event_type, filepath, ts)
        prev = _last_event(c)
        prev_hash = prev["event_hash"] if prev else GENESIS_HASH
        event_hash = _compute_hash(prev_hash, ts, event_type, filepath, detail, severity, reason)
        c.execute(
            "INSERT INTO events (ts, event_type, filepath, detail, severity, anomaly_reason, prev_hash, event_hash) "
            "VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            (ts, event_type, filepath, detail, severity, reason, prev_hash, event_hash)
        )
        return {
            "ts": ts, "event_type": event_type, "filepath": filepath, "detail": detail,
            "severity": severity, "anomaly_reason": reason,
            "prev_hash": prev_hash, "event_hash": event_hash
        }


def append_manual_event(event_type, filepath, detail, severity, reason):
    """Used by the demo-attack script to inject a clearly-labeled simulated
    event (e.g. a synthetic off-hours event) while still going through the
    real hash chain -- this event is just as verifiable as a live one."""
    _ensure_db()
    ts = datetime.utcnow().isoformat()
    with _conn() as c:
        prev = _last_event(c)
        prev_hash = prev["event_hash"] if prev else GENESIS_HASH
        event_hash = _compute_hash(prev_hash, ts, event_type, filepath, detail, severity, reason)
        c.execute(
            "INSERT INTO events (ts, event_type, filepath, detail, severity, anomaly_reason, prev_hash, event_hash) "
            "VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            (ts, event_type, filepath, detail, severity, reason, prev_hash, event_hash)
        )


def get_all_events():
    _ensure_db()
    with _conn() as c:
        rows = c.execute("SELECT * FROM events ORDER BY id ASC").fetchall()
        return [dict(r) for r in rows]


def get_stats():
    events = get_all_events()
    stats = {"total": len(events), "INFO": 0, "WARNING": 0, "CRITICAL": 0}
    for e in events:
        stats[e["severity"]] = stats.get(e["severity"], 0) + 1
    return stats


def verify_chain():
    """Recomputes every hash in the chain from scratch and compares it to
    what's stored. Returns per-event OK/TAMPERED status plus the index of
    the first break, if any."""
    events = get_all_events()
    results = []
    valid_so_far = True
    first_break = None
    running_prev = GENESIS_HASH

    for i, e in enumerate(events):
        expected_hash = _compute_hash(
            running_prev if i > 0 else GENESIS_HASH,
            e["ts"], e["event_type"], e["filepath"], e["detail"], e["severity"], e["anomaly_reason"]
        )
        # For event 0 (genesis) prev_hash is always GENESIS_HASH; for others
        # it should equal the PREVIOUS event's *stored* hash for continuity
        # to be considered valid from an outside verifier's perspective too.
        stored_ok = (e["event_hash"] == expected_hash)
        link_ok = (i == 0) or (e["prev_hash"] == events[i - 1]["event_hash"])

        ok = stored_ok and link_ok
        if not ok and valid_so_far:
            valid_so_far = False
            first_break = i

        results.append({
            **e,
            "status": "OK" if ok else "TAMPERED",
        })
        running_prev = e["event_hash"]

    return {
        "chain_valid": first_break is None,
        "first_break_index": first_break,
        "events": results,
    }


def tamper_event(event_id, new_detail):
    """DEMO-ONLY: directly mutates a stored event's detail field WITHOUT
    recomputing its hash -- exactly what an attacker editing a log file or
    database record after the fact would do. Used to demonstrate that
    verify_chain() detects it. Returns True if a matching record was found
    and updated, False otherwise."""
    _ensure_db()
    with _conn() as c:
        cur = c.execute("UPDATE events SET detail = ?, tampered_manually = 1 WHERE id = ?", (new_detail, event_id))
        return cur.rowcount > 0


def reset_chain():
    _ensure_db()
    with _conn() as c:
        c.execute("DELETE FROM events")
    _ensure_db()
