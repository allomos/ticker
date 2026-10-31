import { SearchBox } from "./components/SearchBox";
import { SearchPage } from "./pages/SearchPage";
import { Link, useLocation } from "./router";

function Home() {
  return (
    <section className="home">
      <h1 className="page-title">Your lists</h1>
      <p className="muted">Search for a stock, ETF, currency or crypto by name or ticker to see its price and chart.</p>
    </section>
  );
}

function NotFound() {
  return (
    <section>
      <h1 className="page-title">Page not found</h1>
      <p>
        <Link href="/">Back to your lists</Link>
      </p>
    </section>
  );
}

export function App() {
  const location = useLocation();
  const path = location.pathname;
  let page;
  if (path === "/") page = <Home />;
  else if (path === "/search") page = <SearchPage query={location.searchParams.get("q") ?? ""} key={location.search} />;
  else page = <NotFound />;
  return (
    <div className="app">
      <header className="topbar">
        <Link className="brand" href="/">
          Ticker
        </Link>
        <SearchBox />
      </header>
      <main className="page">{page}</main>
    </div>
  );
}
