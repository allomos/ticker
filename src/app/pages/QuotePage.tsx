import { useEffect, useState } from "react";
import { INTL_TAG } from "../../shared/locale";
import { RANGES, type Cached, type Quote, type Range, type Series } from "../../shared/market";
import { api, ApiError } from "../api";
import { AddToList } from "../components/AddToList";
import { Breadcrumb } from "../components/Breadcrumb";
import { PriceChart } from "../components/PriceChart";
import { formatChange, formatCompact, formatPrice, formatTime } from "../format";
import { useI18n } from "../i18n";

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

/** Waiting more than a couple of minutes means the daily limit: then it says from when. */
function Busy({ retryAfter, what }: { retryAfter: number; what: "price" | "chart" }) {
  const { t, locale } = useI18n();
  if (retryAfter > 120) {
    const from = new Date(Date.now() + retryAfter * 1000).toLocaleTimeString(INTL_TAG[locale], { hour: "numeric", minute: "2-digit" });
    return <p className="notice">{t.busyDay(from)}</p>;
  }
  return <p className="notice">{what === "price" ? t.busyPrice(retryAfter) : t.busyChart(retryAfter)}</p>;
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
  const { t, locale } = useI18n();
  const q = cached.data;
  const change = formatChange(q.change, q.changePercent, locale);
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
        <span className="price">{formatPrice(q.price, locale)}</span>
        <span className={`change ${change.direction}`}>{change.text}</span>
        <span className="change-label muted">{t.today}</span>
      </div>
      <div className="muted small">
        {q.isMarketOpen ? t.marketOpen : t.marketClosed} · {t.priceAsOf(formatTime(q.asOf, locale))}
        {cached.stale && ` · ${t.staleCopy}`}
      </div>
    </div>
  );
}

function QuoteDetails({ symbol }: { symbol: string }) {
  const { t, locale } = useI18n();
  const [range, setRange] = useState<Range>("1D");
  const quote = useLoad<Cached<Quote>>(`q:${symbol}`, (s) => api.quote(symbol, s));
  const chart = useLoad<Cached<Series>>(`c:${symbol}:${range}`, (s) => api.chart(symbol, range, s));

  if (quote.state === "unavailable") {
    return (
      <section>
        <h1 className="page-title">{symbol}</h1>
        <p>{t.notCovered(symbol)}</p>
      </section>
    );
  }
  if (quote.state === "error") return <p className="error">{t.pricesError}</p>;
  if (quote.state === "busy") return <Busy retryAfter={quote.retryAfter} what="price" />;
  if (quote.state === "loading") return <p className="muted">{t.loadingSymbol(symbol)}</p>;

  const q = quote.value.data;
  const dayRange = q.low != null && q.high != null ? `${formatPrice(q.low, locale)} – ${formatPrice(q.high, locale)}` : "–";
  const yearRange = q.fiftyTwoWeekLow != null && q.fiftyTwoWeekHigh != null ? `${formatPrice(q.fiftyTwoWeekLow, locale)} – ${formatPrice(q.fiftyTwoWeekHigh, locale)}` : "–";
  return (
    <section className="quote">
      <Header cached={quote.value} />
      <div className="ranges" role="tablist" aria-label={t.chartRange}>
        {RANGES.map((r) => (
          <button key={r} role="tab" aria-selected={r === range} className={r === range ? "range active" : "range"} onClick={() => setRange(r)}>
            {t.ranges[r]}
          </button>
        ))}
      </div>
      <div className="chart-box">
        {chart.state === "ok" && chart.value.data.points.length > 0 && (
          <PriceChart series={chart.value.data} baseline={range === "1D" ? q.previousClose : null} />
        )}
        {chart.state === "ok" && chart.value.data.points.length === 0 && <p className="muted chart-note">{t.noPricesForRange}</p>}
        {chart.state === "loading" && <p className="muted chart-note">{t.loadingChart}</p>}
        {chart.state === "busy" && <Busy retryAfter={chart.retryAfter} what="chart" />}
        {(chart.state === "error" || chart.state === "unavailable") && <p className="muted chart-note">{t.noChart}</p>}
      </div>
      <dl className="stats">
        <Stat label={t.statOpen} value={formatPrice(q.open, locale)} />
        <Stat label={t.statPreviousClose} value={formatPrice(q.previousClose, locale)} />
        <Stat label={t.statDayRange} value={dayRange} />
        <Stat label={t.statYearRange} value={yearRange} />
        <Stat label={t.statVolume} value={formatCompact(q.volume, locale)} />
        <Stat label={t.statAvgVolume} value={formatCompact(q.averageVolume, locale)} />
      </dl>
    </section>
  );
}

export function QuotePage({ symbol, list, query }: { symbol: string; list: string | null; query: string | null }) {
  return (
    <>
      <Breadcrumb list={list} query={query} />
      <QuoteDetails symbol={symbol} />
    </>
  );
}
