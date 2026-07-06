/**
 * Settings localStorage 读写 + 导入导出清空 + v0.1.1 生产连接防呆。
 */
import { getItem, setItem, exportAll, importAll, clearAll } from '../../../shared/api/localStorageClient';
import type { AppSettings } from '../../../shared/types/domain';
import type { ApiResponse } from '../../../shared/api/types';

const SETTINGS_KEY = 'settings';

const LOCALHOST_HOSTS = new Set(['localhost', '127.0.0.1', '::1']);

/**
 * 解析默认数据模式（构建期注入，见 src/vite-env.d.ts / 根目录 .env / .env.production）。
 *
 * - VITE_DEFAULT_API_MODE='remote'：生产部署默认，核心业务数据走后端 REST API → DB。
 * - 其它值 / 未设置：默认 'mock'（localStorage，本地开发 / 离线兜底）。
 *
 * 在 getSettings 内每次解析而非缓存到模块常量：
 * 1. 用户清除 localStorage 后立即按最新默认值恢复；
 * 2. 单测可用 vi.stubEnv 即时切换默认值，无需重新加载模块。
 */
function resolveDefaultApiMode(): AppSettings['apiMode'] {
  return import.meta.env.VITE_DEFAULT_API_MODE === 'remote' ? 'remote' : 'mock';
}

/** 未在 localStorage 配置时的默认设置（apiBaseUrl 留空 = 走同源 /api/v1）。 */
function defaultSettings(): AppSettings {
  return { apiMode: resolveDefaultApiMode(), apiBaseUrl: '' };
}

export function getSettings(): AppSettings {
  return getItem<AppSettings>(SETTINGS_KEY) ?? defaultSettings();
}

export function saveSettings(settings: AppSettings): void {
  setItem(SETTINGS_KEY, settings);
}

export function exportData(): Record<string, unknown> {
  return exportAll();
}

export function importData(data: Record<string, unknown>): void {
  importAll(data);
}

export function clearData(): void {
  clearAll();
}

// ============ v0.1.1 生产连接防呆 ============

/** 判断 host 是否为 localhost 系列。 */
export function isLocalhostHost(hostname: string): boolean {
  return LOCALHOST_HOSTS.has(hostname.toLowerCase());
}

/** 判断任意 URL 字符串的 host 是否指向 localhost（用于防误配）。空字符串视为同源，返回 false。 */
export function isLocalhostUrl(url: string): boolean {
  if (!url) return false;
  try {
    const parsed = new URL(url, window.location.origin);
    return LOCALHOST_HOSTS.has(parsed.hostname.toLowerCase());
  } catch {
    return false;
  }
}

/**
 * 返回当前实际请求地址的可读描述：
 * - apiBaseUrl 留空 -> "/api/v1（同源）"。
 * - apiBaseUrl 非空 -> `${apiBaseUrl}/api/v1`。
 */
export function resolveEffectiveApiBaseUrl(settings?: AppSettings): string {
  const { apiBaseUrl } = settings ?? getSettings();
  const base = apiBaseUrl?.trim();
  if (!base) return '/api/v1（同源）';
  return `${base.replace(/\/+$/, '')}/api/v1`;
}

export type ConnectionTestStatus =
  | 'success'
  | 'timeout'
  | 'http_error'
  | 'business_error'
  | 'network_error';

export interface ConnectionTestResult {
  status: ConnectionTestStatus;
  message: string;
  httpStatus?: number;
}

/**
 * 测试前端 -> Nginx/Vite proxy -> 后端 -> DB 的连通性。
 *
 * 使用一个只读业务接口 GET /dashboard/today 验证整条链路。
 * 直接用 axios 请求"用户输入的目标地址"，不依赖 client 的 settings 读取，
 * 以便在保存前验证尚未生效的地址。
 *
 * 区分 success / timeout / http_error / business_error / network_error。
 */
export async function testBackendConnection(apiBaseUrl: string): Promise<ConnectionTestResult> {
  const base = apiBaseUrl?.trim();
  const effective = base ? `${base.replace(/\/+$/, '')}/api/v1` : '/api/v1';
  const url = `${effective}/dashboard/today`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000);
  try {
    const resp = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });
    const body = (await resp.json().catch(() => null)) as ApiResponse<unknown> | null;
    if (resp.status >= 200 && resp.status < 300 && body?.code === 'SUCCESS') {
      return { status: 'success', message: '连接成功：前端 -> 反代 -> 后端 -> 数据库 链路正常', httpStatus: resp.status };
    }
    if (resp.status >= 200 && resp.status < 300 && body && body.code && body.code !== 'SUCCESS') {
      return { status: 'business_error', message: `后端可达，但返回业务错误码：${body.code}`, httpStatus: resp.status };
    }
    return { status: 'http_error', message: `后端返回 HTTP ${resp.status}`, httpStatus: resp.status };
  } catch (e) {
    const err = e as Error;
    if (err.name === 'AbortError') {
      return { status: 'timeout', message: '请求超时：后端未启动或网络不可达' };
    }
    return { status: 'network_error', message: err.message || '网络错误：无法连接后端地址' };
  } finally {
    clearTimeout(timeoutId);
  }
}
