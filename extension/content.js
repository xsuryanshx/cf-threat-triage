/**
 * Content script — extracts open email content from Gmail and Outlook Web.
 * Responds to popup messages with { emailText, subject, from }.
 */

function extractGmail() {
  // Subject
  const subject = document.querySelector('h2.hP')?.innerText?.trim() ?? '';

  // Sender — "From: Name <email>" format
  const senderName = document.querySelector('.gD')?.getAttribute('name') ?? '';
  const senderEmail = document.querySelector('.gD')?.getAttribute('email') ?? '';
  const from = senderName
    ? `From: ${senderName} <${senderEmail}>`
    : senderEmail ? `From: ${senderEmail}` : '';

  // Email body — grab the focused/open message
  const bodyEl = document.querySelector('.a3s.aiL') ?? document.querySelector('.ii.gt');
  const body = bodyEl?.innerText?.trim() ?? '';

  if (!body) return null;

  return [from, subject ? `Subject: ${subject}` : '', '', body]
    .filter(Boolean)
    .join('\n');
}

function extractOutlook() {
  // Subject
  const subject = document.querySelector('[data-testid="subject"]')?.innerText?.trim()
    ?? document.querySelector('.allowTextSelection.ms-font-xl')?.innerText?.trim()
    ?? '';

  // Sender
  const senderEl = document.querySelector('[data-testid="senderName"]')
    ?? document.querySelector('.allowTextSelection.ms-font-m-plus');
  const from = senderEl ? `From: ${senderEl.innerText.trim()}` : '';

  // Body
  const bodyEl = document.querySelector('[data-testid="message-body"]')
    ?? document.querySelector('.allowTextSelection [role="document"]')
    ?? document.querySelector('.ReadingPaneContent');
  const body = bodyEl?.innerText?.trim() ?? '';

  if (!body) return null;

  return [from, subject ? `Subject: ${subject}` : '', '', body]
    .filter(Boolean)
    .join('\n');
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type !== 'GET_EMAIL') return;

  const host = location.hostname;
  let emailText = null;

  if (host === 'mail.google.com') {
    emailText = extractGmail();
  } else if (host.includes('outlook')) {
    emailText = extractOutlook();
  }

  sendResponse({ emailText });
});
