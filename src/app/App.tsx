import { AuthProvider, useAuth } from "./auth";
import { LanguageSwitcher } from "./components/LanguageSwitcher";
import { SearchBox } from "./components/SearchBox";
import { I18nProvider, useI18n } from "./i18n";
import { ListsProvider } from "./lists";
import { ListsPage } from "./pages/ListsPage";
import { UserMenu } from "./components/UserMenu";
import { QuotePage } from "./pages/QuotePage";
import { SearchPage } from "./pages/SearchPage";
import { SignInPage, VerifyPage } from "./pages/SignInPage";
import { Link, useLocation } from "./router";

function Home({ selected }: { selected: string | null }) {
  const { user } = useAuth();
  const { t } = useI18n();
  if (user === undefined) return null;
  if (!user) {
    return (
      <section className="home narrow">
        <h1 className="page-title">{t.homeTitle}</h1>
        <p>{t.homeIntro}</p>
        <p>
          <Link className="button" href="/signin">
            {t.homeSignIn}
          </Link>
        </p>
      </section>
    );
  }
  return <ListsPage selected={selected} />;
}

function NotFound() {
  const { t } = useI18n();
  return (
    <section>
      <h1 className="page-title">{t.notFoundTitle}</h1>
      <p>
        <Link href="/">{t.notFoundBack}</Link>
      </p>
    </section>
  );
}

function Routes() {
  const location = useLocation();
  const path = location.pathname;
  if (path === "/") return <Home selected={location.searchParams.get("list")} />;
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
    <I18nProvider>
      <AuthProvider>
        <ListsProvider>
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
            <footer className="footer">
              <LanguageSwitcher />
            </footer>
          </div>
        </ListsProvider>
      </AuthProvider>
    </I18nProvider>
  );
}
