export interface Env {
  DB: D1Database;
  ASSETS: Fetcher;
  MAIL_FROM: string;
  TWELVE_DATA_API_KEY?: string;
  ALPHA_VANTAGE_API_KEY?: string;
  /** The one account that sees Alpha Vantage's data (its free key is for personal use only). */
  MARKET_OWNER_EMAIL?: string;
  /** Master key for users' API keys kept on the server: 32 random bytes, base64. */
  KEY_ENCRYPTION_KEY?: string;
  RESEND_API_KEY?: string;
}
