import { useState } from 'react';
import { Button, Card, Upload, Popconfirm, Alert, Typography, Select, Input, Space, message, Modal, Tag } from 'antd';
import { DownloadOutlined, UploadOutlined, DeleteOutlined } from '@ant-design/icons';
import type { AppSettings } from '../../../shared/types/domain';
import {
  isLocalhostHost,
  isLocalhostUrl,
  resolveEffectiveApiBaseUrl,
  testBackendConnection,
  type ConnectionTestResult,
} from '../api/settingsApi';

interface Props {
  settings: AppSettings;
  onSaveSettings: (s: AppSettings) => void;
  onExport: () => string;
  onImport: (json: string) => void;
  onClear: () => void;
}

export function DataManagement({ settings, onSaveSettings, onExport, onImport, onClear }: Props) {
  const [apiMode, setApiMode] = useState<AppSettings['apiMode']>(settings.apiMode);
  const [apiBaseUrl, setApiBaseUrl] = useState(settings.apiBaseUrl);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<ConnectionTestResult | null>(null);

  const handleExport = () => {
    const json = onExport();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `qta-local-export-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    message.success('导出成功');
  };

  const handleImportConfirm = (json: string) => {
    Modal.confirm({
      title: '确认导入数据？',
      content: '导入将覆盖当前本地数据，建议先导出备份。确定继续？',
      okText: '确定导入',
      cancelText: '取消',
      okButtonProps: { danger: true },
      onOk: () => {
        try {
          onImport(json);
          message.success('导入成功');
        } catch {
          message.error('导入失败：JSON 格式不正确');
        }
      },
    });
  };

  const handleImportFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result;
      if (typeof text === 'string') {
        handleImportConfirm(text);
      }
    };
    reader.readAsText(file);
    return false;
  };

  const handleSaveSettings = () => {
    const trimmed = apiBaseUrl.trim();
    // 公网页面禁止保存指向 localhost 的后端地址，避免请求落到访问者本机。
    if (apiMode === 'remote' && trimmed && !isLocalhostHost(window.location.hostname) && isLocalhostUrl(trimmed)) {
      message.error('当前页面不是本地环境，后端地址不能指向 localhost/127.0.0.1/::1。生产请留空走同源 /api/v1。');
      return;
    }
    onSaveSettings({ apiMode, apiBaseUrl: trimmed });
    setTestResult(null);
    message.success('设置已保存');
  };

  const handleTestConnection = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const result = await testBackendConnection(apiBaseUrl);
      setTestResult(result);
      if (result.status === 'success') message.success(result.message);
      else message.warning(result.message);
    } finally {
      setTesting(false);
    }
  };

  const resultTag = (status: ConnectionTestResult['status']) => {
    const map: Record<string, { color: string; text: string }> = {
      success: { color: 'green', text: '成功' },
      timeout: { color: 'orange', text: '超时' },
      http_error: { color: 'red', text: 'HTTP 错误' },
      business_error: { color: 'gold', text: '业务错误' },
      network_error: { color: 'red', text: '网络错误' },
    };
    return map[status] ?? map.network_error;
  };

  return (
    <div>
      <Alert
        type="info"
        title="本系统只做交易辅助记录、风控计算和复盘，不自动交易，不连接券商。"
        style={{ marginBottom: 16 }}
        showIcon
      />

      <Card title="数据模式" size="small" style={{ marginBottom: 16 }}>
        <Typography.Paragraph type="secondary">
          <strong>本地模式</strong>：数据保存在浏览器 localStorage。
          <br />
          <strong>后端模式</strong>：核心业务数据（交易账本、持仓快照、自选股、交易计划、交易记录、盘后复盘、工作台待办）通过 REST API 写入后端数据库。
          <br />
          「数据模式」「后端地址」等设置本身，以及 JSON 导入 / 导出 / 清空，始终保存在浏览器本地。
        </Typography.Paragraph>
        <Space orientation="vertical" style={{ width: '100%' }} size="middle">
          <div>
            <Typography.Text strong>数据模式：</Typography.Text>
            <Select
              value={apiMode}
              onChange={setApiMode}
              style={{ width: 180, marginLeft: 8 }}
              options={[
                { value: 'mock', label: '本地模式 (localStorage)' },
                { value: 'remote', label: '后端模式 (REST API)' },
              ]}
            />
          </div>
          {apiMode === 'remote' && (
            <div>
              <Typography.Text strong>后端地址：</Typography.Text>
              <Input
                value={apiBaseUrl}
                onChange={(e) => setApiBaseUrl(e.target.value)}
                style={{ width: 300, marginLeft: 8 }}
                placeholder="留空走同源 /api/v1，或填 http://localhost:8080"
              />
              <Typography.Text type="secondary" style={{ display: 'block', marginTop: 4, marginLeft: 0 }}>
                生产同域部署请留空，由 Nginx 反代 /api 到后端。当前实际请求地址：
                <Typography.Text code>{resolveEffectiveApiBaseUrl({ apiMode, apiBaseUrl })}</Typography.Text>
              </Typography.Text>
            </div>
          )}
          {apiMode === 'remote' && (
            <Alert
              type="info"
              showIcon
              title="后端模式当前接入范围"
              description={
                <ul style={{ margin: 0, paddingLeft: 18 }}>
                  <li>「交易账本」「持仓快照」「自选股」「交易计划」「交易记录」「盘后复盘」「工作台待办」均已接入后端 API，核心数据落库；切换回本地模式仍使用 localStorage。</li>
                  <li>「今日工作台」「待办中心」直接使用后端 /dashboard/today 聚合结果。</li>
                  <li>风控计算器、快照对比与对账的 mock 计算为纯前端，remote 模式走后端 REST。</li>
                  <li>本系统不连接券商，不自动同步真实交易，当前价为手工维护。</li>
                </ul>
              }
            />
          )}
          <Space>
            <Button type="primary" onClick={handleSaveSettings}>
              保存设置
            </Button>
            {apiMode === 'remote' && (
              <Button loading={testing} onClick={() => void handleTestConnection()}>
                测试连接（只读）
              </Button>
            )}
          </Space>
          {testResult && (
            <Alert
              showIcon
              type={testResult.status === 'success' ? 'success' : 'warning'}
              title={
                <span>
                  <Tag color={resultTag(testResult.status).color}>{resultTag(testResult.status).text}</Tag>
                  {testResult.message}
                </span>
              }
            />
          )}
        </Space>
      </Card>

      <Card title="数据管理" size="small" style={{ marginBottom: 16 }}>
        <Typography.Paragraph type="secondary">
          {apiMode === 'remote'
            ? '当前业务数据通过 REST API 写入后端数据库；数据模式与本地模式数据保存在浏览器 localStorage。建议定期导出本地配置。'
            : '当前数据保存在浏览器 localStorage 中。建议定期导出备份。'}
          <br />
          导出内容仅为浏览器 localStorage 中的设置与本地模式数据；后端模式下的业务数据保存在服务器 MySQL，不在本次导出范围内。
        </Typography.Paragraph>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <Button icon={<DownloadOutlined />} onClick={handleExport}>
            导出本地配置 / 本地模式数据
          </Button>
          <Upload accept=".json" showUploadList={false} beforeUpload={handleImportFile}>
            <Button icon={<UploadOutlined />}>导入 JSON 恢复</Button>
          </Upload>
        </div>
      </Card>

      <Card title="危险操作" size="small">
        <Popconfirm
          title="确定清空所有本地数据？此操作不可恢复！"
          description="建议先导出备份再清空"
          onConfirm={onClear}
          okText="确定清空"
          cancelText="取消"
          okButtonProps={{ danger: true }}
        >
          <Button danger icon={<DeleteOutlined />}>
            清空所有本地数据
          </Button>
        </Popconfirm>
      </Card>
    </div>
  );
}
