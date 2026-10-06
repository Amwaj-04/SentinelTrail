/*
 * investigation_kb.js
 * --------------------
 * Static analyst knowledge base used to turn a raw detected event into a
 * short investigation narrative (Analysis / Impact / Recommended Response /
 * Lessons Learned). This is editorial content, not a backend service --
 * intentionally simple and easy to extend with more detector types.
 *
 * Keys are matched against the anomaly_reason string returned by the
 * detector in chain.py.
 */

const INVESTIGATION_KB = [
  {
    match: r => r.includes("Suspicious executable"),
    title: "Suspicious script dropped",
    category: "Execution",
    whyItMatters: "Attackers commonly drop a script or small binary after gaining initial access, using it to establish persistence or run a second-stage payload.",
    impact: "If executed, this file could run arbitrary commands with the privileges of whoever triggers it — anywhere from data theft to a full foothold on the host.",
    analystReasoning: "Legitimate software rarely writes an executable script directly into a general-purpose folder outside of a proper installer. The file type, location, and timing here are consistent with a dropped payload rather than routine activity.",
    recommendedResponse: [
      "Quarantine the file before it can be executed",
      "Inspect its contents in a sandboxed environment",
      "Check for related process launches or outbound connections",
      "Trace how the file arrived (download, attachment, removable media)"
    ],
    lessonsLearned: "General-purpose folders should restrict executable file types, and any new script should trigger automatic review rather than silent acceptance."
  },
  {
    match: r => r.includes("Hidden file"),
    title: "Hidden file staged",
    category: "Staging",
    whyItMatters: "Hidden (dot-prefixed) files are a simple way to stage data or tools while avoiding a casual glance at a directory listing.",
    impact: "Could indicate preparation for data exfiltration, or an attempt to keep working files out of sight during an intrusion.",
    analystReasoning: "A hidden file appearing outside of normal application or OS conventions is worth a second look — it's a low-cost way for an intruder to hide in plain sight, and it's uncommon in everyday user activity.",
    recommendedResponse: [
      "Inspect the file's contents and size",
      "Check whether it was created by a known, expected process",
      "Correlate with other activity in the same time window"
    ],
    lessonsLearned: "Hidden-file creation in monitored directories is cheap to detect and often an early, low-noise signal worth tracking on its own."
  },
  {
    match: r => r.includes("Mass deletion"),
    title: "Mass deletion burst",
    category: "Impact / Cleanup",
    whyItMatters: "A burst of deletions in a short window is a classic sign of either data destruction or an attacker covering their tracks after an operation.",
    impact: "Loss of files or evidence, and reduced ability to reconstruct what happened if deletion continues unchecked.",
    analystReasoning: "A small number of deletions spread over a day is normal housekeeping. Several deletions landing within seconds of each other is a different pattern — it matches scripted or automated removal rather than a person manually cleaning up.",
    recommendedResponse: [
      "Check backups or shadow copies for recoverable versions",
      "Identify the process or session responsible for the deletions",
      "Determine whether the burst is still in progress and can be stopped"
    ],
    lessonsLearned: "Deletion velocity, not just deletion itself, is often the more useful signal — a rate-based threshold catches bursts that a simple audit log would bury."
  },
  {
    match: r => r.includes("Rapid mass modification"),
    title: "Rapid mass modification",
    category: "Impact / Ransomware pattern",
    whyItMatters: "Encrypting or overwriting many files in quick succession is the defining behavior of ransomware and similar destructive malware.",
    impact: "Potential large-scale data loss or encryption; the earlier this is caught, the fewer files are affected before containment.",
    analystReasoning: "A handful of file edits in ten seconds is unusual for human-driven work but exactly what an automated encryption routine looks like. The count and speed here cross a threshold that normal editing very rarely reaches.",
    recommendedResponse: [
      "Isolate the affected host from the network immediately",
      "Stop the responsible process if it's still running",
      "Assess scope: which files and directories were touched",
      "Begin recovery from the most recent clean backup"
    ],
    lessonsLearned: "Rate-based detection on file modification is one of the highest-value, lowest-complexity controls against ransomware-style behavior."
  },
  {
    match: r => r.includes("Off-hours"),
    title: "Off-hours activity",
    category: "Anomalous access",
    whyItMatters: "Activity outside normal working hours is not inherently malicious, but it's a useful anomaly signal, especially on sensitive files.",
    impact: "Could indicate a compromised credential being used outside the legitimate user's normal schedule, or an insider acting outside business hours.",
    analystReasoning: "Timing alone rarely proves anything, which is why this is treated as a lower-severity signal here — but combined with a sensitive file path or other indicators, off-hours access is exactly the kind of context an analyst would want surfaced rather than buried in a routine log.",
    recommendedResponse: [
      "Confirm whether the associated user or process was expected to be active",
      "Check for other signals occurring in the same window",
      "Consider requiring step-up authentication for off-hours access to sensitive paths"
    ],
    lessonsLearned: "Low-severity, context-dependent signals like timing are most useful when correlated with other evidence rather than acted on alone."
  }
];

const DEFAULT_KB_ENTRY = {
  title: "Filesystem activity",
  category: "Informational",
  whyItMatters: "This event didn't match a specific detection rule but is retained in the evidence chain for completeness.",
  impact: "No indicators of malicious activity were associated with this event.",
  analystReasoning: "Routine file activity of this kind is expected during normal use and doesn't warrant investigation on its own.",
  recommendedResponse: ["No action required"],
  lessonsLearned: "Not every logged event needs to become a case — separating signal from routine activity is part of the point."
};

function lookupKB(anomalyReason) {
  if (!anomalyReason) return DEFAULT_KB_ENTRY;
  const found = INVESTIGATION_KB.find(entry => entry.match(anomalyReason));
  return found || DEFAULT_KB_ENTRY;
}
