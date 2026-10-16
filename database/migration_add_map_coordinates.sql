-- Run this against your EXISTING database to add map support without
-- losing any data you've already entered.
-- In MySQL Workbench: File > Open SQL Script > select this file > Ctrl+Shift+Enter

USE freightsync;

ALTER TABLE route_stops
  ADD COLUMN latitude DECIMAL(9,6) NULL AFTER distance_from_origin_km,
  ADD COLUMN longitude DECIMAL(9,6) NULL AFTER latitude;

-- Backfill coordinates for the original seeded demo stops (safe no-op if you
-- renamed/deleted them — matches by route_id + stop_name).
UPDATE route_stops SET latitude = 14.5995, longitude = 120.9842 WHERE route_id = 1 AND stop_name = 'Manila';
UPDATE route_stops SET latitude = 15.0286, longitude = 120.6898 WHERE route_id = 1 AND stop_name = 'San Fernando, Pampanga';
UPDATE route_stops SET latitude = 16.4023, longitude = 120.5960 WHERE route_id = 1 AND stop_name = 'Baguio';
UPDATE route_stops SET latitude = 14.5995, longitude = 120.9842 WHERE route_id = 2 AND stop_name = 'Manila';
UPDATE route_stops SET latitude = 13.7565, longitude = 121.0583 WHERE route_id = 2 AND stop_name = 'Batangas City';
