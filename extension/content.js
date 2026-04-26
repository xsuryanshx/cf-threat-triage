/**
 * ThreatTriage sidebar — injected into every page.
 * Uses Shadow DOM for CSS isolation from the host page.
 * A tab sticks out from the right edge; click it to open/close the panel.
 */

// API calls are proxied through background.js to avoid host-page CSP blocks
const SIDEBAR_ID = '__threattriage_root__';

// Only inject once
if (!document.getElementById(SIDEBAR_ID)) {
  inject();
}

// Toggle from toolbar icon click
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === 'TOGGLE_SIDEBAR') toggle();
});

// ── Inject ──────────────────────────────────────────────────────────────────
function inject() {
  const host = document.createElement('div');
  host.id = SIDEBAR_ID;
  // width:0 + overflow:visible so children (tab & panel) can extend left
  // without pushing the tab away from the right edge.
  // Appended to <html> not <body> to escape Gmail's transform containing blocks.
  Object.assign(host.style, {
    position: 'fixed',
    top: '0',
    right: '0',
    width: '0',
    height: '100vh',
    zIndex: '2147483647',
    overflow: 'visible',
    pointerEvents: 'none',
  });
  (document.documentElement || document.body).appendChild(host);

  const shadow = host.attachShadow({ mode: 'open' });
  shadow.innerHTML = buildHTML();

  // Wire up after DOM is ready in shadow
  requestAnimationFrame(() => wireUp(shadow, host));
}

