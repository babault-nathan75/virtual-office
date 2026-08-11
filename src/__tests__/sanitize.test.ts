import { describe, it, expect } from 'vitest';
import { escapeHtml, sanitizeInput } from '@/lib/sanitize';

describe('escapeHtml', () => {
  it('escapes ampersand', () => {
    expect(escapeHtml('a & b')).toBe('a &amp; b');
  });

  it('escapes angle brackets', () => {
    expect(escapeHtml('<script>')).toBe('&lt;script&gt;');
  });

  it('escapes quotes', () => {
    expect(escapeHtml('"hello"')).toBe('&quot;hello&quot;');
  });

  it('escapes single quotes', () => {
    expect(escapeHtml("it's")).toBe('it&#x27;s');
  });

  it('handles empty string', () => {
    expect(escapeHtml('')).toBe('');
  });

  it('escapes multiple characters', () => {
    expect(escapeHtml('<b>"test"</b>')).toBe('&lt;b&gt;&quot;test&quot;&lt;/b&gt;');
  });
});

describe('sanitizeInput', () => {
  it('trims whitespace', () => {
    expect(sanitizeInput('  hello  ')).toBe('hello');
  });

  it('escapes HTML tags', () => {
    expect(sanitizeInput('<img src=x onerror=alert(1)>')).toBe('&lt;img src=x onerror=alert(1)&gt;');
  });

  it('escapes quotes', () => {
    expect(sanitizeInput('a "b" c')).toBe('a &quot;b&quot; c');
  });

  it('handles clean text', () => {
    expect(sanitizeInput('Hello World')).toBe('Hello World');
  });

  it('handles empty string', () => {
    expect(sanitizeInput('')).toBe('');
  });
});
