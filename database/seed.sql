-- =====================================================================
-- AI School Timetable Generator - Sample Data (Indian school)
-- Run AFTER schema.sql. Safe to re-run: it clears these tables first.
-- =====================================================================

USE timetable_ai;
SET FOREIGN_KEY_CHECKS = 0;

TRUNCATE TABLE timetable_entries;
TRUNCATE TABLE timetables;
TRUNCATE TABLE constraints;
TRUNCATE TABLE class_subject_requirements;
TRUNCATE TABLE teacher_subjects;
TRUNCATE TABLE periods;
TRUNCATE TABLE days;
TRUNCATE TABLE rooms;
TRUNCATE TABLE classes;
TRUNCATE TABLE subjects;
TRUNCATE TABLE teachers;

SET FOREIGN_KEY_CHECKS = 1;

-- ---------------------------------------------------------------------
-- days: Monday - Saturday
-- ---------------------------------------------------------------------
INSERT INTO days (name, order_index) VALUES
('Monday', 1), ('Tuesday', 2), ('Wednesday', 3),
('Thursday', 4), ('Friday', 5), ('Saturday', 6);

-- ---------------------------------------------------------------------
-- periods: 8 teaching periods (1-4 morning, 5-8 afternoon) + 1 lunch break
-- (period_number 9 is the break; it sits chronologically between 4 and 5)
-- ---------------------------------------------------------------------
INSERT INTO periods (period_number, start_time, end_time, is_break, label) VALUES
(1, '08:00:00', '08:40:00', 0, 'Period 1'),
(2, '08:40:00', '09:20:00', 0, 'Period 2'),
(3, '09:20:00', '10:00:00', 0, 'Period 3'),
(4, '10:00:00', '10:40:00', 0, 'Period 4'),
(9, '10:40:00', '11:10:00', 1, 'Lunch Break'),
(5, '11:10:00', '11:50:00', 0, 'Period 5'),
(6, '11:50:00', '12:30:00', 0, 'Period 6'),
(7, '12:30:00', '13:10:00', 0, 'Period 7'),
(8, '13:10:00', '13:50:00', 0, 'Period 8');

-- ---------------------------------------------------------------------
-- subjects
-- ---------------------------------------------------------------------
INSERT INTO subjects (name, code, is_lab) VALUES
('English', 'ENG', 0),
('Hindi', 'HIN', 0),
('Mathematics', 'MATH', 0),
('Science', 'SCI', 1),
('Social Studies', 'SST', 0),
('Computer Science', 'CS', 1),
('Physical Education', 'PE', 0),
('Art & Craft', 'ART', 0),
('Sanskrit', 'SANS', 0),
('General Knowledge', 'GK', 0);

-- ---------------------------------------------------------------------
-- classes: Grades 6-10, sections A & B (10 classes)
-- ---------------------------------------------------------------------
INSERT INTO classes (grade, section, strength) VALUES
(6, 'A', 42), (6, 'B', 40),
(7, 'A', 44), (7, 'B', 41),
(8, 'A', 39), (8, 'B', 43),
(9, 'A', 40), (9, 'B', 38),
(10, 'A', 36), (10, 'B', 37);

-- ---------------------------------------------------------------------
-- rooms: 10 classrooms + 4 labs
-- ---------------------------------------------------------------------
INSERT INTO rooms (name, room_type, capacity) VALUES
('Room-101', 'classroom', 45), ('Room-102', 'classroom', 45),
('Room-103', 'classroom', 45), ('Room-104', 'classroom', 45),
('Room-105', 'classroom', 45), ('Room-106', 'classroom', 45),
('Room-107', 'classroom', 45), ('Room-108', 'classroom', 45),
('Room-109', 'classroom', 45), ('Room-110', 'classroom', 45),
('Computer Lab 1', 'lab', 35), ('Computer Lab 2', 'lab', 35),
('Science Lab 1', 'lab', 30), ('Science Lab 2', 'lab', 30);

-- ---------------------------------------------------------------------
-- teachers (20)
-- ---------------------------------------------------------------------
INSERT INTO teachers (name, email, phone, max_periods_per_day, is_active) VALUES
('Anita Sharma',     'anita.sharma@school.edu',     '9800000001', 6, 1),
('Ramesh Gupta',     'ramesh.gupta@school.edu',     '9800000002', 6, 1),
('Priya Nair',       'priya.nair@school.edu',       '9800000003', 6, 1),
('Suresh Iyer',      'suresh.iyer@school.edu',      '9800000004', 6, 1),
('Kavita Rao',       'kavita.rao@school.edu',       '9800000005', 6, 1),
('Manoj Verma',      'manoj.verma@school.edu',      '9800000006', 6, 1),
('Deepa Menon',      'deepa.menon@school.edu',      '9800000007', 6, 1),
('Arjun Reddy',      'arjun.reddy@school.edu',      '9800000008', 6, 1),
('Sneha Kulkarni',   'sneha.kulkarni@school.edu',   '9800000009', 6, 1),
('Vikram Singh',     'vikram.singh@school.edu',     '9800000010', 6, 1),
('Pooja Joshi',      'pooja.joshi@school.edu',      '9800000011', 6, 1),
('Rajesh Pillai',    'rajesh.pillai@school.edu',    '9800000012', 6, 1),
('Neha Desai',       'neha.desai@school.edu',       '9800000013', 6, 1),
('Amit Kapoor',      'amit.kapoor@school.edu',      '9800000014', 6, 1),
('Divya Krishnan',   'divya.krishnan@school.edu',   '9800000015', 6, 1),
('Sanjay Mehta',     'sanjay.mehta@school.edu',     '9800000016', 6, 1),
('Lakshmi Pillai',   'lakshmi.pillai@school.edu',   '9800000017', 6, 1),
('Rohit Bhatt',      'rohit.bhatt@school.edu',      '9800000018', 6, 1),
('Meera Iyengar',    'meera.iyengar@school.edu',    '9800000019', 6, 1),
('Kiran Rao',        'kiran.rao@school.edu',        '9800000020', 6, 1);

