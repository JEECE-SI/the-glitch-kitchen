-- ==========================================
-- MIGRATION: Add missing columns to recipe_notes
-- These columns were defined in the schema but never applied
-- Run this in the Supabase SQL Editor
-- ==========================================

ALTER TABLE public.recipe_notes
  ADD COLUMN IF NOT EXISTS ingredient VARCHAR(255) DEFAULT '',
  ADD COLUMN IF NOT EXISTS technique  VARCHAR(255) DEFAULT '',
  ADD COLUMN IF NOT EXISTS tool       VARCHAR(255) DEFAULT '';
