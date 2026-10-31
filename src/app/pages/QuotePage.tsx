import { useEffect, useState } from "react";
import { RANGES, type Cached, type Quote, type Range, type Series } from "../../shared/market";
import { api, ApiError } from "../api";
import { AddToList } from "../components/AddToList";
import { PriceChart } from "../components/PriceChart";
import { formatChange, formatCompact, formatPrice, formatTime } from "../format";

type Load<T> = { state: "loading" } | { state: "ok"; value: T } | { state: "busy"; retryAfter: number } | { state: "unavailable" } | { state: "error" };

/** Loads with `fn`; when the data plan's limit is reached, waits and tries again by itself. */
function useLoad<T>(key: string, fn: (signal: AbortSignal) => Promise<T>): Load<T> {
  const [load, setLoad] = useState<Load<T>>({ state: "loading" });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const ctrl = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    if (attempt === 0) setLoad({ state: "loading" });
    fn(ctrl.signal)
      .then((value) => setLoad({ state: "ok", value }))
      .catch((e) => {
        if (ctrl.signal.aborted) return;
        if (e instanceof ApiError && e.status === 503) {
          const retryAfter = e.retryAfter ?? 30;
          setLoad({ state: "busy", retryAfter });
          timer = setTimeout(() => setAttempt((a) => a + 1), retryAfter * 1000);
        } else if (e instanceof ApiError && e.status === 404) setLoad({ state: "unavailable" });
        else setLoad({ state: "error" });
      });
    return () => {
      ctrl.abort();
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, attempt]);
  useEffect(() => setAttempt(0), [key]);
  return load;
}

function Busy({ retryAfter, what }: { retryAfter: number; what: string }) {
  return (
    <p className="notice">
      The free data plan's limit for this minute is reached. The {what} loads by itself in about {retryAfter} seconds.
    </p>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="stat">
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function Header({ cached }: { cached: Cached<Quote> }) {
  const q = cached.data;
  const change = formatChange(q.change, q.changePercent);
  return (
    <div className="quote-head">
      <div className="quote-names">
        <div>
          <h1 className="quote-name">{q.name}</h1>
          <div className="muted">
            {q.symbol} · {q.exchange}
            {q.currency ? ` · ${q.currency}` : ""}
          </div>
        </div>
        <AddToList target={{ symbol: q.symbol, name: q.name, exchange: q.exchange }} />
      </div>
      <div className="quote-price">
        <span className="price">{formatPrice(q.price)}</span>
        <span className={`change ${change.direction}`}>{change.text}</span>
        <span className="change-label muted">today</span>
      </div>
      <div className="muted small">
        {q.isMarketOpen ? "Market open" : "Market closed"} · Price as of {formatTime(q.asOf)}
        {cached.stale && " · An older copy: it refreshes when the data plan allows"}
      </div>
    </div>
  );
}

export function QuotePage({ symbol }: { symbol: string }) {
  const [range, setRange] = useState<Range>("1D");
  const quote = useLoad<Cached<Quote>>(`q:${symbol}`, (s) => api.quote(symbol, s));
  const chart = useLoad<Cached<Series>>(`c:${symbol}:${range}`, (s) => api.chart(symbol, range, s));

  if (quote.state === "unavailable") {
    return (
      <section>
        <h1 className="page-title">{symbol}</h1>
        <p>The app's free price data does not cover {symbol}, or it does not exist.</p>
      </section>
    );
  }
  if (quote.state === "error") return <p className="error">Prices are not answering. Try again in a moment.</p>;
  if (quote.state === "busy") return <Busy retryAfter={quote.retryAfter} what="price" />;
  if (quote.state === "loading") return <p className="muted">Loading {symbol}…</p>;

  const q = quote.value.data;
  const dayRange = q.low != null && q.high != null ? `${formatPrice(q.low)} – ${formatPrice(q.high)}` : "–";
  const yearRange = q.fiftyTwoWeekLow != null && q.fiftyTwoWeekHigh != null ? `${formatPrice(q.fiftyTwoWeekLow)} – ${formatPrice(q.fiftyTwoWeekHigh)}` : "–";
  return (
    <section className="quote">
      <Header cached={quote.value} />
      <div className="ranges" role="tablist" aria-label="Chart range">
        {RANGES.map((r) => (
          <button key={r} role="tab" aria-selected={r === range} className={r === range ? "range active" : "range"} onClick={() => setRange(r)}>
            {r}
          </button>
        ))}
      </div>
      <div className="chart-box">
        {chart.state === "ok" && chart.value.data.points.length > 0 && (
          <PriceChart series={chart.value.data} baseline={range === "1D" ? q.previousClose : null} />
        )}
        {chart.state === "ok" && chart.value.data.points.length === 0 && <p className="muted chart-note">No prices for this range.</p>}
        {chart.state === "loading" && <p className="muted chart-note">Loading chart…</p>}
        {chart.state === "busy" && <Busy retryAfter={chart.retryAfter} what="chart" />}
        {(chart.state === "error" || chart.state === "unavailable") && <p className="muted chart-note">No chart for this range.</p>}
      </div>
      <dl className="stats">
        <Stat label="Open" value={formatPrice(q.open)} />
        <Stat label="Previous close" value={formatPrice(q.previousClose)} />
        <Stat label="Day range" value={dayRange} />
        <Stat label="52-week range" value={yearRange} />
        <Stat label="Volume" value={formatCompact(q.volume)} />
        <Stat label="Avg. volume" value={formatCompact(q.averageVolume)} />
      </dl>
    </section>
  );
}
