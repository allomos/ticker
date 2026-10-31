import { AuthProvider, useAuth } from "./auth";
import { SearchBox } from "./components/SearchBox";
import { UserMenu } from "./components/UserMenu";
import { QuotePage } from "./pages/QuotePage";
import { SearchPage } from "./pages/SearchPage";
import { SignInPage, VerifyPage } from "./pages/SignInPage";
import { Link, useLocation } from "./router";

function Home() {
  const { user } = useAuth();
  if (user === undefined) return null;
  if (!user) {
    return (
      <section className="home narrow">
        <h1 className="page-title">Keep an eye on the markets</h1>
        <p>Search stocks, ETFs, currencies and crypto by name or ticker, keep them in your own lists, and open any of them for its price, chart and key figures.</p>
        <p>
          <Link className="button" href="/signin">
            Sign in to make your lists
          </Link>
        </p>
      </section>
    );
  }
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

function Routes() {
  const location = useLocation();
  const path = location.pathname;
  if (path === "/") return <Home />;
  if (path === "/search") return <SearchPage query={location.searchParams.get("q") ?? ""} key={location.search} />;
  if (path === "/signin") return <SignInPage />;
  if (path === "/signin/verify") return <VerifyPage token={location.searchParams.get("token") ?? ""} />;
  if (path.startsWith("/quote/")) {
    const symbol = decodeURIComponent(path.slice("/quote/".length));
    return <QuotePage symbol={symbol} key={symbol} />;
  }
  return <NotFound />;
}

export function App() {
  return (
    <AuthProvider>
      <div className="app">
        <header className="topbar">
          <Link className="brand" href="/">
            Ticker
          </Link>
          <SearchBox />
          <UserMenu />
        </header>
        <main className="page">
          <Routes />
        </main>
      </div>
    </AuthProvider>
  );
}
