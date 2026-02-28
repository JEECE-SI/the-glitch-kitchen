-- Migration: Add max_attempts column to brigades table
-- This allows admins/staff to grant additional test attempts to brigades

-- Add max_attempts column with default value of 3
ALTER TABLE public.brigades 
ADD COLUMN IF NOT EXISTS max_attempts INTEGER DEFAULT 3;

-- Update existing brigades to have max_attempts = 3
UPDATE public.brigades 
SET max_attempts = 3 
WHERE max_attempts IS NULL;

-- Add comment for documentation
COMMENT ON COLUMN public.brigades.max_attempts IS 'Maximum number of recipe test attempts allowed for this brigade (default: 3)';
