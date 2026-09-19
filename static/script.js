const statusStrip = document.getElementById("statusStrip");
const caseList = document.getElementById("caseList");
const casePanelCount = document.getElementById("casePanelCount");
const investigationView = document.getElementById("investigationView");
const emptyHero = document.getElementById("emptyHero");
const previewTrail = document.getElementById("previewTrail");
const workspaceGrid = document.getElementById("workspaceGrid");

const simulateBtn = document.getElementById("simulateBtn");
const heroSimulateBtn = document.getElementById("heroSimulateBtn");
const verifyBtn = document.getElementById("verifyBtn");
const refreshBtn = document.getElementById("refreshBtn");
const resetBtn = document.getElementById("resetBtn");

const guideBtn = document.getElementById("guideBtn");
const guideOverlay = document.getElementById("guideOverlay");
const guideClose = document.getElementById("guideClose");

let currentEvents = [];
let cases = [];
let selectedCaseId = null;
let integrityById = {};
let integrityState = { checked: false, valid: true, brokenId: null };
let integrityPanelOpen = false;
let focusedStage = null;          // currently focused Evidence Trail stage key, or null
let originalDetailById = {};      // event id -> first-seen ("original") detail text, for restore

const STAGE_NARRATIVE_LABEL = {
  signal: "What was observed",
  evidence: "Simulated indicators",
  analysis: "Analyst reasoning",
  impact: "Why it matters",
  response: "Recommended response",
  outcome: "Lessons learned",
};

