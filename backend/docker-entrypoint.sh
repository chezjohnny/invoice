#!/bin/sh
# Apply migrations, then hand over to the server.
#
# Alembic runs on every start: the operation is idempotent, and it keeps the
# `git push` deployment self-contained — no manual step after pushing a commit
# that adds a migration.
set -e

echo "==> Applying Alembic migrations"
alembic upgrade head

echo "==> Starting: $*"
exec "$@"
