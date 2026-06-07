import { Button } from 'antd';
import type { ReactNode } from 'react';

interface Props {
  onCancel: () => void;
  onSubmit: () => void;
  submitText?: ReactNode;
}

/**
 * Drawer 底部操作栏。
 * 所有 Drawer 表单统一使用，避免散落原生 button 和 inline style。
 */
export function DrawerFooter({ onCancel, onSubmit, submitText = '保存' }: Props) {
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
      <Button style={{ marginRight: 8 }} onClick={onCancel}>
        取消
      </Button>
      <Button type="primary" onClick={onSubmit}>
        {submitText}
      </Button>
    </div>
  );
}
