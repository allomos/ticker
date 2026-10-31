export interface Env {
  DB: D1Database;
  ASSETS: Fetcher;
  MAIL_FROM: string;
  TWELVE_DATA_API_KEY?: string;
  ALPHA_VANTAGE_API_KEY?: string;
  /** The one account that sees Alpha Vantage's data (its free key is for personal use only). */
  MARKET_OWNER_EMAIL?: string;
  RESEND_API_KEY?: string;
}
