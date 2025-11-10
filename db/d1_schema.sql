-- D1 schema for web intake telemetry
-- Create database in Cloudflare: Workers & Pages → D1 → Create (name: intake)
-- Bind to Pages project as: DB

PRAGMA journal_mode=WAL;

CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ts TEXT NOT NULL,
  ip TEXT,
  country TEXT,
  colo TEXT,
  asn INTEGER,
  path TEXT,
  form_id TEXT,
  honey INTEGER NOT NULL DEFAULT 0,
  score INTEGER NOT NULL DEFAULT 0,
  class TEXT,
  ua TEXT,
  cf_ray TEXT,
  fields_json TEXT
);

CREATE INDEX IF NOT EXISTS idx_events_ts ON events(ts);
CREATE INDEX IF NOT EXISTS idx_events_ip ON events(ip);
CREATE INDEX IF NOT EXISTS idx_events_score ON events(score);
CREATE INDEX IF NOT EXISTS idx_events_honey ON events(honey);

