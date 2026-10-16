-- =====================================================================
-- FREIGHT MANAGEMENT SYSTEM (FMS) — MODULE 9
-- Service Provider & Network Control
-- Database: MySQL 8.0+
-- =====================================================================

CREATE DATABASE IF NOT EXISTS freightsync
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE freightsync;

-- ---------------------------------------------------------------------
-- USERS & ROLES
-- ---------------------------------------------------------------------
CREATE TABLE roles (
    role_id       INT AUTO_INCREMENT PRIMARY KEY,
    role_name     VARCHAR(50) NOT NULL UNIQUE,
    description   VARCHAR(255)
);

INSERT INTO roles (role_name, description) VALUES
 ('ADMIN', 'System Administrator - full access'),
 ('LOGISTICS_MANAGER', 'Manages routes, tariffs, SOP approvals, schedules'),
 ('ROUTE_PLANNER', 'Route planning and schedule management'),
 ('OPERATIONS_COORDINATOR', 'Monitors timetables, reports delays'),
 ('SERVICE_PROVIDER_ADMIN', 'Manages own service/vehicle data');

CREATE TABLE service_providers (
    provider_id     INT AUTO_INCREMENT PRIMARY KEY,
    provider_code   VARCHAR(20) NOT NULL UNIQUE,
    provider_name   VARCHAR(150) NOT NULL,
    contact_email   VARCHAR(150),
    contact_phone   VARCHAR(30),
    status          ENUM('Active','Inactive') NOT NULL DEFAULT 'Active',
    date_created    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE users (
    user_id         INT AUTO_INCREMENT PRIMARY KEY,
    username        VARCHAR(50) NOT NULL UNIQUE,
    email           VARCHAR(150) NOT NULL UNIQUE,
    password_hash   VARCHAR(255) NOT NULL,
    full_name       VARCHAR(150) NOT NULL,
    role_id         INT NOT NULL,
    provider_id     INT NULL,                     -- set only for SERVICE_PROVIDER_ADMIN
    is_active       TINYINT(1) NOT NULL DEFAULT 1,
    must_change_password TINYINT(1) NOT NULL DEFAULT 0,
    date_created    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (role_id) REFERENCES roles(role_id),
    FOREIGN KEY (provider_id) REFERENCES service_providers(provider_id)
);

-- ---------------------------------------------------------------------
-- SERVICE NETWORK & ROUTE PLANNER
-- ---------------------------------------------------------------------
CREATE TABLE routes (
    route_id            INT AUTO_INCREMENT PRIMARY KEY,
    route_code           VARCHAR(20) NOT NULL UNIQUE,
    route_name           VARCHAR(150) NOT NULL,
    origin               VARCHAR(150) NOT NULL,
    destination          VARCHAR(150) NOT NULL,
    total_distance_km    DECIMAL(10,2) NOT NULL DEFAULT 0,
    estimated_travel_min INT NOT NULL DEFAULT 0,
    route_status         ENUM('Active','Inactive','Under Review','Discontinued') NOT NULL DEFAULT 'Under Review',
    provider_id          INT NULL,
    created_by           INT NULL,
    date_created         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    date_updated         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (provider_id) REFERENCES service_providers(provider_id),
    FOREIGN KEY (created_by) REFERENCES users(user_id),
    INDEX idx_routes_status (route_status),
    INDEX idx_routes_origin_dest (origin, destination)
);

CREATE TABLE route_stops (
    stop_id             INT AUTO_INCREMENT PRIMARY KEY,
    route_id            INT NOT NULL,
    stop_name           VARCHAR(150) NOT NULL,
    sequence_no         INT NOT NULL,
    distance_from_origin_km DECIMAL(10,2) NOT NULL DEFAULT 0,
    latitude            DECIMAL(9,6) NULL,
    longitude           DECIMAL(9,6) NULL,
    FOREIGN KEY (route_id) REFERENCES routes(route_id) ON DELETE CASCADE,
    UNIQUE KEY uq_route_sequence (route_id, sequence_no)
);

-- ---------------------------------------------------------------------
-- RATE & TARIFF MANAGEMENT
-- ---------------------------------------------------------------------
CREATE TABLE tariffs (
    tariff_id           INT AUTO_INCREMENT PRIMARY KEY,
    tariff_code          VARCHAR(20) NOT NULL UNIQUE,
    service_type         VARCHAR(100) NOT NULL,
    vehicle_type          VARCHAR(100) NOT NULL,
    weight_min_kg         DECIMAL(10,2) NOT NULL,
    weight_max_kg         DECIMAL(10,2) NOT NULL,
    distance_min_km       DECIMAL(10,2) NOT NULL,
    distance_max_km       DECIMAL(10,2) NOT NULL,
    base_rate             DECIMAL(12,2) NOT NULL,
    additional_charges    DECIMAL(12,2) NOT NULL DEFAULT 0,
    fuel_surcharge        DECIMAL(12,2) NOT NULL DEFAULT 0,
    total_freight_cost    DECIMAL(12,2) GENERATED ALWAYS AS (base_rate + additional_charges + fuel_surcharge) STORED,
    effective_date        DATE NOT NULL,
    expiration_date        DATE NULL,
    status                ENUM('Draft','Pending Approval','Approved','Rejected','Archived') NOT NULL DEFAULT 'Draft',
    created_by             INT NULL,
    approved_by             INT NULL,
    date_created            DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    date_updated            DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by) REFERENCES users(user_id),
    FOREIGN KEY (approved_by) REFERENCES users(user_id),
    INDEX idx_tariffs_status (status),
    INDEX idx_tariffs_service_vehicle (service_type, vehicle_type)
);

