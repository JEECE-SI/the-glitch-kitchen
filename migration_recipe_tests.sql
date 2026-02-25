-- ===============================
-- 1. Add missing 'settings' column to games table
-- ===============================
ALTER TABLE public.games
ADD COLUMN IF NOT EXISTS settings JSONB DEFAULT '{"annonce": 4, "contests": 7, "temps_libre": 9}'::jsonb;

-- ===============================
-- 2. RECIPE TESTS TABLE
-- Stores AI comparison attempts (max 3 per brigade)
-- ===============================

CREATE TABLE IF NOT EXISTS public.recipe_tests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    brigade_id UUID REFERENCES public.brigades(id) ON DELETE CASCADE,
    attempt_number INTEGER NOT NULL CHECK (attempt_number >= 1 AND attempt_number <= 3),
    global_score NUMERIC(5,2) DEFAULT 0,
    details JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    UNIQUE(brigade_id, attempt_number)
);

ALTER TABLE public.recipe_tests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read/write access" ON public.recipe_tests;
CREATE POLICY "Allow public read/write access" ON public.recipe_tests FOR ALL USING (true) WITH CHECK (true);

-- ENABLE REALTIME FOR LEADERBOARD (OBLIGATOIRE POUR LE RAFRAICHISSEMENT AUTO)
ALTER PUBLICATION supabase_realtime ADD TABLE public.recipe_tests;

-- FIX: ALTER COLUMN TYPE TO SUPPORT DECIMALS (since 100/3 etc creates floors)
ALTER TABLE public.recipe_tests ALTER COLUMN global_score TYPE NUMERIC(5,2);
