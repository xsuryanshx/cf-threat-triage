const API = 'https://threat-triage.suryanshsinghrawat.workers.dev/api/analyze';

const VERDICT_STYLE = {
  Safe:       { color: '#22c55e', bg: 'rgba(34,197,94,0.1)',   border: 'rgba(34,197,94,0.3)'  },
  Suspicious: { color: '#eab308', bg: 'rgba(234,179,8,0.1)',   border: 'rgba(234,179,8,0.3)'  },
  Phishing:   { color: '#ef4444', bg: 'rgba(239,68,68,0.1)',   border: 'rgba(239,68,68,0.3)'  },
};

const SEV_CLASS = {
  critical: 'sev-critical',
  high:     'sev-high',
  medium:   'sev-medium',
  low:      'sev-low',
};

const SEV_ICON = {
  critical: '🔴',
  high:     '🟠',
  medium:   '🟡',
  low:      '🔵',
};

const SEV_COLOR = {
  critical: '#ef4444',
  high:     '#f97316',
  medium:   '#eab308',
  low:      '#3b82f6',
};

// ── DOM refs ────────────────────────────────────────────────────────────────
const emailInput    = document.getElementById('email-input');
const analyzeBtn    = document.getElementById('analyze-btn');
const clearBtn      = document.getElementById('clear-btn');
const scanningEl    = document.getElementById('scanning');
const resultsEl     = document.getElementById('results');
const errorBox      = document.getElementById('error-box');
const autoBadge     = document.getElementById('auto-badge');
const gaugeRing     = document.getElementById('gauge-ring');
const gaugeNum      = document.getElementById('gauge-num');
const verdictBadge  = document.getElementById('verdict-badge');
const reasoningEl   = document.getElementById('reasoning');
const indicatorsWrap = document.getElementById('indicators-wrap');
const indicatorList = document.getElementById('indicator-list');
const senderRow     = document.getElementById('sender-row');
const senderDomain  = document.getElementById('sender-domain');

// ── Auto-extract email from active tab ─────────────────────────────────────
async function tryAutoExtract() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) return;

    const url = tab.url ?? '';
    const isMailPage = url.includes('mail.google.com') || url.includes('outlook');
    if (!isMailPage) return;

    const response = await chrome.tabs.sendMessage(tab.id, { type: 'GET_EMAIL' });
    if (response?.emailText) {
      emailInput.value = response.emailText;
      autoBadge.style.display = 'flex';
    }
  } catch {
    // Not on a mail page or content script not ready — silent fail
  }
}

// ── Clear ───────────────────────────────────────────────────────────────────
clearBtn.addEventListener('click', () => {
  emailInput.value = '';
  autoBadge.style.display = 'none';
  resultsEl.style.display = 'none';
  errorBox.style.display = 'none';
  scanningEl.style.display = 'none';
  emailInput.focus();
});

// ── Analyze ─────────────────────────────────────────────────────────────────
analyzeBtn.addEventListener('click', analyze);
emailInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) analyze();
});

async function analyze() {
  const emailText = emailInput.value.trim();
  if (emailText.length < 10) {
    showError('Please paste at least 10 characters of email text.');
    return;
  }

  setLoading(true);
  hideError();
  resultsEl.style.display = 'none';

  try {
    const res = await fetch(API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ emailText }),
    });

    const data = await res.json();
    if (!res.ok) {
      showError(data.error ?? 'Analysis failed. Please try again.');
      return;
    }

    renderResults(data);
  } catch {
    showError('Network error — check your connection.');
  } finally {
    setLoading(false);
  }
}

// ── Render ──────────────────────────────────────────────────────────────────
function renderResults(data) {
  const confidence = data.confidence ?? 50;
  const vs = VERDICT_STYLE[data.verdict] ?? VERDICT_STYLE.Suspicious;

  // Gauge — circumference for r=26 is ~163.4
  const circ = 163.4;
  const offset = circ - (circ * confidence / 100);
  gaugeRing.style.stroke = vs.color;
  gaugeRing.style.strokeDashoffset = offset;

  gaugeNum.textContent = confidence;
  gaugeNum.style.color = vs.color;

  // Verdict badge
  verdictBadge.textContent = data.verdict;
  verdictBadge.style.color = vs.color;
  verdictBadge.style.background = vs.bg;
  verdictBadge.style.borderColor = vs.border;

  // Reasoning
  reasoningEl.textContent = data.reasoning ?? '';

  // Indicators
  indicatorList.replaceChildren();
  const indicators = data.indicators ?? [];
  if (indicators.length > 0) {
    indicators.slice(0, 4).forEach(ind => {
      const sev = ind.severity ?? 'medium';
      const row = document.createElement('div');
      row.className = `indicator ${SEV_CLASS[sev] ?? 'sev-medium'}`;

      const icon = document.createElement('span');
      icon.className = 'indicator-icon';
      icon.textContent = SEV_ICON[sev] ?? '🟡';

      const content = document.createElement('div');
      const typeEl = document.createElement('div');
      typeEl.className = 'indicator-type';
      typeEl.style.color = SEV_COLOR[sev] ?? '#eab308';
      typeEl.textContent = ind.type.replace(/_/g, ' ');

      const detailEl = document.createElement('div');
      detailEl.className = 'indicator-detail';
      detailEl.textContent = ind.detail;

      content.appendChild(typeEl);
      content.appendChild(detailEl);
      row.appendChild(icon);
      row.appendChild(content);
      indicatorList.appendChild(row);
    });
    indicatorsWrap.style.display = 'block';
  } else {
    indicatorsWrap.style.display = 'none';
  }

  // Sender
  if (data.senderDomain) {
    senderDomain.textContent = data.senderDomain;
    senderRow.style.display = 'flex';
  } else {
    senderRow.style.display = 'none';
  }

  resultsEl.style.display = 'block';
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function setLoading(on) {
  analyzeBtn.disabled = on;
  scanningEl.style.display = on ? 'flex' : 'none';
}

function showError(msg) {
  errorBox.textContent = msg;
  errorBox.style.display = 'block';
}

function hideError() {
  errorBox.style.display = 'none';
}

// ── Init ─────────────────────────────────────────────────────────────────────
tryAutoExtract();
