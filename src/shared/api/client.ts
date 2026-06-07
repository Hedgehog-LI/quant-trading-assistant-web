import axios from 'axios';
import type { ApiResponse } from './types';

/**
 * Axios 实例，统一配置基础路径和响应拦截。
 */
const client = axios.create({
  baseURL: '/api/v1',
  timeout: 15_000,
  headers: { 'Content-Type': 'application/json' },
});

// 响应拦截：自动解包 ApiResponse
client.interceptors.response.use(
  (response) => response,
  (error) => {
    // 后端返回的业务错误也有统一结构，此处仅做日志
    console.error('[API Error]', error?.response?.data ?? error.message);
    return Promise.reject(error);
  },
);

export { client };
export type { ApiResponse };