/* ---------- icons (small inline SVG helpers, generic line-icon style) ---------- */
const ICON_CHECK = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>`;
const ICON_ALERT = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>`;
const ICON_CLOCK = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/></svg>`;
const ICON_PENCIL = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>`;
const ICON_SCAN = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>`;
const ICON_CORNER = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 10 4 15l5 5"/><path d="M4 15h11a4 4 0 0 0 4-4V4"/></svg>`;
const ICON_ROTATE = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/></svg>`;

/* ---------- formatting helpers ---------- */

function relativeTime(iso) {
  const then = new Date(iso + "Z").getTime();
  const diffSec = Math.max(0, Math.round((Date.now() - then) / 1000));
  if (diffSec < 5) return "just now";
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.round(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  return new Date(iso + "Z").toLocaleDateString();
}

function shortName(path) {
  const parts = path.split("/");
  return parts[parts.length - 1] || path;
}

function shortHash(h) {
  return h.slice(0, 8) + "…" + h.slice(-6);
}

function caseId(id) {
  return `CF-${String(id).padStart(4, "0")}`;
}

function sevKey(severity) {
  return severity === "CRITICAL" ? "critical" : "warning";
}

const BOILERPLATE_DETAILS = new Set([
  "File created", "File contents or metadata changed", "File deleted"
]);
function isNotableDetail(detail) {
  return detail && !BOILERPLATE_DETAILS.has(detail);
}

/* ---------- status strip ---------- */

function renderStatusStrip() {
  const critical = cases.filter(c => c.severity === "CRITICAL").length;
  const warning = cases.filter(c => c.severity === "WARNING").length;

  // Global status is built from EVERY case's own independent integrity check,
  // not just whichever one happened to break first -- tampering with one case
  // never changes another case's verified/tampered status.
  const affected = cases.filter(c => integrityById[c.id] === "TAMPERED");
  const totalCases = cases.length;
  const verifiedCount = totalCases - affected.length;

  let integrityHtml;
  if (!integrityState.checked) {
    integrityHtml = `<div class="integrity-indicator ok" role="status" aria-live="polite"><span class="icircle">${ICON_CHECK}</span><div><div class="ititle">Checking evidence integrity…</div></div></div>`;
  } else if (affected.length === 0) {
    integrityHtml = `<div class="integrity-indicator ok" role="status" aria-live="polite"><span class="icircle">${ICON_CHECK}</span><div><div class="ieyebrow">Evidence integrity</div><div class="ititle">All cases verified</div><div class="isub">all ${totalCases} evidence chains reconcile</div></div></div>`;
  } else {
    const label = `${affected.length} case${affected.length === 1 ? "" : "s"} affected`;
    integrityHtml = `<div class="integrity-indicator bad" role="status" aria-live="polite"><span class="icircle">${ICON_ALERT}</span><div><div class="ieyebrow">Evidence integrity</div><div class="ititle">${label}</div><div class="isub">${verifiedCount} of ${totalCases} chains still reconcile</div></div></div>`;
  }

  statusStrip.innerHTML = `
    <div class="status-card">
      <div class="status-headline">
        <span class="num">${cases.length}</span>
        <span class="label">active<br>case files</span>
      </div>
      <div class="status-divider"></div>
      <div class="status-breakdown">
        <div class="status-chip"><span class="sw critical"></span><div><div class="cnum">${critical}</div><div class="clabel">critical</div></div></div>
        <div class="status-chip"><span class="sw warning"></span><div><div class="cnum">${warning}</div><div class="clabel">warnings</div></div></div>
      </div>
      ${integrityHtml}
    </div>`;
}

/* ---------- generic explainer trail for the empty dashboard state ---------- */

function renderPreviewTrail() {
  const stages = [
    { label: "Signal", headline: "Real-time filesystem activity is monitored as it happens." },
    { label: "Evidence", headline: "Every event is recorded in a tamper-evident hash chain." },
    { label: "Analysis", headline: "Rule-based indicators flag patterns worth a closer look." },
    { label: "Impact", headline: "Each finding explains what could go wrong if it's real." },
    { label: "Response", headline: "Concrete next steps, the way an analyst would document them." },
    { label: "Outcome", headline: "Verified intact — or flagged the moment evidence is altered.", outcome: true },
  ];
  previewTrail.innerHTML = buildTrailHtml(stages, "pending", false);
}

/* ---------- case list ---------- */

function caseStatus(e) {
  const status = integrityById[e.id];
  if (status === "TAMPERED") return { label: "Integrity alert", cls: "alert" };
  if (status === "OK") return { label: "Reviewed", cls: "reviewed" };
  return { label: "Open", cls: "open" };
}

function renderCaseList() {
  if (cases.length === 0) {
    emptyHero.style.display = "flex";
    workspaceGrid.style.display = "none";
    renderPreviewTrail();
    return;
  }
  emptyHero.style.display = "none";
  workspaceGrid.style.display = "";
  casePanelCount.textContent = `${cases.length} indexed`;

  caseList.innerHTML = "";
  cases.forEach(e => {
    const kb = lookupKB(e.anomaly_reason);
    const status = caseStatus(e);
    const sk = sevKey(e.severity);
    const row = document.createElement("button");
    row.type = "button";
    row.className = "case-row" + (e.id === selectedCaseId ? " active" : "");
    row.dataset.id = e.id;
    row.innerHTML = `
      <span class="case-row-edge ${sk}"></span>
      <span class="case-row-body">
        <span class="case-row-top">
          <span class="case-row-id">${caseId(e.id)}</span>
          <span class="status-pill ${status.cls}">${status.label}</span>
        </span>
        <span class="case-row-title">${kb.title}</span>
        <span class="case-row-meta">
          <span class="sevdot ${sk}"></span>
          <span>${e.severity === "CRITICAL" ? "Critical" : "Warning"}</span>
          <span class="sep">·</span>
          <span class="asset">${shortName(e.filepath)}</span>
          <span class="sep">·</span>
          <span>${relativeTime(e.ts)}</span>
        </span>
      </span>
    `;
    row.addEventListener("click", () => selectCase(e.id));
    caseList.appendChild(row);
  });

  if (selectedCaseId != null && cases.find(c => c.id === selectedCaseId)) {
    renderInvestigation(selectedCaseId);
  } else {
    renderInvestigationPlaceholder();
  }
}

function selectCase(id) {
  selectedCaseId = id;
  focusedStage = null;
  document.querySelectorAll(".case-row").forEach(el => {
    el.classList.toggle("active", Number(el.dataset.id) === id);
  });
  renderInvestigation(id);
}

function renderInvestigationPlaceholder() {
  investigationView.innerHTML = `
    <div class="card">
      <div class="investigation-placeholder">
        <svg viewBox="0 0 40 40" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M7 30 16 20 25 25 34 10"/></svg>
        <p>Select a case file to open its investigation and follow the evidence.</p>
      </div>
    </div>`;
}

/* ---------- Evidence Trail (shared builder: desktop stepper + mobile timeline) ---------- */

function buildTrailHtml(stages, outcomeState, interactive) {
  const focused = interactive ? stages.find(s => s.key === focusedStage) : null;

  // desktop
  const desktopStages = stages.map((s, i) => {
    const isOutcome = !!s.outcome;
    const isFocused = interactive && s.key === focusedStage;
    const dimmed = interactive && focusedStage !== null && !isFocused;
    const nodeHtml = isOutcome
      ? `<span class="trail-node-outcome ${outcomeState === "violation" ? "bad" : outcomeState === "ok" ? "ok" : "pending"}">${outcomeState === "violation" ? ICON_ALERT : outcomeState === "ok" ? ICON_CHECK : "?"}</span>`
      : `<span class="trail-node-num${isFocused ? " focused" : ""}">${i + 1}</span>`;
    const labelCls = isOutcome ? (outcomeState === "violation" ? "bad" : outcomeState === "ok" ? "ok" : "") : (isFocused ? "focused-label" : "");
    const headline = isOutcome && outcomeState === "violation" ? "Integrity violation" : s.headline;
    const inner = `
          ${nodeHtml}
          <p class="trail-stage-label ${labelCls}">${s.label}</p>
          <p class="trail-stage-headline">${headline}</p>`;
    return `
      <div class="trail-stage-d">
        <span class="trail-connector-d"></span>
        <div class="trail-stage-inner-d">
          ${interactive
            ? `<button type="button" class="trail-stage-btn${dimmed ? " dimmed" : ""}" data-stage-key="${s.key}" aria-pressed="${isFocused}">${inner}</button>`
            : inner}
        </div>
      </div>`;
  }).join("");

  // mobile
  const mobileStages = stages.map((s, i) => {
    const isOutcome = !!s.outcome;
    const isFocused = interactive && s.key === focusedStage;
    const nodeHtml = isOutcome
      ? `<span class="trail-node-outcome ${outcomeState === "violation" ? "bad" : outcomeState === "ok" ? "ok" : "pending"}">${outcomeState === "violation" ? ICON_ALERT : outcomeState === "ok" ? ICON_CHECK : "?"}</span>`
      : `<span class="trail-node-num${isFocused ? " focused" : ""}">${i + 1}</span>`;
    const labelCls = isOutcome ? (outcomeState === "violation" ? "bad" : outcomeState === "ok" ? "ok" : "") : (isFocused ? "focused-label" : "");
    const headline = isOutcome && outcomeState === "violation" ? "Integrity violation" : s.headline;
    const detail = isOutcome && outcomeState === "violation"
      ? "The hash chain no longer reconciles. A record was altered after capture — findings from this case are untrusted until verified again."
      : (s.detail || "");
    const body = `
          <div class="trail-m-top">
            <p class="trail-stage-label ${labelCls}" style="margin:0;">${s.label}</p>
            ${s.timestamp ? `<span class="trail-m-ts">${s.timestamp}</span>` : ""}
          </div>
          <p class="trail-m-headline">${headline}</p>
          ${detail ? `<p class="trail-m-detail">${detail}</p>` : ""}
          ${isFocused ? `<p class="trail-see-hint">${ICON_CORNER}See "${STAGE_NARRATIVE_LABEL[s.key]}"</p>` : ""}`;
    return `
      <div class="trail-stage-m">
        <span class="trail-connector-m"></span>
        ${nodeHtml}
        ${interactive
          ? `<button type="button" class="trail-stage-btn-m${isFocused ? " focused-m" : ""}" data-stage-key="${s.key}" aria-pressed="${isFocused}"><div class="trail-m-body">${body}</div></button>`
          : `<div class="trail-m-body">${body}</div>`}
      </div>`;
  }).join("");

  const focusPanel = focused ? `
    <div class="trail-focus-panel">
      <div class="tfp-top">
        <span class="tfp-label">${focused.label}</span>
        ${focused.timestamp ? `<span class="tfp-ts">${focused.timestamp}</span>` : ""}
      </div>
      <p class="tfp-detail">${focused.key === "outcome" && outcomeState === "violation" ? "The hash chain no longer reconciles. A record was altered after capture — findings from this case are untrusted until restored." : focused.detail}</p>
      <p class="tfp-hint">${ICON_CORNER}Highlighted below in "${STAGE_NARRATIVE_LABEL[focused.key]}"</p>
    </div>` : "";

  return `
    <div class="trail-head">
      <h3>Evidence trail</h3>
      <span class="count">${interactive ? (focused ? "select a stage to follow it" : "6 stages") : "6 stages"}</span>
    </div>
    <div class="trail-desktop">${desktopStages}</div>
    ${interactive ? focusPanel : ""}
    <div class="trail-mobile">${mobileStages}</div>`;
}

function buildTrail(e, kb) {
  const status = integrityById[e.id];
  let outcomeState = status === "TAMPERED" ? "violation" : status === "OK" ? "ok" : "pending";
  let outcomeHeadline = status === "TAMPERED"
    ? "Integrity violation"
    : status === "OK"
      ? "Evidence trail verified"
      : "Pending verification";
  let outcomeDetail = status === "TAMPERED"
    ? "Evidence integrity compromised — investigation reopened."
    : status === "OK"
      ? "Evidence confirmed intact — case ready for closure."
      : "Run Verify Evidence Trail to confirm this record's integrity.";

  const t = new Date(e.ts + "Z");
  const ts = t.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  const stages = [
    { key: "signal", label: "Signal", headline: `${e.event_type} detected`, detail: `SentinelTrail's monitor recorded a ${e.event_type.toLowerCase()} event on ${shortName(e.filepath)}.`, timestamp: ts },
    { key: "evidence", label: "Evidence", headline: `Recorded in evidence chain`, detail: `The event was appended to the tamper-evident chain as block #${e.id}.`, timestamp: ts },
    { key: "analysis", label: "Analysis", headline: "Rule-based indicator matched", detail: kb.analystReasoning, timestamp: ts },
    { key: "impact", label: "Impact", headline: "Potential consequence assessed", detail: kb.impact, timestamp: ts },
    { key: "response", label: "Response", headline: kb.recommendedResponse[0], detail: kb.recommendedResponse.slice(1).join(" ") || kb.recommendedResponse[0], timestamp: ts },
    { key: "outcome", label: "Outcome", headline: outcomeHeadline, detail: outcomeDetail, outcome: true, timestamp: ts },
  ];

  return `<div class="card">${buildTrailHtml(stages, outcomeState, true)}</div>`;
}

