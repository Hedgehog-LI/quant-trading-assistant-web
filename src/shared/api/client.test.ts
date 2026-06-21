import { describe, it, expect, beforeEach } from 'vitest';
import { buildApiBaseUrl } from './client';

beforeEach(() => {
  localStorage.clear();
});

function setSettings(apiBaseUrl: string | undefined): void {
  localStorage.setItem('qta:settings', JSON.stringify({ apiBaseUrl }));
}

describe('buildApiBaseUrl', () => {
  it('apiBaseUrl 非空时拼接为绝对地址，末尾自动补 /api/v1', () => {
    setSettings('http://localhost:8080');
    expect(buildApiBaseUrl()).toBe('http://localhost:8080/api/v1');
  });

  it('apiBaseUrl 带一个尾斜杠时去除后再拼接', () => {
    setSettings('http://localhost:8080/');
    expect(buildApiBaseUrl()).toBe('http://localhost:8080/api/v1');
  });

  it('apiBaseUrl 带多个尾斜杠时全部去除', () => {
    setSettings('http://localhost:8080//');
    expect(buildApiBaseUrl()).toBe('http://localhost:8080/api/v1');
  });

  it('apiBaseUrl 带子路径时保留子路径', () => {
    setSettings('http://192.168.1.10:8080/quant');
    expect(buildApiBaseUrl()).toBe('http://192.168.1.10:8080/quant/api/v1');
  });

  it('apiBaseUrl 为空字符串时走同源 /api/v1', () => {
    setSettings('');
    expect(buildApiBaseUrl()).toBe('/api/v1');
  });

  it('apiBaseUrl 为纯空白时走同源', () => {
    setSettings('   ');
    expect(buildApiBaseUrl()).toBe('/api/v1');
  });

  it('未配置 settings 时走同源', () => {
    expect(buildApiBaseUrl()).toBe('/api/v1');
  });

  it('settings 非 JSON 或损坏时走同源（getItem 容错返回 null）', () => {
    localStorage.setItem('qta:settings', 'not-json');
    expect(buildApiBaseUrl()).toBe('/api/v1');
  });
});
