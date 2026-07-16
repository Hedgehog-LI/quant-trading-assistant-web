import { describe, expect, it, beforeEach, vi } from 'vitest';
import { saveSettings } from '../../settings/api/settingsApi';
import { clearAll } from '../../../shared/api/localStorageClient';
import { client } from '../../../shared/api/client';
import {
  getWorkbenchOverview, getTradingSessions, isTradingDay, createSyncPlan,
  listTaskItems, reconcileTask,
} from './workbenchApi';

describe('workbenchApi mock', () => {
  beforeEach(() => {
    clearAll();
    saveSettings({ apiMode: 'mock', apiBaseUrl: '' });
  });

  describe('overview', () => {
    it('returns overview with trading sessions', async () => {
      const overview = await getWorkbenchOverview();
      expect(overview.totalSymbols).toBe(0);
      expect(overview.unresolvedHighAlerts).toBe(0);
      expect(overview.tradingSessions).toBeDefined();
      expect(overview.tradingSessions!.length).toBeGreaterThan(0);
    });

    it('trading sessions include AM and PM', async () => {
      const sessions = await getTradingSessions();
      expect(sessions.some((s) => s.sessionType === 'AM')).toBe(true);
      expect(sessions.some((s) => s.sessionType === 'PM')).toBe(true);
    });
  });

  describe('isTradingDay', () => {
    it('weekday is trading day', async () => {
      expect(await isTradingDay('CN_A', '2026-07-10')).toBe(true);
    });

    it('weekend is not trading day', async () => {
      expect(await isTradingDay('CN_A', '2026-07-11')).toBe(false);
    });
  });

  describe('createSyncPlan', () => {
    it('creates plan with defaults', async () => {
      const plan = await createSyncPlan({
        planName: '茅台30M补档',
        taskType: 'MINUTE_BAR_BACKFILL',
        provider: 'LONGPORT',
        scopeJson: '{"symbols":["SH.600519"]}',
        intervalType: '30M',
      });
      expect(plan.planName).toBe('茅台30M补档');
      expect(plan.enabled).toBe(true);
      expect(plan.adjustType).toBe('NONE');
      expect(plan.triggerType).toBe('MANUAL');
    });
  });
});

describe('workbenchApi remote task items', () => {
  beforeEach(() => {
    clearAll();
    saveSettings({ apiMode: 'remote', apiBaseUrl: '' });
  });

  it('listTaskItems calls GET /sync-tasks/{taskId}/items with params', async () => {
    const mockGet = vi.spyOn(client, 'get').mockResolvedValueOnce({
      data: { success: true, code: 'SUCCESS', data: { items: [], total: 0, page: 1, size: 20 } },
    });
    await listTaskItems(42, undefined, 2, 10);
    expect(mockGet).toHaveBeenCalledWith('/market-data/sync-tasks/42/items', { params: { status: undefined, page: 2, size: 10 } });
    mockGet.mockRestore();
  });

  it('reconcileTask calls POST /sync-tasks/{taskId}/reconcile', async () => {
    const mockPost = vi.spyOn(client, 'post').mockResolvedValueOnce({
      data: { success: true, code: 'SUCCESS', data: { id: 42, taskType: 'DAILY_BAR_BACKFILL', provider: 'LONGPORT', scopeJson: '{}', status: 'SUCCEEDED', createdAt: '' } },
    });
    const result = await reconcileTask(42);
    expect(mockPost).toHaveBeenCalledWith('/market-data/sync-tasks/42/reconcile');
    expect(result.status).toBe('SUCCEEDED');
    mockPost.mockRestore();
  });
});
