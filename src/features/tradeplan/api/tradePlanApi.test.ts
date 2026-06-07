import { describe, it, expect, beforeEach } from 'vitest';
import {
  getTradePlans,
  addTradePlan,
  updateTradePlan,
  getTradePlanById,
} from '../api/tradePlanApi';

beforeEach(() => {
  localStorage.clear();
});

describe('tradePlanApi', () => {
  it('新增交易计划', () => {
    const plan = addTradePlan({
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

  it('股票代码自动转大写', () => {
    const plan = addTradePlan({
      planDate: '2026-06-08',
      symbol: ' 300750 ',
      name: '宁德时代',
      planStatus: 'DRAFT',
      allowedToTrade: false,
    });
    expect(plan.symbol).toBe('300750');
  });

  it('更新交易计划', () => {
    const plan = addTradePlan({
      planDate: '2026-06-08',
      symbol: '300750',
      name: '宁德时代',
      planStatus: 'DRAFT',
      allowedToTrade: false,
    });
    const updated = updateTradePlan(plan.id, {
      planStatus: 'ACTIVE',
      allowedToTrade: true,
      buyCondition: '突破220',
      stopLossPrice: 210,
    });
    expect(updated?.planStatus).toBe('ACTIVE');
    expect(updated?.allowedToTrade).toBe(true);
    expect(updated?.buyCondition).toBe('突破220');
  });

  it('更新不存在的 id 返回 null', () => {
    const result = updateTradePlan('non-existent', { planStatus: 'CANCELLED' });
    expect(result).toBeNull();
  });

  it('getTradePlanById 正确查找', () => {
    const plan = addTradePlan({
      planDate: '2026-06-08',
      symbol: '300750',
      planStatus: 'DRAFT',
      allowedToTrade: false,
    });
    const found = getTradePlanById(plan.id);
    expect(found?.symbol).toBe('300750');
  });

  it('getTradePlanById 不存在返回 null', () => {
    expect(getTradePlanById('non-existent')).toBeNull();
  });

  it('可添加同一股票不同日期的计划', () => {
    addTradePlan({ planDate: '2026-06-08', symbol: '300750', planStatus: 'DRAFT', allowedToTrade: false });
    addTradePlan({ planDate: '2026-06-09', symbol: '300750', planStatus: 'DRAFT', allowedToTrade: false });
    expect(getTradePlans()).toHaveLength(2);
  });
});
