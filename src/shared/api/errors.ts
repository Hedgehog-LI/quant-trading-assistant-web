import type { ApiResponse } from './types';

/** 前端可判断错误码和 HTTP 状态的统一 API 异常。 */
export class ApiRequestError extends Error {
  readonly code: string;
  readonly httpStatus?: number;

  constructor(
    code: string,
    message: string,
    httpStatus?: number,
  ) {
    super(message);
    this.name = 'ApiRequestError';
    this.code = code;
    this.httpStatus = httpStatus;
  }
}

interface HttpErrorShape {
  message?: string;
  response?: {
    status?: number;
    data?: Partial<ApiResponse<unknown>>;
  };
}

/** 把 Axios/后端业务异常转换为稳定、可读的前端错误。 */
export function normalizeApiError(error: unknown): ApiRequestError {
  if (error instanceof ApiRequestError) return error;
  const source = error as HttpErrorShape;
  const body = source?.response?.data;
  return new ApiRequestError(
    body?.code ?? 'NETWORK_ERROR',
    body?.message ?? source?.message ?? '请求失败，请稍后重试',
    source?.response?.status,
  );
}

export function hasApiErrorCode(error: unknown, code: string): boolean {
  return error instanceof ApiRequestError && error.code === code;
}
