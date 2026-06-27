/**
 * 后端统一 API 响应类型。
 * 与后端 ApiResponse<T> 结构对齐。
 */
export interface ApiResponse<T> {
  success: boolean;
  code: string;
  message: string | null;
  /** 后端使用 NON_NULL 序列化，空数据时字段可能省略。 */
  data?: T | null;
  timestamp: string;
}
