-- Run this against your EXISTING database to add personal calendar reminders
-- without losing any data you've already entered.
-- In MySQL Workbench: File > Open SQL Script > select this file > Ctrl+Shift+Enter

USE freightsync;

CREATE TABLE IF NOT EXISTS personal_reminders (
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
