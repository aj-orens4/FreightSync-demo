#!/bin/bash
# SECURITY CONTROL: Backup & Recovery
# Dumps the FreightSync database to a timestamped .sql file.
#
# Usage:
#   ./backup.sh                (uses defaults below / environment variables)
#   DB_PASSWORD=yourpass ./backup.sh
#
# Restore a backup with:
#   mysql -u root -p freightsync < backups/freightsync_2026-09-27_143000.sql

set -e

DB_USER="${DB_USER:-root}"
DB_NAME="${DB_NAME:-freightsync}"
DB_HOST="${DB_HOST:-localhost}"
BACKUP_DIR="$(dirname "$0")/backups"
TIMESTAMP=$(date +"%Y-%m-%d_%H%M%S")
OUT_FILE="$BACKUP_DIR/${DB_NAME}_${TIMESTAMP}.sql"

mkdir -p "$BACKUP_DIR"

if [ -z "$DB_PASSWORD" ]; then
  echo "Enter MySQL password for user '$DB_USER' (input hidden):"
  mysqldump -u "$DB_USER" -p -h "$DB_HOST" "$DB_NAME" > "$OUT_FILE"
else
  mysqldump -u "$DB_USER" -p"$DB_PASSWORD" -h "$DB_HOST" "$DB_NAME" > "$OUT_FILE"
fi

echo "Backup written to: $OUT_FILE"

# Keep only the 10 most recent backups so this doesn't fill the disk over time.
cd "$BACKUP_DIR"
ls -1t "${DB_NAME}"_*.sql 2>/dev/null | tail -n +11 | xargs -r rm --
