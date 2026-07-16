import { describe, expect, it, beforeEach, vi } from 'vitest';
import { saveSettings } from '../../settings/api/settingsApi';
import { clearAll, getItem } from '../../../shared/api/localStorageClient';
import { client } from '../../../shared/api/client';
import {
  createSegment, listSegments, getSegment, updateSegment, deleteSegment,
  listSegmentMembers, addSegmentMember, removeSegmentMember,
} from './segmentApi';

describe('segmentApi mock 生命周期', () => {
  beforeEach(() => {
    clearAll();
    saveSettings({ apiMode: 'mock', apiBaseUrl: '' });
  });

  it('create -> list -> get -> update -> add member -> memberCount -> remove member -> delete 完整生命周期', async () => {
    // create
    const seg = await createSegment({ segmentName: '白酒观察池', segmentType: 'CUSTOM', description: '测试' });
    expect(seg.segmentName).toBe('白酒观察池');
    expect(seg.segmentType).toBe('CUSTOM');
    expect(seg.enabled).toBe(true);
    expect(seg.memberCount).toBe(0);
    expect(seg.segmentCode).toMatch(/^SEG_/);
    // UUID string ID
    expect(typeof seg.id).toBe('string');
    expect(typeof seg.id === 'string' && seg.id.length > 10).toBe(true);

    // list 能查到
    const listResult = await listSegments({ page: 1, size: 20 });
    expect(listResult.total).toBe(1);
    expect(listResult.items[0].id).toBe(seg.id);

    // get 单个
    const got = await getSegment(seg.id);
    expect(got.segmentName).toBe('白酒观察池');

    // update 保留未修改字段
    const updated = await updateSegment(seg.id, { segmentName: '白酒精选', description: '更新描述' });
    expect(updated.segmentName).toBe('白酒精选');
    expect(updated.description).toBe('更新描述');
    expect(updated.segmentType).toBe('CUSTOM');
    expect(updated.enabled).toBe(true);

    // add member — symbol 规范化（小写输入 → 大写存储）
    const m1 = await addSegmentMember(seg.id, { canonicalSymbol: 'sh.600519', remark: '茅台' });
    expect(m1.canonicalSymbol).toBe('SH.600519');
    expect(typeof m1.id).toBe('string');

    // memberCount 同步
    const afterAdd = await getSegment(seg.id);
    expect(afterAdd.memberCount).toBe(1);

    // list members
    const members = await listSegmentMembers(seg.id);
    expect(members.length).toBe(1);
    expect(members[0].canonicalSymbol).toBe('SH.600519');

    // 同一 symbol 不允许静默重复（规范化后比较）
    await expect(addSegmentMember(seg.id, { canonicalSymbol: 'SH.600519' }))
      .rejects.toThrow('成员已存在');

    // 添加第二个不同 symbol
    await addSegmentMember(seg.id, { canonicalSymbol: 'SZ.000858' });
    const afterAdd2 = await getSegment(seg.id);
    expect(afterAdd2.memberCount).toBe(2);

    // remove member
    await removeSegmentMember(seg.id, 'SH.600519');
    const afterRemove = await getSegment(seg.id);
    expect(afterRemove.memberCount).toBe(1);
    const membersAfterRemove = await listSegmentMembers(seg.id);
    expect(membersAfterRemove.length).toBe(1);
    expect(membersAfterRemove[0].canonicalSymbol).toBe('SZ.000858');

    // delete 板块使用 removeItem 真正级联删除桶
    await deleteSegment(seg.id);
    const listAfterDelete = await listSegments({ page: 1, size: 20 });
    expect(listAfterDelete.total).toBe(0);
    // 成员桶被真正删除（不是空数组而是 key 不存在）
    const membersAfterDelete = getItem<unknown[]>(`marketSegmentMembers:${seg.id}`);
    expect(membersAfterDelete).toBeNull();
  });

  it('UUID string ID for segment and member', async () => {
    const seg = await createSegment({ segmentName: 'UUID测试' });
    expect(typeof seg.id).toBe('string');
    // UUID format check (v4 has dashes)
    expect(seg.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);

    const member = await addSegmentMember(seg.id, { canonicalSymbol: 'SH.600519' });
    expect(typeof member.id).toBe('string');
    expect(member.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
    expect(member.segmentId).toBe(seg.id);
  });

  it('removeMember 不存在 symbol 不改变计数', async () => {
    const seg = await createSegment({ segmentName: '测试' });
    await addSegmentMember(seg.id, { canonicalSymbol: 'SH.600519' });
    const before = await getSegment(seg.id);
    expect(before.memberCount).toBe(1);

    // 删除不存在的 symbol
    await removeSegmentMember(seg.id, 'SZ.999999');
    const after = await getSegment(seg.id);
    expect(after.memberCount).toBe(1); // 不变
  });

  it('removeMember 空成员不出现负数', async () => {
    const seg = await createSegment({ segmentName: '空成员测试' });
    // 板块没有任何成员时尝试删除
    await removeSegmentMember(seg.id, 'SH.600519');
    const after = await getSegment(seg.id);
    expect(after.memberCount).toBe(0); // 不出现负数
  });

  it('addMember 拒绝孤儿板块', async () => {
    await expect(addSegmentMember('nonexistent-uuid', { canonicalSymbol: 'SH.600519' }))
      .rejects.toThrow('板块不存在');
  });

  it('addMember symbol 规范化（去空格 + 转大写）', async () => {
    const seg = await createSegment({ segmentName: '规范化测试' });
    const m = await addSegmentMember(seg.id, { canonicalSymbol: '  sh.600519  ' });
    expect(m.canonicalSymbol).toBe('SH.600519');
  });

  it('addMember 拒绝非法 symbol 格式', async () => {
    const seg = await createSegment({ segmentName: '非法symbol测试' });
    await expect(addSegmentMember(seg.id, { canonicalSymbol: 'INVALID' }))
      .rejects.toThrow('格式不合法');
  });

  it('创建多个板块后分页', async () => {
    for (let i = 0; i < 5; i++) {
      await createSegment({ segmentName: `板块${i}` });
    }
    const page1 = await listSegments({ page: 1, size: 2 });
    expect(page1.total).toBe(5);
    expect(page1.items.length).toBe(2);
    const page2 = await listSegments({ page: 2, size: 2 });
    expect(page2.items.length).toBe(2);
    const page3 = await listSegments({ page: 3, size: 2 });
    expect(page3.items.length).toBe(1);
  });

  it('按 segmentType 筛选', async () => {
    await createSegment({ segmentName: '自定义1', segmentType: 'CUSTOM' });
    await createSegment({ segmentName: '行业1', segmentType: 'INDUSTRY' });
    const customOnly = await listSegments({ segmentType: 'CUSTOM' });
    expect(customOnly.total).toBe(1);
    expect(customOnly.items[0].segmentType).toBe('CUSTOM');
  });

  it('按 enabled 筛选', async () => {
    await createSegment({ segmentName: '启用', enabled: true });
    await createSegment({ segmentName: '停用', enabled: false });
    const enabledOnly = await listSegments({ enabled: true });
    expect(enabledOnly.total).toBe(1);
    expect(enabledOnly.items[0].segmentName).toBe('启用');
  });

  it('按 keyword 筛选', async () => {
    await createSegment({ segmentName: '白酒观察池' });
    await createSegment({ segmentName: '银行高股息' });
    const result = await listSegments({ keyword: '白酒' });
    expect(result.total).toBe(1);
    expect(result.items[0].segmentName).toBe('白酒观察池');
  });

  it('update 不存在的板块抛错', async () => {
    await expect(updateSegment('nonexistent-uuid', { segmentName: '不存在' })).rejects.toThrow('板块不存在');
  });

  it('get 不存在的板块抛错', async () => {
    await expect(getSegment('nonexistent-uuid')).rejects.toThrow('板块不存在');
  });

  it('create 后数据持久化到 localStorage', async () => {
    await createSegment({ segmentName: '持久化测试' });
    const stored = getItem<unknown[]>('marketSegments');
    expect(stored).toBeDefined();
    expect(stored!.length).toBe(1);
  });
});

describe('segmentApi remote', () => {
  beforeEach(() => {
    clearAll();
    saveSettings({ apiMode: 'remote', apiBaseUrl: '' });
  });

  it('createSegment 调用 POST /market-data/segments', async () => {
    const mockPost = vi.spyOn(client, 'post').mockResolvedValueOnce({
      data: { success: true, code: 'SUCCESS', data: { id: '1', segmentCode: 'SEG_1', segmentName: '远程', segmentType: 'CUSTOM', enabled: true, memberCount: 0, createdAt: '', updatedAt: '' } },
    });
    const result = await createSegment({ segmentName: '远程', segmentType: 'CUSTOM' });
    expect(mockPost).toHaveBeenCalledWith('/market-data/segments', { segmentName: '远程', segmentType: 'CUSTOM' });
    expect(result.segmentName).toBe('远程');
    mockPost.mockRestore();
  });

  it('listSegments 调用 GET /market-data/segments 带 params', async () => {
    const mockGet = vi.spyOn(client, 'get').mockResolvedValueOnce({
      data: { success: true, code: 'SUCCESS', data: { items: [], total: 0, page: 1, size: 20 } },
    });
    await listSegments({ page: 2, size: 10, segmentType: 'CUSTOM' });
    expect(mockGet).toHaveBeenCalledWith('/market-data/segments', { params: { page: 2, size: 10, segmentType: 'CUSTOM' } });
    mockGet.mockRestore();
  });

  it('getSegment 调用 GET /market-data/segments/{id}', async () => {
    const mockGet = vi.spyOn(client, 'get').mockResolvedValueOnce({
      data: { success: true, code: 'SUCCESS', data: { id: '42', segmentCode: 'SEG_42', segmentName: '远程板块', segmentType: 'CUSTOM', enabled: true, memberCount: 0, createdAt: '', updatedAt: '' } },
    });
    const result = await getSegment('42');
    expect(mockGet).toHaveBeenCalledWith('/market-data/segments/42');
    expect(result.segmentName).toBe('远程板块');
    mockGet.mockRestore();
  });

  it('updateSegment 调用 PUT /market-data/segments/{id}', async () => {
    const mockPut = vi.spyOn(client, 'put').mockResolvedValueOnce({
      data: { success: true, code: 'SUCCESS', data: { id: '42', segmentCode: 'SEG_42', segmentName: '更新后', segmentType: 'CUSTOM', enabled: true, memberCount: 0, createdAt: '', updatedAt: '' } },
    });
    const result = await updateSegment('42', { segmentName: '更新后' });
    expect(mockPut).toHaveBeenCalledWith('/market-data/segments/42', { segmentName: '更新后' });
    expect(result.segmentName).toBe('更新后');
    mockPut.mockRestore();
  });

  it('deleteSegment 调用 DELETE /market-data/segments/{id}', async () => {
    const mockDelete = vi.spyOn(client, 'delete').mockResolvedValueOnce({
      data: { success: true, code: 'SUCCESS', data: null },
    });
    await deleteSegment(42);
    expect(mockDelete).toHaveBeenCalledWith('/market-data/segments/42');
    mockDelete.mockRestore();
  });

  it('listMembers 调用 GET /market-data/segments/{id}/members', async () => {
    const mockGet = vi.spyOn(client, 'get').mockResolvedValueOnce({
      data: { success: true, code: 'SUCCESS', data: [] },
    });
    await listSegmentMembers(5);
    expect(mockGet).toHaveBeenCalledWith('/market-data/segments/5/members');
    mockGet.mockRestore();
  });

  it('addMember 调用 POST /market-data/segments/{id}/members', async () => {
    const mockPost = vi.spyOn(client, 'post').mockResolvedValueOnce({
      data: { success: true, code: 'SUCCESS', data: { id: '1', segmentId: '5', canonicalSymbol: 'SH.600519', sortOrder: 0, createdAt: '' } },
    });
    const result = await addSegmentMember(5, { canonicalSymbol: 'SH.600519' });
    expect(mockPost).toHaveBeenCalledWith('/market-data/segments/5/members', { canonicalSymbol: 'SH.600519' });
    expect(result.canonicalSymbol).toBe('SH.600519');
    mockPost.mockRestore();
  });

  it('removeMember 调用 DELETE /market-data/segments/{id}/members/{symbol}', async () => {
    const mockDelete = vi.spyOn(client, 'delete').mockResolvedValueOnce({
      data: { success: true, code: 'SUCCESS', data: null },
    });
    await removeSegmentMember(5, 'SH.600519');
    expect(mockDelete).toHaveBeenCalledWith('/market-data/segments/5/members/SH.600519');
    mockDelete.mockRestore();
  });
});
