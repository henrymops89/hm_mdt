-- hm_mdt SQL Installation Script
-- Run this once to set up all required MDT tables
-- Keine Abhängigkeit von hm_policemanager oder anderen Resources — hm_mdt läuft
-- vollständig eigenständig direkt auf dem Framework-Job (via hm_lib).

-- citizenid ist bewusst der alleinige PRIMARY KEY (kein separates `id`), passend
-- zum Schema aus server/core/migrations.lua — kein Code greift auf eine .id-Spalte zu.
CREATE TABLE IF NOT EXISTS `hm_mdt_profiles` (
    `citizenid`      VARCHAR(50)   NOT NULL,
    `name`           VARCHAR(100)  NOT NULL DEFAULT '',
    `firstname`      VARCHAR(50)   NULL,
    `lastname`       VARCHAR(50)   NULL,
    `dob`            VARCHAR(20)   NULL,
    `phone`          VARCHAR(20)   NULL,
    `gender`         VARCHAR(20)   NOT NULL DEFAULT 'male',
    `nationality`    VARCHAR(50)   NOT NULL DEFAULT '',
    `job`            VARCHAR(80)   NULL,
    `status`         VARCHAR(20)   NOT NULL DEFAULT 'neutral',
    `image_url`      TEXT          NULL,
    `notes`          TEXT          NULL,
    `license_status` VARCHAR(20)   NOT NULL DEFAULT 'valid',
    `wanted_level`   TINYINT       NOT NULL DEFAULT 0,
    `created_at`     INT           NOT NULL DEFAULT 0,
    `updated_at`     INT           NOT NULL DEFAULT 0,
    PRIMARY KEY (`citizenid`),
    INDEX `idx_name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `hm_mdt_records` (
    `id`          INT           NOT NULL AUTO_INCREMENT,
    `citizenid`   VARCHAR(50)   NOT NULL,
    `type`        VARCHAR(20)   NOT NULL DEFAULT 'citation',
    `title`       VARCHAR(200)  NOT NULL,
    `description` TEXT          NULL,
    `fine`        INT           NOT NULL DEFAULT 0,
    `jail_time`   INT           NOT NULL DEFAULT 0,
    `officer`     VARCHAR(100)  NULL,
    `dept`        VARCHAR(50)   NULL,
    `edit_log`    VARCHAR(200)  NULL,
    `timestamp`   INT           NOT NULL DEFAULT 0,
    PRIMARY KEY (`id`),
    INDEX `idx_citizenid` (`citizenid`),
    INDEX `idx_timestamp` (`timestamp`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `hm_mdt_notes` (
    `id`          INT           NOT NULL AUTO_INCREMENT,
    `citizenid`   VARCHAR(50)   NOT NULL,
    `title`       VARCHAR(200)  NOT NULL,
    `content`     TEXT          NULL,
    `tag`         VARCHAR(30)   NULL,
    `expire_at`   VARCHAR(30)   NULL,
    `officer`     VARCHAR(100)  NULL,
    `created_at`  INT           NOT NULL DEFAULT 0,
    PRIMARY KEY (`id`),
    INDEX `idx_citizenid` (`citizenid`),
    INDEX `idx_created` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `hm_mdt_licenses` (
    `id`          INT           NOT NULL AUTO_INCREMENT,
    `citizenid`   VARCHAR(50)   NOT NULL,
    `type`        VARCHAR(50)   NOT NULL DEFAULT 'driving',
    `status`      VARCHAR(20)   NOT NULL DEFAULT 'valid',
    `issued_date` VARCHAR(20)   NULL,
    `expire_date` VARCHAR(20)   NULL,
    `officer`     VARCHAR(100)  NULL,
    `edit_log`    VARCHAR(200)  NULL,
    `created_at`  INT           NOT NULL DEFAULT 0,
    PRIMARY KEY (`id`),
    INDEX `idx_citizenid` (`citizenid`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `hm_mdt_vehicles` (
    `id`            INT           NOT NULL AUTO_INCREMENT,
    `plate`         VARCHAR(20)   NOT NULL,
    `citizenid`     VARCHAR(50)   NULL,
    `model`         VARCHAR(50)   NULL,
    `color`         VARCHAR(50)   NULL,
    `vehicle_class` VARCHAR(30)   NULL,
    `status`        VARCHAR(20)   NOT NULL DEFAULT 'clean',
    `stolen`        TINYINT(1)    NOT NULL DEFAULT 0,
    `flags`         VARCHAR(200)  NULL,
    `notes`         TEXT          NULL,
    `edit_log`      VARCHAR(200)  NULL,
    `image_url`     TEXT          NULL,
    `created_at`    INT           NOT NULL DEFAULT 0,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_plate` (`plate`),
    INDEX `idx_citizenid` (`citizenid`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `hm_mdt_vehicle_notes` (
    `id`          INT           NOT NULL AUTO_INCREMENT,
    `plate`       VARCHAR(20)   NOT NULL,
    `title`       VARCHAR(200)  NOT NULL,
    `content`     TEXT          NULL,
    `tag`         VARCHAR(30)   NULL,
    `expire_at`   VARCHAR(30)   NULL,
    `officer`     VARCHAR(100)  NULL,
    `created_at`  INT           NOT NULL DEFAULT 0,
    PRIMARY KEY (`id`),
    INDEX `idx_plate` (`plate`),
    INDEX `idx_created` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `hm_mdt_properties` (
    `id`          INT           NOT NULL AUTO_INCREMENT,
    `address`     VARCHAR(200)  NOT NULL,
    `owner_cid`   VARCHAR(50)   NULL,
    `owner_name`  VARCHAR(100)  NULL,
    `type`        VARCHAR(30)   NOT NULL DEFAULT 'house',
    `status`      VARCHAR(20)   NOT NULL DEFAULT 'clear',
    `flags`       VARCHAR(200)  NULL,
    `notes`       TEXT          NULL,
    `officer`     VARCHAR(100)  NULL,
    `edit_log`    VARCHAR(200)  NULL,
    `image_url`   TEXT          NULL,
    `created_at`  INT           NOT NULL DEFAULT 0,
    PRIMARY KEY (`id`),
    INDEX `idx_owner` (`owner_cid`),
    INDEX `idx_address` (`address`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `hm_mdt_property_notes` (
    `id`          INT           NOT NULL AUTO_INCREMENT,
    `property_id` INT           NOT NULL,
    `title`       VARCHAR(200)  NOT NULL,
    `content`     TEXT          NULL,
    `tag`         VARCHAR(30)   NULL,
    `expire_at`   VARCHAR(30)   NULL,
    `officer`     VARCHAR(100)  NULL,
    `created_at`  INT           NOT NULL DEFAULT 0,
    PRIMARY KEY (`id`),
    INDEX `idx_property` (`property_id`),
    INDEX `idx_created` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `hm_mdt_weapons` (
    `id`            INT           NOT NULL AUTO_INCREMENT,
    `serial_number` VARCHAR(50)   NOT NULL,
    `owner_cid`     VARCHAR(50)   NULL,
    `owner_name`    VARCHAR(100)  NULL,
    `weapon_type`   VARCHAR(80)   NOT NULL DEFAULT '',
    `status`        VARCHAR(20)   NOT NULL DEFAULT 'registered',
    `flags`         VARCHAR(200)  NULL,
    `notes`         TEXT          NULL,
    `officer`       VARCHAR(100)  NULL,
    `edit_log`      VARCHAR(200)  NULL,
    `created_at`    INT           NOT NULL DEFAULT 0,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_serial` (`serial_number`),
    INDEX `idx_owner` (`owner_cid`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `hm_mdt_evidences` (
    `id`              INT           NOT NULL AUTO_INCREMENT,
    `evidence_number` VARCHAR(30)   NULL,
    `case_id`         VARCHAR(50)   NULL,
    `type`            VARCHAR(30)   NOT NULL DEFAULT 'physical',
    `title`           VARCHAR(200)  NOT NULL,
    `description`     TEXT          NULL,
    `location`        VARCHAR(200)  NULL,
    `image_url`       TEXT          NULL,
    `citizenid`       VARCHAR(50)   NULL,
    `citizen_name`    VARCHAR(100)  NULL,
    `status`          VARCHAR(20)   NOT NULL DEFAULT 'active',
    `officer`         VARCHAR(100)  NULL,
    `dept`            VARCHAR(50)   NULL,
    `edit_log`        VARCHAR(200)  NULL,
    `created_at`      INT           NOT NULL DEFAULT 0,
    PRIMARY KEY (`id`),
    INDEX `idx_case` (`case_id`),
    INDEX `idx_citizenid` (`citizenid`),
    INDEX `idx_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `hm_warrants` (
    `id`          INT           NOT NULL AUTO_INCREMENT,
    `dept`        VARCHAR(50)   NOT NULL DEFAULT 'police',
    `subject`     VARCHAR(100)  NOT NULL,
    `charges`     TEXT          NULL,
    `issued_by`   VARCHAR(100)  NULL,
    `issued_date` VARCHAR(20)   NULL,
    `priority`    VARCHAR(20)   NOT NULL DEFAULT 'medium',
    `status`      VARCHAR(20)   NOT NULL DEFAULT 'active',
    `edit_log`    VARCHAR(200)  NULL,
    PRIMARY KEY (`id`),
    INDEX `idx_status` (`status`),
    INDEX `idx_dept` (`dept`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `hm_bolos` (
    `id`          INT           NOT NULL AUTO_INCREMENT,
    `dept`        VARCHAR(50)   NOT NULL DEFAULT 'police',
    `type`        VARCHAR(30)   NOT NULL DEFAULT 'vehicle',
    `title`       VARCHAR(200)  NOT NULL,
    `plate`       VARCHAR(20)   NULL,
    `description` TEXT          NULL,
    `last_seen`   VARCHAR(200)  NULL,
    `issued_by`   VARCHAR(100)  NULL,
    `issued_date` VARCHAR(20)   NULL,
    `edit_log`    VARCHAR(200)  NULL,
    PRIMARY KEY (`id`),
    INDEX `idx_dept` (`dept`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `hm_mdt_reports` (
    `id`           INT           NOT NULL AUTO_INCREMENT,
    `title`        VARCHAR(200)  NOT NULL,
    `type`         VARCHAR(30)   NOT NULL DEFAULT 'incident',
    `content`      TEXT          NULL,
    `citizenids`   VARCHAR(500)  NULL,
    `citizen_names` VARCHAR(500) NULL,
    `vehicles`     VARCHAR(500)  NULL,
    `officer`      VARCHAR(100)  NULL,
    `officer_cid`  VARCHAR(50)   NULL,
    `status`       VARCHAR(30)   NOT NULL DEFAULT 'draft',
    `location`     VARCHAR(300)  NULL,
    `occurred_at`  DATETIME      NULL,
    `created_at`   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at`   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    INDEX `idx_status` (`status`),
    INDEX `idx_officer` (`officer_cid`),
    FULLTEXT `ft_report` (`title`, `content`, `citizenids`, `vehicles`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `hm_mdt_audit_log` (
    `id`           INT           NOT NULL AUTO_INCREMENT,
    `entity_type`  VARCHAR(30)   NOT NULL,
    `entity_id`    VARCHAR(100)  NOT NULL,
    `action`       VARCHAR(30)   NOT NULL,
    `officer`      VARCHAR(100)  NULL,
    `officer_cid`  VARCHAR(50)   NULL,
    `details`      TEXT          NULL,
    `created_at`   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    INDEX `idx_entity` (`entity_type`, `entity_id`),
    INDEX `idx_officer` (`officer_cid`),
    INDEX `idx_created` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- BOLO Erweiterung: Bild-URL + Ablaufdatum
ALTER TABLE `hm_bolos` ADD COLUMN IF NOT EXISTS `image_url` VARCHAR(500) NULL AFTER `description`;
ALTER TABLE `hm_bolos` ADD COLUMN IF NOT EXISTS `expire_at` DATETIME NULL AFTER `image_url`;
ALTER TABLE `hm_bolos` ADD COLUMN IF NOT EXISTS `status` VARCHAR(20) NOT NULL DEFAULT 'active' AFTER `expire_at`;

CREATE TABLE IF NOT EXISTS `hm_mdt_cases` (
    `id`           INT           NOT NULL AUTO_INCREMENT,
    `case_number`  VARCHAR(30)   NOT NULL UNIQUE,
    `title`        VARCHAR(200)  NOT NULL,
    `type`         VARCHAR(30)   NOT NULL DEFAULT 'investigation',
    `description`  TEXT          NULL,
    `status`       VARCHAR(30)   NOT NULL DEFAULT 'open',
    `priority`     VARCHAR(20)   NOT NULL DEFAULT 'medium',
    `lead_officer` VARCHAR(100)  NULL,
    `lead_cid`     VARCHAR(50)   NULL,
    `image_url`    VARCHAR(500)  NULL,
    `created_at`   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at`   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    INDEX `idx_status` (`status`),
    INDEX `idx_lead` (`lead_cid`),
    FULLTEXT `ft_case` (`title`, `description`, `case_number`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `hm_mdt_case_links` (
    `id`        INT          NOT NULL AUTO_INCREMENT,
    `case_id`   INT          NOT NULL,
    `link_type` VARCHAR(30)  NOT NULL,
    `link_id`   VARCHAR(100) NOT NULL,
    `label`     VARCHAR(200) NULL,
    `role`      VARCHAR(50)  NULL,
    `added_by`  VARCHAR(100) NULL,
    `created_at` DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    INDEX `idx_case` (`case_id`),
    INDEX `idx_link` (`link_type`, `link_id`),
    CONSTRAINT `fk_case_link` FOREIGN KEY (`case_id`) REFERENCES `hm_mdt_cases` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `hm_mdt_case_notes` (
    `id`         INT           NOT NULL AUTO_INCREMENT,
    `case_id`    INT           NOT NULL,
    `title`      VARCHAR(200)  NOT NULL,
    `content`    TEXT          NULL,
    `tag`        VARCHAR(30)   NULL,
    `officer`    VARCHAR(100)  NULL,
    `created_at` DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    INDEX `idx_case` (`case_id`),
    CONSTRAINT `fk_case_note` FOREIGN KEY (`case_id`) REFERENCES `hm_mdt_cases` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `hm_mdt_penal_code` (
    `id`          INT           NOT NULL AUTO_INCREMENT,
    `offense_id`  VARCHAR(20)   NOT NULL UNIQUE,
    `category`    VARCHAR(100)  NOT NULL DEFAULT 'Sonstiges',
    `title`       VARCHAR(200)  NOT NULL,
    `description` TEXT          NULL,
    `type`        VARCHAR(20)   NOT NULL DEFAULT 'citation',
    `fine`        INT           NOT NULL DEFAULT 0,
    `jail`        INT           NOT NULL DEFAULT 0,
    `created_at`  DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at`  DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    INDEX `idx_category` (`category`),
    INDEX `idx_offense` (`offense_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `hm_mdt_judgments` (
    `id`           INT           NOT NULL AUTO_INCREMENT,
    `citizenid`    VARCHAR(50)   NOT NULL,
    `citizen_name` VARCHAR(100)  NULL,
    `charges`      TEXT          NOT NULL,
    `total_fine`   INT           NOT NULL DEFAULT 0,
    `total_jail`   INT           NOT NULL DEFAULT 0,
    `multiplier`   DECIMAL(3,2)  NOT NULL DEFAULT 1.00,
    `plea_deal`    TINYINT(1)    NOT NULL DEFAULT 0,
    `note`         TEXT          NULL,
    `officer`      VARCHAR(100)  NULL,
    `officer_cid`  VARCHAR(50)   NULL,
    `created_at`   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    INDEX `idx_citizen` (`citizenid`),
    INDEX `idx_officer` (`officer_cid`),
    INDEX `idx_created` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `hm_mdt_report_links` (
    `id`          INT          NOT NULL AUTO_INCREMENT,
    `report_id`   INT          NOT NULL,
    `link_type`   VARCHAR(30)  NOT NULL,
    `link_id`     VARCHAR(100) NOT NULL,
    `label`       VARCHAR(200) NULL,
    `role`        VARCHAR(50)  NULL,
    `added_by`    VARCHAR(100) NULL,
    `created_at`  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    INDEX `idx_report` (`report_id`),
    INDEX `idx_link` (`link_type`, `link_id`),
    CONSTRAINT `fk_report_link` FOREIGN KEY (`report_id`) REFERENCES `hm_mdt_reports` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `hm_mdt_access_roles` (
    `id`         INT           NOT NULL AUTO_INCREMENT,
    `role`       VARCHAR(50)   NOT NULL UNIQUE,
    `label`      VARCHAR(100)  NOT NULL,
    `tabs`       TEXT          NOT NULL,
    `actions`    TEXT          NOT NULL,
    `created_at` DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    INDEX `idx_role` (`role`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── Performance-Indizes ──────────────────────────────────────────────────────
ALTER TABLE `hm_warrants` ADD INDEX IF NOT EXISTS `idx_status` (`status`);
ALTER TABLE `hm_bolos` ADD INDEX IF NOT EXISTS `idx_status` (`status`);
ALTER TABLE `hm_mdt_profiles` ADD INDEX IF NOT EXISTS `idx_wanted` (`wanted_level`);
ALTER TABLE `hm_mdt_vehicles` ADD INDEX IF NOT EXISTS `idx_stolen` (`stolen`);
ALTER TABLE `hm_mdt_records` ADD INDEX IF NOT EXISTS `idx_type_time` (`type`, `timestamp`);
ALTER TABLE `hm_mdt_reports` ADD INDEX IF NOT EXISTS `idx_updated` (`updated_at`);
ALTER TABLE `hm_mdt_judgments` ADD INDEX IF NOT EXISTS `idx_created` (`created_at`);
ALTER TABLE `hm_mdt_evidences` ADD INDEX IF NOT EXISTS `idx_status` (`status`);
