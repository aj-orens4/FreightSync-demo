USE freightsync;

ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_photo MEDIUMTEXT NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone VARCHAR(30) NULL;

CREATE TABLE IF NOT EXISTS notifications (
  notification_id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  title VARCHAR(150) NOT NULL,
  message VARCHAR(500) NOT NULL,
  type ENUM('INFO','SUCCESS','WARNING','SECURITY','SUPPORT') NOT NULL DEFAULT 'INFO',
  link_url VARCHAR(255) NULL,
  is_read TINYINT(1) NOT NULL DEFAULT 0,
  date_created DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
  INDEX idx_notifications_user_read (user_id,is_read,date_created)
);

CREATE TABLE IF NOT EXISTS support_tickets (
  ticket_id INT AUTO_INCREMENT PRIMARY KEY,
  ticket_code VARCHAR(30) UNIQUE,
  created_by INT NOT NULL,
  category ENUM('Bug','Access Problem','Data Correction','Feature Request','Security Concern','Map/Route Problem','Schedule Problem','Tariff Problem','Other') NOT NULL DEFAULT 'Other',
  subject VARCHAR(180) NOT NULL,
  description TEXT NOT NULL,
  priority ENUM('Low','Medium','High','Urgent') NOT NULL DEFAULT 'Medium',
  status ENUM('Open','In Progress','Resolved','Closed') NOT NULL DEFAULT 'Open',
  assigned_to INT NULL,
  date_created DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  date_updated DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (created_by) REFERENCES users(user_id),
  FOREIGN KEY (assigned_to) REFERENCES users(user_id),
  INDEX idx_ticket_status (status,priority,date_created)
);

CREATE TABLE IF NOT EXISTS support_ticket_messages (
  message_id INT AUTO_INCREMENT PRIMARY KEY,
  ticket_id INT NOT NULL,
  user_id INT NOT NULL,
  message TEXT NOT NULL,
  date_created DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (ticket_id) REFERENCES support_tickets(ticket_id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(user_id),
  INDEX idx_ticket_messages (ticket_id,date_created)
);
