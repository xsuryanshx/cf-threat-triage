import { describe, it, expect } from 'vitest';
import { extractSenderDomain } from '../src/lib/extract-domain';

describe('extractSenderDomain', () => {
  it('extracts domain from "From: Name <user@evil.example.com>" header', () => {
    const email = 'From: John Doe <john@evil.example.com>\nSubject: Test';
    expect(extractSenderDomain(email)).toBe('evil.example.com');
  });

  it('extracts domain from bare "From: user@phishing.net" header', () => {
    const email = 'From: attacker@phishing.net\nSubject: Urgent';
    expect(extractSenderDomain(email)).toBe('phishing.net');
  });

  it('falls back to first email address in body if no From header', () => {
    const email = 'Click here to verify: support@scam.io/verify';
    expect(extractSenderDomain(email)).toBe('scam.io');
  });

  it('returns null when no email address found', () => {
    const email = 'This is just plain text with no email addresses.';
    expect(extractSenderDomain(email)).toBeNull();
  });

  it('lowercases the domain from From header', () => {
    const email = 'From: User@UPPER.COM';
    expect(extractSenderDomain(email)).toBe('upper.com');
  });

  it('lowercases the domain from body fallback', () => {
    const email = 'No headers here. Contact: alert@SCAM.IO for details';
    expect(extractSenderDomain(email)).toBe('scam.io');
  });

  it('handles From: with no space before address', () => {
    const email = 'From:attacker@evil.com\nSubject: Hi';
    expect(extractSenderDomain(email)).toBe('evil.com');
  });
});
