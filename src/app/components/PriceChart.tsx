import { AreaSeries, createChart, LineStyle, type IChartApi, type UTCTimestamp } from "lightweight-charts";
import { useEffect, useRef } from "react";
import type { Range, Series } from "../../shared/market";

function cssVar(name: string) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

const intraday = (range: Range) => range === "1D" || range === "5D" || range === "1M";

function formatter(range: Range, timeZone: string) {
  const opts: Intl.DateTimeFormatOptions = intraday(range)
    ? { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone }
    : { year: "numeric", month: "short", day: "numeric", timeZone: "UTC" };
  const fmt = new Intl.DateTimeFormat(undefined, opts);
  return (t: number) => fmt.format(new Date(t * 1000));
}

function tickFormatter(range: Range, timeZone: string) {
  const time = new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit", timeZone });
  const day = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", timeZone: intraday(range) ? timeZone : "UTC" });
  const year = new Intl.DateTimeFormat(undefined, { year: "numeric", timeZone: "UTC" });
  return (t: number) => {
    const d = new Date(t * 1000);
    if (range === "1D") return time.format(d);
    if (range === "5Y" || range === "MAX") return year.format(d);
    return day.format(d);
  };
}

/** The price over one range; green when it rose over the range, red when it fell. */
export function PriceChart({ series, baseline }: { series: Series; baseline?: number | null }) {
  const box = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const points = series.points;
    const first = baseline ?? points[0]?.c ?? 0;
    const last = points[points.length - 1]?.c ?? 0;
    const color = last >= first ? cssVar("--up") : cssVar("--down");
    const chart = createChart(el, {
      autoSize: true,
      layout: { background: { color: "transparent" }, textColor: cssVar("--muted"), attributionLogo: false },
      grid: { vertLines: { visible: false }, horzLines: { color: cssVar("--border") } },
      rightPriceScale: { borderVisible: false },
      timeScale: {
        borderVisible: false,
        timeVisible: intraday(series.range),
        fixLeftEdge: true,
        fixRightEdge: true,
        tickMarkFormatter: tickFormatter(series.range, series.timezone),
      },
      localization: { timeFormatter: formatter(series.range, series.timezone) },
      crosshair: { horzLine: { visible: false } },
      handleScroll: false,
      handleScale: false,
    });
    chartRef.current = chart;
    const area = chart.addSeries(AreaSeries, {
      lineColor: color,
      topColor: `${color}55`,
      bottomColor: `${color}05`,
      lineWidth: 2,
      priceLineVisible: false,
    });
    area.setData(points.map((p) => ({ time: p.t as UTCTimestamp, value: p.c })));
    if (baseline != null) {
      area.createPriceLine({ price: baseline, color: cssVar("--muted"), lineStyle: LineStyle.Dashed, lineWidth: 1, axisLabelVisible: false, title: "Prev close" });
    }
    chart.timeScale().fitContent();
    return () => {
      chart.remove();
      chartRef.current = null;
    };
  }, [series, baseline]);

  return <div className="chart" ref={box} role="img" aria-label={`${series.symbol} price chart, ${series.range}`} />;
}
