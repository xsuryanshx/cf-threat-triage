# Demo Recording Script

**Tool:** QuickTime Player → File → New Screen Recording (or Loom)
**Duration:** ~60-90 seconds
**URL:** https://threat-triage.suryanshsinghrawat.workers.dev

---

## Script

### Scene 1 — Landing (5s)
Show the app homepage. Hover over the nav tabs briefly.

### Scene 2 — Paste a phishing email (10s)
Paste this into the textarea:

```
From: security-alert@paypa1-support.com
Subject: Urgent: Your account has been limited

Dear Customer,

We have detected unusual activity on your PayPal account.
Your account has been temporarily limited.

Click here to verify your identity:
http://paypa1-support.com/verify?token=abc123

If you do not verify within 24 hours, your account will be permanently suspended.

PayPal Security Team
```

### Scene 3 — Click "Analyze Threat" (3s)
Show the scanning animation while it processes.

### Scene 4 — Results (20s)
- Slow pan over the threat gauge showing 95
- Show the red "Phishing" badge
- Scroll through the indicator cards (critical/high severity)
- Show the URL section with the red dot on paypa1-support.com

### Scene 5 — Dashboard tab (15s)
Click Dashboard. Show the stat cards and animated bars.

### Scene 6 — History tab (10s)
Click History. Show the triage card. Click to expand reasoning.
Show the filter buttons.

### Scene 7 — Safe email contrast (15s)
Go back to Analyze. Paste:
```
From: alice@company.com
Subject: Q3 Planning

Hi team, please review the Q3 doc and add comments by Friday. Thanks, Alice
```
Click Analyze. Show the green Safe badge with low confidence score.

---

## After Recording

1. Export as MP4
2. Either:
   - Drag into a GitHub Issue comment → copy the CDN URL → paste into README
   - Or commit `demo.mp4` to the repo root
3. Update the README demo section:

```html
<video src="demo.mp4" width="100%" controls autoplay muted loop></video>
```
