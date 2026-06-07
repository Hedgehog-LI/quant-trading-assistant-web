/**
 * 后端统一 API 响应类型。
 * 与后端 ApiResponse<T> 结构对齐。
 */
export interface ApiResponse<T> {
  success: boolean;
  code: string;
  message: string | null;
  data: T | null;
  timestamp: string;
}
