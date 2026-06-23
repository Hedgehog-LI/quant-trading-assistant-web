/**
 * 后端 ApiResponse 统一解包器。
 *
 * 所有 feature 的 remote 实现共用，避免每个 api 文件重复定义。
 * - unwrap：有返回体的接口，success=false 或 data=null 视为失败并抛错，返回 data。
 * - unwrapVoid：无返回体的接口（如 DELETE），只检查 success（data 合法为 null）。
 */
import type { ApiResponse } from './types';

export async function unwrap<T>(p: Promise<{ data: ApiResponse<T> }>): Promise<T> {
  const res = await p;
  const body = res.data;
  if (!body.success || body.data == null) {
    throw new Error(body.message ?? '接口返回失败');
  }
  return body.data;
}

export async function unwrapVoid(p: Promise<{ data: ApiResponse<unknown> }>): Promise<void> {
  const res = await p;
  const body = res.data;
  if (!body.success) {
    throw new Error(body.message ?? '接口返回失败');
  }
}