CREATE TABLE tariff_history (
    history_id            INT AUTO_INCREMENT PRIMARY KEY,
    tariff_id              INT NOT NULL,
    snapshot_json           JSON NOT NULL,        -- full row snapshot prior to change
    changed_by               INT NULL,
    change_reason             VARCHAR(255),
    date_recorded             DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (tariff_id) REFERENCES tariffs(tariff_id) ON DELETE CASCADE,
    FOREIGN KEY (changed_by) REFERENCES users(user_id)
);

-- ---------------------------------------------------------------------
-- SOP MANAGER
-- ---------------------------------------------------------------------
CREATE TABLE sops (
    sop_id                 INT AUTO_INCREMENT PRIMARY KEY,
    sop_code                VARCHAR(20) NOT NULL UNIQUE,
    sop_title                VARCHAR(200) NOT NULL,
    category                  VARCHAR(100) NOT NULL,
    description                TEXT,
    version_number              INT NOT NULL DEFAULT 1,
    author_id                    INT NULL,
    approval_status               ENUM('Draft','Submitted','Approved','Rejected','Published','Archived') NOT NULL DEFAULT 'Draft',
    date_created                  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    date_updated                  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (author_id) REFERENCES users(user_id),
    INDEX idx_sops_category (category),
    INDEX idx_sops_status (approval_status),
    FULLTEXT KEY ft_sops_search (sop_title, description)
);

CREATE TABLE sop_versions (
    version_id             INT AUTO_INCREMENT PRIMARY KEY,
    sop_id                   INT NOT NULL,
    version_number             INT NOT NULL,
    snapshot_json               JSON NOT NULL,
    changed_by                   INT NULL,
    date_recorded                 DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (sop_id) REFERENCES sops(sop_id) ON DELETE CASCADE,
    FOREIGN KEY (changed_by) REFERENCES users(user_id)
);

CREATE TABLE sop_documents (
    document_id              INT AUTO_INCREMENT PRIMARY KEY,
    sop_id                     INT NOT NULL,
    file_name                    VARCHAR(255) NOT NULL,
    file_path                    VARCHAR(500) NOT NULL,
    uploaded_by                   INT NULL,
    date_uploaded                  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (sop_id) REFERENCES sops(sop_id) ON DELETE CASCADE,
    FOREIGN KEY (uploaded_by) REFERENCES users(user_id)
);

-- ---------------------------------------------------------------------
-- SCHEDULES & TRANSIT TIMETABLE MANAGEMENT
-- ---------------------------------------------------------------------
CREATE TABLE schedules (
    schedule_id               INT AUTO_INCREMENT PRIMARY KEY,
    schedule_code                VARCHAR(20) NOT NULL UNIQUE,
    route_id                       INT NOT NULL,
    departure_location               VARCHAR(150) NOT NULL,
    arrival_location                  VARCHAR(150) NOT NULL,
    departure_time                     DATETIME NOT NULL,
    arrival_time                        DATETIME NOT NULL,
    vehicle_code                          VARCHAR(50) NOT NULL,
    provider_id                            INT NULL,
    status                                   ENUM('Scheduled','In Transit','Delayed','Completed','Cancelled') NOT NULL DEFAULT 'Scheduled',
    created_by                                INT NULL,
    date_created                                DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    date_updated                                DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (route_id) REFERENCES routes(route_id),
    FOREIGN KEY (provider_id) REFERENCES service_providers(provider_id),
    FOREIGN KEY (created_by) REFERENCES users(user_id),
    INDEX idx_schedules_vehicle_time (vehicle_code, departure_time, arrival_time),
    INDEX idx_schedules_route (route_id),
    INDEX idx_schedules_status (status)
);

