import { Empty } from 'antd';
import type { MarketResearchHistoryPoint } from '../model/types';

interface Props {
  points: MarketResearchHistoryPoint[];
}

export function SectorHistoryChart({ points }: Props) {
  if (points.length === 0) return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无已发布历史" />;
  const width = 760;
  const height = 300;
  const left = 48;
  const top = 24;
  const plotWidth = width - left - 20;
  const plotHeight = height - top - 48;
  const ordered = [...points].reverse();
  const position = (point: MarketResearchHistoryPoint, index: number) => ({
    x: left + (ordered.length === 1 ? plotWidth / 2 : (index / (ordered.length - 1)) * plotWidth),
    y: top + (1 - Math.max(0, Math.min(1, point.rsRankPercentile ?? 0))) * plotHeight,
  });
  const path = ordered.map((point, index) => {
    const p = position(point, index);
    return `${index === 0 ? 'M' : 'L'} ${p.x} ${p.y}`;
  }).join(' ');

  return (
    <div className="sector-history-chart" data-testid="sector-history-chart">
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="板块相对强弱历史轨迹">
        {[0, 0.25, 0.5, 0.75, 1].map((tick) => {
          const yValue = top + (1 - tick) * plotHeight;
          return (
            <g key={tick}>
              <line x1={left} y1={yValue} x2={left + plotWidth} y2={yValue} className="history-grid" />
              <text x="8" y={yValue + 4} className="history-label">{Math.round(tick * 100)}%</text>
            </g>
          );
        })}
        <path d={path} className="history-line" />
        {ordered.map((point, index) => {
          const p = position(point, index);
          return (
            <g key={`${point.publicationBatchId}-${point.asOfDate}`}>
              <title>{`${point.asOfDate} · RS ${point.rsRankPercentile == null ? '--' : `${(point.rsRankPercentile * 100).toFixed(1)}%`} · 排名 ${point.currentRank ?? '--'}`}</title>
              <circle cx={p.x} cy={p.y} r="4" className="history-dot" />
              {(index === 0 || index === ordered.length - 1 || index % 4 === 0) && (
                <text x={p.x} y={height - 12} textAnchor="middle" className="history-label">{point.asOfDate.slice(5)}</text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