/* ---------- Investigation view ---------- */

function renderInvestigation(id) {
  const e = currentEvents.find(ev => ev.id === id);
  if (!e) return;
  const kb = lookupKB(e.anomaly_reason);
  const sk = sevKey(e.severity);
  const integrityStatus = integrityById[e.id];

  let integrityCls = "pending", integrityLabel = "Not yet verified", integrityIcon = ICON_PENCIL;
  if (integrityStatus === "OK") { integrityCls = "ok"; integrityLabel = "verified"; integrityIcon = ICON_CHECK; }
  if (integrityStatus === "TAMPERED") { integrityCls = "bad"; integrityLabel = "violation"; integrityIcon = ICON_ALERT; }

  const verifyResultHtml = integrityStatus === "OK"
    ? `<div class="verify-result ok">${ICON_CHECK}<p>Chain reconciles. No tampering detected on this record.</p></div>`
    : integrityStatus === "TAMPERED"
      ? `<div class="verify-result bad">${ICON_ALERT}<p>Record <b>${caseId(e.id)}</b>'s stored hash no longer matches a fresh recomputation. This record — and everything an analyst would conclude from it — is untrusted until restored.</p></div>`
      : "";

  const nf = (key) => focusedStage === key ? " narr-focused" : "";
  const nh = (key) => focusedStage === key ? " narr-heading-active" : "";
  const isTampered = originalDetailById[e.id] !== undefined && e.detail !== originalDetailById[e.id];

  investigationView.innerHTML = `
    <div class="card">
      <div class="inv-header-top">
        <span class="tag-mono">${caseId(e.id)}</span>
        <span class="badge ${sk}"><span class="bdot"></span>${e.severity === "CRITICAL" ? "Critical" : "Warning"}</span>
        <span class="status-pill ${caseStatus(e).cls}">${caseStatus(e).label}</span>
        <span class="inv-time">${ICON_CLOCK}${new Date(e.ts + "Z").toLocaleString()}</span>
      </div>
      <h2 class="inv-title font-serif">${kb.title}</h2>
      <p class="inv-summary">SentinelTrail recorded a <strong>${e.event_type.toLowerCase()}</strong> event for <span class="mono">${shortName(e.filepath)}</span>.${isNotableDetail(e.detail) ? ` ${e.detail}.` : ""} ${kb.whyItMatters}</p>
      <div class="inv-footline">
        <span>asset <b>${shortName(e.filepath)}</b></span>
        <span class="sep">·</span>
        <span>opened ${relativeTime(e.ts)}</span>
      </div>
    </div>

    ${buildTrail(e, kb)}

    <div class="card">
      <div class="narrative-grid">
        <div class="narr-section narr-full${nf("signal")}">
          <h4 class="narr-heading${nh("signal")}">What was observed</h4>
          <p>SentinelTrail recorded a <strong>${e.event_type.toLowerCase()}</strong> event for <span class="mono">${shortName(e.filepath)}</span> at ${new Date(e.ts + "Z").toLocaleTimeString()}.${isNotableDetail(e.detail) ? ` ${e.detail}.` : ""}</p>
        </div>
        <div class="narr-section${nf("impact")}">
          <h4 class="narr-heading${nh("impact")}">Why it matters</h4>
          <p>${kb.whyItMatters}</p>
        </div>
        <div class="narr-section${nf("evidence")}">
          <h4 class="narr-heading${nh("evidence")}">Simulated indicators</h4>
          <dl class="indicator-grid">
            <div class="indicator-cell"><dt>Indicator</dt><dd>${e.anomaly_reason || "None"}</dd></div>
            <div class="indicator-cell"><dt>Severity</dt><dd>${e.severity}</dd></div>
          </dl>
        </div>
        <div class="narr-section narr-full${nf("analysis")}">
          <h4 class="narr-heading${nh("analysis")}">Analyst reasoning</h4>
          <p class="narr-quote">${kb.analystReasoning}</p>
        </div>
        <div class="narr-section narr-full${nf("response")}">
          <h4 class="narr-heading${nh("response")}">Recommended response</h4>
          <ol class="response-list">
            ${kb.recommendedResponse.map((r, i) => `
              <li class="response-item">
                <span class="response-num">${i + 1}</span>
                <div><p class="response-title">${r}</p></div>
              </li>`).join("")}
          </ol>
        </div>
        <div class="narr-section narr-full${nf("outcome")}">
          <h4 class="narr-heading${nh("outcome")}">Lessons learned</h4>
          <p>${kb.lessonsLearned}</p>
        </div>
      </div>
    </div>

    <details class="integrity-card"${integrityPanelOpen ? " open" : ""}>
      <summary class="integrity-summary-row">
        ${ICON_SCAN.replace('<svg ', '<svg class="lead-icon" ')}
        <span class="integrity-summary-text">
          <h3>Evidence integrity</h3>
          <p>hash-chained record · tamper simulation</p>
        </span>
        <span class="integrity-mini-pill ${integrityCls}">${integrityIcon.replace('<svg ', '<svg style="width:12px;height:12px" ')}${integrityLabel}</span>
        <svg class="integrity-chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m6 9 6 6 6-6"/></svg>
      </summary>
      <div class="integrity-body">
        <p class="integrity-intro">This record is chained to the one before it by hash. Edit its description below to simulate tampering, then verify the trail — a mismatch here is exactly what a modified log would look like.</p>

        <div class="evidence-block ${integrityStatus === 'TAMPERED' ? 'broken' : ''}">
          <div class="eb-top">
            <span>block #${e.id}</span>
            <span class="sep">·</span>
            <span>${e.event_type}</span>
            ${isTampered ? `<span class="edited-tag">${ICON_PENCIL}edited</span>` : ""}
          </div>
          <div class="tamper-row" data-event-id="${e.id}">
            <input type="text" class="tamper-input" placeholder="${e.detail}" />
            <button class="btn btn-danger tamper-btn" type="button">${ICON_PENCIL}Overwrite &amp; save</button>
            <button class="btn btn-outline restore-btn" type="button" ${isTampered ? "" : "disabled"}>${ICON_ROTATE}Restore original</button>
          </div>
          <div class="eb-fields">
            <div><span class="fk">prev</span><span class="fv">${shortHash(e.prev_hash)}</span></div>
            <div><span class="fk">hash</span><span class="fv">${shortHash(e.event_hash)}</span></div>
          </div>
        </div>

        ${verifyResultHtml}

        <div class="integrity-actions">
          <button class="btn btn-primary verify-scoped-btn" type="button">${ICON_SCAN}Verify evidence trail</button>
        </div>
      </div>
    </details>
  `;
  const detailsEl = investigationView.querySelector(".integrity-card");
  if (detailsEl) {
    detailsEl.addEventListener("toggle", () => { integrityPanelOpen = detailsEl.open; });
  }
}

