#!/usr/bin/env bash
# Applies the migrations to a throwaway local Postgres database with Supabase
# stubs, then runs the policy tests.  Usage: PGHOST=... PGPORT=... ./supabase/tests/run.sh
set -euo pipefail
cd "$(dirname "$0")/../.."
DB=typequest_test
dropdb --if-exists "$DB" >/dev/null 2>&1 || true
createdb "$DB"
psql -q -v ON_ERROR_STOP=1 -d "$DB" -f supabase/tests/stub-supabase.sql
for f in supabase/migrations/*.sql; do psql -q -v ON_ERROR_STOP=1 -d "$DB" -f "$f"; done
for t in supabase/tests/policies.sql supabase/tests/challenges.sql supabase/tests/games.sql; do
  echo "== $t"
  psql -d "$DB" -f "$t"
done
