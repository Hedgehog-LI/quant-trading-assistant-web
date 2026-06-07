import { useState } from 'react';
import { Button, Card, Upload, Popconfirm, Alert, Typography, Select, Input, Space, message, Modal } from 'antd';
import { DownloadOutlined, UploadOutlined, DeleteOutlined } from '@ant-design/icons';
import type { AppSettings } from '../../../shared/types/domain';

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

  const handleExport = () => {
    const json = onExport();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `qta-backup-${new Date().toISOString().slice(0, 10)}.json`;
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
    onSaveSettings({ apiMode, apiBaseUrl });
    message.success('设置已保存');
  };

  return (
    <div>
      <Alert
        type="info"
        message={undefined}
        title="本系统只做交易辅助记录、风控计算和复盘，不自动交易，不连接券商。"
        style={{ marginBottom: 16 }}
        showIcon
      />

      <Card title="数据模式" size="small" style={{ marginBottom: 16 }}>
        <Typography.Paragraph type="secondary">
          当前业务数据保存在浏览器 localStorage 中。切换到后端模式后，数据将通过 REST API 与后端交互。
        </Typography.Paragraph>
        <Space direction="vertical" style={{ width: '100%' }} size="middle">
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
                placeholder="http://localhost:8080"
              />
            </div>
          )}
          {apiMode === 'remote' && (
            <Alert
              type="warning"
              message={undefined}
              title="后端模式为预留联调配置，当前业务 API 仍未完全接入。选择后端模式后部分功能可能暂时无法使用。"
              showIcon
            />
          )}
          <Button type="primary" onClick={handleSaveSettings}>
            保存设置
          </Button>
        </Space>
      </Card>

      <Card title="数据管理" size="small" style={{ marginBottom: 16 }}>
        <Typography.Paragraph type="secondary">
          当前数据保存在浏览器 localStorage 中。建议定期导出备份。
        </Typography.Paragraph>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <Button icon={<DownloadOutlined />} onClick={handleExport}>
            导出 JSON 备份
          </Button>
          <Upload
            accept=".json"
            showUploadList={false}
            beforeUpload={handleImportFile}
          >
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
