import { describe, expect, it } from 'vitest';
import { normalizeCanonicalSymbol, parseCanonicalSymbols } from './canonicalSymbol';

describe('canonicalSymbol', () => {
  it('规范化 A 股、港股和美股代码', () => {
    expect(normalizeCanonicalSymbol(' sh.600519 ')).toBe('SH.600519');
    expect(normalizeCanonicalSymbol('hk.2498')).toBe('HK.02498');
    expect(normalizeCanonicalSymbol('us.aapl')).toBe('US.AAPL');
    expect(normalizeCanonicalSymbol('US.BRK.B')).toBe('US.BRK.B');
  });

  it('解析时规范化并去重', () => {
    expect(parseCanonicalSymbols('HK.2498, hk.02498\nUS.aapl')).toEqual(['HK.02498', 'US.AAPL']);
  });

  it('拒绝非法代码', () => {
    expect(() => normalizeCanonicalSymbol('HK.00000')).toThrow();
    expect(() => normalizeCanonicalSymbol('US.AAPL/WS')).toThrow();
  });
});
