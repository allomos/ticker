// The home page for a visitor who isn't signed in: what Ticker does, an example list, and the
// way in. Built from the mock-up the approver chose (A01-hinge715).
import { DEFAULT_LIST_NAME, INTL_TAG } from "../../shared/locale";
import { ChartIcon, ListIcon, MailIcon, SearchIcon } from "../components/Icons";
import { formatPrice } from "../format";
import { useI18n } from "../i18n";
import { Link } from "../router";

const EXAMPLE = [
  { symbol: "AAPL", name: "Apple", price: 228.4, change: 1.2 },
  { symbol: "NVDA", name: "NVIDIA", price: 131.05, change: 2.8 },
  { symbol: "EUR/USD", name: "Euro", price: 1.0842, change: -0.3 },
  { symbol: "BTC/USD", name: "Bitcoin", price: 68210, change: 0.9 },
];

function ExampleList() {
  const { t, locale } = useI18n();
  const pct = new Intl.NumberFormat(INTL_TAG[locale], { style: "percent", minimumFractionDigits: 1, maximumFractionDigits: 1, signDisplay: "always" });
  return (
    <figure className="example-list" aria-label={t.example}>
      <figcaption className="example-head">
        <span>{DEFAULT_LIST_NAME[locale]}</span>
        <span className="muted small">{t.example}</span>
      </figcaption>
      {EXAMPLE.map((r) => (
        <div className="example-row" key={r.symbol}>
          <b>{r.symbol}</b>
          <span className="muted">{r.name}</span>
          <span className="num">{formatPrice(r.price, locale)}</span>
          <span className={r.change >= 0 ? "num up" : "num down"}>{pct.format(r.change / 100).replace("-", "−")}</span>
        </div>
      ))}
      <svg className="example-chart" viewBox="0 0 240 44" preserveAspectRatio="none" aria-hidden="true">
        <polyline points="0,34 20,30 40,32 60,24 80,27 100,20 120,22 140,14 160,18 180,10 200,13 220,6 240,8" />
      </svg>
    </figure>
  );
}

export function FrontPage() {
  const { t } = useI18n();
  const focusSearch = () => document.querySelector<HTMLInputElement>(".search-input")?.focus();
  return (
    <section className="front">
      <div className="hero">
        <div>
          <h1 className="hero-title">{t.homeTitle}</h1>
          <p className="hero-text">{t.homeIntro}</p>
          <div className="hero-actions">
            <Link className="button" href="/signin">
              {t.homeSignIn}
            </Link>
            <button className="button button-quiet" onClick={focusSearch}>
              {t.trySearch}
            </button>
          </div>
          <p className="hero-note muted small">
            <MailIcon /> {t.noPassword}
          </p>
        </div>
        <ExampleList />
      </div>
      <ul className="features">
        <li>
          <span className="feature-icon teal">
            <SearchIcon />
          </span>
          <b>{t.featureFind}</b>
          <span className="muted small">{t.featureFindText}</span>
        </li>
        <li>
          <span className="feature-icon coral">
            <ListIcon />
          </span>
          <b>{t.featureLists}</b>
          <span className="muted small">{t.featureListsText}</span>
        </li>
        <li>
          <span className="feature-icon gold">
            <ChartIcon />
          </span>
          <b>{t.featureCharts}</b>
          <span className="muted small">{t.featureChartsText}</span>
        </li>
      </ul>
    </section>
  );
}
