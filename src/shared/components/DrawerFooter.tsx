import { Button } from 'antd';
import type { ReactNode } from 'react';

interface Props {
  onCancel: () => void;
  onSubmit: () => void;
  submitText?: ReactNode;
  /** 提交按钮 loading 态（异步提交时防重复点击）。可选，默认 false，向后兼容。 */
  loading?: boolean;
}

/**
 * Drawer 底部操作栏。
 * 所有 Drawer 表单统一使用，避免散落原生 button 和 inline style。
 */
export function DrawerFooter({ onCancel, onSubmit, submitText = '保存', loading = false }: Props) {
  return (
    <div
      style={{
        position: 'absolute',
        bottom: 0,
        width: '100%',
        borderTop: '1px solid #e8e8e8',
        padding: '10px 16px',
        textAlign: 'right',
        background: '#fff',
        left: 0,
      }}
    >
      <Button style={{ marginRight: 8 }} onClick={onCancel} disabled={loading}>
        取消
      </Button>
      <Button type="primary" onClick={onSubmit} loading={loading}>
        {submitText}
      </Button>
    </div>
  );
}
