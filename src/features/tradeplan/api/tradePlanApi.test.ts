import { describe, it, expect, beforeEach } from 'vitest';
import {
  getTradePlans,
  addTradePlan,
  updateTradePlan,
  getTradePlanById,
  updateTradePlanStatus,
} from './tradePlanApi';
import { saveSettings } from '../../settings/api/settingsApi';
import { clearAll } from '../../../shared/api/localStorageClient';

/**
 * 锁定 mock 模式：默认 settings.apiMode 可能为 'remote'，
 * 显式 saveSettings({ apiMode: 'mock', ... }) 确保走 localStorage 分支。
 */
beforeEach(() => {
  clearAll();
  saveSettings({ apiMode: 'mock', apiBaseUrl: '' });
});

describe('tradePlanApi', () => {
  it('新增交易计划', async () => {
    const plan = await addTradePlan({
      planDate: '2026-06-08',
      symbol: '300750',
      name: '宁德时代',
      planStatus: 'DRAFT',
      allowedToTrade: false,
    });
    expect(plan.symbol).toBe('300750');
    expect(plan.planStatus).toBe('DRAFT');
    expect(plan.id).toBeTruthy();
  });

  it('股票代码自动转大写', async () => {
    const plan = await addTradePlan({
      planDate: '2026-06-08',
      symbol: ' 300750 ',
      name: '宁德时代',
      planStatus: 'DRAFT',
      allowedToTrade: false,
    });
    expect(plan.symbol).toBe('300750');
  });

  it('更新交易计划', async () => {
    const plan = await addTradePlan({
      planDate: '2026-06-08',
      symbol: '300750',
      name: '宁德时代',
      planStatus: 'DRAFT',
      allowedToTrade: false,
    });
    const updated = await updateTradePlan(plan.id, {
      planStatus: 'ACTIVE',
      allowedToTrade: true,
      buyCondition: '突破220',
      stopLossPrice: 210,
    });
    expect(updated?.planStatus).toBe('ACTIVE');
    expect(updated?.allowedToTrade).toBe(true);
    expect(updated?.buyCondition).toBe('突破220');
  });

  it('更新不存在的 id 返回 null', async () => {
    const result = await updateTradePlan('non-existent', { planStatus: 'CANCELLED' });
    expect(result).toBeNull();
  });

  it('getTradePlanById 正确查找', async () => {
    const plan = await addTradePlan({
      planDate: '2026-06-08',
      symbol: '300750',
      planStatus: 'DRAFT',
      allowedToTrade: false,
    });
    const found = await getTradePlanById(plan.id);
    expect(found?.symbol).toBe('300750');
  });

  it('getTradePlanById 不存在返回 null', async () => {
    expect(await getTradePlanById('non-existent')).toBeNull();
  });

  it('可添加同一股票不同日期的计划', async () => {
    await addTradePlan({ planDate: '2026-06-08', symbol: '300750', planStatus: 'DRAFT', allowedToTrade: false });
    await addTradePlan({ planDate: '2026-06-09', symbol: '300750', planStatus: 'DRAFT', allowedToTrade: false });
    expect(await getTradePlans()).toHaveLength(2);
  });

  it('updateTradePlanStatus 更新状态', async () => {
    const plan = await addTradePlan({
      planDate: '2026-06-08',
      symbol: '300750',
      planStatus: 'DRAFT',
      allowedToTrade: false,
    });
    const updated = await updateTradePlanStatus(plan.id, 'ACTIVE');
    expect(updated?.planStatus).toBe('ACTIVE');
  });

  it('updateTradePlanStatus 不存在返回 null', async () => {
    const result = await updateTradePlanStatus('non-existent', 'CANCELLED');
    expect(result).toBeNull();
  });
});
