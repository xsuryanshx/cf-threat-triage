import { describe, it, expect } from 'vitest';
import { extractUrls, analyzeUrls } from '../src/lib/extract-urls';

describe('extractUrls', () => {
  it('extracts http and https URLs', () => {
    const text = 'Visit http://evil.com and https://good.com/path';
    expect(extractUrls(text)).toEqual(['http://evil.com', 'https://good.com/path']);
  });

  it('returns empty array when no URLs found', () => {
    expect(extractUrls('Just plain text')).toEqual([]);
  });

  it('deduplicates URLs', () => {
    const text = 'http://evil.com click http://evil.com again';
    expect(extractUrls(text)).toEqual(['http://evil.com']);
  });

  it('caps at 20 URLs', () => {
    const text = Array.from({ length: 25 }, (_, i) => `http://site${i}.com`).join(' ');
    expect(extractUrls(text)).toHaveLength(20);
  });
});

describe('analyzeUrls', () => {
  it('flags IP address hostnames', () => {
    const result = analyzeUrls(['http://192.168.1.1/login']);
    expect(result[0].suspicious).toBe(true);
    expect(result[0].reason).toContain('IP address');
  });

  it('flags typosquatting patterns', () => {
    const result = analyzeUrls(['http://paypa1-support.com/verify']);
    expect(result[0].suspicious).toBe(true);
    expect(result[0].reason).toContain('typosquatting');
  });

  it('marks clean URLs as not suspicious', () => {
    const result = analyzeUrls(['https://google.com']);
    expect(result[0].suspicious).toBe(false);
  });
});