// ── HTML template ────────────────────────────────────────────────────────────
function buildHTML() {
  return `
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  :host { font-family: 'Inter', system-ui, sans-serif; font-size: 13px; }

  /* ── Tab (always visible, sticks out from right edge) ── */
  #tab {
    pointer-events: all;
    position: absolute;
    right: 0;
    top: 50%;
    transform: translateY(-50%);
    cursor: pointer;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 6px;
    width: 32px;
    background: #f97316;
    color: #fff;
    border-radius: 8px 0 0 8px;
    padding: 14px 6px;
    box-shadow: -3px 0 16px rgba(0,0,0,0.35);
    user-select: none;
    transition: background 0.15s, right 0.3s cubic-bezier(0.4,0,0.2,1);
    z-index: 2;
  }
  #tab:hover { background: #ea580c; }
  #tab.open { right: 380px; }
  #tab-icon { width: 18px; height: 18px; flex-shrink: 0; }
  #tab-label {
    writing-mode: vertical-rl;
    text-orientation: mixed;
    transform: rotate(180deg);
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: rgba(255,255,255,0.85);
  }
  #tab-arrow {
    font-size: 14px;
    font-weight: 700;
    line-height: 1;
  }

  /* ── Panel ── */
  #panel {
    pointer-events: none;
    position: absolute;
    top: 0;
    right: 0;
    width: 380px;
    height: 100vh;
    background: #0a0a14;
    border-left: 1px solid #1e1e35;
    box-shadow: -8px 0 32px rgba(0,0,0,0.5);
    display: flex;
    flex-direction: column;
    overflow: hidden;
    transform: translateX(100%);
    transition: transform 0.3s cubic-bezier(0.4,0,0.2,1);
    will-change: transform;
    z-index: 1;
  }
  #panel.open {
    transform: translateX(0);
    pointer-events: all;
  }

  /* ── Header ── */
  .hd {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 12px 14px;
    background: #111122;
    border-bottom: 1px solid #1e1e35;
    flex-shrink: 0;
  }
  .hd-title { font-weight: 700; font-size: 15px; color: #e5e7eb; }
  .hd-title span { color: #f97316; }
  .hd-badge {
    margin-left: auto;
    font-size: 10px;
    color: #6b7280;
    display: flex;
    align-items: center;
    gap: 4px;
  }
  .dot {
    width: 6px; height: 6px; border-radius: 50%;
    background: #22c55e;
    animation: pdot 1.5s ease-in-out infinite;
  }
  @keyframes pdot { 0%,100%{opacity:1} 50%{opacity:0.3} }

  /* ── Scroll area ── */
  .scroll { flex: 1; overflow-y: auto; padding: 14px; display: flex; flex-direction: column; gap: 10px; }
  .scroll::-webkit-scrollbar { width: 4px; }
  .scroll::-webkit-scrollbar-thumb { background: #374151; border-radius: 2px; }

  /* ── Auto badge ── */
  .auto-badge {
    display: none;
    align-items: center;
    gap: 6px;
    font-size: 11px;
    color: #22c55e;
    background: rgba(34,197,94,0.08);
    border: 1px solid rgba(34,197,94,0.2);
    border-radius: 6px;
    padding: 6px 10px;
  }

  /* ── Textarea ── */
  textarea {
    width: 100%;
    height: 130px;
    background: #111122;
    border: 1px solid #1e1e35;
    border-radius: 8px;
    padding: 10px;
    color: #e5e7eb;
    font-family: 'JetBrains Mono', 'Courier New', monospace;
    font-size: 11px;
    line-height: 1.5;
    resize: vertical;
    outline: none;
    transition: border-color 0.2s;
  }
  textarea:focus { border-color: #f97316; }
  textarea::placeholder { color: #4b5563; }

  /* ── Actions ── */
  .actions { display: flex; gap: 8px; }
  .btn-analyze {
    flex: 1;
    padding: 9px 0;
    background: #f97316;
    color: #fff;
    border: none;
    border-radius: 8px;
    font-weight: 700;
    font-size: 13px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    transition: background 0.15s, opacity 0.15s;
  }
  .btn-analyze:hover { background: #ea580c; }
  .btn-analyze:disabled { opacity: 0.3; cursor: not-allowed; }
  .btn-clear {
    padding: 9px 12px;
    background: transparent;
    border: 1px solid #1e1e35;
    border-radius: 8px;
    color: #6b7280;
    cursor: pointer;
    font-size: 12px;
    transition: color 0.15s, border-color 0.15s;
  }
  .btn-clear:hover { color: #e5e7eb; border-color: #374151; }

  /* ── Scanning ── */
  .scanning {
    display: none;
    align-items: center;
    gap: 10px;
    padding: 10px 12px;
    background: #111122;
    border: 1px solid #1e1e35;
    border-radius: 8px;
  }
  .spinner {
    width: 16px; height: 16px;
    border: 2px solid rgba(249,115,22,0.2);
    border-top-color: #f97316;
    border-radius: 50%;
    animation: spin 0.7s linear infinite;
    flex-shrink: 0;
  }
  @keyframes spin { to { transform: rotate(360deg); } }
  .scanning-text { font-size: 12px; color: #6b7280; }

  /* ── Error ── */
  .error-box {
    display: none;
    padding: 9px 12px;
    background: rgba(239,68,68,0.08);
    border: 1px solid rgba(239,68,68,0.25);
    border-radius: 7px;
    color: #fca5a5;
    font-size: 11px;
    line-height: 1.5;
  }

  /* ── Results ── */
  .results { display: none; flex-direction: column; gap: 10px; }

  /* Verdict row */
  .verdict-row {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px;
    background: #111122;
    border: 1px solid #1e1e35;
    border-radius: 10px;
  }

  /* Gauge */
  .gauge-wrap { position: relative; width: 68px; height: 68px; flex-shrink: 0; }
  .gauge-wrap svg { width: 100%; height: 100%; transform: rotate(-90deg); }
  .gauge-bg { fill: none; stroke: #1e1e35; stroke-width: 7; }
  .gauge-ring { fill: none; stroke-width: 7; stroke-linecap: round; stroke-dasharray: 163; stroke-dashoffset: 163; transition: stroke-dashoffset 1.2s ease-out, stroke 0.3s; }
  .gauge-label {
    position: absolute; inset: 0;
    display: flex; flex-direction: column;
    align-items: center; justify-content: center;
  }
  .gauge-num { font-size: 20px; font-weight: 800; line-height: 1; }
  .gauge-sub { font-size: 8px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.06em; margin-top: 1px; }

  .verdict-info { flex: 1; min-width: 0; }
  .verdict-badge {
    display: inline-flex;
    padding: 3px 10px;
    border-radius: 20px;
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    border: 1px solid;
    margin-bottom: 6px;
  }
  .reasoning {
    font-size: 11px;
    color: #9ca3af;
    line-height: 1.5;
    display: -webkit-box;
    -webkit-line-clamp: 4;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  /* Indicators */
  .section-label {
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: #6b7280;
    margin-bottom: 5px;
  }
  .ind-list { display: flex; flex-direction: column; gap: 4px; }
  .ind {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    padding: 8px 10px;
    border-radius: 7px;
    border: 1px solid;
  }
  .ind-icon { font-size: 11px; flex-shrink: 0; margin-top: 1px; }
  .ind-type { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; }
  .ind-detail { font-size: 11px; color: #9ca3af; margin-top: 2px; line-height: 1.4; }

  .sev-critical { background: rgba(239,68,68,0.08);  border-color: rgba(239,68,68,0.2); }
  .sev-high     { background: rgba(249,115,22,0.08); border-color: rgba(249,115,22,0.2); }
  .sev-medium   { background: rgba(234,179,8,0.08);  border-color: rgba(234,179,8,0.2); }
  .sev-low      { background: rgba(59,130,246,0.08); border-color: rgba(59,130,246,0.2); }

  /* Sender */
  .sender-row {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 11px;
    color: #6b7280;
    padding: 8px 10px;
    background: #111122;
    border: 1px solid #1e1e35;
    border-radius: 7px;
  }
  .sender-domain { font-family: monospace; color: #9ca3af; }

  /* Footer */
  .panel-footer {
    padding: 10px 14px;
    border-top: 1px solid #1e1e35;
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-shrink: 0;
    background: #111122;
  }
  .panel-footer a { font-size: 10px; color: #6b7280; text-decoration: none; }
  .panel-footer a:hover { color: #f97316; }
</style>

<!-- Tab (always visible) -->
<div id="tab">
  <svg id="tab-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
    <path d="M12 2L3 7v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7l-9-5z"/>
    <path d="M9 12l2 2 4-4" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>
  <span id="tab-label">Triage</span>
  <span id="tab-arrow">‹</span>
</div>

<!-- Sliding panel -->
<div id="panel">

  <div class="hd">
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#f97316" stroke-width="1.8">
      <path d="M12 2L3 7v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7l-9-5z"/>
      <path d="M9 12l2 2 4-4" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
    <span class="hd-title">Threat<span>Triage</span></span>
    <div class="hd-badge"><div class="dot"></div>Workers AI</div>
  </div>

  <div class="scroll">
    <div id="auto-badge" class="auto-badge">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
      Email auto-detected
    </div>

    <textarea id="email-input" placeholder="Paste email here…&#10;&#10;Or open an email in Gmail / Outlook and it will be extracted automatically."></textarea>

    <div class="actions">
      <button class="btn-analyze" id="analyze-btn">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
        Analyze Threat
      </button>
      <button class="btn-clear" id="clear-btn">Clear</button>
    </div>

    <div class="scanning" id="scanning">
      <div class="spinner"></div>
      <span class="scanning-text">Running AI analysis…</span>
    </div>

    <div class="error-box" id="error-box"></div>

    <div class="results" id="results">
      <div class="verdict-row">
        <div class="gauge-wrap">
          <svg viewBox="0 0 52 52">
            <circle class="gauge-bg" cx="26" cy="26" r="26"/>
            <circle id="gauge-ring" class="gauge-ring" cx="26" cy="26" r="26"/>
          </svg>
          <div class="gauge-label">
            <span id="gauge-num" class="gauge-num">0</span>
            <span class="gauge-sub">threat</span>
          </div>
        </div>
        <div class="verdict-info">
          <div id="verdict-badge" class="verdict-badge"></div>
          <div id="reasoning" class="reasoning"></div>
        </div>
      </div>

      <div id="ind-section">
        <div class="section-label">Threat Indicators</div>
        <div class="ind-list" id="ind-list"></div>
      </div>

      <div class="sender-row" id="sender-row" style="display:none">
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#6b7280" stroke-width="2"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>
        Sender: <span id="sender-domain" class="sender-domain"></span>
      </div>
    </div>
  </div>

  <div class="panel-footer">
    <a href="https://threat-triage.suryanshsinghrawat.workers.dev" target="_blank">Open full app ↗</a>
    <a href="https://github.com/xsuryanshx/cf-threat-triage" target="_blank">GitHub ↗</a>
  </div>
</div>
  `;
}

