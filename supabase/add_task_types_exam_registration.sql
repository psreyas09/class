-- Migration: Add Exam and Registration to task_type enum
ALTER TYPE public.task_type ADD VALUE IF NOT EXISTS 'Exam';
ALTER TYPE public.task_type ADD VALUE IF NOT EXISTS 'Registration';
