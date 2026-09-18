CREATE TABLE IF NOT EXISTS users (
  id CHAR(24) NOT NULL PRIMARY KEY,
  email VARCHAR(255) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  division VARCHAR(255) NOT NULL DEFAULT 'ICT',
  designation VARCHAR(255) NOT NULL DEFAULT '',
  role ENUM('super_admin', 'admin', 'record_management', 'user') NOT NULL DEFAULT 'user',
  active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  UNIQUE KEY uq_users_email (email),
  KEY idx_users_role_active (role, active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS forms (
  id CHAR(24) NOT NULL PRIMARY KEY,
  title VARCHAR(500) NOT NULL,
  ref_number VARCHAR(100) NOT NULL,
  effectivity VARCHAR(50) NOT NULL DEFAULT '',
  version VARCHAR(50) NOT NULL DEFAULT 'v1.0',
  fields JSON NOT NULL,
  signatories JSON NOT NULL,
  print_template LONGTEXT NOT NULL,
  print_template_image_path VARCHAR(1000) NULL,
  print_placements JSON NOT NULL,
  print_placement_font_size INT NOT NULL DEFAULT 10,
  work_procedure_name VARCHAR(500) NOT NULL DEFAULT '',
  work_procedure_path VARCHAR(1000) NULL,
  status ENUM('draft', 'pending_review', 'published', 'disapproved') NOT NULL DEFAULT 'draft',
  description TEXT NOT NULL,
  department VARCHAR(255) NOT NULL DEFAULT '',
  review_remarks TEXT NOT NULL,
  reviewed_by CHAR(24) NULL,
  reviewed_at DATETIME(3) NULL,
  submitted_for_review_at DATETIME(3) NULL,
  duplicated_from CHAR(24) NULL,
  created_by CHAR(24) NOT NULL,
  updated_by CHAR(24) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  UNIQUE KEY uq_forms_ref (ref_number),
  KEY idx_forms_status_updated (status, updated_at),
  KEY idx_forms_created_by (created_by),
  CONSTRAINT fk_forms_created_by FOREIGN KEY (created_by) REFERENCES users(id),
  CONSTRAINT fk_forms_updated_by FOREIGN KEY (updated_by) REFERENCES users(id),
  CONSTRAINT fk_forms_reviewed_by FOREIGN KEY (reviewed_by) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS tickets (
  id CHAR(24) NOT NULL PRIMARY KEY,
  ticket_number VARCHAR(64) NOT NULL,
  form_id CHAR(24) NOT NULL,
  form_title VARCHAR(500) NOT NULL,
  title VARCHAR(500) NOT NULL,
  description MEDIUMTEXT NOT NULL,
  creator_id CHAR(24) NOT NULL,
  creator_name VARCHAR(255) NOT NULL,
  creator_email VARCHAR(255) NOT NULL DEFAULT '',
  division VARCHAR(255) NOT NULL DEFAULT '',
  answers JSON NOT NULL,
  attachment_url VARCHAR(1000) NOT NULL DEFAULT '',
  attachment_name VARCHAR(500) NOT NULL DEFAULT '',
  attachment_mime_type VARCHAR(255) NOT NULL DEFAULT '',
  status ENUM(
    'pending_approval', 'approved', 'rejected', 'open', 'in_progress',
    'pending', 'resolved', 'closed', 'reopened'
  ) NOT NULL DEFAULT 'pending_approval',
  priority ENUM('low', 'medium', 'high', 'urgent') NOT NULL DEFAULT 'medium',
  rejection_reason TEXT NOT NULL,
  feedback_rating INT NULL,
  feedback_comment TEXT NOT NULL,
  feedback_submitted TINYINT(1) NOT NULL DEFAULT 0,
  client_confirmed TINYINT(1) NOT NULL DEFAULT 0,
  resolved_at DATETIME(3) NULL,
  closed_at DATETIME(3) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  UNIQUE KEY uq_tickets_number (ticket_number),
  KEY idx_tickets_status_updated (status, updated_at),
  KEY idx_tickets_creator_created (creator_id, created_at),
  KEY idx_tickets_form (form_id),
  CONSTRAINT fk_tickets_form FOREIGN KEY (form_id) REFERENCES forms(id),
  CONSTRAINT fk_tickets_creator FOREIGN KEY (creator_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS ticket_assignees (
  ticket_id CHAR(24) NOT NULL,
  user_id CHAR(24) NOT NULL,
  PRIMARY KEY (ticket_id, user_id),
  KEY idx_ticket_assignees_user (user_id),
  CONSTRAINT fk_ta_ticket FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE,
  CONSTRAINT fk_ta_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS conversations (
  id CHAR(24) NOT NULL PRIMARY KEY,
  type ENUM('direct', 'group', 'ticket') NOT NULL,
  direct_key VARCHAR(64) NULL,
  ticket_id CHAR(24) NULL,
  is_closed TINYINT(1) NOT NULL DEFAULT 0,
  closed_at DATETIME(3) NULL,
  title VARCHAR(500) NOT NULL DEFAULT '',
  is_global TINYINT(1) NOT NULL DEFAULT 0,
  last_message_at DATETIME(3) NULL,
  last_message_preview VARCHAR(500) NOT NULL DEFAULT '',
  last_sender_name VARCHAR(255) NOT NULL DEFAULT '',
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  UNIQUE KEY uq_conversations_direct_key (direct_key),
  UNIQUE KEY uq_conversations_ticket (ticket_id),
  KEY idx_conversations_global (is_global),
  CONSTRAINT fk_conversations_ticket FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS conversation_participants (
  conversation_id CHAR(24) NOT NULL,
  user_id CHAR(24) NOT NULL,
  PRIMARY KEY (conversation_id, user_id),
  KEY idx_cp_user (user_id),
  CONSTRAINT fk_cp_conversation FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
  CONSTRAINT fk_cp_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS conversation_messages (
  id CHAR(24) NOT NULL PRIMARY KEY,
  conversation_id CHAR(24) NOT NULL,
  sender_id CHAR(24) NOT NULL,
  sender_name VARCHAR(255) NOT NULL,
  sender_role VARCHAR(64) NOT NULL,
  body TEXT NOT NULL,
  mentions JSON NOT NULL,
  is_system TINYINT(1) NOT NULL DEFAULT 0,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  KEY idx_messages_conversation_created (conversation_id, created_at),
  CONSTRAINT fk_messages_conversation FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS activity_logs (
  id CHAR(24) NOT NULL PRIMARY KEY,
  actor_id CHAR(24) NULL,
  actor_name VARCHAR(255) NOT NULL DEFAULT 'System',
  action VARCHAR(100) NOT NULL,
  entity_type VARCHAR(64) NOT NULL,
  entity_id CHAR(24) NOT NULL,
  summary TEXT NOT NULL,
  meta JSON NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  KEY idx_activity_created (created_at),
  KEY idx_activity_entity (entity_type, entity_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS pokes (
  id CHAR(24) NOT NULL PRIMARY KEY,
  from_user_id CHAR(24) NOT NULL,
  to_user_id CHAR(24) NOT NULL,
  conversation_id CHAR(24) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  KEY idx_pokes_pair_created (from_user_id, to_user_id, created_at),
  KEY idx_pokes_to (to_user_id),
  CONSTRAINT fk_pokes_from FOREIGN KEY (from_user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_pokes_to FOREIGN KEY (to_user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
