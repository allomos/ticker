export interface Env {
  DB: D1Database;
  ASSETS: Fetcher;
  APP_URL: string;
  MAIL_FROM: string;
  TWELVE_DATA_API_KEY?: string;
  RESEND_API_KEY?: string;
}
