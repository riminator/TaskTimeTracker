#!/usr/bin/env bash
# =============================================================================
# migrate-from-railway.sh
#
# Dumps the time_entries table from your Railway Postgres and restores it
# into your own Postgres server.
#
# Usage:
#   chmod +x scripts/migrate-from-railway.sh
#   ./scripts/migrate-from-railway.sh
#
# Prerequisites:
#   - pg_dump and psql installed  (brew install libpq && brew link --force libpq)
#   - Set the two env vars below before running, or export them in your shell
# =============================================================================

set -euo pipefail

# ---------------------------------------------------------------------------
# CONFIGURE THESE TWO VALUES before running
# Either export them in your shell, or set them inline when calling the script:
#
#   RAILWAY_DATABASE_URL='postgresql://...' \
#   TARGET_DATABASE_URL='postgresql://...' \
#   ./scripts/migrate-from-railway.sh
# ---------------------------------------------------------------------------
RAILWAY_URL="${RAILWAY_DATABASE_URL:-}"
TARGET_URL="${TARGET_DATABASE_URL:-}"
# ---------------------------------------------------------------------------

DUMP_FILE="railway_time_entries_$(date +%Y%m%d_%H%M%S).sql"

# ── Validate inputs ─────────────────────────────────────────────────────────
if [[ -z "$RAILWAY_URL" ]]; then
  echo "❌  RAILWAY_DATABASE_URL is not set."
  echo "    Export it or set it inline:"
  echo "    RAILWAY_DATABASE_URL='postgresql://...' TARGET_DATABASE_URL='postgresql://...' ./scripts/migrate-from-railway.sh"
  exit 1
fi

if [[ -z "$TARGET_URL" ]]; then
  echo "❌  TARGET_DATABASE_URL is not set."
  echo "    Export it or set it inline:"
  echo "    RAILWAY_DATABASE_URL='postgresql://...' TARGET_DATABASE_URL='postgresql://...' ./scripts/migrate-from-railway.sh"
  exit 1
fi

# ── Check tools ──────────────────────────────────────────────────────────────
if ! command -v pg_dump &>/dev/null; then
  echo "❌  pg_dump not found. Install with: brew install libpq && brew link --force libpq"
  exit 1
fi
if ! command -v psql &>/dev/null; then
  echo "❌  psql not found. Install with: brew install libpq && brew link --force libpq"
  exit 1
fi

echo ""
echo "═══════════════════════════════════════════════════════"
echo "  Task Time Tracker — Railway → Your Postgres Migration"
echo "═══════════════════════════════════════════════════════"
echo ""

# ── Step 1: Dump from Railway ────────────────────────────────────────────────
echo "▶  Step 1/3  Dumping time_entries from Railway..."
pg_dump \
  --no-owner \
  --no-acl \
  --table=time_entries \
  --data-only \
  --column-inserts \
  "$RAILWAY_URL" \
  -f "$DUMP_FILE"

ROW_COUNT=$(grep -c "^INSERT INTO" "$DUMP_FILE" || true)
echo "   ✅  Dumped $ROW_COUNT rows → $DUMP_FILE"
echo ""

# ── Step 2: Ensure the table exists in the target DB ────────────────────────
echo "▶  Step 2/3  Ensuring time_entries table exists in target DB..."
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

# ── Step 3: Restore into target DB ──────────────────────────────────────────
echo "▶  Step 3/3  Restoring data into target DB..."
# pg_dump --column-inserts emits standard INSERT statements.
# We pipe the dump directly and ignore duplicate-key errors so the script is
# safe to re-run without creating duplicate rows.
psql "$TARGET_URL" \
  --set ON_ERROR_STOP=0 \
  --quiet \
  -f "$DUMP_FILE" 2>&1 \
  | grep -v "^$\|duplicate key" || true

echo "   ✅  Restore complete"
echo ""

# ── Summary ──────────────────────────────────────────────────────────────────
FINAL_COUNT=$(psql "$TARGET_URL" -t -c "SELECT COUNT(*) FROM time_entries;" | tr -d ' ')
echo "═══════════════════════════════════════════════════════"
echo "  Migration complete"
echo "  Rows in target DB: $FINAL_COUNT"
echo "  Dump file kept at: $DUMP_FILE"
echo "  (You can delete it once you've verified the data)"
echo "═══════════════════════════════════════════════════════"
echo ""
