CREATE TABLE account_daily_usage (
  account_id TEXT NOT NULL,
  day TEXT NOT NULL,
  pulls INTEGER NOT NULL,
  changes INTEGER NOT NULL,
  PRIMARY KEY (account_id, day)
);
