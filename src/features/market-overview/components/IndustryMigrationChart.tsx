/**
 * 行业成交占比迁移图（自绘 SVG 堆叠面积，无新增依赖）：
 * - 图层 = 每日 Top-8 行业（按窗口合计成交额降序着色）+ OTHER（灰，恒最后）；
 * - 命名行业当日未进 Top-8 时份额为 0（该注意力已并入 OTHER，真实语义而非缺失）；
 * - 悬停垂直参考线 + tooltip：行业、排名、占比、成交额、较前一日变化、较 20 日中位变化、
 *   覆盖股票数（textContent 渲染，翻转防溢出）；
 * - 文案统一"成交占比 / 交易注意力"，禁止称为资金净流入；窄屏横向滚动。
 */
import { useMemo, useState } from 'react';
import { dash, formatMoney, formatPercent, formatSignedPercent } from '../model/formatters';
import {
  buildMigrationTooltipRows,
  toMigrationChartData,
} from '../model/overviewTransform';
import type { IndustryMigrationRow } from '../model/types';

const HEIGHT = 320;
const PADDING_LEFT = 46;
const PADDING_RIGHT = 10;
const PADDING_TOP = 10;
const PADDING_BOTTOM = 22;
const MIN_COLUMN_WIDTH = 14;
const GRID_LEVELS = [0, 0.25, 0.5, 0.75, 1];

interface Props {
  rows: IndustryMigrationRow[];
}

export function IndustryMigrationChart({ rows }: Props) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const chartData = useMemo(() => toMigrationChartData(rows), [rows]);
  const { dates, layers, rowByDateAndCode } = chartData;

  const width = Math.max(
    PADDING_LEFT + PADDING_RIGHT + dates.length * MIN_COLUMN_WIDTH + MIN_COLUMN_WIDTH,
    560,
  );
  const innerWidth = width - PADDING_LEFT - PADDING_RIGHT;
  const innerHeight = HEIGHT - PADDING_TOP - PADDING_BOTTOM;
  const columnWidth = dates.length > 0 ? innerWidth / dates.length : innerWidth;

  const stackedPolygons = useMemo(() => layers.map((layer) => {
    const top: string[] = [];
    const bottom: string[] = [];
    let cumulative = 0;
    for (let index = 0; index < dates.length; index++) {
      const value = layer.points[index]?.value ?? 0;
      cumulative += value;
      const x = PADDING_LEFT + (index + 0.5) * columnWidth;
      top.push(`${x.toFixed(1)},${(PADDING_TOP + (1 - cumulative) * innerHeight).toFixed(1)}`);
      bottom.push(`${x.toFixed(1)},${(PADDING_TOP + (1 - cumulative + value) * innerHeight).toFixed(1)}`);
    }
    return { layer, points: [...top, ...bottom.reverse()].join(' ') };
  }), [layers, dates, columnWidth, innerHeight]);

  const hoverRows = useMemo(() => {
    if (hoverIndex == null || dates.length === 0) return null;
    const date = dates[hoverIndex];
    const byDate = new Map<string, IndustryMigrationRow>();
    for (const [key, row] of rowByDateAndCode) {
      if (key.startsWith(`${date}|`)) byDate.set(key, row);
    }
    return { date, rows: buildMigrationTooltipRows(byDate) };
  }, [hoverIndex, dates, rowByDateAndCode]);

  if (dates.length === 0 || layers.length === 0) {
    return <div data-testid="overview-migration-chart" className="overview-migration-empty">窗口内没有行业成交占比数据</div>;
  }

  const hoverX = hoverIndex != null ? PADDING_LEFT + (hoverIndex + 0.5) * columnWidth : null;

  return (
    <div data-testid="overview-migration-chart" className="overview-migration">
      <div className="overview-migration__legend">
        {layers.map((layer) => (
          <span key={layer.industryCode} className="overview-migration__legend-item">
            <span className="overview-migration__legend-dot" style={{ background: layer.color }} />
            {layer.industryName}
          </span>
        ))}
      </div>
      <div
        className="overview-migration__scroll"
        onMouseLeave={() => setHoverIndex(null)}
        onMouseMove={(event) => {
          const rect = event.currentTarget.getBoundingClientRect();
          const svgLeft = rect.left + PADDING_LEFT;
          const offset = event.clientX - svgLeft;
          if (offset < 0 || offset > innerWidth) {
            setHoverIndex(null);
            return;
          }
          setHoverIndex(Math.min(dates.length - 1, Math.max(0, Math.floor(offset / columnWidth))));
        }}
      >
        <svg width={width} height={HEIGHT} role="img" aria-label="行业成交占比迁移堆叠面积图">
          {GRID_LEVELS.map((level) => (
            <g key={level}>
              <line
                x1={PADDING_LEFT} x2={width - PADDING_RIGHT}
                y1={PADDING_TOP + (1 - level) * innerHeight} y2={PADDING_TOP + (1 - level) * innerHeight}
                stroke="#e5e7eb" strokeWidth={1}
              />
              <text
                x={PADDING_LEFT - 6} y={PADDING_TOP + (1 - level) * innerHeight + 4}
                textAnchor="end" fontSize={11} fill="#8c8c8c"
              >
                {`${level * 100}%`}
              </text>
            </g>
          ))}
          {stackedPolygons.map(({ layer, points }) => (
            <polygon key={layer.industryCode} points={points} fill={layer.color} fillOpacity={0.82} />
          ))}
          {[0, Math.floor((dates.length - 1) / 2), dates.length - 1].map((index) => (
            <text
              key={index} x={PADDING_LEFT + (index + 0.5) * columnWidth} y={HEIGHT - 6}
              textAnchor="middle" fontSize={11} fill="#8c8c8c"
            >
              {dates[index]}
            </text>
          ))}
          {hoverX != null && (
            <line x1={hoverX} x2={hoverX} y1={PADDING_TOP} y2={PADDING_TOP + innerHeight} stroke="#595959" strokeDasharray="3 3" />
          )}
        </svg>
        {hoverRows && (
          <div
            className="overview-migration__tooltip"
            style={hoverX != null && hoverX > width * 0.6
              ? { right: Math.max(4, width - hoverX + 10) }
              : { left: Math.max(4, (hoverX ?? 0) + 10) }}
          >
            <div className="overview-migration__tooltip-date">{hoverRows.date}</div>
            {hoverRows.rows.slice(0, 9).map((row) => (
              <div key={row.industryCode} className="overview-migration__tooltip-row">
                <span className="overview-migration__tooltip-dot" style={{ display: 'inline-block', width: 8, height: 8, background: layers.find((l) => l.industryCode === row.industryCode)?.color ?? '#bfbfbf' }} />
                <span>{row.rank != null ? `#${row.rank} ` : ''}{row.industryName}</span>
                <span>{dash(formatPercent(row.turnoverShare))}</span>
                <span>{dash(formatMoney(row.turnover))}</span>
                <span>{dash(formatSignedPercent(row.previousDayShareChange, 2))}</span>
                <span>{dash(formatSignedPercent(row.median20ShareChange, 2))}</span>
                <span>{row.coveredStocks}只</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
