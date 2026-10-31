-- The sign-in code sent beside the link: kept only as a hash, with the wrong tries made against
-- it. Using the code or the link uses up the request (used_at), so both stop working.
ALTER TABLE login_tokens ADD COLUMN code_hash TEXT;
ALTER TABLE login_tokens ADD COLUMN code_tries INTEGER NOT NULL DEFAULT 0;
