const A_SHARE_PATTERN = /^(SH|SZ|BJ)\.\d{4,6}$/;
const HK_PATTERN = /^HK\.\d{1,5}$/;
const US_PATTERN = /^US\.[A-Z0-9]+(?:[.-][A-Z0-9]+)*$/;

/** 与后端一致的统一证券标识规范化。 */
export function normalizeCanonicalSymbol(symbol: string): string {
  const normalized = symbol.trim().toUpperCase();
  if (A_SHARE_PATTERN.test(normalized)) return normalized;
  if (HK_PATTERN.test(normalized)) {
    const code = normalized.slice(3);
    const numericCode = Number(code);
    if (!Number.isInteger(numericCode) || numericCode <= 0) throw invalidSymbol(symbol);
    return `HK.${code.padStart(5, '0')}`;
  }
  if (US_PATTERN.test(normalized) && normalized.slice(3).length <= 16) return normalized;
  throw invalidSymbol(symbol);
}

export function parseCanonicalSymbols(input: string, maxSymbols = 500): string[] {
  const rawSymbols = input.split(/[,\n\s]+/).map((item) => item.trim()).filter(Boolean);
  if (rawSymbols.length === 0) throw new Error('请输入至少一个证券代码');
  const uniqueSymbols = Array.from(new Set(rawSymbols.map(normalizeCanonicalSymbol)));
  if (uniqueSymbols.length > maxSymbols) throw new Error(`单次最多支持 ${maxSymbols} 个证券代码`);
  return uniqueSymbols;
}

function invalidSymbol(symbol: string): Error {
  return new Error(`证券代码格式不合法：${symbol || '空值'}。示例：SH.600519 / HK.02498 / US.AAPL`);
}
