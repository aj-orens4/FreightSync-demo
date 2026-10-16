USE freightsync;

-- Service Providers
INSERT INTO service_providers (provider_code, provider_name, contact_email, contact_phone) VALUES
 ('SP-001', 'Luzon Express Freight', 'contact@luzonexpress.ph', '0917-000-0001'),
 ('SP-002', 'Northbound Logistics Inc.', 'ops@northbound.ph', '0917-000-0002');

-- Users (password_hash below = bcrypt hash of "Password123!" — replace via seed script in production)
INSERT INTO users (username, email, password_hash, full_name, role_id, provider_id) VALUES
 ('admin',        'admin@fms.local',      '$2b$10$replaceWithRealBcryptHash', 'System Administrator', 1, NULL),
 ('lmanager',     'lmanager@fms.local',   '$2b$10$replaceWithRealBcryptHash', 'Lea Manager',          2, NULL),
 ('rplanner',     'rplanner@fms.local',   '$2b$10$replaceWithRealBcryptHash', 'Ryan Planner',         3, NULL),
 ('opscoord',     'opscoord@fms.local',   '$2b$10$replaceWithRealBcryptHash', 'Oscar Coordinator',    4, NULL),
 ('spadmin1',     'spadmin1@fms.local',   '$2b$10$replaceWithRealBcryptHash', 'Provider Admin 1',     5, 1);

-- Routes
INSERT INTO routes (route_code, route_name, origin, destination, total_distance_km, estimated_travel_min, route_status, provider_id, created_by) VALUES
 ('RT-0001', 'Manila - Baguio Freight Line', 'Manila', 'Baguio', 250.00, 300, 'Active', 1, 3),
 ('RT-0002', 'Manila - Batangas Port Line', 'Manila', 'Batangas', 110.00, 150, 'Active', 2, 3);

INSERT INTO route_stops (route_id, stop_name, sequence_no, distance_from_origin_km, latitude, longitude) VALUES
 (1, 'Manila', 1, 0, 14.5995, 120.9842),
 (1, 'San Fernando, Pampanga', 2, 70, 15.0286, 120.6898),
 (1, 'Baguio', 3, 250, 16.4023, 120.5960),
 (2, 'Manila', 1, 0, 14.5995, 120.9842),
 (2, 'Batangas City', 2, 110, 13.7565, 121.0583);

-- Tariffs
INSERT INTO tariffs (tariff_code, service_type, vehicle_type, weight_min_kg, weight_max_kg, distance_min_km, distance_max_km, base_rate, additional_charges, fuel_surcharge, effective_date, status, created_by) VALUES
 ('TR-0001', 'Standard Freight', '6-Wheeler Truck', 0, 1000, 0, 300, 5000.00, 500.00, 300.00, '2026-01-01', 'Approved', 2),
 ('TR-0002', 'Express Freight', '10-Wheeler Truck', 1000, 5000, 0, 300, 9000.00, 800.00, 500.00, '2026-01-01', 'Draft', 2);

-- SOPs
INSERT INTO sops (sop_code, sop_title, category, description, author_id, approval_status) VALUES
 ('SOP-0001', 'Route Deviation Handling Procedure', 'Route Handling', 'Steps for handling unplanned route deviations due to road closures.', 3, 'Published'),
 ('SOP-0002', 'Cargo Damage Reporting SOP', 'Safety', 'Procedure for reporting and documenting cargo damage in transit.', 3, 'Draft');

-- Schedules
INSERT INTO schedules (schedule_code, route_id, departure_location, arrival_location, departure_time, arrival_time, vehicle_code, provider_id, status, created_by) VALUES
 ('SC-0001', 1, 'Manila', 'Baguio', '2026-07-20 06:00:00', '2026-07-20 11:00:00', 'TRK-101', 1, 'Scheduled', 3),
 ('SC-0002', 2, 'Manila', 'Batangas City', '2026-07-20 08:00:00', '2026-07-20 10:30:00', 'TRK-202', 2, 'Scheduled', 3);
