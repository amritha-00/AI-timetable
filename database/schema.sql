-- =====================================================================
-- AI School Timetable Generator - Database Schema
-- Target: MySQL 5.7+/8.0 or MariaDB 10.2+ (XAMPP default)
-- Import this file in phpMyAdmin against a fresh `timetable_ai` database,
-- or run: mysql -u root timetable_ai < schema.sql
-- This mirrors the SQLAlchemy models in backend/app/models exactly.
-- =====================================================================

CREATE DATABASE IF NOT EXISTS timetable_ai CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE timetable_ai;

SET FOREIGN_KEY_CHECKS = 0;

-- ---------------------------------------------------------------------
-- teachers
-- ---------------------------------------------------------------------
DROP TABLE IF EXISTS teachers;
CREATE TABLE teachers (
    id                   INT AUTO_INCREMENT PRIMARY KEY,
    name                 VARCHAR(120) NOT NULL,
    email                VARCHAR(150) UNIQUE NULL,
    phone                VARCHAR(20) NULL,
    max_periods_per_day  INT NOT NULL DEFAULT 6,
    is_active            TINYINT(1) NOT NULL DEFAULT 1,
    created_at           DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------------------------------------------------------------------
-- subjects
-- ---------------------------------------------------------------------
DROP TABLE IF EXISTS subjects;
CREATE TABLE subjects (
    id       INT AUTO_INCREMENT PRIMARY KEY,
    name     VARCHAR(100) NOT NULL UNIQUE,
    code     VARCHAR(20) NOT NULL UNIQUE,
    is_lab   TINYINT(1) NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------------------------------------------------------------------
-- classes (grade + section)
-- ---------------------------------------------------------------------
DROP TABLE IF EXISTS classes;
CREATE TABLE classes (
    id               INT AUTO_INCREMENT PRIMARY KEY,
    grade            INT NOT NULL,
    section          VARCHAR(5) NOT NULL,
    strength         INT NOT NULL DEFAULT 40,
    -- Homeroom/class teacher - administrative metadata only (attendance,
    -- discipline, parent contact). Not used by the solver.
    class_teacher_id INT NULL,
    CONSTRAINT uq_grade_section UNIQUE (grade, section),
    CONSTRAINT fk_class_teacher FOREIGN KEY (class_teacher_id) REFERENCES teachers(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------------------------------------------------------------------
-- rooms
-- ---------------------------------------------------------------------
DROP TABLE IF EXISTS rooms;
CREATE TABLE rooms (
    id         INT AUTO_INCREMENT PRIMARY KEY,
    name       VARCHAR(50) NOT NULL UNIQUE,
    room_type  VARCHAR(20) NOT NULL DEFAULT 'classroom', -- classroom | lab | auditorium | sports
    capacity   INT NOT NULL DEFAULT 40
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------------------------------------------------------------------
-- days
-- ---------------------------------------------------------------------
DROP TABLE IF EXISTS days;
CREATE TABLE days (
    id           INT AUTO_INCREMENT PRIMARY KEY,
    name         VARCHAR(20) NOT NULL UNIQUE,
    order_index  INT NOT NULL UNIQUE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------------------------------------------------------------------
-- periods
-- ---------------------------------------------------------------------
DROP TABLE IF EXISTS periods;
CREATE TABLE periods (
    id             INT AUTO_INCREMENT PRIMARY KEY,
    period_number  INT NOT NULL UNIQUE,
    start_time     TIME NOT NULL,
    end_time       TIME NOT NULL,
    is_break       TINYINT(1) NOT NULL DEFAULT 0,
    label          VARCHAR(100) NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------------------------------------------------------------------
-- teacher_subjects (which teacher can teach which subject)
-- ---------------------------------------------------------------------
DROP TABLE IF EXISTS teacher_subjects;
CREATE TABLE teacher_subjects (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    teacher_id  INT NOT NULL,
    subject_id  INT NOT NULL,
    CONSTRAINT uq_teacher_subject UNIQUE (teacher_id, subject_id),
    CONSTRAINT fk_ts_teacher FOREIGN KEY (teacher_id) REFERENCES teachers(id) ON DELETE CASCADE,
    CONSTRAINT fk_ts_subject FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------------------------------------------------------------------
-- class_subject_requirements (periods/week per class+subject)
-- ---------------------------------------------------------------------
DROP TABLE IF EXISTS class_subject_requirements;
CREATE TABLE class_subject_requirements (
    id                INT AUTO_INCREMENT PRIMARY KEY,
    class_id          INT NOT NULL,
    subject_id        INT NOT NULL,
    periods_per_week  INT NOT NULL DEFAULT 1,
    -- Pinned teacher for this class+subject; NULL = solver picks any
    -- qualified teacher freely (see teacher_subjects).
    teacher_id        INT NULL,
    CONSTRAINT uq_class_subject UNIQUE (class_id, subject_id),
    CONSTRAINT fk_csr_class   FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE,
    CONSTRAINT fk_csr_subject FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE,
    CONSTRAINT fk_csr_teacher FOREIGN KEY (teacher_id) REFERENCES teachers(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------------------------------------------------------------------
-- constraints (LLM-parsed, structured constraint objects)
-- ---------------------------------------------------------------------
DROP TABLE IF EXISTS constraints;
CREATE TABLE constraints (
    id               INT AUTO_INCREMENT PRIMARY KEY,
    constraint_type  VARCHAR(40) NOT NULL, -- teacher_unavailable | teacher_preferred_slot |
                                            -- subject_time_preference | max_periods_per_day |
                                            -- no_consecutive | room_requirement
    raw_text         TEXT NOT NULL,
    payload          JSON NOT NULL,
    severity         VARCHAR(10) NOT NULL DEFAULT 'hard', -- hard | soft
    weight           FLOAT NOT NULL DEFAULT 1.0,
    is_active        TINYINT(1) NOT NULL DEFAULT 1,
    created_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------------------------------------------------------------------
-- timetables (generated versions)
-- ---------------------------------------------------------------------
DROP TABLE IF EXISTS timetables;
CREATE TABLE timetables (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    name        VARCHAR(150) NOT NULL,
    status      VARCHAR(20) NOT NULL DEFAULT 'draft', -- draft | generating | completed | failed
    score       FLOAT NULL,
    message     TEXT NULL,
    created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------------------------------------------------------------------
-- timetable_entries (one scheduled slot)
-- ---------------------------------------------------------------------
DROP TABLE IF EXISTS timetable_entries;
CREATE TABLE timetable_entries (
    id            INT AUTO_INCREMENT PRIMARY KEY,
    timetable_id  INT NOT NULL,
    class_id      INT NOT NULL,
    day_id        INT NOT NULL,
    period_id     INT NOT NULL,
    subject_id    INT NOT NULL,
    teacher_id    INT NOT NULL,
    room_id       INT NOT NULL,
    CONSTRAINT fk_te_timetable FOREIGN KEY (timetable_id) REFERENCES timetables(id) ON DELETE CASCADE,
    CONSTRAINT fk_te_class     FOREIGN KEY (class_id)     REFERENCES classes(id)    ON DELETE CASCADE,
    CONSTRAINT fk_te_day       FOREIGN KEY (day_id)       REFERENCES days(id)       ON DELETE CASCADE,
    CONSTRAINT fk_te_period    FOREIGN KEY (period_id)    REFERENCES periods(id)    ON DELETE CASCADE,
    CONSTRAINT fk_te_subject   FOREIGN KEY (subject_id)   REFERENCES subjects(id)   ON DELETE CASCADE,
    CONSTRAINT fk_te_teacher   FOREIGN KEY (teacher_id)   REFERENCES teachers(id)   ON DELETE CASCADE,
    CONSTRAINT fk_te_room      FOREIGN KEY (room_id)      REFERENCES rooms(id)      ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE INDEX idx_te_lookup ON timetable_entries (timetable_id, class_id, day_id, period_id);
CREATE INDEX idx_te_teacher_lookup ON timetable_entries (timetable_id, teacher_id, day_id, period_id);
CREATE INDEX idx_te_room_lookup ON timetable_entries (timetable_id, room_id, day_id, period_id);

SET FOREIGN_KEY_CHECKS = 1;