/* ---------- tamper + scoped verify (event delegation) ---------- */

document.addEventListener("click", async (evt) => {
  const tamperBtn = evt.target.closest(".tamper-btn");
  if (tamperBtn) {
    const row = tamperBtn.closest(".tamper-row");
    const id = row.dataset.eventId;
    const input = row.querySelector(".tamper-input");
    const detail = input.value.trim() || "*** LOG EDITED BY ATTACKER ***";
    tamperBtn.disabled = true;
    try {
      const res = await fetch(`/api/tamper/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ detail })
      });
      if (res.ok) await loadAll(false);
    } finally {
      tamperBtn.disabled = false;
    }
    return;
  }
  const scopedVerify = evt.target.closest(".verify-scoped-btn");
  if (scopedVerify) {
    runVerification(false);
    return;
  }
  const restoreBtn = evt.target.closest(".restore-btn");
  if (restoreBtn) {
    const row = restoreBtn.closest(".tamper-row");
    const id = row.dataset.eventId;
    const original = originalDetailById[id];
    if (original === undefined) return;
    restoreBtn.disabled = true;
    try {
      const res = await fetch(`/api/tamper/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ detail: original })
      });
      if (res.ok) await loadAll(false);
    } finally {
      restoreBtn.disabled = false;
    }
    return;
  }
  const stageBtn = evt.target.closest(".trail-stage-btn, .trail-stage-btn-m");
  if (stageBtn) {
    const key = stageBtn.dataset.stageKey;
    focusedStage = focusedStage === key ? null : key;
    if (selectedCaseId != null) renderInvestigation(selectedCaseId);
  }
});

