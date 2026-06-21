import axios from 'axios';
import type { InternalAxiosRequestConfig } from 'axios';
import { getItem } from './localStorageClient';
import type { ApiResponse } from './types';

const API_PREFIX = '/api/v1';

/**
 * localStorage 中 settings 的 key（与 features/settings/api/settingsApi 一致）。
 * client 位于 shared 层，仅按需读取 apiBaseUrl 一个字段，避免 shared 反向依赖 features。
 */
const SETTINGS_KEY = 'settings';

interface SettingsApiBaseUrl {
  apiBaseUrl?: string;
}

/**
 * 构建本次请求的 baseURL。
 *
 * - settings.apiBaseUrl 非空：拼接为 `${apiBaseUrl}/api/v1`，直连后端。
 *   例如 `http://localhost:8080` → `http://localhost:8080/api/v1/portfolio/summary`。
 * - settings.apiBaseUrl 为空 / 未配置：返回 `/api/v1`，走同源，
 *   开发期由 vite proxy、生产由 nginx 反代转发到后端（不破坏现有同源部署）。
 *
 * 直接读 localStorage 而非 import features/settings，保持 shared 层不依赖 features；
 * 每次请求现读，用户在设置页切换 apiBaseUrl 后无需刷新页面。
 */
export function buildApiBaseUrl(): string {
  const settings = getItem<SettingsApiBaseUrl>(SETTINGS_KEY);
  const base = settings?.apiBaseUrl?.trim();
  if (!base) {
    return API_PREFIX;
  }
  return `${base.replace(/\/+$/, '')}${API_PREFIX}`;
}

/**
 * Axios 实例：统一 timeout、headers、响应日志。
 *
 * baseURL 不在创建时固定，而是在请求拦截器中按 settings 动态计算（见 buildApiBaseUrl），
 * 这样设置页修改后端地址可即时生效。
 */
const client = axios.create({
  timeout: 15_000,
  headers: { 'Content-Type': 'application/json' },
});

// 请求拦截：每次请求按最新 settings 计算 baseURL。
client.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  config.baseURL = buildApiBaseUrl();
  return config;
});

// 响应拦截：业务错误统一日志（解包由各 feature 的 unwrap 完成）。
client.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error('[API Error]', error?.response?.data ?? error.message);
    return Promise.reject(error);
  },
);

export { client };
export type { ApiResponse };
