/**
 * P1.9-A 行情资产工具栏：证券选择 + 组合（粒度/来源/复权）+ 快捷范围 + 自定义范围。
 * 纯展示组件，状态全部由父级注入；范围错误文案原样透出。
 */
import { Alert, Button, DatePicker, Radio, Select, Space, Spin, Typography } from 'antd';
import type { Dayjs } from 'dayjs';
import dayjs from 'dayjs';
import { SecuritySelector } from '../../../shared/components/SecuritySelector';
import { formatRangeParam, parseRangeParam } from '../model/marketAssetOptions';
import type { Option, RangePreset } from '../model/marketAssetOptions';

const { RangePicker } = DatePicker;
const { Text } = Typography;

interface Props {
  symbol: string;
  onSymbolChange: (symbol: string) => void;
  availabilityLoading: boolean;
  intervalOptions: Option[];
  interval: string;
  onIntervalChange: (interval: string) => void;
  dataSourceOptions: Option[];
  dataSource: string;
  onDataSourceChange: (dataSource: string) => void;
  adjustTypeOptions: Option[];
  adjustType: string;
  onAdjustTypeChange: (adjustType: string) => void;
  rangePresets: RangePreset[];
  activePreset: string | null;
  onApplyPreset: (preset: RangePreset) => void;
  from: string;
  to: string;
  onCustomRange: (from: string, to: string) => void;
  rangeError: string | null;
}

export function MarketAssetToolbar(props: Props) {
  const {
    symbol,
    onSymbolChange,
    availabilityLoading,
    intervalOptions,
    interval,
    onIntervalChange,
    dataSourceOptions,
    dataSource,
    onDataSourceChange,
    adjustTypeOptions,
    adjustType,
    onAdjustTypeChange,
    rangePresets,
    activePreset,
    onApplyPreset,
    from,
    to,
    onCustomRange,
    rangeError,
  } = props;

  const pickerValue = (): [Dayjs, Dayjs] | null => {
    const fromMs = parseRangeParam(from, interval);
    const toMs = parseRangeParam(to, interval);
    if (fromMs == null || toMs == null) return null;
    return [dayjs(fromMs), dayjs(toMs)];
  };

  return (
    <Space direction="vertical" size="middle" style={{ width: '100%' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'flex-start' }}>
        <div style={{ minWidth: 260, flex: '1 1 260px' }}>
          <SecuritySelector value={symbol} onChange={onSymbolChange} />
        </div>

        <Space size="small" wrap align="center">
          {availabilityLoading ? <Spin size="small" /> : null}
          <Select
            data-testid="asset-interval-select"
            value={interval}
            options={intervalOptions}
            style={{ width: 96 }}
            onChange={onIntervalChange}
          />
          <Select
            data-testid="asset-datasource-select"
            value={dataSource}
            options={dataSourceOptions}
            style={{ width: 120 }}
            onChange={onDataSourceChange}
          />
          <Select
            data-testid="asset-adjusttype-select"
            value={adjustType}
            options={adjustTypeOptions}
            style={{ width: 104 }}
            onChange={onAdjustTypeChange}
          />
        </Space>
      </div>

      <Space size="middle" wrap>
        <Radio.Group
          value={activePreset ?? '__CUSTOM__'}
          onChange={(event) => {
            const preset = rangePresets.find((p) => p.key === event.target.value);
            if (preset) onApplyPreset(preset);
          }}
        >
          {rangePresets.map((preset) => (
            <Radio.Button key={preset.key} value={preset.key} data-testid={`range-preset-${preset.key}`}>
              {preset.label}
            </Radio.Button>
          ))}
          <Radio.Button value="__CUSTOM__">自定义</Radio.Button>
        </Radio.Group>

        <RangePicker
          data-testid="asset-range-picker"
          value={pickerValue()}
          showTime={interval !== '1D'}
          onChange={(dates) => {
            if (dates?.[0] && dates[1]) {
              onCustomRange(
                formatRangeParam(dates[0].toDate(), interval),
                formatRangeParam(dates[1].toDate(), interval),
              );
            }
          }}
        />
        <Button data-testid="asset-range-reset" onClick={() => rangePresets[0] && onApplyPreset(rangePresets[0])}>
          重置范围
        </Button>
      </Space>

      {rangeError && (
        <Alert data-testid="asset-range-error" type="warning" showIcon message={rangeError} />
      )}
      <Text type="secondary">
        区间摘要为所选数据窗口的价格变化，不代表投资收益；不构成交易建议。
      </Text>
    </Space>
  );
}
