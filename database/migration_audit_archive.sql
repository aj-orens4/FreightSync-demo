-- Run once on an existing FreightSync database. Safe on MySQL 8+ when column does not exist.
ALTER TABLE audit_logs ADD COLUMN is_archived TINYINT(1) NOT NULL DEFAULT 0 AFTER ip_address;
CREATE INDEX idx_audit_archived ON audit_logs (is_archived, date_created);