-- ---------------------------------------------------------------------
-- teacher_subjects (qualifications) - by subject code lookup
-- Mathematics: Anita, Ramesh, Priya
-- Science:     Suresh, Kavita, Manoj
-- English:     Deepa, Arjun, Sneha
-- Hindi:       Vikram, Pooja
-- Social Studies: Rajesh, Neha
-- Computer Science: Amit, Divya
-- Physical Education: Sanjay, Lakshmi
-- Art & Craft: Rohit, Meera
-- Sanskrit: Meera, Kiran
-- General Knowledge: Rohit, Kiran
-- ---------------------------------------------------------------------
INSERT INTO teacher_subjects (teacher_id, subject_id)
SELECT t.id, s.id FROM teachers t, subjects s WHERE
  (t.name = 'Anita Sharma'   AND s.code = 'MATH') OR
  (t.name = 'Ramesh Gupta'   AND s.code = 'MATH') OR
  (t.name = 'Priya Nair'     AND s.code = 'MATH') OR
  (t.name = 'Suresh Iyer'    AND s.code = 'SCI')  OR
  (t.name = 'Kavita Rao'     AND s.code = 'SCI')  OR
  (t.name = 'Manoj Verma'    AND s.code = 'SCI')  OR
  (t.name = 'Deepa Menon'    AND s.code = 'ENG')  OR
  (t.name = 'Arjun Reddy'    AND s.code = 'ENG')  OR
  (t.name = 'Sneha Kulkarni' AND s.code = 'ENG')  OR
  (t.name = 'Vikram Singh'   AND s.code = 'HIN')  OR
  (t.name = 'Pooja Joshi'    AND s.code = 'HIN')  OR
  (t.name = 'Rajesh Pillai'  AND s.code = 'SST')  OR
  (t.name = 'Neha Desai'     AND s.code = 'SST')  OR
  (t.name = 'Amit Kapoor'    AND s.code = 'CS')   OR
  (t.name = 'Divya Krishnan' AND s.code = 'CS')   OR
  (t.name = 'Sanjay Mehta'   AND s.code = 'PE')   OR
  (t.name = 'Lakshmi Pillai' AND s.code = 'PE')   OR
  (t.name = 'Rohit Bhatt'    AND s.code = 'ART')  OR
  (t.name = 'Meera Iyengar'  AND s.code = 'ART')  OR
  (t.name = 'Meera Iyengar'  AND s.code = 'SANS') OR
  (t.name = 'Kiran Rao'      AND s.code = 'SANS') OR
  (t.name = 'Rohit Bhatt'    AND s.code = 'GK')   OR
  (t.name = 'Kiran Rao'      AND s.code = 'GK');

-- ---------------------------------------------------------------------
-- class_subject_requirements: same weekly load applied to every class
-- (38 periods/week used out of 48 available slots, leaving solver slack)
-- ---------------------------------------------------------------------
INSERT INTO class_subject_requirements (class_id, subject_id, periods_per_week)
SELECT c.id, s.id,
  CASE s.code
    WHEN 'MATH' THEN 6
    WHEN 'SCI'  THEN 6
    WHEN 'ENG'  THEN 5
    WHEN 'HIN'  THEN 4
    WHEN 'SST'  THEN 4
    WHEN 'CS'   THEN 3
    WHEN 'PE'   THEN 3
    WHEN 'ART'  THEN 2
    WHEN 'SANS' THEN 3
    WHEN 'GK'   THEN 2
  END
FROM classes c, subjects s;

-- ---------------------------------------------------------------------
-- class_teacher assignments (homeroom teacher per class) - administrative
-- only, not used by the solver. One teacher per class, spread across staff.
-- ---------------------------------------------------------------------
UPDATE classes c
JOIN teachers t ON t.name = CASE
    WHEN c.grade = 6  AND c.section = 'A' THEN 'Anita Sharma'
    WHEN c.grade = 6  AND c.section = 'B' THEN 'Deepa Menon'
    WHEN c.grade = 7  AND c.section = 'A' THEN 'Suresh Iyer'
    WHEN c.grade = 7  AND c.section = 'B' THEN 'Vikram Singh'
    WHEN c.grade = 8  AND c.section = 'A' THEN 'Rajesh Pillai'
    WHEN c.grade = 8  AND c.section = 'B' THEN 'Kavita Rao'
    WHEN c.grade = 9  AND c.section = 'A' THEN 'Sanjay Mehta'
    WHEN c.grade = 9  AND c.section = 'B' THEN 'Meera Iyengar'
    WHEN c.grade = 10 AND c.section = 'A' THEN 'Priya Nair'
    WHEN c.grade = 10 AND c.section = 'B' THEN 'Arjun Reddy'
END
SET c.class_teacher_id = t.id;
