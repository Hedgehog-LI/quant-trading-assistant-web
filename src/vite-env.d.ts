/// <reference types="vite/client" />

interface ImportMetaEnv {
  /**
   * 默认数据模式（构建期注入，见根目录 .env / .env.production）。
   *
   * - 'mock'：localStorage，本地开发 / 离线兜底（开发默认）。
   * - 'remote'：核心业务数据走后端 REST API → DB（生产默认）。
   *
   * 未设置或非法值在 settingsApi.resolveDefaultApiMode 内统一收敛为 'mock'。
   */
  readonly VITE_DEFAULT_API_MODE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
