import { normalizeText } from './normalize-text.util';

describe('normalizeText', () => {
  it('collapses multiple internal spaces and trims edges', () => {
    expect(normalizeText('  hello   world  ')).toBe('hello world');
  });

  it('preserves a single space between words', () => {
    expect(normalizeText('hello world')).toBe('hello world');
  });

  it('trims leading and trailing whitespace', () => {
    expect(normalizeText('  trimmed  ')).toBe('trimmed');
  });
});
