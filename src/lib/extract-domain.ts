/**
 * Extracts the sender's domain from raw email text.
 * Tries the From: header first, then falls back to any email address in the text.
 * Returns null if no email address is found.
 */
export function extractSenderDomain(emailText: string): string | null {
  // Match "From: Name <user@domain.com>" or "From: user@domain.com"
  const fromMatch = emailText.match(
    /^From:.*?[\s<]([a-zA-Z0-9._%+-]+@([a-zA-Z0-9.-]+\.[a-zA-Z]{2,}))/im
  );
  if (fromMatch) return fromMatch[2].toLowerCase();

  // Fallback: first email address anywhere in the text
  const emailMatch = emailText.match(/[a-zA-Z0-9._%+-]+@([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
  if (emailMatch) return emailMatch[1].toLowerCase();

  return null;
}
