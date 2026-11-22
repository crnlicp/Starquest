import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { BehaviorCount, Bucket } from "~/bindings/backend";
import { BehaviorKind } from "~/bindings/backend";
import { dayFormat, dayToDate } from "~/lib/days";

// Bar with a 4px rounded data end and a square end on the baseline.
function barPath(x: number, w: number, base: number, end: number) {
  const up = end < base;
  const h = Math.abs(base - end);
  if (h < 0.5) return "";
  const r = Math.min(4, h, w / 2);
  const s = up ? 1 : -1;
  return [
    `M${x},${base}`,
    `V${end + s * r}`,
    `Q${x},${end} ${x + r},${end}`,
    `H${x + w - r}`,
    `Q${x + w},${end} ${x + w},${end + s * r}`,
    `V${base}`,
    "Z",
  ].join(" ");
}

function bucketLabel(b: Bucket, language: string, long = false) {
  const date = dayToDate(Number(b.startDay));
  if (Number(b.days) > 7) return dayFormat(language, { month: long ? "long" : "short" }).format(date);
  if (Number(b.days) > 1) return dayFormat(language, { day: "numeric", month: "short" }).format(date);
  return dayFormat(language, long ? { weekday: "long", day: "numeric", month: "short" } : { day: "numeric" }).format(date);
}

function Legend() {
  const { t } = useTranslation();
  return (
    <div className="chart-legend">
      <span><i className="swatch swatch--earned" /> {t("reports.earned")}</span>
      <span><i className="swatch swatch--lost" /> {t("reports.lost")}</span>
    </div>
  );
}

// Points earned above the line and lost below it, one bar pair per day (or week, or month).
export function PointsChart({ buckets }: { buckets: Bucket[] }) {
  const { t, i18n } = useTranslation();
  const [hover, setHover] = useState<number | null>(null);
  const [table, setTable] = useState(false);
  const W = 320;
  const H = 170;
  const top = 8;
  const bottom = 20;
  const maxE = Math.max(0, ...buckets.map((b) => Number(b.earned)));
  const maxL = Math.max(0, ...buckets.map((b) => Number(b.lost)));
  const total = Math.max(1, maxE + maxL);
  const plot = H - top - bottom;
  const base = top + (plot * maxE) / total + (maxE + maxL === 0 ? plot / 2 : 0);
  const scale = plot / total;
  const band = W / Math.max(1, buckets.length);
  const barW = Math.min(24, band * 0.6);
  // Label every bar when few, otherwise about six evenly spaced.
  const every = Math.max(1, Math.ceil(buckets.length / 6));
  const hovered = hover === null ? null : buckets[hover];

  return (
    <figure className="chart">
      <div className="row">
        <Legend />
        <button type="button" className="chip chip--quiet" aria-pressed={table} onClick={() => setTable(!table)}>
          {table ? t("reports.showChart") : t("reports.showTable")}
        </button>
      </div>
      {table ? (
        <table className="chart-table">
          <thead>
            <tr>
              <th>{t("reports.when")}</th>
              <th>{t("reports.earned")}</th>
              <th>{t("reports.lost")}</th>
            </tr>
          </thead>
          <tbody>
            {buckets.map((b) => (
              <tr key={String(b.startDay)}>
                <td>{bucketLabel(b, i18n.language, true)}</td>
                <td>+{Number(b.earned)}</td>
                <td>−{Number(b.lost)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <div className="chart-plot" onMouseLeave={() => setHover(null)}>
          <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={t("reports.chartLabel")} data-testid="points-chart">
            <line x1={0} x2={W} y1={base} y2={base} className="chart-axis" />
            {buckets.map((b, i) => {
              const x = i * band + (band - barW) / 2;
              return (
                <g key={String(b.startDay)} className={hover !== null && hover !== i ? "chart-dim" : undefined}>
                  <path d={barPath(x, barW, base - 1, base - 1 - Number(b.earned) * scale)} className="bar bar--earned" />
                  <path d={barPath(x, barW, base + 1, base + 1 + Number(b.lost) * scale)} className="bar bar--lost" />
                  {i % every === 0 && (
                    <text x={i * band + band / 2} y={H - 4} className="chart-tick" textAnchor="middle">
                      {bucketLabel(b, i18n.language)}
                    </text>
                  )}
                  {/* The hit target is the whole column, wider than the bar. */}
                  <rect
                    x={i * band} y={0} width={band} height={H - bottom} fill="transparent" tabIndex={0}
                    aria-label={`${bucketLabel(b, i18n.language, true)}: +${Number(b.earned)}, −${Number(b.lost)}`}
                    onMouseEnter={() => setHover(i)} onFocus={() => setHover(i)} onBlur={() => setHover(null)}
                    onClick={() => setHover(i)}
                  />
                </g>
              );
            })}
          </svg>
          {hovered && hover !== null && (
            <div className="chart-tip" style={{ left: `${((hover + 0.5) / buckets.length) * 100}%` }} role="status">
              <strong>{bucketLabel(hovered, i18n.language, true)}</strong>
              <span><i className="swatch swatch--earned" /> +{Number(hovered.earned)}</span>
              <span><i className="swatch swatch--lost" /> −{Number(hovered.lost)}</span>
            </div>
          )}
        </div>
      )}
    </figure>
  );
}

// Good moments against oopses, as one split bar with the counts written out.
export function RatioBar({ good, oops }: { good: number; oops: number }) {
  const { t } = useTranslation();
  const total = good + oops;
  if (total === 0) return <p className="muted">{t("reports.nothingYet")}</p>;
  return (
    <div className="ratio" data-testid="ratio">
      <div className="ratio__bar" role="img" aria-label={t("reports.ratioLabel", { good, oops })}>
        {good > 0 && <span className="ratio__good" style={{ flexGrow: good }} />}
        {oops > 0 && <span className="ratio__oops" style={{ flexGrow: oops }} />}
      </div>
      <div className="row">
        <span><i className="swatch swatch--earned" /> {t("reports.goodCount", { count: good })}</span>
        <span><i className="swatch swatch--lost" /> {t("reports.oopsCount", { count: oops })}</span>
      </div>
    </div>
  );
}

export function TopBehaviors({ items }: { items: BehaviorCount[] }) {
  const { t } = useTranslation();
  if (items.length === 0) return <p className="muted">{t("reports.nothingYet")}</p>;
  const max = Math.max(...items.map((b) => Number(b.count)));
  return (
    <ol className="top-list">
      {items.map((b) => (
        <li key={String(b.behaviorId)}>
          <span className="top-list__name">
            {b.emoji ?? "⭐"} {b.title}
          </span>
          <span className="top-list__meter">
            <span
              className={b.kind === BehaviorKind.good ? "bar--earned" : "bar--lost"}
              style={{ width: `${(Number(b.count) / max) * 100}%` }}
            />
          </span>
          <span className="top-list__count">×{Number(b.count)}</span>
        </li>
      ))}
    </ol>
  );
}
