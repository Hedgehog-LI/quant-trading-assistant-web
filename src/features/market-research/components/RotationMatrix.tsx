import { Empty } from 'antd';
import type { MarketResearchSector, RotationState } from '../model/types';

interface Props {
  sectors: MarketResearchSector[];
  onSelect: (sector: MarketResearchSector) => void;
}

const STATE_LABEL: Record<RotationState, string> = {
  LEADING: '领先',
  IMPROVING: '改善',
  WEAKENING: '转弱',
  LAGGING: '落后',
  INSUFFICIENT_DATA: '样本不足',
};

function x(value: number | null): number {
  return 50 + Math.max(0, Math.min(1, value ?? 0.5)) * 540;
}

function y(value: number | null): number {
  const normalized = Math.max(-0.25, Math.min(0.25, value ?? 0));
  return 165 - normalized * 500;
}

export function RotationMatrix({ sectors, onSelect }: Props) {
  if (sectors.length === 0) return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无轮动样本" />;
  const labels = new Set(sectors.slice().sort((a, b) => (a.currentRank ?? 999) - (b.currentRank ?? 999))
    .slice(0, 14).map((sector) => sector.sectorId));

  return (
    <div className="rotation-matrix" data-testid="rotation-matrix">
      <svg viewBox="0 0 640 360" role="img" aria-label="板块相对强弱和短期位次变化四象限图">
        <rect x="50" y="35" width="270" height="130" className="quadrant quadrant--improving" />
        <rect x="320" y="35" width="270" height="130" className="quadrant quadrant--leading" />
        <rect x="50" y="165" width="270" height="130" className="quadrant quadrant--lagging" />
        <rect x="320" y="165" width="270" height="130" className="quadrant quadrant--weakening" />
        <line x1="320" y1="35" x2="320" y2="295" className="matrix-axis" />
        <line x1="50" y1="165" x2="590" y2="165" className="matrix-axis" />
        <text x="62" y="57" className="quadrant-label">改善</text>
        <text x="538" y="57" className="quadrant-label">领先</text>
        <text x="62" y="286" className="quadrant-label">落后</text>
        <text x="538" y="286" className="quadrant-label">转弱</text>
        <text x="250" y="328" className="axis-label">中期相对强弱百分位 →</text>
        <text x="18" y="205" className="axis-label" transform="rotate(-90 18 205)">短期位次变化 →</text>
        {sectors.map((sector) => (
          <g
            key={sector.sectorId}
            className="matrix-point"
            transform={`translate(${x(sector.rsRankPercentile)} ${y(sector.rankPercentileChange)})`}
            onClick={() => onSelect(sector)}
            role="button"
            tabIndex={0}
            onKeyDown={(event) => { if (event.key === 'Enter') onSelect(sector); }}
            aria-label={`查看${sector.sectorName}，${STATE_LABEL[sector.rotationState]}`}
          >
            <title>{`${sector.sectorName} · ${STATE_LABEL[sector.rotationState]}`}</title>
            <circle r="7" className={`matrix-dot matrix-dot--${sector.rotationState.toLowerCase()}`} />
            {labels.has(sector.sectorId) && <text x="10" y="4" className="matrix-point__label">{sector.sectorName}</text>}
          </g>
        ))}
      </svg>
    </div>
  );
}
