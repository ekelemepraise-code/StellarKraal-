'use client';
import { healthColor, colors } from '@/lib/design-tokens';

interface Props {
  value: number; // bps, 10_000 = 1.0
}

export default function HealthGauge({ value }: Props) {
  const ratio = Math.min(value / 20_000, 1);
  const pct = Math.round(ratio * 100);
  const color = healthColor(value);
  const label = value >= 10_000 ? 'Healthy' : 'At Risk';
  const displayValue = (value / 10_000).toFixed(2);

  return (
    <div className="mt-4">
      <div className="flex justify-between text-sm mb-1">
        <span className="font-semibold" style={{ color }}>
          {label}
        </span>
        <span className={colors.text.secondary}>{displayValue}x</span>
      </div>
      <svg
        role="img"
        aria-label={`Health factor: ${displayValue}`}
        width="100%"
        height="16"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
      >
        <title>{`Health factor: ${displayValue}`}</title>
        <rect width="100%" height="16" rx="8" fill="#e5e7eb" />
        <rect
          width={`${pct}%`}
          height="16"
          rx="8"
          fill={color}
          style={{ transition: 'width 0.5s' }}
        />
      </svg>
    </div>
  );
}
