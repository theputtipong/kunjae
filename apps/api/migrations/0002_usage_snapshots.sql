CREATE TABLE usage_snapshots (
  taken_on TEXT PRIMARY KEY NOT NULL,
  taken_at TEXT NOT NULL,
  accounts INTEGER NOT NULL,
  vaults INTEGER NOT NULL,
  items INTEGER NOT NULL,
  total_revisions INTEGER NOT NULL,
  estimated_bytes INTEGER NOT NULL
);
