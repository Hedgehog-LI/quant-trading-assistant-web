import { useRef, useState } from 'react';
import { Alert, Button, Descriptions, Input, Segmented, Space, Tag, Typography } from 'antd';
import { PlusOutlined, SearchOutlined } from '@ant-design/icons';
import { verifySecurity, type SecurityVerification, type VerifySecurityInput } from '../api/workbenchApi';

const { Text } = Typography;
const MARKET_OPTIONS = [
  { label: 'A 股', value: 'CN' },
  { label: '港股', value: 'HK' },
  { label: '美股', value: 'US' },
];
const ADDABLE = new Set(['VERIFIED_QUOTE_AVAILABLE', 'VERIFIED_DELAYED_QUOTE', 'VERIFIED_NO_QUOTE', 'NO_PERMISSION']);
const STATUS_LABELS: Record<string, string> = {
  VERIFIED_QUOTE_AVAILABLE: '证券与报价已验证',
  VERIFIED_DELAYED_QUOTE: '证券已验证，报价有延迟',
  VERIFIED_NO_QUOTE: '证券已验证，暂无报价',
  INVALID_SYMBOL: '未查询到证券',
  PROVIDER_UNAVAILABLE: '行情服务不可用',
  NO_PERMISSION: '证券已验证，暂无报价权限',
};

interface Props {
  value?: string;
  onChange?: (value: string) => void;
  remoteMode: boolean;
  taskType?: string;
}

export function SecurityVerificationField({ value, onChange, remoteMode, taskType }: Props) {
  const [market, setMarket] = useState<VerifySecurityInput['market']>('CN');
  const [code, setCode] = useState('');
  const [result, setResult] = useState<SecurityVerification | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const requestRef = useRef(0);
  const selected = (value ?? '').split(/[\s,，;；]+/).filter(Boolean);

  const invalidate = () => {
    requestRef.current += 1;
    setResult(null);
    setError(null);
    setLoading(false);
  };

  const handleVerify = async () => {
    if (!remoteMode || loading || !code.trim()) return;
    const requestId = ++requestRef.current;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const response = await verifySecurity({ market, code: code.trim() });
      if (requestId === requestRef.current) setResult(response);
    } catch (reason) {
      if (requestId === requestRef.current) setError((reason as Error).message);
    } finally {
      if (requestId === requestRef.current) setLoading(false);
    }
  };

  const addResult = () => {
    if (!result || !ADDABLE.has(result.verificationStatus)) return;
    onChange?.([...new Set([...selected, result.canonicalSymbol])].join(', '));
    setCode('');
    setResult(null);
  };

  const minuteMarketWarning = taskType !== 'DAILY_BAR_BACKFILL'
    && selected.some((symbol) => symbol.startsWith('HK.') || symbol.startsWith('US.'));

  return (
    <Space orientation="vertical" style={{ width: '100%' }} size="small">
      <Segmented options={MARKET_OPTIONS} value={market} onChange={(next) => {
        setMarket(next as VerifySecurityInput['market']);
        invalidate();
      }} />
      <Space.Compact style={{ width: '100%' }}>
        <Input value={code} placeholder={market === 'CN' ? '603308' : market === 'HK' ? '2498' : 'NVDA'}
          onChange={(event) => { setCode(event.target.value); invalidate(); }}
          onPressEnter={() => void handleVerify()} />
        <Button icon={<SearchOutlined />} loading={loading} disabled={!remoteMode || !code.trim() || loading}
          onClick={() => void handleVerify()}>查询并验证</Button>
      </Space.Compact>

      {!remoteMode && <Alert type="info" title="本地模式不连接 LongPort，切换后端模式后可验证证券。" />}
      {error && <Alert type="error" title={error} />}
      {result && (
        <Space orientation="vertical" style={{ width: '100%' }} size="small">
          <Alert type={ADDABLE.has(result.verificationStatus) ? 'success' : 'warning'}
            title={`${result.displayName ?? result.canonicalSymbol} · ${STATUS_LABELS[result.verificationStatus] ?? result.verificationStatus}`}
            description={result.message} />
          <Descriptions size="small" column={2} items={[
            { key: 'symbol', label: '统一代码', children: result.canonicalSymbol },
            { key: 'exchange', label: '交易所', children: result.exchange ?? '-' },
            { key: 'price', label: '当前价', children: result.lastPrice == null ? '-' : `${result.lastPrice} ${result.currency ?? ''}` },
            { key: 'time', label: '报价时间', children: result.quoteTime ?? '-' },
            { key: 'lot', label: '每手股数', children: result.lotSize ?? '-' },
            { key: 'status', label: '交易状态', children: result.tradeStatus ?? '-' },
            { key: 'delay', label: '行情时效', children: result.quoteDelay === 'UNKNOWN' ? '以报价时间为准' : result.quoteDelay ?? '-' },
          ]} />
          <Button type="primary" icon={<PlusOutlined />} disabled={!ADDABLE.has(result.verificationStatus)}
            onClick={addResult}>加入计划</Button>
        </Space>
      )}

      <div>
        <Text type="secondary">已选标的</Text>
        <div style={{ marginTop: 6 }}>
          {selected.length === 0 ? <Text type="secondary">暂无</Text> : selected.map((symbol) => (
            <Tag key={symbol} closable onClose={() => onChange?.(selected.filter((item) => item !== symbol).join(', '))}>
              {symbol}
            </Tag>
          ))}
        </div>
      </div>
      {minuteMarketWarning && <Alert type="warning" title="港股/美股分钟采集尚未闭环；可改用日 K，或移除港美股标的。" />}
    </Space>
  );
}
