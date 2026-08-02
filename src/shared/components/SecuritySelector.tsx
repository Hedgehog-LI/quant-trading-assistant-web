import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Button, Input, Space, Spin, Switch, Tag } from 'antd';
import { searchSecurities } from '../../features/market-data/api/securityDirectoryApi';
import type { SecuritySummary } from '../types/domain';

const DEBOUNCE_MS = 250;

const MARKET_LABEL: Record<string, string> = {
  SH: '沪市',
  SZ: '深市',
  BJ: '北交所',
  HK: '港股',
  US: '美股',
};

const TYPE_LABEL: Record<string, string> = {
  STOCK: '股票',
  ETF: 'ETF',
  INDEX: '指数',
  REIT: 'REIT',
  FUND: '基金',
  BOND: '债券',
  WARRANT: '权证',
  OPTION: '期权',
  FUTURE: '期货',
  OTHER: '其他',
};

interface Props {
  value?: string;
  onChange?: (value: string) => void;
  markets?: string[];
  types?: string[];
  includeDelistedToggle?: boolean;
}

interface SearchState {
  status: 'idle' | 'loading' | 'success' | 'error';
  items: SecuritySummary[];
  catalogStatus: string;
  catalogUpdatedAt: string | null;
  stale: boolean;
}

const INITIAL_STATE: SearchState = {
  status: 'idle',
  items: [],
  catalogStatus: 'READY',
  catalogUpdatedAt: null,
  stale: false,
};

function marketLabel(market: string): string {
  return MARKET_LABEL[market] ?? market;
}

function typeLabel(securityType: string): string {
  return TYPE_LABEL[securityType] ?? securityType;
}

