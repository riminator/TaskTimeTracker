#!/usr/bin/env bash
# =============================================================================
# import-csv-to-postgres.sh
#
# Imports a Railway CSV export directly into your own Postgres time_entries table.
#
# Usage:
#   TARGET_DATABASE_URL='postgresql://user:pass@host:5432/dbname' \
#   ./scripts/import-csv-to-postgres.sh path/to/time-entries.csv
# =============================================================================

set -euo pipefail

CSV_FILE="${1:-}"
TARGET_URL="${TARGET_DATABASE_URL:-}"

# ── Validate inputs ──────────────────────────────────────────────────────────
if [[ -z "$CSV_FILE" ]]; then
  echo "❌  No CSV file specified."
  echo "    Usage: ./scripts/import-csv-to-postgres.sh path/to/time-entries.csv"
  exit 1
fi

if [[ ! -f "$CSV_FILE" ]]; then
  echo "❌  File not found: $CSV_FILE"
  exit 1
fi

if [[ -z "$TARGET_URL" ]]; then
  echo "❌  TARGET_DATABASE_URL is not set."
  echo "    Export it or set it inline:"
  echo "    TARGET_DATABASE_URL='postgresql://...' ./scripts/import-csv-to-postgres.sh file.csv"
  exit 1
fi

if ! command -v psql &>/dev/null; then
  echo "❌  psql not found. Install with: brew install libpq && brew link --force libpq"
  exit 1
fi

echo ""
echo "═══════════════════════════════════════════════════════"
echo "  Task Time Tracker — CSV → Postgres Import"
echo "  File: $CSV_FILE"
echo "═══════════════════════════════════════════════════════"
echo ""

# ── Step 1: Ensure table exists ──────────────────────────────────────────────
echo "▶  Step 1/3  Ensuring time_entries table exists..."
psql "$TARGET_URL" <<'SQL'
CREATE TABLE IF NOT EXISTS time_entries (
  id TEXT PRIMARY KEY,
  project_code TEXT NOT NULL DEFAULT 'GENERAL',
  task_type TEXT NOT NULL DEFAULT 'meeting',
  duration_minutes NUMERIC NOT NULL,
  entry_date DATE NOT NULL,
  start_time TIMESTAMPTZ,
  end_time TIMESTAMPTZ,
  description TEXT,
  meeting_id TEXT,
  meeting_title TEXT,
  billable BOOLEAN NOT NULL DEFAULT FALSE,
  confidence NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'logged',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ,
  organizer TEXT,
  attendees TEXT
);
CREATE INDEX IF NOT EXISTS idx_time_entries_entry_date    ON time_entries (entry_date);
CREATE INDEX IF NOT EXISTS idx_time_entries_project_code ON time_entries (project_code);
CREATE INDEX IF NOT EXISTS idx_time_entries_billable      ON time_entries (billable);
SQL
echo "   ✅  Table ready"
echo ""

# ── Steps 2 & 3: Load CSV into staging and insert into time_entries ──────────
# Both steps run in a single psql session so the TEMP TABLE is still alive
# when the INSERT runs.
echo "▶  Step 2/3  Loading CSV into staging table..."
echo "▶  Step 3/3  Inserting into time_entries (skipping duplicates)..."

# Use an absolute path so psql \COPY can find the file
ABS_CSV="$(cd "$(dirname "$CSV_FILE")" && pwd)/$(basename "$CSV_FILE")"

psql "$TARGET_URL" <<SQL
CREATE TEMP TABLE _csv_import_staging (
  id            TEXT,
  entry_date    TEXT,
  project_code  TEXT,
  task_type     TEXT,
  dur_minutes   TEXT,
  dur_hours     TEXT,
  billable_raw  TEXT,
  meeting_title TEXT,
  description   TEXT,
  confidence    TEXT,
  created_at    TEXT
);

\COPY _csv_import_staging FROM '$ABS_CSV' CSV HEADER;

SELECT COUNT(*) AS rows_loaded FROM _csv_import_staging;

INSERT INTO time_entries (
  id,
  entry_date,
  project_code,
  task_type,
  duration_minutes,
  meeting_title,
  description,
  billable,
  confidence,
  created_at,
  status
)
SELECT
  id,
  entry_date::DATE,
  project_code,
  task_type,
  dur_minutes::NUMERIC,
  meeting_title,
  description,
  CASE WHEN LOWER(billable_raw) IN ('yes','true','1') THEN TRUE ELSE FALSE END,
  confidence::NUMERIC,
  created_at::TIMESTAMPTZ,
  'logged'
FROM _csv_import_staging
ON CONFLICT (id) DO NOTHING;

SELECT COUNT(*) AS total_rows_in_table FROM time_entries;
SQL

echo "   ✅  Import complete"
echo ""

FINAL_COUNT=$(psql "$TARGET_URL" -t -c "SELECT COUNT(*) FROM time_entries;" | tr -d ' ')
echo "═══════════════════════════════════════════════════════"
echo "  Done! Rows now in time_entries: $FINAL_COUNT"
echo "═══════════════════════════════════════════════════════"
echo ""
