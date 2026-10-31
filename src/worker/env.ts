export interface Env {
  DB: D1Database;
  ASSETS: Fetcher;
  MAIL_FROM: string;
  TWELVE_DATA_API_KEY?: string;
  RESEND_API_KEY?: string;
}
