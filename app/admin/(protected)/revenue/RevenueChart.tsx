'use client';

// Simple SVG bar chart for daily revenue. No external deps.

export function RevenueChart({
  daily,
}: {
  daily: Array<{ date: string; amount_cents: number }>;
}) {
  const maxCents = Math.max(...daily.map((d) => d.amount_cents), 100);
  const width = Math.max(daily.length * 18, 400);
  const height = 180;
  const padX = 24;
  const padY = 16;
  const innerW = width - padX * 2;
  const innerH = height - padY * 2;
  const barW = (innerW / daily.length) * 0.7;
  const barGap = (innerW / daily.length) * 0.3;

  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${width} ${height}`} className="block min-w-full" preserveAspectRatio="none">
        {/* Y-axis grid lines (4) */}
        {[0.25, 0.5, 0.75, 1].map((p) => (
          <line
            key={p}
            x1={padX}
            x2={width - padX}
            y1={padY + innerH * (1 - p)}
            y2={padY + innerH * (1 - p)}
            stroke="#E5E7EB"
            strokeDasharray="2 4"
          />
        ))}

        {/* Bars */}
        {daily.map((d, i) => {
          const h = (d.amount_cents / maxCents) * innerH;
          const x = padX + i * (barW + barGap) + barGap / 2;
          const y = padY + innerH - h;
          return (
            <g key={d.date}>
              <rect
                x={x}
                y={y}
                width={barW}
                height={Math.max(1, h)}
                rx={2}
                fill="#ff7783"
                opacity={d.amount_cents > 0 ? 0.9 : 0.15}
              >
                <title>
                  {d.date} · ${(d.amount_cents / 100).toFixed(2)}
                </title>
              </rect>
            </g>
          );
        })}

        {/* X-axis label (first + last) */}
        <text x={padX} y={height - 2} fontSize="10" fill="#94A3B8">
          {daily[0]?.date.slice(5)}
        </text>
        {daily.length > 1 && (
          <text x={width - padX} y={height - 2} fontSize="10" fill="#94A3B8" textAnchor="end">
            {daily[daily.length - 1]?.date.slice(5)}
          </text>
        )}
      </svg>
    </div>
  );
}
