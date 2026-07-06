import { describe, it, expect } from 'vitest';
import {
  isLocalhostHost,
  isLocalhostUrl,
  resolveEffectiveApiBaseUrl,
} from './settingsApi';
import type { AppSettings } from '../../../shared/types/domain';

describe('生产连接防呆', () => {
  it('识别 localhost 系列 host', () => {
    expect(isLocalhostHost('localhost')).toBe(true);
    expect(isLocalhostHost('127.0.0.1')).toBe(true);
    expect(isLocalhostHost('::1')).toBe(true);
    expect(isLocalhostHost('example.com')).toBe(false);
  });

  it('识别指向 localhost 的后端 URL', () => {
    expect(isLocalhostUrl('http://localhost:8080')).toBe(true);
    expect(isLocalhostUrl('http://127.0.0.1:8080')).toBe(true);
    expect(isLocalhostUrl('https://example.com')).toBe(false);
    expect(isLocalhostUrl('')).toBe(false);
  });

  it('展示当前有效请求地址', () => {
    const remote: AppSettings = { apiMode: 'remote', apiBaseUrl: '' };
    expect(resolveEffectiveApiBaseUrl(remote)).toContain('同源');
    const direct: AppSettings = { apiMode: 'remote', apiBaseUrl: 'http://localhost:8080' };
    expect(resolveEffectiveApiBaseUrl(direct)).toBe('http://localhost:8080/api/v1');
    const trailingSlash: AppSettings = { apiMode: 'remote', apiBaseUrl: 'http://localhost:8080/' };
    expect(resolveEffectiveApiBaseUrl(trailingSlash)).toBe('http://localhost:8080/api/v1');
  });
});
