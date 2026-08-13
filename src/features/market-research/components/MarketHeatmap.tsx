import { Empty, Tooltip } from 'antd';
import type { MarketResearchSector } from '../model/types';

interface Props {
  sectors: MarketResearchSector[];
  onSelect: (sector: MarketResearchSector) => void;
}

function tileTone(value: number | null): string {
  if (value == null) return 'neutral';
  if (value >= 0.04) return 'up-strong';
  if (value >= 0.015) return 'up';
  if (value > -0.015) return 'flat';
  if (value > -0.04) return 'down';
  return 'down-strong';
}

function percent(value: number | null): string {
  if (value == null) return '--';
  return `${value >= 0 ? '+' : ''}${(value * 100).toFixed(1)}%`;
}

export function MarketHeatmap({ sectors, onSelect }: Props) {
  if (sectors.length === 0) return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无可展示板块" />;

  return (
    <div className="research-heatmap" data-testid="research-heatmap">
      {sectors.slice(0, 24).map((sector) => (
        <Tooltip
          key={sector.sectorId}
          title={`${sector.sectorName} · 相对收益 ${percent(sector.relativeReturn)} · RS ${percent(sector.rsRankPercentile)}`}
        >
          <button
            type="button"
            className={`research-heatmap__tile research-heatmap__tile--${tileTone(sector.relativeReturn)}`}
            onClick={() => onSelect(sector)}
            aria-label={`查看${sector.sectorName}板块详情`}
          >
            <strong>{sector.sectorName}</strong>
            <span>{percent(sector.relativeReturn)}</span>
            <small>RS {percent(sector.rsRankPercentile)}</small>
          </button>
        </Tooltip>
      ))}
    </div>
  );
}
