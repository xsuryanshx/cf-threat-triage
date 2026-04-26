/**
 * Extracts URLs from email text for pre-analysis context.
 */
export function extractUrls(text: string): string[] {
  const urlRegex = /https?:\/\/[^\s<>"')\]]+/gi;
  const matches = text.match(urlRegex) || [];
  return [...new Set(matches)].slice(0, 20); // dedupe, cap at 20
}

/**
 * Checks for common phishing URL patterns.
 */
export function analyzeUrls(urls: string[]): { url: string; suspicious: boolean; reason?: string }[] {
  return urls.map((url) => {
    try {
      const parsed = new URL(url);
      const host = parsed.hostname.toLowerCase();

      // IP address as hostname
      if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) {
        return { url, suspicious: true, reason: 'IP address used as hostname' };
      }

      // Excessive subdomains (more than 3 levels)
      if (host.split('.').length > 4) {
        return { url, suspicious: true, reason: 'Excessive subdomains' };
      }

      // Known brand typosquatting patterns
      const typos = ['paypa1', 'g00gle', 'micr0soft', 'amaz0n', 'faceb00k', 'app1e', 'netf1ix'];
      if (typos.some((t) => host.includes(t))) {
        return { url, suspicious: true, reason: 'Possible typosquatting domain' };
      }

      // URL contains @ (credential harvesting trick)
      if (url.includes('@')) {
        return { url, suspicious: true, reason: 'URL contains @ symbol (redirect trick)' };
      }

      // Unusually long URL
      if (url.length > 200) {
        return { url, suspicious: true, reason: 'Unusually long URL' };
      }

      return { url, suspicious: false };
    } catch {
      return { url, suspicious: true, reason: 'Malformed URL' };
    }
  });
}