export function SecuritySelector({
  value,
  onChange,
  markets,
  types,
  includeDelistedToggle = false,
}: Props) {
  const [query, setQuery] = useState(value ?? '');
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const [selected, setSelected] = useState<SecuritySummary | null>(null);
  const [state, setState] = useState<SearchState>(INITIAL_STATE);
  const [includeDelisted, setIncludeDelisted] = useState(false);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestRef = useRef(0);
  const lastQueryRef = useRef('');

  const runSearch = useCallback(
    (q: string) => {
      const trimmed = q.trim();
      lastQueryRef.current = trimmed;
      if (!trimmed) {
        requestRef.current += 1;
        setState({ ...INITIAL_STATE, status: 'idle' });
        setOpen(false);
        return;
      }
      const requestId = (requestRef.current += 1);
      setState((prev) => ({ ...prev, status: 'loading' }));
      setOpen(true);
      searchSecurities({
        q: trimmed,
        markets,
        types,
        includeDelisted,
      })
        .then((result) => {
          if (requestId !== requestRef.current) return;
          setState({
            status: result.items.length === 0 && !result.catalogStatus ? 'success' : 'success',
            items: result.items,
            catalogStatus: result.catalogStatus,
            catalogUpdatedAt: result.catalogUpdatedAt,
            stale: result.stale,
          });
          setHighlight(0);
        })
        .catch(() => {
          if (requestId !== requestRef.current) return;
          setState((prev) => ({ ...prev, status: 'error' }));
        });
    },
    [markets, types, includeDelisted],
  );

  const didMountRef = useRef(false);
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  // Re-run the search when the delisted toggle changes (no debounce), so the
  // user immediately sees delisted items alongside the current query.
  useEffect(() => {
    if (!didMountRef.current) {
      didMountRef.current = true;
      return;
    }
    if (lastQueryRef.current) {
      runSearch(lastQueryRef.current);
    }
  }, [includeDelisted, runSearch]);

  const invalidateSelection = useCallback(() => {
    if (selected) {
      setSelected(null);
      onChange?.('');
    }
  }, [selected, onChange]);

  const handleQueryChange = (next: string) => {
    setQuery(next);
    invalidateSelection();
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      runSearch(next);
    }, DEBOUNCE_MS);
  };

  const handleRetry = () => {
    runSearch(lastQueryRef.current);
  };

  const confirmItem = (item: SecuritySummary) => {
    setSelected(item);
    setQuery(item.displayName);
    onChange?.(item.canonicalSymbol);
    setOpen(false);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    const items = state.items;
    if (event.key === 'ArrowDown') {
      if (items.length === 0) return;
      event.preventDefault();
      setOpen(true);
      setHighlight((prev) => (prev + 1) % items.length);
    } else if (event.key === 'ArrowUp') {
      if (items.length === 0) return;
      event.preventDefault();
      setOpen(true);
      setHighlight((prev) => (prev - 1 + items.length) % items.length);
    } else if (event.key === 'Enter') {
      if (open && items.length > 0) {
        event.preventDefault();
        confirmItem(items[highlight] ?? items[0]);
      }
    } else if (event.key === 'Escape') {
      event.preventDefault();
      setOpen(false);
    }
  };

  const showEmptyMessage =
    open &&
    state.status !== 'loading' &&
    state.status !== 'error' &&
    state.items.length === 0;
  const isCatalogEmpty = showEmptyMessage && state.catalogStatus === 'EMPTY';
  const isNoMatch =
    showEmptyMessage && state.catalogStatus !== 'EMPTY';

  return (
    <Space orientation="vertical" style={{ width: '100%' }} size="small">
      <Input
        value={query}
        placeholder="输入代码 / 名称 / 拼音检索证券"
        onChange={(event) => handleQueryChange(event.target.value)}
        onKeyDown={handleKeyDown}
        onFocus={() => {
          if (state.items.length > 0) setOpen(true);
        }}
        suffix={
          <span data-testid="security-selector-input-suffix">
            {state.status === 'loading' ? <Spin size="small" /> : null}
          </span>
        }
      />

      {includeDelistedToggle && (
        <Space size="small">
          <Switch
            checked={includeDelisted}
            onChange={(checked) => setIncludeDelisted(checked)}
          />
          <span>包含退市</span>
        </Space>
      )}

      {state.status === 'error' && (
        <Alert
          type="error"
          title="请求失败"
          action={
            <Button size="small" onClick={handleRetry}>
              重试
            </Button>
          }
        />
      )}

      {state.stale && state.items.length > 0 && state.catalogUpdatedAt && (
        <Alert
          type="info"
          title={`目录可能陈旧（最近更新：${state.catalogUpdatedAt}）`}
        />
      )}

      {selected && (
        <div
          data-testid="security-selector-selected"
          style={{ border: '1px solid #d9d9d9', padding: 8, borderRadius: 6 }}
        >
          <div>
            <strong data-testid="selected-displayName">
              {selected.displayName}
            </strong>
          </div>
          <Space size={4} wrap>
            <Tag data-testid="selected-canonicalSymbol">
              {selected.canonicalSymbol}
            </Tag>
            <Tag data-testid="selected-market">
              {marketLabel(selected.market)}
              {selected.exchange ? ` · ${selected.exchange}` : ''}
            </Tag>
            <Tag data-testid="selected-securityType">
              {typeLabel(selected.securityType)}
            </Tag>
          </Space>
        </div>
      )}

      {open && state.status === 'loading' && (
        <div data-testid="security-selector-loading" role="status">
          <Spin size="small" /> <span>检索中…</span>
        </div>
      )}

      {open && state.status === 'success' && (
        <ul
          data-testid="security-selector-results"
          role="listbox"
          style={{ listStyle: 'none', margin: 0, padding: 0 }}
        >
          {state.items.map((item, index) => (
            <li
              key={`${item.canonicalSymbol}-${index}`}
              role="option"
              aria-selected={index === highlight}
              data-canonical-symbol={item.canonicalSymbol}
              onClick={() => confirmItem(item)}
              style={{
                padding: '6px 8px',
                cursor: 'pointer',
                background: index === highlight ? '#e6f4ff' : 'transparent',
                borderBottom: '1px solid #f0f0f0',
              }}
            >
              <span data-testid={`result-displayName-${index}`}>
                {item.displayName}
              </span>{' '}
              <Tag>{item.canonicalSymbol}</Tag>
              <Tag>{marketLabel(item.market)}</Tag>
              <Tag>{typeLabel(item.securityType)}</Tag>
              {item.listStatus === 'DELISTED' && (
                <Tag color="default" data-testid={`result-delisted-${index}`}>
                  退市
                </Tag>
              )}
            </li>
          ))}
        </ul>
      )}

      {isCatalogEmpty && (
        <Alert type="info" title="目录尚未初始化" />
      )}
      {isNoMatch && <Alert type="info" title="无匹配结果" />}
    </Space>
  );
}
