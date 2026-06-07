import { Component } from 'react';
import { Result, Button } from 'antd';
import type { ReactNode, ErrorInfo } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

/**
 * 简单可靠的 React ErrorBoundary。
 * 包住路由，出错时展示友好提示，不暴露技术堆栈给用户。
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // 开发环境打印错误便于调试，生产环境不展示堆栈
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  handleReload = () => {
    this.setState({ hasError: false });
  };

  render() {
    if (this.state.hasError) {
      return (
        <Result
          status="error"
          title="页面出现异常"
          subTitle="请刷新页面重试。如果问题持续存在，建议检查本地数据备份后清理浏览器缓存。"
          extra={
            <Button type="primary" onClick={this.handleReload}>
              重试
            </Button>
          }
        />
      );
    }
    return this.props.children;
  }
}
