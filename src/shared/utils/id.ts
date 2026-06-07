/** 生成唯一 ID */
export function generateId(): string {
  return crypto.randomUUID();
}