CREATE TABLE schedule_delays (
    delay_id                    INT AUTO_INCREMENT PRIMARY KEY,
    schedule_id                   INT NOT NULL,
    delay_reason                    VARCHAR(255) NOT NULL,
    original_arrival_time             DATETIME NOT NULL,
    revised_arrival_time                DATETIME NOT NULL,
    reported_by                           INT NULL,
    date_reported                          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (schedule_id) REFERENCES schedules(schedule_id) ON DELETE CASCADE,
    FOREIGN KEY (reported_by) REFERENCES users(user_id)
);

-- ---------------------------------------------------------------------
-- PERSONAL REMINDERS (private per-user calendar pins, separate from
-- operational schedules — powers the "pin a reminder" calendar feature)
-- ---------------------------------------------------------------------
CREATE TABLE personal_reminders (
    reminder_id    INT AUTO_INCREMENT PRIMARY KEY,
    user_id        INT NOT NULL,
    title          VARCHAR(150) NOT NULL,
    note           VARCHAR(500) DEFAULT '',
    remind_at      DATETIME NOT NULL,
    is_completed   TINYINT(1) NOT NULL DEFAULT 0,
    notified       TINYINT(1) NOT NULL DEFAULT 0,
    date_created   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    INDEX idx_reminders_user_time (user_id, remind_at)
);

-- ---------------------------------------------------------------------
-- AUDIT LOG (cross-cutting)
-- ---------------------------------------------------------------------
CREATE TABLE audit_logs (
    log_id                INT AUTO_INCREMENT PRIMARY KEY,
    user_id                 INT NULL,
    action                    VARCHAR(100) NOT NULL,      -- e.g. CREATE_ROUTE, APPROVE_TARIFF
    entity_type                VARCHAR(50) NOT NULL,       -- ROUTE, TARIFF, SOP, SCHEDULE, USER
    entity_id                    INT NULL,
    before_state                  JSON NULL,
    after_state                    JSON NULL,
    ip_address                       VARCHAR(45),
    date_created                      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id),
    INDEX idx_audit_entity (entity_type, entity_id),
    INDEX idx_audit_user (user_id)
);

-- ---------------------------------------------------------------------
-- SYSTEM COMPLETENESS: profile, notifications, support desk
-- ---------------------------------------------------------------------
ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_photo MEDIUMTEXT NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone VARCHAR(30) NULL;
CREATE TABLE IF NOT EXISTS notifications (
 notification_id INT AUTO_INCREMENT PRIMARY KEY, user_id INT NOT NULL, title VARCHAR(150) NOT NULL,
 message VARCHAR(500) NOT NULL, type ENUM('INFO','SUCCESS','WARNING','SECURITY','SUPPORT') NOT NULL DEFAULT 'INFO',
 link_url VARCHAR(255) NULL, is_read TINYINT(1) NOT NULL DEFAULT 0, date_created DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE, INDEX idx_notifications_user_read (user_id,is_read,date_created));
CREATE TABLE IF NOT EXISTS support_tickets (
 ticket_id INT AUTO_INCREMENT PRIMARY KEY, ticket_code VARCHAR(30) UNIQUE, created_by INT NOT NULL,
 category ENUM('Bug','Access Problem','Data Correction','Feature Request','Security Concern','Map/Route Problem','Schedule Problem','Tariff Problem','Other') NOT NULL DEFAULT 'Other',
 subject VARCHAR(180) NOT NULL, description TEXT NOT NULL, priority ENUM('Low','Medium','High','Urgent') NOT NULL DEFAULT 'Medium',
 status ENUM('Open','In Progress','Resolved','Closed') NOT NULL DEFAULT 'Open', assigned_to INT NULL,
 date_created DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, date_updated DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
 FOREIGN KEY (created_by) REFERENCES users(user_id), FOREIGN KEY (assigned_to) REFERENCES users(user_id), INDEX idx_ticket_status(status,priority,date_created));
CREATE TABLE IF NOT EXISTS support_ticket_messages (
 message_id INT AUTO_INCREMENT PRIMARY KEY, ticket_id INT NOT NULL, user_id INT NOT NULL, message TEXT NOT NULL,
 date_created DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY(ticket_id) REFERENCES support_tickets(ticket_id) ON DELETE CASCADE,
 FOREIGN KEY(user_id) REFERENCES users(user_id), INDEX idx_ticket_messages(ticket_id,date_created));
