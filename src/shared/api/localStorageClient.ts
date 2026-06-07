/**
 * 统一 localStorage 访问。
 * 所有业务代码必须通过本模块读写 localStorage，禁止直接调用 window.localStorage。
 */

const PREFIX = 'qta:';

function fullKey(key: string): string {
  return `${PREFIX}${key}`;
}

/** 读取并反序列化，不存在或解析失败返回 null */
export function getItem<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(fullKey(key));
    if (raw === null) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

/** 序列化并写入 */
export function setItem<T>(key: string, value: T): void {
  localStorage.setItem(fullKey(key), JSON.stringify(value));
}

/** 删除单个 key */
export function removeItem(key: string): void {
  localStorage.removeItem(fullKey(key));
}

/** 获取所有业务 key（不含前缀） */
export function getAllKeys(): string[] {
  const keys: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k?.startsWith(PREFIX)) {
      keys.push(k.slice(PREFIX.length));
    }
  }
  return keys;
}

/** 清空所有 qta: 前缀的数据 */
export function clearAll(): void {
  getAllKeys().forEach((key) => removeItem(key));
}

/** 导出所有业务数据（带完整前缀 key） */
export function exportAll(): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k?.startsWith(PREFIX)) {
      const raw = localStorage.getItem(k);
      if (raw !== null) {
        try {
          result[k] = JSON.parse(raw);
        } catch {
          result[k] = raw;
        }
      }
    }
  }
  return result;
}

/** 导入数据覆盖（接受带前缀的 key） */
export function importAll(data: Record<string, unknown>): void {
  Object.entries(data).forEach(([key, value]) => {
    if (key.startsWith(PREFIX)) {
      localStorage.setItem(key, JSON.stringify(value));
    }
  });
}