/* ---------- data loading ---------- */

async function loadAll(autoVerify = true) {
  try {
    const [eventsRes, statsRes] = await Promise.all([
      fetch("/api/events"), fetch("/api/stats")
    ]);
    if (!eventsRes.ok || !statsRes.ok) throw new Error("Server error");
    currentEvents = await eventsRes.json();
    // Capture each event's first-seen ("pristine") detail exactly once, so the
    // Restore button has something real to restore to. Never overwrite an
    // already-captured original with a possibly-tampered value from a later load.
    currentEvents.forEach(e => {
      if (!(e.id in originalDetailById)) originalDetailById[e.id] = e.detail;
    });
    cases = currentEvents.filter(e => e.severity === "WARNING" || e.severity === "CRITICAL");
    renderCaseList();
    renderStatusStrip();
    if (autoVerify) await runVerification(true);
  } catch (err) {
    workspaceGrid.style.display = "none";
    emptyHero.style.display = "none";
    statusStrip.innerHTML = `<div class="status-card"><div class="status-headline"><span class="label" style="color:var(--violation); font-weight:600;">Couldn't reach SentinelTrail — make sure the app is still running, then click Refresh.</span></div></div>`;
  }
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function runVerification(silent = false) {
  if (!silent) {
    integrityState = { checked: false, valid: true, brokenId: null };
    renderStatusStrip();
    await sleep(400);
  }

  const res = await fetch("/api/verify");
  const result = await res.json();

  integrityById = {};
  result.events.forEach(ev => { integrityById[ev.id] = ev.status; });

  if (result.chain_valid) {
    integrityState = { checked: true, valid: true, brokenId: null };
  } else {
    integrityState = { checked: true, valid: false, brokenId: result.events[result.first_break_index].id };
  }

  renderCaseList();
  renderStatusStrip();
  if (selectedCaseId != null && cases.find(c => c.id === selectedCaseId)) {
    renderInvestigation(selectedCaseId);
  }
}

/* ---------- toolbar actions ---------- */

verifyBtn.addEventListener("click", () => runVerification(false));
refreshBtn.addEventListener("click", () => loadAll());

async function runSimulateIncident(button) {
  button.disabled = true;
  const original = button.innerHTML;
  button.textContent = "Running incident…";
  try {
    await fetch("/api/simulate-incident", { method: "POST" });
    await loadAll();
  } finally {
    button.disabled = false;
    button.innerHTML = original;
  }
}
simulateBtn.addEventListener("click", () => runSimulateIncident(simulateBtn));
heroSimulateBtn.addEventListener("click", () => runSimulateIncident(heroSimulateBtn));

resetBtn.addEventListener("click", async () => {
  if (!confirm("This clears the evidence trail and starts fresh. Continue?")) return;
  await fetch("/api/reset", { method: "POST" });
  selectedCaseId = null;
  integrityById = {};
  originalDetailById = {};
  focusedStage = null;
  integrityState = { checked: false, valid: true, brokenId: null };
  await loadAll();
});

/* ---------- demo guide modal ---------- */

guideBtn.addEventListener("click", () => guideOverlay.classList.add("open"));
guideClose.addEventListener("click", () => guideOverlay.classList.remove("open"));
guideOverlay.addEventListener("click", (e) => { if (e.target === guideOverlay) guideOverlay.classList.remove("open"); });

loadAll();