// ── Wire up interactions ──────────────────────────────────────────────────────
function wireUp(shadow, host) {
  const panel      = shadow.getElementById('panel');
  const tabEl      = shadow.getElementById('tab');
  const tabArrow   = shadow.getElementById('tab-arrow');
  const emailInput = shadow.getElementById('email-input');
  const analyzeBtn = shadow.getElementById('analyze-btn');
  const clearBtn   = shadow.getElementById('clear-btn');
  const scanning   = shadow.getElementById('scanning');
  const resultsEl  = shadow.getElementById('results');
  const errorBox   = shadow.getElementById('error-box');
  const autoBadge  = shadow.getElementById('auto-badge');
  const gaugeRing  = shadow.getElementById('gauge-ring');
  const gaugeNum   = shadow.getElementById('gauge-num');
  const verdictBadge = shadow.getElementById('verdict-badge');
  const reasoningEl  = shadow.getElementById('reasoning');
  const indSection   = shadow.getElementById('ind-section');
  const indList      = shadow.getElementById('ind-list');
  const senderRow    = shadow.getElementById('sender-row');
  const senderDomain = shadow.getElementById('sender-domain');

  let isOpen = false;

  // ── Toggle ────────────────────────────────────────────────────────────────
  function open() {
    isOpen = true;
    panel.classList.add('open');
    tabEl.classList.add('open');   // slides tab left to sit at panel edge
    tabArrow.textContent = '›';
    tryAutoExtract();
  }

  function close() {
    isOpen = false;
    panel.classList.remove('open');
    tabEl.classList.remove('open'); // slides tab back to right edge
    tabArrow.textContent = '‹';
  }

  window.__ttToggle = () => isOpen ? close() : open();
  tabEl.addEventListener('click', () => isOpen ? close() : open());

  // Close on Escape
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && isOpen) close();
  });

  // ── Auto-extract ──────────────────────────────────────────────────────────
  function tryAutoExtract() {
    const host = location.hostname;
    let emailText = null;

    if (host === 'mail.google.com') {
      emailText = extractGmail();
    } else if (host.includes('outlook')) {
      emailText = extractOutlook();
    }

    if (emailText) {
      emailInput.value = emailText;
      autoBadge.style.display = 'flex';
    }
  }

  function extractGmail() {
    const subject   = document.querySelector('h2.hP')?.innerText?.trim() ?? '';
    const senderName  = document.querySelector('.gD')?.getAttribute('name') ?? '';
    const senderEmail = document.querySelector('.gD')?.getAttribute('email') ?? '';
    const from = senderName
      ? `From: ${senderName} <${senderEmail}>`
      : senderEmail ? `From: ${senderEmail}` : '';
    const bodyEl = document.querySelector('.a3s.aiL') ?? document.querySelector('.ii.gt');
    const body = bodyEl?.innerText?.trim() ?? '';
    if (!body) return null;
    return [from, subject ? `Subject: ${subject}` : '', '', body].filter(Boolean).join('\n');
  }

  function extractOutlook() {
    const subject = document.querySelector('[data-testid="subject"]')?.innerText?.trim() ?? '';
    const senderEl = document.querySelector('[data-testid="senderName"]');
    const from = senderEl ? `From: ${senderEl.innerText.trim()}` : '';
    const bodyEl = document.querySelector('[data-testid="message-body"]')
      ?? document.querySelector('.ReadingPaneContent');
    const body = bodyEl?.innerText?.trim() ?? '';
    if (!body) return null;
    return [from, subject ? `Subject: ${subject}` : '', '', body].filter(Boolean).join('\n');
  }

  // ── Clear ─────────────────────────────────────────────────────────────────
  clearBtn.addEventListener('click', () => {
    emailInput.value = '';
    autoBadge.style.display = 'none';
    resultsEl.style.display = 'none';
    errorBox.style.display = 'none';
    emailInput.focus();
  });

  // ── Analyze ───────────────────────────────────────────────────────────────
  analyzeBtn.addEventListener('click', analyze);
  emailInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) analyze();
  });

  async function analyze() {
    const text = emailInput.value.trim();
    if (text.length < 10) { showError('Paste at least 10 characters of email text.'); return; }

    analyzeBtn.disabled = true;
    scanning.style.display = 'flex';
    resultsEl.style.display = 'none';
    errorBox.style.display = 'none';

    try {
      // Route through background service worker to bypass host-page CSP
      let result;
      try {
        result = await chrome.runtime.sendMessage({ type: 'ANALYZE', emailText: text });
      } catch (msgErr) {
        // Background not responding — fall back to direct fetch (works on non-CSP pages)
        const res = await fetch('https://threat-triage.suryanshsinghrawat.workers.dev/api/analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ emailText: text }),
        });
        const data = await res.json();
        result = { ok: res.ok, data };
      }
      if (!result?.ok) { showError(result?.data?.error ?? 'Analysis failed.'); return; }
      renderResults(result.data);
    } catch (e) {
      showError('Error: ' + (e?.message ?? 'unknown. Check the extension console.'));
    } finally {
      analyzeBtn.disabled = false;
      scanning.style.display = 'none';
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────
  const VSTYLE = {
    Safe:       { color: '#22c55e', bg: 'rgba(34,197,94,0.1)',  border: 'rgba(34,197,94,0.3)'  },
    Suspicious: { color: '#eab308', bg: 'rgba(234,179,8,0.1)',  border: 'rgba(234,179,8,0.3)'  },
    Phishing:   { color: '#ef4444', bg: 'rgba(239,68,68,0.1)',  border: 'rgba(239,68,68,0.3)'  },
  };
  const SEV = {
    critical: { cls: 'sev-critical', icon: '🔴', color: '#ef4444' },
    high:     { cls: 'sev-high',     icon: '🟠', color: '#f97316' },
    medium:   { cls: 'sev-medium',   icon: '🟡', color: '#eab308' },
    low:      { cls: 'sev-low',      icon: '🔵', color: '#3b82f6' },
  };

  function renderResults(data) {
    const vs = VSTYLE[data.verdict] ?? VSTYLE.Suspicious;
    const confidence = data.confidence ?? 50;

    // Gauge (r=26, circ≈163.4)
    gaugeRing.style.stroke = vs.color;
    gaugeRing.style.strokeDashoffset = 163.4 - (163.4 * confidence / 100);
    gaugeNum.textContent = confidence;
    gaugeNum.style.color = vs.color;

    // Badge
    verdictBadge.textContent = data.verdict;
    verdictBadge.style.color = vs.color;
    verdictBadge.style.background = vs.bg;
    verdictBadge.style.borderColor = vs.border;

    reasoningEl.textContent = data.reasoning ?? '';

    // Indicators
    indList.replaceChildren();
    (data.indicators ?? []).slice(0, 5).forEach(ind => {
      const s = SEV[ind.severity] ?? SEV.medium;
      const row = document.createElement('div');
      row.className = `ind ${s.cls}`;

      const icon = document.createElement('span');
      icon.className = 'ind-icon';
      icon.textContent = s.icon;

      const wrap = document.createElement('div');
      const typeEl = document.createElement('div');
      typeEl.className = 'ind-type';
      typeEl.style.color = s.color;
      typeEl.textContent = ind.type.replace(/_/g, ' ');

      const det = document.createElement('div');
      det.className = 'ind-detail';
      det.textContent = ind.detail;

      wrap.appendChild(typeEl);
      wrap.appendChild(det);
      row.appendChild(icon);
      row.appendChild(wrap);
      indList.appendChild(row);
    });

    if (data.senderDomain) {
      senderDomain.textContent = data.senderDomain;
      senderRow.style.display = 'flex';
    } else {
      senderRow.style.display = 'none';
    }

    resultsEl.style.display = 'flex';
  }

  function showError(msg) {
    errorBox.textContent = msg;
    errorBox.style.display = 'block';
  }
}

// ── Toggle from background message ───────────────────────────────────────────
function toggle() {
  if (window.__ttToggle) window.__ttToggle();
}
